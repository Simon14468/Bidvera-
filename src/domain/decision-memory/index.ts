/**
 * Decision Memory — company-private prior tender decisions.
 * Reference/context only. Never invents data or changes current analysis scores.
 */

import type { LearningFeatures } from "@/domain/learning";
import { similarityScore } from "@/domain/learning/similarity";
import type { DecisionType } from "@prisma/client";
import { createHash } from "node:crypto";
import { toTenderDecisionLabel } from "@/domain/decision/labels";
import type { DecisionOutcomeValue } from "@/domain/decision-outcome-learning";

/** User-facing labels mapped from engine DecisionType — display only. */
export type DecisionMemoryLabel = "GO" | "CONDITIONAL GO" | "NO-BID";

export function decisionMemoryLabel(decision: DecisionType): DecisionMemoryLabel {
  return toTenderDecisionLabel(decision);
}

export { localizeTenderDecisionLabel } from "@/domain/decision/labels";

export type DecisionMemoryRequirementsSnapshot = {
  totalRequirements: number;
  ready: number;
  missing: number;
  verify: number;
  /** Short requirement descriptions copied from analysis — never invented */
  lines: string[];
};

export type DecisionMemoryRiskSnapshot = {
  id: string;
  title: string;
  severity: string;
};

export type DecisionMemoryScoresSnapshot = {
  fitScore: number | null;
  readinessScore: number | null;
  bidScore: number | null;
  confidence: string;
};

export type DecisionMemoryInsight = {
  memoryId: string;
  tenderId: string;
  title: string;
  client: string | null;
  decision: DecisionType;
  decisionLabel: DecisionMemoryLabel;
  fitScore: number | null;
  readinessScore: number | null;
  bidScore: number | null;
  reasoning: string;
  similarity: number;
  /** Explicit reasons this prior decision is considered relevant */
  relevanceReasons: string[];
  analyzedAt: string;
  /** Hard disclaimer — never automatic proof */
  disclaimer: string;
  /** Populated when a real-world outcome was recorded — never invented */
  recordedOutcome?: DecisionOutcomeValue | null;
  outcomeLabel?: string | null;
  outcomeDate?: string | null;
  outcomeReasonSummary?: string | null;
  recommendationEvaluation?: import("@/domain/decision-outcome-learning").RecommendationEvaluation | null;
  decisionSuccess?: "successful" | "unsuccessful" | "neutral" | "pending" | null;
  outcomeTraceNote?: string | null;
};

export type DecisionMemoryInsightsBundle = {
  /** Always true when insights were computed (even if empty) */
  computed: boolean;
  /** Prior memories that met the relevance threshold */
  matches: DecisionMemoryInsight[];
  emptyReason: string | null;
  /** Separates current analysis from historical context */
  currentAnalysisNote: string;
  historicalNote: string;
};

export const DECISION_MEMORY_DISCLAIMER =
  "Historical Decision — reference only. Does not change the Current Analysis scores, requirements, or recommendation.";

export const EMPTY_DECISION_MEMORY_INSIGHTS: DecisionMemoryInsightsBundle = {
  computed: true,
  matches: [],
  emptyReason: "No relevant prior decisions found for this opportunity yet.",
  currentAnalysisNote:
    "Current Analysis is authoritative for this tender. Scores and recommendation are unchanged.",
  historicalNote:
    "Historical Decision Memory is context only — never automatic proof of success or failure.",
};

const MIN_RELEVANCE = 0.35;
const MAX_MATCHES = 5;

const FEATURE_REASON_LABELS: Record<keyof LearningFeatures, string> = {
  industryBucket: "Same industry band",
  countryBucket: "Same country/region band",
  sizeBand: "Similar company size band",
  fitBand: "Similar fit score band",
  readinessBand: "Similar readiness band",
  decisionAtAnalysis: "Same decision class at analysis",
  mandatoryGapBand: "Similar mandatory-gap profile",
  valueBand: "Similar contract value band",
};

/** Explainable overlap reasons — only for features that actually match and are known. */
export function relevanceReasons(
  current: LearningFeatures,
  prior: LearningFeatures,
): string[] {
  const reasons: string[] = [];
  for (const key of Object.keys(FEATURE_REASON_LABELS) as (keyof LearningFeatures)[]) {
    const a = current[key];
    const b = prior[key];
    if (!a || !b || a === "unknown" || b === "unknown") continue;
    if (a === b) reasons.push(FEATURE_REASON_LABELS[key]);
  }
  return reasons;
}

export function rankRelevantMemories(input: {
  currentFeatures: LearningFeatures;
  candidates: Array<{
    id: string;
    tenderId: string;
    title: string;
    client: string | null;
    decision: DecisionType;
    fitScore: number | null;
    readinessScore: number | null;
    bidScore: number | null;
    reasoning: string;
    features: LearningFeatures;
    analyzedAt: Date | string;
  }>;
  excludeTenderId?: string;
}): DecisionMemoryInsightsBundle {
  const scored: DecisionMemoryInsight[] = [];

  for (const c of input.candidates) {
    if (input.excludeTenderId && c.tenderId === input.excludeTenderId) continue;
    const similarity = similarityScore(input.currentFeatures, c.features);
    if (similarity < MIN_RELEVANCE) continue;
    const reasons = relevanceReasons(input.currentFeatures, c.features);
    if (reasons.length === 0 && similarity < 0.5) continue;

    scored.push({
      memoryId: c.id,
      tenderId: c.tenderId,
      title: c.title,
      client: c.client,
      decision: c.decision,
      decisionLabel: decisionMemoryLabel(c.decision),
      fitScore: c.fitScore,
      readinessScore: c.readinessScore,
      bidScore: c.bidScore,
      reasoning: c.reasoning,
      similarity: Math.round(similarity * 1000) / 1000,
      relevanceReasons:
        reasons.length > 0
          ? reasons
          : ["Overall feature similarity above relevance threshold"],
      analyzedAt:
        typeof c.analyzedAt === "string"
          ? c.analyzedAt
          : c.analyzedAt.toISOString(),
      disclaimer: DECISION_MEMORY_DISCLAIMER,
    });
  }

  scored.sort((a, b) => b.similarity - a.similarity || b.analyzedAt.localeCompare(a.analyzedAt));
  const matches = scored.slice(0, MAX_MATCHES);

  return {
    computed: true,
    matches,
    emptyReason:
      matches.length === 0
        ? "No relevant prior decisions found for this opportunity yet."
        : null,
    currentAnalysisNote: EMPTY_DECISION_MEMORY_INSIGHTS.currentAnalysisNote,
    historicalNote: EMPTY_DECISION_MEMORY_INSIGHTS.historicalNote,
  };
}

/** Stable integrity hash — detects empty/corrupt overwrites. */
export function decisionMemoryContentHash(input: {
  decision: DecisionType;
  fitScore: number | null;
  readinessScore: number | null;
  bidScore: number | null;
  reasoning: string;
  requirementsSnapshot: DecisionMemoryRequirementsSnapshot;
  risksSnapshot: DecisionMemoryRiskSnapshot[];
}): string {
  const payload = JSON.stringify({
    d: input.decision,
    f: input.fitScore,
    r: input.readinessScore,
    b: input.bidScore,
    reason: input.reasoning.trim(),
    reqTotal: input.requirementsSnapshot.totalRequirements,
    riskCount: input.risksSnapshot.length,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export function isCorruptOrEmptyMemoryPayload(input: {
  reasoning: string;
  requirementsSnapshot: DecisionMemoryRequirementsSnapshot;
}): boolean {
  if (!input.reasoning.trim()) return true;
  if (
    typeof input.requirementsSnapshot.totalRequirements !== "number" ||
    input.requirementsSnapshot.totalRequirements < 0
  ) {
    return true;
  }
  return false;
}
