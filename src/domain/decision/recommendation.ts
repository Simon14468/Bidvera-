/**
 * Tender Decision Recommendation — explainable shell around the rule/fit engine.
 *
 * Does NOT recompute fit, readiness, or Bid Score formulas.
 * Decision Memory and learning signals may only appear as reference factors —
 * they never change the recommendation enum.
 */

import {
  localizeTenderDecisionLabel,
  toTenderDecisionLabel,
  type TenderDecisionLabel,
} from "@/domain/decision/labels";
import type { DecisionEngineOutput, DeterministicFinding } from "@/domain/decision/types";
import {
  CONFIRMED_NON_COMPLIANCE_FINDING_CODES,
  VERIFICATION_ONLY_FINDING_CODES,
} from "@/domain/risk/evidence-signals";
import type { DecisionMemoryInsightsBundle } from "@/domain/decision-memory";
import {
  formatCompanyEvidenceDisplay,
  formatSourceLocation,
} from "@/domain/provenance";
import type {
  ComplianceRow,
  ComplianceSummary,
} from "@/domain/tender-intelligence/types";
import type { DecisionTraceLink } from "@/domain/provenance/types";
import type { ConfidenceLevel, DecisionType } from "@prisma/client";
import { createHash } from "node:crypto";

export type DecisionFactorSource =
  | "RULE"
  | "FIT"
  | "REQUIREMENT"
  | "RISK"
  | "COMPLIANCE"
  | "DEADLINE"
  | "EVIDENCE"
  | "READINESS"
  | "MEMORY"
  | "AI"
  | "UNCERTAINTY";

export type DecisionReason = {
  code: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  text: string;
  source: DecisionFactorSource;
};

export type DecisionEvidenceRef = {
  kind: "requirement" | "finding" | "risk" | "blocker" | "deadline" | "memory";
  label: string;
  detail: string | null;
  requirementId?: string | null;
  evidenceId?: string | null;
  riskId?: string | null;
};

export type DecisionFactor = {
  key: string;
  label: string;
  value: string;
  influencedDecision: boolean;
  /** Explicit when Memory/history is cited — never overrides current evidence */
  referenceOnly?: boolean;
};

export type TenderDecisionRecommendation = {
  /** Storage enum — maps 1:1 to displayLabel */
  decision: DecisionType;
  displayLabel: TenderDecisionLabel;
  confidence: ConfidenceLevel;
  hardFailure: boolean;
  /** True when AI did not tip the final enum (rules/fit/evidence alone) */
  deterministic: boolean;
  reasons: DecisionReason[];
  /** Confirmed hard blockers only — never verification/uncertainty items. */
  criticalBlockers: string[];
  reviewItems: string[];
  decisionDrivers: string[];
  actionItems: string[];
  supportingEvidence: DecisionEvidenceRef[];
  /** Decision → reason → requirement/risk → evidence → source */
  decisionTrace: DecisionTraceLink[];
  factors: DecisionFactor[];
  /** Human-readable summary — same facts as structured fields */
  summary: string;
  /** Integrity fingerprint of inputs that produced this recommendation */
  contentHash: string;
  memoryNote: string | null;
  missingDataNotes: string[];
};

export type FinalizeDecisionInput = {
  engine: DecisionEngineOutput;
  /** Whether AI suggestion participated in the engine blend */
  aiParticipated: boolean;
  readiness?: {
    score: number | null;
    counts: { ready: number; missing: number; verify: number; unknown: number };
    attention: string[];
    recommendation: string;
  } | null;
  compliance?: ComplianceSummary | null;
  complianceMatrix?: ComplianceRow[] | null;
  keyBlockers?: string[];
  reviewItems?: string[];
  decisionDrivers?: string[];
  actionItems?: string[];
  structuredRiskTitles?: Array<{
    title: string;
    severity: string;
    /** Canonical evidence state — verification-only must not force NO_BID. */
    evidenceState?: string | null;
    fitStatus?: string | null;
  }>;
  deadline?: Date | null;
  asOf?: Date;
  memoryInsights?: DecisionMemoryInsightsBundle | null;
  /**
   * Unresolved team workflow summary — reference only.
   * Never changes the GO / CONDITIONAL GO / NO-BID enum.
   */
  teamWorkflow?: {
    openCriticalCount: number;
    openCount: number;
    titles: string[];
    note: string | null;
  } | null;
};

/**
 * Apply evidence-based refinements AFTER the core engine.
 * - Never invents facts
 * - Never upgrades to BID/GO
 * - Never lets Memory override current tender evidence
 * - Hard NO_BID always wins
 */
export function refineDecisionWithEvidence(
  input: FinalizeDecisionInput,
): {
  decision: DecisionType;
  confidence: ConfidenceLevel;
  refinementReasons: DecisionReason[];
  missingDataNotes: string[];
} {
  const { engine } = input;
  let decision = engine.decision;
  let confidence = engine.confidence;
  const refinementReasons: DecisionReason[] = [];
  const missingDataNotes: string[] = [];

  if (engine.hardFailure || decision === "NO_BID") {
    // Hard blockers already decided — do not soften with secondary evidence
    return {
      decision: engine.hardFailure ? "NO_BID" : decision,
      confidence: engine.hardFailure ? "HIGH" : confidence,
      refinementReasons,
      missingDataNotes,
    };
  }

  const mandatoryFailed = engine.failedRequirements.filter(
    (r) => r.mandatory && r.fitStatus === "CONFIRMED_GAP",
  );
  if (mandatoryFailed.length > 0 && decision === "BID") {
    decision = "REVIEW";
    if (confidence === "HIGH") confidence = "MEDIUM";
    refinementReasons.push({
      code: "MANDATORY_FAILED",
      severity: "HIGH",
      text: `${mandatoryFailed.length} mandatory requirement(s) failed company match — cannot recommend GO.`,
      source: "REQUIREMENT",
    });
  }

  const missingMandatory = engine.requirements.filter(
    (r) =>
      r.mandatory &&
      (r.fitStatus === "NEEDS_VERIFICATION" ||
        r.status === "MISSING" ||
        r.status === "UNCERTAIN"),
  );
  if (missingMandatory.length > 0 && decision === "BID") {
    decision = "REVIEW";
    if (confidence === "HIGH") confidence = "MEDIUM";
    refinementReasons.push({
      code: "MANDATORY_UNCERTAIN",
      severity: "MEDIUM",
      text: `${missingMandatory.length} mandatory requirement(s) require verification — CONDITIONAL GO pending evidence.`,
      source: "UNCERTAINTY",
    });
  }

  const readinessMissing = input.readiness?.counts.missing ?? 0;
  if (readinessMissing > 0 && decision === "BID") {
    decision = "REVIEW";
    if (confidence === "HIGH") confidence = "MEDIUM";
    refinementReasons.push({
      code: "READINESS_MISSING",
      severity: "HIGH",
      text: `Tender readiness shows ${readinessMissing} missing item(s) — CONDITIONAL GO until resolved.`,
      source: "READINESS",
    });
  }

  const complianceMissing = input.compliance?.missing ?? 0;
  if (complianceMissing > 0 && decision === "BID") {
    decision = "REVIEW";
    if (confidence === "HIGH") confidence = "MEDIUM";
    refinementReasons.push({
      code: "COMPLIANCE_MISSING",
      severity: "HIGH",
      text: `Compliance matrix has ${complianceMissing} missing requirement(s) — not a clean GO.`,
      source: "COMPLIANCE",
    });
  }

  // Consume canonical Risk layer only — NEEDS_VERIFICATION must not force NO_BID / auto-HIGH
  const criticalRisks = (input.structuredRiskTitles ?? []).filter((r) => {
    const sev = r.severity === "HIGH" || r.severity === "CRITICAL";
    if (!sev) return false;
    if (r.fitStatus === "NEEDS_VERIFICATION" || r.fitStatus === "NOT_APPLICABLE") {
      return false;
    }
    if (r.evidenceState && r.evidenceState !== "CONFIRMED_NON_COMPLIANT") {
      return false;
    }
    return true;
  });
  if (criticalRisks.length > 0 && decision === "BID") {
    decision = "REVIEW";
    if (confidence === "HIGH") confidence = "MEDIUM";
    refinementReasons.push({
      code: "HIGH_RISK_PRESENT",
      severity: "HIGH",
      text: `${criticalRisks.length} confirmed high/critical risk(s) identified — CONDITIONAL GO pending mitigation.`,
      source: "RISK",
    });
  }

  const asOf = input.asOf ?? new Date();
  if (input.deadline && !Number.isNaN(input.deadline.getTime())) {
    if (input.deadline.getTime() < asOf.getTime() && decision === "BID") {
      decision = "REVIEW";
      if (confidence === "HIGH") confidence = "MEDIUM";
      refinementReasons.push({
        code: "DEADLINE_PASSED",
        severity: "HIGH",
        text: "Submission deadline has passed — verify whether late submission is still possible before GO.",
        source: "DEADLINE",
      });
    }
  } else if (decision === "BID") {
    missingDataNotes.push(
      "Submission deadline not confirmed in tender data — treated as unknown (not assumed).",
    );
  }

  const hardBlockerCount = engine.hardBlockers?.length ?? 0;
  if (hardBlockerCount >= 2 && decision === "BID") {
    decision = "REVIEW";
    if (confidence === "HIGH") confidence = "MEDIUM";
    refinementReasons.push({
      code: "MULTIPLE_BLOCKERS",
      severity: "MEDIUM",
      text: `${hardBlockerCount} hard blocker(s) require resolution before a clean GO.`,
      source: "EVIDENCE",
    });
  }

  // Memory / history: NEVER change decision — only note if present
  if (input.memoryInsights?.matches.length) {
    missingDataNotes.push(
      "Decision Memory matches are reference only and did not change this recommendation.",
    );
  }

  // Team workflow: NEVER change decision — surface unresolved critical work only
  if (input.teamWorkflow?.note) {
    missingDataNotes.push(input.teamWorkflow.note);
  }

  return { decision, confidence, refinementReasons, missingDataNotes };
}

/**
 * Build a full explainable recommendation from engine output + optional evidence.
 */
export function buildTenderDecisionRecommendation(
  input: FinalizeDecisionInput,
): TenderDecisionRecommendation {
  const refined = refineDecisionWithEvidence(input);
  const { engine } = input;
  const decision = refined.decision;
  const displayLabel = toTenderDecisionLabel(decision);
  const complianceByReq = new Map(
    (input.complianceMatrix ?? []).map((row) => [row.requirementId, row]),
  );
  const reasons: DecisionReason[] = [];
  const supportingEvidence: DecisionEvidenceRef[] = [];
  const factors: DecisionFactor[] = [];
  const criticalBlockers: string[] = [];

  function requirementTraceDetail(requirementId: string | null | undefined, status: string): string {
    const row = requirementId ? complianceByReq.get(requirementId) : undefined;
    if (!row) {
      return `Status: ${status} · ${formatCompanyEvidenceDisplay(null)}`;
    }
    const tenderLoc = formatSourceLocation(row.tenderSource);
    const companyLine = formatCompanyEvidenceDisplay(row.companyEvidence);
    return `Status: ${status} · Tender source: ${tenderLoc} · Company evidence: ${companyLine}`;
  }

  // —— Rules / findings — confirmed non-compliance only as hard blockers ——
  const seenFindingIdentities = new Set<string>();
  function findingIdentity(f: { code: string; description: string }): string {
    return `${f.code}::${f.description.trim().toLowerCase().replace(/\s+/g, " ")}`;
  }

  for (const f of engine.findings) {
    if (f.forcesDecision === "NO_BID") {
      if (VERIFICATION_ONLY_FINDING_CODES.has(f.code)) {
        reasons.push({
          code: f.code,
          severity: "MEDIUM",
          text: f.description,
          source: "UNCERTAINTY",
        });
        continue;
      }
      if (!CONFIRMED_NON_COMPLIANCE_FINDING_CODES.has(f.code)) {
        reasons.push({
          code: f.code,
          severity: f.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
          text: f.description,
          source: "RULE",
        });
        continue;
      }
      const identity = findingIdentity(f);
      if (seenFindingIdentities.has(identity)) {
        continue;
      }
      seenFindingIdentities.add(identity);
      reasons.push({
        code: f.code,
        severity: "CRITICAL",
        text: f.description,
        source: "RULE",
      });
      criticalBlockers.push(f.description);
      supportingEvidence.push({
        kind: "finding",
        label: f.code,
        detail: f.description,
      });
    } else if (f.forcesDecision === "REVIEW") {
      reasons.push({
        code: f.code,
        severity: "MEDIUM",
        text: f.description,
        source: "RULE",
      });
      supportingEvidence.push({
        kind: "finding",
        label: f.code,
        detail: f.description,
      });
    } else if (f.severity === "HIGH" || f.severity === "CRITICAL") {
      reasons.push({
        code: f.code,
        severity: f.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
        text: f.description,
        source: "RISK",
      });
    }
  }

  for (const b of engine.hardBlockers ?? []) {
    if (!criticalBlockers.includes(b.description)) {
      criticalBlockers.push(b.description);
    }
  }

  // —— Fit ——
  const fit = engine.fitBreakdown;
  factors.push({
    key: "fit",
    label: "Company–Tender Fit",
    value:
      fit.scoringAvailable === false || fit.overall == null
        ? "UNAVAILABLE"
        : `${fit.overall}%`,
    influencedDecision: true,
  });
  for (const m of fit.matches.slice(0, 5)) {
    reasons.push({
      code: "FIT_MATCH",
      severity: "INFO",
      text: m,
      source: "FIT",
    });
    supportingEvidence.push({ kind: "requirement", label: "Fit match", detail: m });
  }
  for (const g of fit.gaps.slice(0, 5)) {
    reasons.push({
      code: "FIT_GAP",
      severity: "MEDIUM",
      text: g,
      source: "FIT",
    });
  }
  for (const u of fit.unknowns.slice(0, 4)) {
    reasons.push({
      code: "FIT_UNKNOWN",
      severity: "LOW",
      text: u,
      source: "UNCERTAINTY",
    });
  }

  // —— Requirements (canonical Fit) ——
  factors.push({
    key: "requirements",
    label: "Requirements",
    value: `${engine.matchedRequirements.length} matched · ${engine.failedRequirements.length} failed · ${engine.uncertainRequirements.length} uncertain/missing`,
    influencedDecision: true,
  });
  for (const r of engine.failedRequirements.filter((x) => x.mandatory && x.fitStatus === "CONFIRMED_GAP").slice(0, 5)) {
    const cmRow = r.id ? complianceByReq.get(r.id) : undefined;
    supportingEvidence.push({
      kind: "requirement",
      label: r.description.slice(0, 120),
      detail: requirementTraceDetail(r.id, r.status),
      requirementId: r.id ?? null,
      evidenceId: cmRow?.evidenceId ?? null,
    });
    if (!criticalBlockers.includes(r.description)) {
      criticalBlockers.push(`Mandatory confirmed gap: ${r.description.slice(0, 160)}`);
    }
  }
  // —— Refinement reasons ——
  reasons.push(...refined.refinementReasons);

  function uniqueStrings(list: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of list) {
      const key = s.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(s.trim());
    }
    return out;
  }
  for (const m of (engine.explainability?.supportingFits ?? []).slice(0, 5)) {
    supportingEvidence.push({
      kind: "requirement",
      label: m.description.slice(0, 120),
      detail: m.evidence ? `Confirmed fit evidence: ${m.evidence.slice(0, 120)}` : "CONFIRMED_FIT",
      requirementId: m.requirementId,
    });
  }

  // —— Readiness / compliance ——
  if (input.readiness) {
    factors.push({
      key: "readiness",
      label: "Tender Readiness",
      value:
        input.readiness.score == null
          ? "UNAVAILABLE"
          : `${input.readiness.score}% (${input.readiness.counts.ready} ready / ${input.readiness.counts.missing} missing / ${input.readiness.counts.verify} verify)`,
      influencedDecision: refined.refinementReasons.some(
        (r) => r.source === "READINESS",
      ),
    });
  }
  if (input.compliance) {
    factors.push({
      key: "compliance",
      label: "Compliance",
      value: `${input.compliance.totalRequirements} requirements · ${input.compliance.ready} ready · ${input.compliance.missing} missing · ${input.compliance.verify} verify`,
      influencedDecision: refined.refinementReasons.some(
        (r) => r.source === "COMPLIANCE",
      ),
    });
  }

  // —— Deadline ——
  if (input.deadline && !Number.isNaN(input.deadline.getTime())) {
    const passed =
      input.deadline.getTime() < (input.asOf ?? new Date()).getTime();
    factors.push({
      key: "deadline",
      label: "Submission deadline",
      value: `${input.deadline.toISOString()}${passed ? " (passed)" : ""}`,
      influencedDecision: refined.refinementReasons.some(
        (r) => r.code === "DEADLINE_PASSED",
      ),
    });
    supportingEvidence.push({
      kind: "deadline",
      label: "Deadline",
      detail: input.deadline.toISOString(),
    });
  } else {
    factors.push({
      key: "deadline",
      label: "Submission deadline",
      value: "Unknown — not confirmed in tender data",
      influencedDecision: false,
    });
  }

  // —— Severity buckets (canonical — not inflated into blockers) ——
  const reviewItems = uniqueStrings([
    ...(engine.explainability?.verificationItems ?? []).map((i) =>
      `Verification required: ${i.description.slice(0, 160)}`,
    ),
    ...(input.reviewItems ?? []),
  ]);
  const decisionDrivers = uniqueStrings([
    ...(input.decisionDrivers ?? []),
    ...refined.refinementReasons
      .filter((r) =>
        ["CONTRACT_SIZE_HIGH", "DEADLINE_PASSED", "HIGH_RISK_PRESENT", "FIT_GAP"].includes(
          r.code,
        ),
      )
      .map((r) => r.text),
  ]);
  const actionItems = uniqueStrings([
    ...(input.actionItems ?? []),
    ...(input.teamWorkflow?.titles ?? []),
  ]);

  for (const item of reviewItems.slice(0, 6)) {
    if (reasons.some((r) => r.text === item)) continue;
    reasons.push({
      code: "VERIFICATION_ITEM",
      severity: "MEDIUM",
      text: item,
      source: "UNCERTAINTY",
    });
  }

  for (const driver of decisionDrivers.slice(0, 6)) {
    reasons.push({
      code: "DECISION_DRIVER",
      severity: "MEDIUM",
      text: driver,
      source: "EVIDENCE",
    });
  }

  // —— Decision Memory (reference only) ——
  let memoryNote: string | null = null;
  if (input.memoryInsights?.matches.length) {
    memoryNote =
      input.memoryInsights.historicalNote ||
      "Historical Decision Memory is reference only — does not change Current Analysis.";
    const top = input.memoryInsights.matches[0]!;
    factors.push({
      key: "memory",
      label: "Decision Memory (reference)",
      value: `${top.decisionLabel}: ${top.title} (${input.memoryInsights.matches.length} relevant)`,
      influencedDecision: false,
      referenceOnly: true,
    });
    supportingEvidence.push({
      kind: "memory",
      label: `Historical ${top.decisionLabel}`,
      detail: `${top.title} — ${top.relevanceReasons.slice(0, 2).join("; ")}`,
    });
    reasons.push({
      code: "MEMORY_REFERENCE",
      severity: "INFO",
      text: `Similar prior decision (${top.decisionLabel}): ${top.title}. Reference only — current tender evidence prevails.`,
      source: "MEMORY",
    });
  }

  // —— Team workflow (reference only — never flips decision) ——
  if (input.teamWorkflow && input.teamWorkflow.openCount > 0) {
    factors.push({
      key: "team_workflow",
      label: "Team workflow (reference)",
      value: `${input.teamWorkflow.openCriticalCount} critical open · ${input.teamWorkflow.openCount} open total`,
      influencedDecision: false,
      referenceOnly: true,
    });
    if (input.teamWorkflow.note) {
      reasons.push({
        code: "TEAM_WORKFLOW_OPEN",
        severity: input.teamWorkflow.openCriticalCount > 0 ? "HIGH" : "INFO",
        text: input.teamWorkflow.note,
        source: "EVIDENCE",
      });
    }
    for (const title of input.teamWorkflow.titles.slice(0, 3)) {
      supportingEvidence.push({
        kind: "finding",
        label: "Open team task (action item)",
        detail: title,
      });
    }
  }

  // —— AI participation note ——
  const deterministic =
    !input.aiParticipated ||
    engine.hardFailure ||
    engine.findings.some((f) => f.forcesDecision === "NO_BID" || f.forcesDecision === "REVIEW");

  if (input.aiParticipated && !engine.hardFailure) {
    factors.push({
      key: "ai",
      label: "AI assessment",
      value: "Participated as secondary signal — not verified fact",
      influencedDecision: !deterministic,
    });
  }

  const missingDataNotes = [
    ...refined.missingDataNotes,
    ...fit.unknowns.slice(0, 3).map((u) => `Unknown: ${u}`),
  ];

  const summary = formatRecommendationSummary({
    displayLabel,
    decision,
    confidence: refined.confidence,
    fitScore: fit.overall,
    scoringAvailable: fit.scoringAvailable !== false,
    criticalBlockers,
    refinementReasons: refined.refinementReasons,
    memoryNote,
  });

  const contentHash = hashRecommendationInputs({
    decision,
    confidence: refined.confidence,
    hardFailure: engine.hardFailure,
    findingCodes: engine.findings.map((f) => f.code).sort(),
    fitOverall: fit.overall,
    matched: engine.matchedRequirements.length,
    failed: engine.failedRequirements.length,
    uncertain: engine.uncertainRequirements.length,
    readinessMissing: input.readiness?.counts.missing ?? null,
    complianceMissing: input.compliance?.missing ?? null,
    deadlineIso: input.deadline?.toISOString() ?? null,
    blockerCount: criticalBlockers.length,
    memoryIds: (input.memoryInsights?.matches ?? []).map((m) => m.memoryId).sort(),
  });

  const traceEvidence = supportingEvidence.slice(0, 12);
  const decisionTrace: DecisionTraceLink[] = traceEvidence.map((ev) => {
    const cmRow = ev.requirementId ? complianceByReq.get(ev.requirementId) : undefined;
    return {
      decision: displayLabel,
      reason: ev.detail ?? ev.label,
      requirementId: ev.requirementId ?? null,
      riskId: ev.riskId ?? null,
      evidenceId: ev.evidenceId ?? null,
      tenderSource: cmRow?.tenderSource ?? null,
      companyEvidence: cmRow?.companyEvidence ?? null,
    };
  });

  return {
    decision,
    displayLabel,
    confidence: refined.confidence,
    hardFailure: engine.hardFailure,
    deterministic,
    reasons,
    criticalBlockers: criticalBlockers.slice(0, 8),
    reviewItems: reviewItems.slice(0, 12),
    decisionDrivers: decisionDrivers.slice(0, 8),
    actionItems: actionItems.slice(0, 8),
    supportingEvidence: supportingEvidence.slice(0, 20),
    decisionTrace,
    factors,
    summary,
    contentHash,
    memoryNote,
    missingDataNotes: missingDataNotes.slice(0, 8),
  };
}

function formatRecommendationSummary(input: {
  displayLabel: TenderDecisionLabel;
  decision: DecisionType;
  confidence: ConfidenceLevel;
  fitScore: number | null;
  scoringAvailable: boolean;
  criticalBlockers: string[];
  refinementReasons: DecisionReason[];
  memoryNote: string | null;
}): string {
  const lines: string[] = [];
  const fitPart =
    !input.scoringAvailable || input.fitScore == null
      ? "Fit: UNAVAILABLE"
      : `Fit: ${input.fitScore}%`;
  lines.push(
    `Bidvera recommends ${input.displayLabel} (${localizeTenderDecisionLabel(input.decision, "en")}) — confidence ${input.confidence}. ${fitPart}.`,
  );
  if (input.criticalBlockers.length) {
    lines.push("Critical blockers:");
    for (const b of input.criticalBlockers.slice(0, 5)) lines.push(`• ${b}`);
  }
  if (input.refinementReasons.length) {
    lines.push("Evidence adjustments:");
    for (const r of input.refinementReasons) lines.push(`• ${r.text}`);
  }
  if (input.memoryNote) {
    lines.push(input.memoryNote);
  }
  return lines.join("\n");
}

function hashRecommendationInputs(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 24);
}

/** Validate recommendation is internally consistent with engine storage enum. */
export function assertRecommendationConsistency(
  rec: TenderDecisionRecommendation,
): void {
  if (toTenderDecisionLabel(rec.decision) !== rec.displayLabel) {
    throw new Error(
      `Decision/label mismatch: ${rec.decision} vs ${rec.displayLabel}`,
    );
  }
  if (rec.hardFailure && rec.decision !== "NO_BID") {
    throw new Error("Hard failure must yield NO-BID");
  }
  if (
    rec.factors.some((f) => f.key === "memory" && f.influencedDecision === true)
  ) {
    throw new Error("Decision Memory must never influenceDecision=true");
  }
  if (
    rec.factors.some(
      (f) => f.key === "team_workflow" && f.influencedDecision === true,
    )
  ) {
    throw new Error("Team workflow must never influenceDecision=true");
  }
  // NO_BID must cite at least one critical blocker when hardFailure
  if (rec.decision === "NO_BID" && rec.hardFailure && rec.criticalBlockers.length === 0) {
    throw new Error("NO_BID hard failure without critical blockers for explainability");
  }
}

export function findingsForceNoBid(findings: DeterministicFinding[]): boolean {
  return findings.some((f) => f.forcesDecision === "NO_BID");
}
