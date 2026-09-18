import { LEARNING_EVIDENCE } from "@/config/learning";
import type {
  LearningFeatures,
  LearningOutcomeLean,
  LearningPatternLifecycle,
  LearningSignalStrength,
  SimilarCompanyLearningSignal,
} from "./types";
import { EMPTY_LEARNING_SIGNAL } from "./types";
import { canLifecycleInfluence } from "./validation";

export type PatternCandidate = {
  id: string;
  featureKey: string;
  features: LearningFeatures;
  sampleCount: number;
  wonCount: number;
  lostCount: number;
  bidSubmittedCount: number;
  noBidCount: number;
  withdrawnCount: number;
  lifecycle: LearningPatternLifecycle;
  independentOrgCount: number;
  dataQualityScore: number;
  consistencyScore: number;
  /** @deprecated derived from lifecycle */
  validated: boolean;
};

const FEATURE_WEIGHTS: Record<keyof LearningFeatures, number> = {
  industryBucket: 1.5,
  countryBucket: 1.2,
  sizeBand: 0.8,
  fitBand: 1.0,
  readinessBand: 1.0,
  decisionAtAnalysis: 0.9,
  mandatoryGapBand: 1.1,
  valueBand: 0.7,
};

/** Weighted similarity in [0, 1]. Exact key match → 1. */
export function similarityScore(
  a: LearningFeatures,
  b: LearningFeatures,
): number {
  let weight = 0;
  let matched = 0;
  for (const key of Object.keys(FEATURE_WEIGHTS) as (keyof LearningFeatures)[]) {
    const w = FEATURE_WEIGHTS[key];
    weight += w;
    if (a[key] === b[key] && a[key] !== "unknown") {
      matched += w;
    } else if (a[key] === b[key]) {
      matched += w * 0.35;
    }
  }
  return weight === 0 ? 0 : matched / weight;
}

function outcomeLean(pattern: PatternCandidate): LearningOutcomeLean {
  const decisive = pattern.wonCount + pattern.lostCount;
  if (decisive < 2) return "insufficient";
  const winRatio = pattern.wonCount / decisive;
  if (winRatio >= 0.6) return "more_often_successful";
  if (winRatio <= 0.4) return "more_often_unsuccessful";
  return "mixed";
}

function strengthFor(
  similarity: number,
  sampleCount: number,
  orgCount: number,
): LearningSignalStrength {
  if (
    similarity >= 0.85 &&
    sampleCount >= LEARNING_EVIDENCE.minOpportunities + LEARNING_EVIDENCE.activeExtraSamples &&
    orgCount >= LEARNING_EVIDENCE.minIndependentOrgs
  ) {
    return "HIGH";
  }
  if (
    similarity >= LEARNING_EVIDENCE.minSimilarityForSignal &&
    sampleCount >= LEARNING_EVIDENCE.minOpportunities
  ) {
    return "MEDIUM";
  }
  return "LOW";
}

function leanPhrase(lean: LearningOutcomeLean): string {
  switch (lean) {
    case "more_often_successful":
      return "Among anonymized similar opportunities with recorded results, successful outcomes appear more often than unsuccessful ones.";
    case "more_often_unsuccessful":
      return "Among anonymized similar opportunities with recorded results, unsuccessful outcomes appear more often than successful ones.";
    case "mixed":
      return "Anonymized similar opportunities show mixed recorded outcomes.";
    default:
      return "Anonymized similar opportunities exist, but recorded results are still limited.";
  }
}

/**
 * Build a safe historical signal from VERIFIED/ACTIVE patterns only.
 * Does not identify peers, copy strategies, or guarantee outcomes.
 */
export function buildLearningSignal(input: {
  features: LearningFeatures;
  featureKey: string;
  candidates: PatternCandidate[];
  influenceAllowed: boolean;
  suppressedReason: string | null;
}): SimilarCompanyLearningSignal {
  const eligible = input.candidates.filter((c) =>
    canLifecycleInfluence(c.lifecycle),
  );
  if (eligible.length === 0) return { ...EMPTY_LEARNING_SIGNAL };

  let best: { pattern: PatternCandidate; similarity: number } | null = null;
  for (const pattern of eligible) {
    const sim =
      pattern.featureKey === input.featureKey
        ? 1
        : similarityScore(input.features, pattern.features);
    if (sim < LEARNING_EVIDENCE.minSimilarityForSignal) continue;
    if (!best || sim > best.similarity) best = { pattern, similarity: sim };
  }

  if (!best) return { ...EMPTY_LEARNING_SIGNAL };

  const lean = outcomeLean(best.pattern);
  const strength = strengthFor(
    best.similarity,
    best.pattern.sampleCount,
    best.pattern.independentOrgCount,
  );

  const influenceAllowed = input.influenceAllowed;
  const detailParts = [
    "Similar historical outcomes may provide a relevant signal for this opportunity.",
    leanPhrase(lean),
    "This is not a prediction that your company will succeed or fail.",
    "Bidvera never reveals contributing companies, their documents, strategies, or exact results.",
  ];
  if (!influenceAllowed && input.suppressedReason) {
    detailParts.push(input.suppressedReason);
  }

  return {
    detected: true,
    strength,
    similarity: Math.round(best.similarity * 100) / 100,
    outcomeLean: lean,
    headline: influenceAllowed
      ? "Relevant historical pattern detected among similar opportunities."
      : "Historical pattern noted — current tender evidence takes priority.",
    detail: detailParts.join(" "),
    priorityNote:
      "Current tender evidence and your company profile always take priority over historical patterns. Historical patterns never recommend BID over missing mandatory requirements.",
    validated: true,
    lifecycle: best.pattern.lifecycle,
    influenceAllowed,
    suppressedReason: influenceAllowed ? null : input.suppressedReason,
    patternRef: best.pattern.id,
  };
}

/** @deprecated Prefer evaluatePatternLifecycle / canLifecycleInfluence */
export function isPatternValidated(sampleCount: number): boolean {
  return sampleCount >= LEARNING_EVIDENCE.minOpportunities;
}
