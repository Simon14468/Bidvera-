/**
 * Build structured Explainable Decision from canonical recommendation + intelligence.
 */

import type { TenderDecisionRecommendation } from "@/domain/decision/recommendation";
import type { DecisionMemoryInsightsBundle } from "@/domain/decision-memory";
import type { EvidenceIntelligenceBundle } from "@/domain/evidence-intelligence";
import type { TenderReadinessBreakdown } from "@/domain/decision/tender-readiness";
import type { ComplianceRow, StructuredRisk } from "@/domain/tender-intelligence";
import type { PipelineTrustSnapshot } from "@/domain/ai-trust";
import { trustAnomalyNote } from "@/domain/ai-trust";
import type {
  ExplainableDecision,
  ExplainableDecisionExecutiveSummary,
  ExplainableDecisionItem,
  ExplainableDecisionSections,
  ExplanationCategory,
  ExplanationConfidence,
  ExplanationImpactRole,
} from "./types";
import {
  EXPLAINABLE_DECISION_DISCLAIMER,
  INSUFFICIENT_DATA,
} from "./types";
import {
  sourceFromComplianceRow,
  sourceFromEngine,
  sourceFromMemory,
  stableItemId,
  whyFromReason,
} from "./traceability";

export type BuildExplainableDecisionInput = {
  recommendation: TenderDecisionRecommendation;
  evidenceIntelligence?: EvidenceIntelligenceBundle | null;
  complianceMatrix?: ComplianceRow[];
  risks?: StructuredRisk[];
  readiness?: TenderReadinessBreakdown | null;
  memoryInsights?: DecisionMemoryInsightsBundle | null;
  aiTrust?: PipelineTrustSnapshot | null;
};

const REFINEMENT_DRIVER_CODES = new Set([
  "MANDATORY_FAILED",
  "DEADLINE_PASSED",
  "MULTIPLE_BLOCKERS",
]);

const REVIEW_ITEM_CODES = new Set([
  "MANDATORY_UNCERTAIN",
  "VERIFICATION_ITEM",
  "READINESS_MISSING",
  "COMPLIANCE_MISSING",
]);

const DECISION_DRIVER_CODES = new Set([
  "CONTRACT_SIZE_HIGH",
  "HIGH_RISK_PRESENT",
  "DECISION_DRIVER",
  "FIT_GAP",
  "TEAM_WORKFLOW_OPEN",
]);

function confidenceFromSeverity(
  severity: string | undefined,
  located: boolean,
): ExplanationConfidence {
  if (!located) return "UNKNOWN";
  if (severity === "CRITICAL" || severity === "HIGH") return "HIGH";
  if (severity === "MEDIUM") return "MEDIUM";
  if (severity === "LOW" || severity === "INFO") return "LOW";
  return "MEDIUM";
}

function impactRoleForReason(input: {
  code: string;
  severity: string;
  hardFailure: boolean;
  referenceOnly?: boolean;
}): ExplanationImpactRole {
  if (input.referenceOnly) return "CONTEXT_ONLY";
  if (REVIEW_ITEM_CODES.has(input.code)) return "CONTRIBUTING_FACTOR";
  if (DECISION_DRIVER_CODES.has(input.code)) return "CONTRIBUTING_FACTOR";
  if (input.hardFailure && input.severity === "CRITICAL") return "DIRECT_DECISION_DRIVER";
  if (REFINEMENT_DRIVER_CODES.has(input.code)) return "DIRECT_DECISION_DRIVER";
  if (input.severity === "CRITICAL") return "DIRECT_DECISION_DRIVER";
  if (input.severity === "HIGH") return "CONTRIBUTING_FACTOR";
  if (input.severity === "MEDIUM") return "CONTRIBUTING_FACTOR";
  return "CONTRIBUTING_FACTOR";
}

function categoryForReason(input: {
  code: string;
  source: string;
  severity: string;
}): ExplanationCategory {
  if (input.code.startsWith("FIT_MATCH")) return "POSITIVE_FACTOR";
  if (input.code.startsWith("FIT_GAP")) return "NEGATIVE_FACTOR";
  if (input.code.startsWith("FIT_UNKNOWN")) return "UNKNOWN";
  if (input.code === "VERIFICATION_ITEM") return "REVIEW_ITEM";
  if (REVIEW_ITEM_CODES.has(input.code)) return "REVIEW_ITEM";
  if (input.code === "DECISION_DRIVER" || DECISION_DRIVER_CODES.has(input.code)) {
    return "DECISION_DRIVER";
  }
  if (input.source === "MEMORY") return "HISTORICAL_SIGNAL";
  if (input.source === "READINESS") return "READINESS";
  if (input.source === "COMPLIANCE") return "REQUIREMENT";
  if (input.source === "RISK") return "RISK";
  if (input.source === "FIT") return "COMPANY_FIT";
  if (input.source === "DEADLINE") return "DEADLINE";
  if (input.source === "UNCERTAINTY") return "UNKNOWN";
  if (input.severity === "CRITICAL" || input.code.includes("BLOCKER")) return "BLOCKER";
  if (input.severity === "HIGH") return "NEGATIVE_FACTOR";
  if (input.severity === "INFO") return "POSITIVE_FACTOR";
  return "NEGATIVE_FACTOR";
}

function buildExecutiveSummary(input: {
  recommendation: TenderDecisionRecommendation;
  hardBlockers: ExplainableDecisionItem[];
  reviewItems: ExplainableDecisionItem[];
  positives: ExplainableDecisionItem[];
  canonicalTotalRequirements: number;
  canonicalNeedsVerification: number;
}): ExplainableDecisionExecutiveSummary {
  const { recommendation } = input;
  const hardBlockerCount = recommendation.criticalBlockers.length;
  const reviewItemCount = recommendation.reviewItems?.length ?? input.reviewItems.length;
  const canonicalVerify = input.canonicalNeedsVerification;
  const canonicalTotal = input.canonicalTotalRequirements;

  let whyHeadline: string;
  if (recommendation.hardFailure || recommendation.displayLabel === "NO-BID") {
    whyHeadline =
      hardBlockerCount > 0
        ? `${hardBlockerCount} hard blocker${hardBlockerCount === 1 ? "" : "s"} drive NO-BID.`
        : "Hard compliance failure — NO-BID recommended.";
  } else if (recommendation.displayLabel === "CONDITIONAL GO") {
    if (hardBlockerCount > 0) {
      whyHeadline = `${hardBlockerCount} hard blocker${hardBlockerCount === 1 ? "" : "s"} remain.`;
    } else if (canonicalVerify > 0) {
      whyHeadline = `${canonicalVerify} canonical requirement${canonicalVerify === 1 ? "" : "s"} require verification before a clean GO.`;
    } else if (reviewItemCount > 0) {
      whyHeadline = `${reviewItemCount} main decision driver${reviewItemCount === 1 ? "" : "s"} require verification before a clean GO.`;
    } else {
      whyHeadline = "Conditions require verification before a clean GO.";
    }
  } else {
    whyHeadline =
      hardBlockerCount > 0
        ? `${hardBlockerCount} hard blocker${hardBlockerCount === 1 ? "" : "s"} noted — review before submission.`
        : "No hard blockers identified under current evidence.";
  }

  const topBlockers = input.hardBlockers.slice(0, 3).map((b) => b.what);

  const positiveCount = input.positives.length;
  const positiveSummary =
    positiveCount > 0
      ? `Strong company fit and ${positiveCount} positive factor${positiveCount === 1 ? "" : "s"} support the decision.`
      : null;

  return {
    decision: recommendation.decision,
    displayLabel: recommendation.displayLabel,
    confidence: recommendation.confidence,
    whyHeadline,
    blockerCount: hardBlockerCount,
    hardBlockerCount,
    reviewItemCount,
    canonicalTotalRequirements: canonicalTotal,
    canonicalNeedsVerification: canonicalVerify,
    topBlockers,
    positiveSummary,
  };
}

function partitionSections(items: ExplainableDecisionItem[]): ExplainableDecisionSections {
  const pick = (cats: ExplanationCategory[]) =>
    items.filter((i) => cats.includes(i.category));

  const keyReasons = items.filter(
    (i) =>
      i.category === "BLOCKER" ||
      (i.impactRole === "DIRECT_DECISION_DRIVER" && i.category !== "REVIEW_ITEM"),
  );

  return {
    keyReasons: keyReasons.slice(0, 12),
    requirements: pick(["REQUIREMENT", "NEGATIVE_FACTOR"]).filter(
      (i) => i.requirementId != null,
    ),
    evidence: pick(["MISSING_EVIDENCE", "UNVERIFIED_EVIDENCE"]),
    risks: pick(["RISK"]),
    companyFit: pick(["COMPANY_FIT", "POSITIVE_FACTOR"]).filter(
      (i) => i.category === "COMPANY_FIT" || i.category === "POSITIVE_FACTOR",
    ),
    readiness: pick(["READINESS"]),
    historicalSignals: pick(["HISTORICAL_SIGNAL"]),
    unknowns: pick(["UNKNOWN"]),
    actions: pick(["RECOMMENDED_ACTION"]),
  };
}

export function buildExplainableDecision(
  input: BuildExplainableDecisionInput,
): ExplainableDecision {
  const { recommendation } = input;
  const complianceByReq = new Map(
    (input.complianceMatrix ?? []).map((r) => [r.requirementId, r]),
  );
  const evidenceByReq = new Map(
    (input.evidenceIntelligence?.rows ?? []).map((r) => [r.requirementId, r]),
  );

  const items: ExplainableDecisionItem[] = [];

  // —— Hard blockers (confirmed only) ——
  for (const [idx, blocker] of recommendation.criticalBlockers.entries()) {
    items.push({
      id: stableItemId(["blocker", String(idx), blocker.slice(0, 40)]),
      category: "BLOCKER",
      impactRole: recommendation.hardFailure
        ? "DIRECT_DECISION_DRIVER"
        : "DIRECT_DECISION_DRIVER",
      what: blocker.slice(0, 200),
      why: whyFromReason(blocker),
      reasonCode: "CRITICAL_BLOCKER",
      status: "BLOCKER",
      impact: "Hard blocker",
      source: sourceFromEngine("Decision Engine", blocker),
      requirementId: null,
      evidenceId: null,
      riskId: null,
      confidence: "HIGH",
      referenceOnly: false,
    });
  }

  for (const [idx, review] of (recommendation.reviewItems ?? []).entries()) {
    items.push({
      id: stableItemId(["review", String(idx), review.slice(0, 40)]),
      category: "REVIEW_ITEM",
      impactRole: "CONTRIBUTING_FACTOR",
      what: review.slice(0, 200),
      why: whyFromReason(review),
      reasonCode: "VERIFICATION_ITEM",
      status: "VERIFY",
      impact: "Review item — verification required",
      source: sourceFromEngine("Decision Engine", review),
      requirementId: null,
      evidenceId: null,
      riskId: null,
      confidence: "MEDIUM",
      referenceOnly: false,
    });
  }

  for (const [idx, driver] of (recommendation.decisionDrivers ?? []).entries()) {
    items.push({
      id: stableItemId(["driver", String(idx), driver.slice(0, 40)]),
      category: "DECISION_DRIVER",
      impactRole: "CONTRIBUTING_FACTOR",
      what: driver.slice(0, 200),
      why: whyFromReason(driver),
      reasonCode: "DECISION_DRIVER",
      status: null,
      impact: "Decision driver",
      source: sourceFromEngine("Decision Engine", driver),
      requirementId: null,
      evidenceId: null,
      riskId: null,
      confidence: "MEDIUM",
      referenceOnly: false,
    });
  }

  // —— Structured reasons from recommendation ——
  for (const reason of recommendation.reasons) {
    const referenceOnly = reason.source === "MEMORY";
    const category = categoryForReason(reason);
    const isUnknown =
      category === "UNKNOWN" ||
      reason.code === "VERIFICATION_ITEM" ||
      reason.code.startsWith("FIT_UNKNOWN");
    items.push({
      id: stableItemId(["reason", reason.code, reason.source]),
      category,
      impactRole: impactRoleForReason({
        code: reason.code,
        severity: reason.severity,
        hardFailure: recommendation.hardFailure,
        referenceOnly,
      }),
      what: reason.text.slice(0, 240),
      why: whyFromReason(reason.text),
      reasonCode: reason.code,
      status: isUnknown ? "UNKNOWN" : reason.severity,
      impact:
        impactRoleForReason({
          code: reason.code,
          severity: reason.severity,
          hardFailure: recommendation.hardFailure,
          referenceOnly,
        }) === "DIRECT_DECISION_DRIVER"
          ? "Decision driver"
          : referenceOnly
            ? "Historical context"
            : "Contributing factor",
      source: sourceFromEngine(`Decision Engine (${reason.source})`, reason.text),
      requirementId: null,
      evidenceId: null,
      riskId: null,
      confidence: isUnknown
        ? "UNKNOWN"
        : confidenceFromSeverity(reason.severity, true),
      referenceOnly,
    });
  }

  // —— Decision factors ——
  for (const factor of recommendation.factors) {
    const cat: ExplanationCategory =
      factor.key === "fit"
        ? "COMPANY_FIT"
        : factor.key === "readiness"
          ? "READINESS"
          : factor.key === "memory"
            ? "HISTORICAL_SIGNAL"
            : factor.key === "deadline"
              ? "DEADLINE"
              : factor.referenceOnly
                ? "HISTORICAL_SIGNAL"
                : "REQUIREMENT";

    items.push({
      id: stableItemId(["factor", factor.key]),
      category: cat,
      impactRole: factor.referenceOnly
        ? "CONTEXT_ONLY"
        : factor.influencedDecision
          ? "CONTRIBUTING_FACTOR"
          : "CONTEXT_ONLY",
      what: `${factor.label}: ${factor.value}`,
      why: factor.referenceOnly
        ? "Reference-only context — does not change the current decision."
        : whyFromReason(factor.label),
      reasonCode: factor.key.toUpperCase(),
      status: factor.value.includes("Unknown") ? "UNKNOWN" : null,
      impact: factor.influencedDecision ? "Contributing factor" : "Context only",
      source: factor.key === "memory"
        ? sourceFromMemory(factor.value)
        : sourceFromEngine("Decision Engine", factor.value),
      requirementId: null,
      evidenceId: null,
      riskId: null,
      confidence: factor.value.includes("UNAVAILABLE") || factor.value.includes("Unknown")
        ? "UNKNOWN"
        : "MEDIUM",
      referenceOnly: Boolean(factor.referenceOnly),
    });
  }

  // —— Evidence Intelligence rows ——
  for (const row of input.evidenceIntelligence?.rows ?? []) {
    if (row.requirementVerificationStatus === "NOT_APPLICABLE") continue;

    const cat: ExplanationCategory =
      row.evidenceState === "MISSING"
        ? "MISSING_EVIDENCE"
        : row.evidenceState === "FOUND_UNVERIFIED" || row.evidenceState === "EXPIRED"
          ? "UNVERIFIED_EVIDENCE"
          : row.evidenceState === "VERIFIED"
            ? "POSITIVE_FACTOR"
            : row.evidenceState === "INVALID"
              ? "NEGATIVE_FACTOR"
              : "UNKNOWN";

    const cm = complianceByReq.get(row.requirementId);
    const impactRole: ExplanationImpactRole =
      row.evidenceState === "INVALID"
        ? "DIRECT_DECISION_DRIVER"
        : "CONTRIBUTING_FACTOR";

    items.push({
      id: stableItemId(["evidence", row.requirementId, row.evidenceState]),
      category: cat,
      impactRole,
      what: row.requirement.slice(0, 200),
      why: whyFromReason(row.relevanceReason ?? row.decisionImpactNote),
      reasonCode: row.evidenceState,
      status: row.evidenceState,
      impact:
        row.evidenceState === "INVALID"
          ? "Confirmed non-compliance"
          : row.evidenceState === "VERIFIED"
            ? "Supporting evidence"
            : "Verification required",
      source: sourceFromComplianceRow(cm, "company"),
      requirementId: row.requirementId,
      evidenceId: row.evidence?.evidenceId ?? null,
      riskId: null,
      confidence:
        row.evidence?.sourceKind === "TEAM_VERIFIED"
          ? "HIGH"
          : row.evidenceState === "UNKNOWN"
            ? "UNKNOWN"
            : "MEDIUM",
      referenceOnly: false,
    });
  }

  // —— Failed mandatory requirements with compliance trace ——
  for (const ev of recommendation.supportingEvidence.filter(
    (e) => e.kind === "requirement" && e.requirementId,
  )) {
    const cm = ev.requirementId ? complianceByReq.get(ev.requirementId) : undefined;
    const ei = ev.requirementId ? evidenceByReq.get(ev.requirementId) : undefined;
    if (items.some((i) => i.requirementId === ev.requirementId && i.category === "REQUIREMENT")) {
      continue;
    }
    items.push({
      id: stableItemId(["req", ev.requirementId]),
      category: "REQUIREMENT",
      impactRole: ei?.evidenceState === "MISSING" ? "DIRECT_DECISION_DRIVER" : "CONTRIBUTING_FACTOR",
      what: ev.label,
      why: whyFromReason(ev.detail),
      reasonCode: cm?.status ?? INSUFFICIENT_DATA,
      status: ei?.evidenceState ?? cm?.status ?? null,
      impact: ei?.evidenceState === "MISSING" ? "Decision blocker" : "Requirement gap",
      source: sourceFromComplianceRow(cm ?? null, "tender"),
      requirementId: ev.requirementId ?? null,
      evidenceId: ev.evidenceId ?? null,
      riskId: null,
      confidence: cm?.sourceLocated ? "HIGH" : "UNKNOWN",
      referenceOnly: false,
    });
  }

  // —— Structured risks ——
  for (const risk of input.risks ?? []) {
    const located = risk.source.located;
    items.push({
      id: stableItemId(["risk", risk.id]),
      category: "RISK",
      impactRole:
        risk.severityCanonical === "CRITICAL" || risk.severity === "HIGH"
          ? "DIRECT_DECISION_DRIVER"
          : "CONTRIBUTING_FACTOR",
      what: risk.title,
      why: whyFromReason(risk.explanation || risk.whyRisky),
      reasonCode: risk.category,
      status: risk.severityCanonical ?? risk.severity,
      impact: risk.impact || "Risk factor",
      source: {
        kind: located ? "TENDER_DOCUMENT" : "UNKNOWN",
        label: risk.source.document ?? "Risk source",
        documentName: risk.source.document,
        page: risk.source.page,
        section: risk.source.section,
        excerpt: risk.source.excerpt,
        located,
      },
      requirementId: risk.requirementId ?? null,
      evidenceId: null,
      riskId: risk.id,
      confidence: confidenceFromSeverity(risk.severity, located),
      referenceOnly: false,
    });

    if (risk.recommendedAction?.trim()) {
      items.push({
        id: stableItemId(["action", risk.id]),
        category: "RECOMMENDED_ACTION",
        impactRole: "CONTEXT_ONLY",
        what: risk.recommendedAction.slice(0, 200),
        why: "Mitigation recommended by risk analysis.",
        reasonCode: "RISK_ACTION",
        status: null,
        impact: "Recommended action",
        source: sourceFromEngine("Risk analysis", risk.recommendedAction),
        requirementId: risk.requirementId ?? null,
        evidenceId: null,
        riskId: risk.id,
        confidence: "MEDIUM",
        referenceOnly: false,
      });
    }
  }

  // —— Readiness attention items ——
  for (const note of input.readiness?.attention?.slice(0, 6) ?? []) {
    items.push({
      id: stableItemId(["readiness", note.slice(0, 30)]),
      category: "READINESS",
      impactRole: "CONTRIBUTING_FACTOR",
      what: note.slice(0, 200),
      why: whyFromReason(note),
      reasonCode: "READINESS_ATTENTION",
      status: input.readiness?.recommendation ?? null,
      impact: "Readiness factor",
      source: sourceFromEngine("Tender Readiness", note),
      requirementId: null,
      evidenceId: null,
      riskId: null,
      confidence: "MEDIUM",
      referenceOnly: false,
    });
  }

  // —— Decision Memory (context only) ——
  for (const match of input.memoryInsights?.matches ?? []) {
    items.push({
      id: stableItemId(["memory", match.memoryId]),
      category: "HISTORICAL_SIGNAL",
      impactRole: "CONTEXT_ONLY",
      what: `${match.title} — prior ${match.decisionLabel}`,
      why: match.disclaimer || "Historical signal — not proof for this tender.",
      reasonCode: "MEMORY_REFERENCE",
      status: "HISTORICAL",
      impact: "Historical context",
      source: sourceFromMemory(match.title),
      requirementId: null,
      evidenceId: null,
      riskId: null,
      confidence: "LOW",
      referenceOnly: true,
    });
  }

  // —— Unknown / missing data notes ——
  for (const [idx, note] of recommendation.missingDataNotes.entries()) {
    items.push({
      id: stableItemId(["unknown", String(idx)]),
      category: "UNKNOWN",
      impactRole: "CONTEXT_ONLY",
      what: note.slice(0, 200),
      why: note.startsWith("Unknown") ? note : `Unknown: ${note}`,
      reasonCode: INSUFFICIENT_DATA,
      status: "UNKNOWN",
      impact: "Insufficient data — not assumed",
      source: {
        kind: "UNKNOWN",
        label: "Source unknown",
        documentName: null,
        page: null,
        section: null,
        excerpt: null,
        located: false,
      },
      requirementId: null,
      evidenceId: null,
      riskId: null,
      confidence: "UNKNOWN",
      referenceOnly: false,
    });
  }

  // —— Compliance required actions ——
  for (const row of input.complianceMatrix ?? []) {
    if (!row.requiredAction?.trim()) continue;
    items.push({
      id: stableItemId(["action", row.requirementId]),
      category: "RECOMMENDED_ACTION",
      impactRole: "CONTEXT_ONLY",
      what: row.requiredAction.slice(0, 200),
      why: whyFromReason(row.notes),
      reasonCode: row.status,
      status: row.status,
      impact: "Recommended action",
      source: sourceFromComplianceRow(row, "tender"),
      requirementId: row.requirementId,
      evidenceId: row.evidenceId ?? null,
      riskId: null,
      confidence: row.sourceLocated ? "MEDIUM" : "UNKNOWN",
      referenceOnly: false,
    });
  }

  const deduped = dedupeItems(items);
  const hardBlockers = deduped.filter((i) => i.category === "BLOCKER");
  const reviewItems = deduped.filter((i) => i.category === "REVIEW_ITEM");
  const positives = deduped.filter((i) => i.category === "POSITIVE_FACTOR");

  const matrix = input.complianceMatrix ?? [];
  const canonicalTotalRequirements =
    matrix.length > 0
      ? matrix.length
      : (input.readiness?.totalRequirements ?? input.readiness?.total ?? 0);
  const canonicalNeedsVerification =
    matrix.length > 0
      ? matrix.filter((r) => r.status === "VERIFY" || r.status === "UNKNOWN").length
      : (input.readiness?.counts.verify ?? 0) + (input.readiness?.counts.unknown ?? 0);

  return {
    computed: true,
    decision: recommendation.decision,
    displayLabel: recommendation.displayLabel,
    confidence: recommendation.confidence,
    hardFailure: recommendation.hardFailure,
    deterministic: recommendation.deterministic,
    executiveSummary: buildExecutiveSummary({
      recommendation,
      hardBlockers,
      reviewItems,
      positives,
      canonicalTotalRequirements,
      canonicalNeedsVerification,
    }),
    items: deduped,
    sections: partitionSections(deduped),
    contentHash: recommendation.contentHash,
    disclaimer: EXPLAINABLE_DECISION_DISCLAIMER,
    missingDataNotes: (() => {
      const notes = [...recommendation.missingDataNotes];
      const trustNote = trustAnomalyNote(input.aiTrust);
      if (trustNote && !notes.includes(trustNote)) notes.push(trustNote);
      return notes;
    })(),
  };
}

function dedupeItems(items: ExplainableDecisionItem[]): ExplainableDecisionItem[] {
  const seen = new Set<string>();
  const out: ExplainableDecisionItem[] = [];
  for (const item of items) {
    const key = `${item.category}:${item.id}:${item.what.slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
