/**
 * Decision Outcome Learning — pure domain logic.
 * Advisory only: never modifies scores, decision engine rules, or Decision Memory ranking.
 */

import type { LearningFeatures } from "@/domain/learning";
import { similarityScore } from "@/domain/learning/similarity";
import { relevanceReasons } from "@/domain/decision-memory";
import { decisionMemoryLabel } from "@/domain/decision-memory";
import {
  lifecycleBucket,
  validateOutcomeTransition,
} from "@/domain/decision-outcome-learning/lifecycle";
import {
  USER_OUTCOME_EVIDENCE_DISCLAIMER,
} from "@/domain/decision-outcome-learning/evidence";
import type { DecisionType, TenderOutcome } from "@prisma/client";

export type { OutcomeAuditAction } from "@/domain/decision-outcome-learning/lifecycle";
export {
  isTerminalOutcome,
  isNonTerminalOutcome,
  lifecycleBucket,
  resolveOutcomeAuditAction,
  validateOutcomeTransition,
} from "@/domain/decision-outcome-learning/lifecycle";
export {
  buildOutcomeUserEvidence,
  outcomeEvidenceChanged,
  parseOutcomeUserEvidence,
  USER_OUTCOME_EVIDENCE_DISCLAIMER,
  type OutcomeUserEvidence,
} from "@/domain/decision-outcome-learning/evidence";
export { toOutcomeEngineContext, type OutcomeEngineContextSignal } from "@/domain/decision-outcome-learning/engine-context";

export type DecisionOutcomeValue =
  | "WON"
  | "LOST"
  | "WITHDRAWN"
  | "CANCELLED"
  | "NOT_SUBMITTED"
  | "PENDING"
  | "BID_SUBMITTED"
  | "NO_BID_CONFIRMED";

/** Bidvera recommendation vs actual outcome — does not equate GO=WON or NO-BID=LOST. */
export type RecommendationEvaluation =
  | "SUCCESSFUL"
  | "UNSUCCESSFUL"
  | "NOT_EVALUATED";

/** @deprecated use RecommendationEvaluation */
export type DecisionSuccessEvaluation =
  | "successful"
  | "unsuccessful"
  | "neutral"
  | "pending"
  | null;

export const OUTCOME_REASON_CODES = [
  "price",
  "technical",
  "compliance",
  "capacity",
  "incumbent",
  "strategy",
  "client_relationship",
  "other",
] as const;

export type OutcomeReasonCode = (typeof OUTCOME_REASON_CODES)[number];

export const OUTCOME_LABELS: Record<DecisionOutcomeValue, string> = {
  WON: "Won",
  LOST: "Lost",
  WITHDRAWN: "Withdrawn",
  CANCELLED: "Cancelled",
  NOT_SUBMITTED: "Not submitted",
  PENDING: "Pending",
  BID_SUBMITTED: "Bid submitted (pending)",
  NO_BID_CONFIRMED: "Confirmed no-bid",
};

export const RECOMMENDATION_EVALUATION_LABELS: Record<
  RecommendationEvaluation,
  string
> = {
  SUCCESSFUL: "Successful",
  UNSUCCESSFUL: "Unsuccessful",
  NOT_EVALUATED: "Not evaluated",
};

export const OUTCOME_DISCLAIMER =
  "Historical outcomes are advisory intelligence only. They never change Current Analysis scores or the recommendation.";

/** Minimum similar tenders before surfacing aggregate win-rate language. */
export const MIN_COMPARABLE_SAMPLE = 3;
/** Minimum WON+LOST count before computing a win rate. */
export const MIN_DECISIVE_SAMPLE = 2;
/** Minimum occurrences before listing a recurring loss reason. */
export const MIN_RECURRING_REASON_COUNT = 2;

export function normalizeOutcomeForLearning(outcome: DecisionOutcomeValue): TenderOutcome {
  return lifecycleBucket(outcome) as TenderOutcome;
}

export function isDecisiveOutcome(outcome: DecisionOutcomeValue): boolean {
  const bucket = lifecycleBucket(outcome);
  return bucket === "WON" || bucket === "LOST";
}

export function validateOutcomePayload(input: {
  outcome: DecisionOutcomeValue;
  outcomeDate?: Date | string | null;
  reasonCode?: string | null;
  fromOutcome?: DecisionOutcomeValue | null;
  allowReversal?: boolean;
}): { ok: true } | { ok: false; message: string } {
  if (!input.outcome) {
    return { ok: false, message: "Outcome is required." };
  }

  const transition = validateOutcomeTransition({
    from: input.fromOutcome ?? null,
    to: input.outcome,
    allowReversal: input.allowReversal,
  });
  if (!transition.ok) return transition;

  if (isDecisiveOutcome(input.outcome)) {
    if (!input.outcomeDate) {
      return { ok: false, message: "Outcome date is required for Won/Lost." };
    }
    const d =
      input.outcomeDate instanceof Date ? input.outcomeDate : new Date(input.outcomeDate);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, message: "Invalid outcome date." };
    }
  }
  if (
    input.reasonCode &&
    !OUTCOME_REASON_CODES.includes(input.reasonCode as OutcomeReasonCode)
  ) {
    return { ok: false, message: "Invalid outcome reason code." };
  }
  return { ok: true };
}

/**
 * Compare Bidvera recommendation at analysis vs verified real-world outcome.
 * REVIEW (Conditional GO) is never auto-scored as success/failure.
 */
export function evaluateRecommendationAlignment(input: {
  decisionAtAnalysis: DecisionType;
  outcome: DecisionOutcomeValue;
}): RecommendationEvaluation {
  const outcome = lifecycleBucket(input.outcome);

  if (outcome === "PENDING") {
    return "NOT_EVALUATED";
  }

  if (input.decisionAtAnalysis === "REVIEW") {
    return "NOT_EVALUATED";
  }

  if (outcome === "WON") {
    return input.decisionAtAnalysis === "BID" ? "SUCCESSFUL" : "UNSUCCESSFUL";
  }

  if (outcome === "LOST") {
    return input.decisionAtAnalysis === "NO_BID" ? "SUCCESSFUL" : "UNSUCCESSFUL";
  }

  if (
    outcome === "NOT_SUBMITTED" ||
    outcome === "WITHDRAWN" ||
    outcome === "CANCELLED"
  ) {
    if (input.decisionAtAnalysis === "BID") return "UNSUCCESSFUL";
    if (input.decisionAtAnalysis === "NO_BID") return "SUCCESSFUL";
    return "NOT_EVALUATED";
  }

  return "NOT_EVALUATED";
}

/** @deprecated use evaluateRecommendationAlignment */
export function evaluateDecisionSuccess(input: {
  decisionAtAnalysis: DecisionType;
  outcome: DecisionOutcomeValue;
}): DecisionSuccessEvaluation {
  const v = evaluateRecommendationAlignment(input);
  switch (v) {
    case "SUCCESSFUL":
      return "successful";
    case "UNSUCCESSFUL":
      return "unsuccessful";
    default:
      return lifecycleBucket(input.outcome) === "PENDING" ? "pending" : "neutral";
  }
}

export function formatOutcomeTraceNote(title: string): string {
  return `Recorded outcome for “${title.trim()}”.`;
}

export type OutcomeLearningStatistics = {
  comparableCount: number;
  won: number;
  lost: number;
  withdrawn: number;
  cancelled: number;
  notSubmitted: number;
  pending: number;
  decisiveCount: number;
  /** Percent 0–100 only when decisiveCount >= MIN_DECISIVE_SAMPLE */
  winRatePercent: number | null;
  sufficientSample: boolean;
  summary: string | null;
};

export type OutcomeLearningPattern = {
  tenderId: string;
  title: string;
  decisionAtAnalysis: DecisionType;
  decisionLabel: string;
  recordedOutcome: DecisionOutcomeValue;
  outcomeLabel: string;
  outcomeDate: string | null;
  reasonCode: string | null;
  reasonSummary: string | null;
  similarity: number;
  relevanceReasons: string[];
  recommendationEvaluation: RecommendationEvaluation;
  /** @deprecated */
  decisionSuccess: DecisionSuccessEvaluation;
  traceNote: string;
};

export type OutcomeLearningInsightsBundle = {
  computed: boolean;
  referenceOnly: true;
  similarOutcomes: OutcomeLearningPattern[];
  statistics: OutcomeLearningStatistics | null;
  winRateSummary: string | null;
  recurringLossReasons: string[];
  recurringSuccessPatterns: string[];
  disclaimer: string;
  emptyReason: string | null;
};

export const EMPTY_OUTCOME_LEARNING_INSIGHTS: OutcomeLearningInsightsBundle = {
  computed: true,
  referenceOnly: true,
  similarOutcomes: [],
  statistics: null,
  winRateSummary: null,
  recurringLossReasons: [],
  recurringSuccessPatterns: [],
  disclaimer: OUTCOME_DISCLAIMER,
  emptyReason: "No prior tenders with recorded outcomes match this opportunity yet.",
};

const MIN_SIMILARITY = 0.35;
const MAX_PATTERNS = 5;

function countByOutcome(
  rows: Array<{ outcome: DecisionOutcomeValue }>,
): Omit<
  OutcomeLearningStatistics,
  "decisiveCount" | "winRatePercent" | "sufficientSample" | "summary"
> {
  let won = 0;
  let lost = 0;
  let withdrawn = 0;
  let cancelled = 0;
  let notSubmitted = 0;
  let pending = 0;

  for (const r of rows) {
    switch (lifecycleBucket(r.outcome)) {
      case "WON":
        won++;
        break;
      case "LOST":
        lost++;
        break;
      case "WITHDRAWN":
        withdrawn++;
        break;
      case "CANCELLED":
        cancelled++;
        break;
      case "NOT_SUBMITTED":
        notSubmitted++;
        break;
      default:
        pending++;
        break;
    }
  }

  return {
    comparableCount: rows.length,
    won,
    lost,
    withdrawn,
    cancelled,
    notSubmitted,
    pending,
  };
}

export function buildOutcomeStatistics(
  similarRows: Array<{ outcome: DecisionOutcomeValue }>,
): OutcomeLearningStatistics | null {
  if (similarRows.length === 0) return null;

  const counts = countByOutcome(similarRows);
  const decisiveCount = counts.won + counts.lost;
  const sufficientSample = counts.comparableCount >= MIN_COMPARABLE_SAMPLE;
  const winRatePercent =
    decisiveCount >= MIN_DECISIVE_SAMPLE
      ? Math.round((counts.won / decisiveCount) * 1000) / 10
      : null;

  let summary: string | null = null;
  if (sufficientSample && counts.won + counts.lost + counts.withdrawn > 0) {
    summary = `${counts.won} of ${counts.comparableCount} similar tenders were won`;
    if (counts.lost > 0) {
      summary += ` (${counts.lost} lost`;
      if (counts.withdrawn > 0) summary += `, ${counts.withdrawn} withdrawn`;
      summary += ")";
    } else if (counts.withdrawn > 0) {
      summary += ` (${counts.withdrawn} withdrawn)`;
    }
  }

  return {
    ...counts,
    decisiveCount,
    winRatePercent,
    sufficientSample,
    summary,
  };
}

export function buildOutcomeLearningInsights(input: {
  currentFeatures: LearningFeatures;
  excludeTenderId: string;
  candidates: Array<{
    tenderId: string;
    title: string;
    decisionAtAnalysis: DecisionType;
    outcome: DecisionOutcomeValue;
    outcomeDate: Date | string | null;
    reasonCode: string | null;
    reasonDetail: string | null;
    features: LearningFeatures;
  }>;
}): OutcomeLearningInsightsBundle {
  const patterns: OutcomeLearningPattern[] = [];
  const similarCandidateRows: typeof input.candidates = [];

  for (const c of input.candidates) {
    if (c.tenderId === input.excludeTenderId) continue;
    const similarity = similarityScore(input.currentFeatures, c.features);
    if (similarity < MIN_SIMILARITY) continue;
    const reasons = relevanceReasons(input.currentFeatures, c.features);
    if (reasons.length === 0 && similarity < 0.5) continue;

    similarCandidateRows.push(c);

    const recommendationEvaluation = evaluateRecommendationAlignment({
      decisionAtAnalysis: c.decisionAtAnalysis,
      outcome: c.outcome,
    });

    patterns.push({
      tenderId: c.tenderId,
      title: c.title,
      decisionAtAnalysis: c.decisionAtAnalysis,
      decisionLabel: decisionMemoryLabel(c.decisionAtAnalysis),
      recordedOutcome: lifecycleBucket(c.outcome),
      outcomeLabel: OUTCOME_LABELS[lifecycleBucket(c.outcome)] ?? c.outcome,
      outcomeDate:
        c.outcomeDate == null
          ? null
          : typeof c.outcomeDate === "string"
            ? c.outcomeDate
            : c.outcomeDate.toISOString(),
      reasonCode: c.reasonCode,
      reasonSummary: c.reasonDetail?.trim() || null,
      similarity: Math.round(similarity * 1000) / 1000,
      relevanceReasons:
        reasons.length > 0
          ? reasons
          : ["Overall feature similarity above relevance threshold"],
      recommendationEvaluation,
      decisionSuccess: evaluateDecisionSuccess({
        decisionAtAnalysis: c.decisionAtAnalysis,
        outcome: c.outcome,
      }),
      traceNote: formatOutcomeTraceNote(c.title),
    });
  }

  patterns.sort(
    (a, b) =>
      b.similarity - a.similarity ||
      (b.outcomeDate?.localeCompare(a.outcomeDate ?? "") ?? 0),
  );
  const similarOutcomes = patterns.slice(0, MAX_PATTERNS);

  const statistics = buildOutcomeStatistics(
    similarCandidateRows.map((c) => ({ outcome: c.outcome })),
  );

  const winRateSummary =
    statistics?.sufficientSample && statistics.summary ? statistics.summary : null;

  const lossReasons = similarCandidateRows
    .filter((c) => lifecycleBucket(c.outcome) === "LOST" && c.reasonCode)
    .map((c) => c.reasonCode as string);
  const recurringLossReasons = topCounts(lossReasons, 3)
    .filter(([, n]) => n >= MIN_RECURRING_REASON_COUNT)
    .map(
      ([code, n]) =>
        `${code.replace(/_/g, " ")} (${n} of ${similarCandidateRows.length} similar)`,
    );

  const successPatterns = similarOutcomes
    .filter((p) => p.recommendationEvaluation === "SUCCESSFUL")
    .map((p) => `${p.decisionLabel} → ${p.outcomeLabel}: ${p.title}`)
    .slice(0, 3);

  return {
    computed: true,
    referenceOnly: true,
    similarOutcomes,
    statistics,
    winRateSummary,
    recurringLossReasons,
    recurringSuccessPatterns: successPatterns,
    disclaimer: OUTCOME_DISCLAIMER,
    emptyReason:
      similarOutcomes.length === 0
        ? EMPTY_OUTCOME_LEARNING_INSIGHTS.emptyReason
        : null,
  };
}

function topCounts(values: string[], limit: number): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export type DecisionOutcomeView = {
  tenderId: string;
  bidveraDecision: DecisionType;
  bidveraDecisionLabel: string;
  humanFinalDecision: DecisionType | null;
  humanFinalDecisionLabel: string | null;
  outcome: DecisionOutcomeValue | null;
  outcomeLabel: string | null;
  outcomeDate: string | null;
  reasonCode: string | null;
  reasonDetail: string | null;
  recommendationEvaluation: RecommendationEvaluation | null;
  /** @deprecated */
  decisionSuccess: DecisionSuccessEvaluation;
  attachmentFileName: string | null;
  userEvidenceDisclaimer: string;
  recordedAt: string | null;
  disclaimer: string;
};

export function buildDecisionOutcomeView(input: {
  tenderId: string;
  bidveraDecision: DecisionType;
  humanFinalDecision?: DecisionType | null;
  outcome?: DecisionOutcomeValue | null;
  outcomeDate?: Date | string | null;
  reasonCode?: string | null;
  reasonDetail?: string | null;
  attachmentFileName?: string | null;
  recordedAt?: Date | string | null;
}): DecisionOutcomeView {
  const outcome = input.outcome == null ? null : lifecycleBucket(input.outcome);
  const recommendationEvaluation = outcome
    ? evaluateRecommendationAlignment({
        decisionAtAnalysis: input.bidveraDecision,
        outcome,
      })
    : null;

  return {
    tenderId: input.tenderId,
    bidveraDecision: input.bidveraDecision,
    bidveraDecisionLabel: decisionMemoryLabel(input.bidveraDecision),
    humanFinalDecision: input.humanFinalDecision ?? null,
    humanFinalDecisionLabel: input.humanFinalDecision
      ? decisionMemoryLabel(input.humanFinalDecision)
      : null,
    outcome,
    outcomeLabel: outcome ? OUTCOME_LABELS[outcome] : null,
    outcomeDate:
      input.outcomeDate == null
        ? null
        : typeof input.outcomeDate === "string"
          ? input.outcomeDate
          : input.outcomeDate.toISOString(),
    reasonCode: input.reasonCode ?? null,
    reasonDetail: input.reasonDetail ?? null,
    recommendationEvaluation,
    decisionSuccess:
      recommendationEvaluation && outcome
        ? evaluateDecisionSuccess({
            decisionAtAnalysis: input.bidveraDecision,
            outcome,
          })
        : null,
    attachmentFileName: input.attachmentFileName ?? null,
    userEvidenceDisclaimer: USER_OUTCOME_EVIDENCE_DISCLAIMER,
    recordedAt:
      input.recordedAt == null
        ? null
        : typeof input.recordedAt === "string"
          ? input.recordedAt
          : input.recordedAt.toISOString(),
    disclaimer: OUTCOME_DISCLAIMER,
  };
}
