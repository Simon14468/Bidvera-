/**
 * Smart Alerts — pure candidate builders from real tender/analysis data only.
 * Never invents scores, deadlines, requirements, or events.
 * Does not change scoring, decision, or analysis logic.
 */

import type { AlertType, DecisionType } from "@prisma/client";
import { toTenderDecisionLabel } from "@/domain/decision/labels";

export type SmartAlertCandidate = {
  type: AlertType;
  title: string;
  message: string;
  href: string;
  /** Stable idempotency key — never invent; derived from source facts only */
  dedupeKey: string;
  /** Optional future schedule; omit for immediate */
  scheduledFor?: Date | null;
};

export type PriorAnalysisSnapshot = {
  decision: DecisionType | null;
  fitScore: number | null;
  bidScore: number | null;
  compliance: {
    ready: number;
    missing: number;
    verify: number;
    totalRequirements: number;
  } | null;
};

export type CurrentAnalysisSnapshot = {
  companyId: string;
  tenderId: string;
  title: string;
  decision: DecisionType;
  fitScore: number;
  bidScore: number | null;
  scoringAvailable: boolean;
  hasHighOrCriticalRisk: boolean;
  missingDocumentCount: number;
  compliance: {
    ready: number;
    missing: number;
    verify: number;
    totalRequirements: number;
  };
  /** Top relevant Decision Memory match ids (real IDs only) */
  decisionMemoryMatchIds: string[];
  decisionMemoryTopTitle: string | null;
  decisionMemoryTopLabel: string | null;
  /** From Tender Action Plan — open critical/blocking counts only when plan computed. */
  actionPlanOpenCritical?: number;
  actionPlanOpenBlocking?: number;
  actionPlanDeadlineDays?: number | null;
};

/** Minimum absolute bid-score delta to emit a score-change alert (points). */
export const SCORE_CHANGE_THRESHOLD = 5;

export function formatDecisionLabel(decision: DecisionType): string {
  return toTenderDecisionLabel(decision);
}

/**
 * Extract a prior snapshot from stored TenderDecision fields.
 * Returns nulls when fields are missing — never invents numbers.
 */
export function priorSnapshotFromStored(input: {
  decision?: DecisionType | null;
  fitScore?: number | null;
  bidScoreBreakdown?: unknown;
  intelligenceBreakdown?: unknown;
}): PriorAnalysisSnapshot {
  const bid = readBidScore(input.bidScoreBreakdown);
  const compliance = readCompliance(input.intelligenceBreakdown);
  return {
    decision: input.decision ?? null,
    fitScore: typeof input.fitScore === "number" ? input.fitScore : null,
    bidScore: bid,
    compliance,
  };
}

function readBidScore(breakdown: unknown): number | null {
  if (!breakdown || typeof breakdown !== "object") return null;
  const o = breakdown as Record<string, unknown>;
  if (o.scoringAvailable === false) return null;
  if (typeof o.score === "number" && Number.isFinite(o.score)) return o.score;
  return null;
}

function readCompliance(
  intelligence: unknown,
): PriorAnalysisSnapshot["compliance"] {
  if (!intelligence || typeof intelligence !== "object") return null;
  const summary = (intelligence as Record<string, unknown>).complianceSummary;
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  const ready = s.ready;
  const missing = s.missing;
  const verify = s.verify;
  const total = s.totalRequirements;
  if (
    typeof ready !== "number" ||
    typeof missing !== "number" ||
    typeof verify !== "number" ||
    typeof total !== "number"
  ) {
    return null;
  }
  return { ready, missing, verify, totalRequirements: total };
}

/**
 * Build alert candidates from a completed analysis event.
 * Only emits when the underlying fact is present and (for deltas) actually changed.
 */
export function buildPostAnalysisAlertCandidates(
  current: CurrentAnalysisSnapshot,
  prior: PriorAnalysisSnapshot | null,
): SmartAlertCandidate[] {
  const href = `/tenders/${current.tenderId}`;
  const base = `${current.companyId}:${current.tenderId}`;
  const title = current.title.trim() || "Tender";
  const out: SmartAlertCandidate[] = [];

  const decisionLabel = formatDecisionLabel(current.decision);
  const bidPart =
    current.scoringAvailable && current.bidScore != null
      ? String(current.bidScore)
      : "na";
  out.push({
    type: "DECISION_GENERATED",
    title: "Decision ready",
    message: `"${title}" → ${decisionLabel}${
      current.scoringAvailable && current.bidScore != null
        ? ` · Bid Score ${current.bidScore}/100`
        : ""
    }`,
    href,
    dedupeKey: `${base}:decision:${current.decision}:${current.fitScore}:${bidPart}`,
  });

  if (current.hasHighOrCriticalRisk) {
    out.push({
      type: "HIGH_RISK",
      title: "High-risk tender",
      message: `"${title}" has critical or high disqualification risks.`,
      href,
      dedupeKey: `${base}:high-risk`,
    });
  }

  if (current.missingDocumentCount > 0) {
    const n = current.missingDocumentCount;
    out.push({
      type: "MISSING_DOCUMENT",
      title: "Missing documents detected",
      message: `"${title}" — ${n} document gap${n === 1 ? "" : "s"} found.`,
      href,
      dedupeKey: `${base}:missing-docs:${n}`,
    });
  }

  // Score / decision change — only when a prior analysis exists and values differ
  if (prior) {
    const scoreChange = significantScoreChange(prior, current);
    if (scoreChange) {
      out.push({
        type: "SCORE_CHANGED",
        title: "Score or decision changed",
        message: scoreChange.message,
        href,
        dedupeKey: `${base}:score-change:${scoreChange.fingerprint}`,
      });
    }

    const reqChange = requirementStatusChange(prior, current);
    if (reqChange) {
      out.push({
        type: "REQUIREMENT_STATUS",
        title: "Requirement status changed",
        message: reqChange.message,
        href,
        dedupeKey: `${base}:req-status:${reqChange.fingerprint}`,
      });
    }
  }

  if (
    current.decisionMemoryMatchIds.length > 0 &&
    current.decisionMemoryTopTitle
  ) {
    const topId = current.decisionMemoryMatchIds[0]!;
    const label = current.decisionMemoryTopLabel ?? "prior";
    out.push({
      type: "DECISION_MEMORY",
      title: "Relevant Decision Memory",
      message: `"${title}" matches historical ${label}: "${current.decisionMemoryTopTitle}" (${current.decisionMemoryMatchIds.length} relevant). Reference only — does not change current scores.`,
      href: `/decision-memory/${topId}`,
      dedupeKey: `${base}:memory:${topId}`,
    });
  }

  if (
    typeof current.actionPlanOpenCritical === "number" &&
    current.actionPlanOpenCritical > 0
  ) {
    out.push({
      type: "WORKFLOW_EVENT",
      title: "Critical actions required",
      message: `"${title}" — ${current.actionPlanOpenCritical} critical action(s) block progress. Review the Action Plan.`,
      href: `${href}#action-plan`,
      dedupeKey: `${base}:action-plan:critical:${current.actionPlanOpenCritical}`,
    });
  }

  if (
    typeof current.actionPlanDeadlineDays === "number" &&
    current.actionPlanDeadlineDays >= 0 &&
    current.actionPlanDeadlineDays <= 7 &&
    (current.actionPlanOpenBlocking ?? 0) > 0
  ) {
    out.push({
      type: "DEADLINE_APPROACHING",
      title: "Deadline approaching — blocking actions remain",
      message: `"${title}" — ${current.actionPlanDeadlineDays} day(s) left with ${current.actionPlanOpenBlocking} blocking action(s).`,
      href: `${href}#action-plan`,
      dedupeKey: `${base}:action-plan:deadline:${current.actionPlanDeadlineDays}:${current.actionPlanOpenBlocking}`,
    });
  }

  return out;
}

export function significantScoreChange(
  prior: PriorAnalysisSnapshot,
  current: CurrentAnalysisSnapshot,
): { message: string; fingerprint: string } | null {
  const parts: string[] = [];
  const fp: string[] = [];
  const title = current.title.trim() || "Tender";

  if (prior.decision && prior.decision !== current.decision) {
    parts.push(
      `decision ${formatDecisionLabel(prior.decision)} → ${formatDecisionLabel(current.decision)}`,
    );
    fp.push(`d:${prior.decision}->${current.decision}`);
  }

  if (
    prior.bidScore != null &&
    current.scoringAvailable &&
    current.bidScore != null &&
    Math.abs(current.bidScore - prior.bidScore) >= SCORE_CHANGE_THRESHOLD
  ) {
    parts.push(`Bid Score ${prior.bidScore} → ${current.bidScore}`);
    fp.push(`b:${prior.bidScore}->${current.bidScore}`);
  }

  if (
    prior.fitScore != null &&
    Math.abs(current.fitScore - prior.fitScore) >= SCORE_CHANGE_THRESHOLD
  ) {
    parts.push(`Fit ${prior.fitScore} → ${current.fitScore}`);
    fp.push(`f:${prior.fitScore}->${current.fitScore}`);
  }

  if (parts.length === 0) return null;
  return {
    message: `"${title}" — ${parts.join("; ")}.`,
    fingerprint: fp.join("|"),
  };
}

export function requirementStatusChange(
  prior: PriorAnalysisSnapshot,
  current: CurrentAnalysisSnapshot,
): { message: string; fingerprint: string } | null {
  if (!prior.compliance) return null;
  const p = prior.compliance;
  const c = current.compliance;
  if (
    p.ready === c.ready &&
    p.missing === c.missing &&
    p.verify === c.verify &&
    p.totalRequirements === c.totalRequirements
  ) {
    return null;
  }
  const title = current.title.trim() || "Tender";
  return {
    message: `"${title}" requirements: ${c.ready} ready · ${c.missing} missing · ${c.verify} verify (was ${p.ready}/${p.missing}/${p.verify}).`,
    fingerprint: `${p.ready}.${p.missing}.${p.verify}->${c.ready}.${c.missing}.${c.verify}`,
  };
}

/** Workflow / incomplete-package alerts from real gate reasons only. */
export function buildWorkflowAlertCandidate(input: {
  companyId: string;
  tenderId: string;
  title: string;
  reason: "ONLY_AVIS" | "NO_REQUIREMENTS" | "COMPANY_KNOWLEDGE_ONLY" | string;
  message: string;
}): SmartAlertCandidate {
  const titles: Record<string, string> = {
    ONLY_AVIS: "Tender notice processed — package incomplete",
    CPS_MISSING: "Analysis incomplete — CPS / package missing",
    NO_REQUIREMENTS: "Analysis incomplete — requirements not extracted",
    COMPANY_KNOWLEDGE_ONLY: "Company knowledge extracted",
  };
  return {
    type: "WORKFLOW_EVENT",
    title: titles[input.reason] ?? "Workflow update",
    message: input.message.slice(0, 500),
    href: `/tenders/${input.tenderId}`,
    dedupeKey: `${input.companyId}:${input.tenderId}:workflow:${input.reason}`,
  };
}

/** Preference gate key for each alert type (deadline finer gates applied at schedule). */
export type SmartAlertPrefKey =
  | "decisionAlerts"
  | "highRiskAlerts"
  | "missingDocAlerts"
  | "scoreChangeAlerts"
  | "requirementAlerts"
  | "decisionMemoryAlerts"
  | "workflowAlerts"
  | "deadline";

export function alertTypePrefKey(type: AlertType | string): SmartAlertPrefKey {
  switch (type) {
    case "DEADLINE_APPROACHING":
    case "DEADLINE_PASSED":
      return "deadline";
    case "HIGH_RISK":
      return "highRiskAlerts";
    case "DECISION_GENERATED":
      return "decisionAlerts";
    case "MISSING_DOCUMENT":
      return "missingDocAlerts";
    case "SCORE_CHANGED":
      return "scoreChangeAlerts";
    case "REQUIREMENT_STATUS":
      return "requirementAlerts";
    case "DECISION_MEMORY":
      return "decisionMemoryAlerts";
    case "WORKFLOW_EVENT":
    case "TRIAL_LIMIT":
    case "SYSTEM":
      return "workflowAlerts";
    default:
      return "workflowAlerts";
  }
}
