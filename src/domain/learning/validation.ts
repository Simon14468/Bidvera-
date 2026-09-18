import { LEARNING_EVIDENCE } from "@/config/learning";
import type { LearningPatternLifecycle } from "./types";

export type PatternEvidenceStats = {
  sampleCount: number;
  independentOrgCount: number;
  decisiveOutcomeCount: number;
  wonCount: number;
  lostCount: number;
  /** 0–1 share of contributions from the single largest org */
  maxOrgShare: number;
  /** 0–100 */
  dataQualityScore: number;
  /** 0–100 */
  consistencyScore: number;
  previousLifecycle?: LearningPatternLifecycle | null;
};

export type PatternEvidenceResult = {
  lifecycle: LearningPatternLifecycle;
  /** Only VERIFIED / ACTIVE may influence recommendations */
  canInfluence: boolean;
  reasons: string[];
};

/** Compute data-quality score from coverage of coarse feature buckets. */
export function computeDataQualityScore(input: {
  unknownFeatureCount: number;
  totalFeatureCount: number;
  sampleCount: number;
  independentOrgCount: number;
}): number {
  const knownRatio =
    input.totalFeatureCount === 0
      ? 0
      : (input.totalFeatureCount - input.unknownFeatureCount) /
        input.totalFeatureCount;
  const sampleFactor = Math.min(1, input.sampleCount / LEARNING_EVIDENCE.minOpportunities);
  const orgFactor = Math.min(
    1,
    input.independentOrgCount / LEARNING_EVIDENCE.minIndependentOrgs,
  );
  return Math.round((knownRatio * 0.5 + sampleFactor * 0.25 + orgFactor * 0.25) * 100);
}

/** Consistency of decisive outcomes (not pure noise). */
export function computeConsistencyScore(wonCount: number, lostCount: number): number {
  const decisive = wonCount + lostCount;
  if (decisive < 2) return 0;
  const ratio = wonCount / decisive;
  // Peak when lean is clear (near 0 or 1), lower when exactly 50/50 with tiny n
  const clarity = Math.abs(ratio - 0.5) * 2; // 0–1
  const volume = Math.min(1, decisive / LEARNING_EVIDENCE.minDecisiveOutcomes);
  return Math.round((clarity * 0.55 + volume * 0.45) * 100);
}

function meetsEvidenceFloor(stats: PatternEvidenceStats): boolean {
  return (
    stats.independentOrgCount >= LEARNING_EVIDENCE.minIndependentOrgs &&
    stats.sampleCount >= LEARNING_EVIDENCE.minOpportunities &&
    stats.decisiveOutcomeCount >= LEARNING_EVIDENCE.minDecisiveOutcomes &&
    stats.maxOrgShare <= LEARNING_EVIDENCE.maxSingleOrgShare &&
    stats.dataQualityScore >= LEARNING_EVIDENCE.minDataQuality &&
    stats.consistencyScore >= LEARNING_EVIDENCE.minConsistency
  );
}

/**
 * Evaluate pattern lifecycle from evidence — never “4 wins → activate”.
 */
export function evaluatePatternLifecycle(
  stats: PatternEvidenceStats,
): PatternEvidenceResult {
  const reasons: string[] = [];
  const prev = stats.previousLifecycle ?? "CANDIDATE";

  if (stats.sampleCount <= 0) {
    return {
      lifecycle: "CANDIDATE",
      canInfluence: false,
      reasons: ["No outcome observations yet."],
    };
  }

  if (stats.independentOrgCount < LEARNING_EVIDENCE.minIndependentOrgs) {
    reasons.push(
      `Needs ${LEARNING_EVIDENCE.minIndependentOrgs}+ independent organizations (have ${stats.independentOrgCount}).`,
    );
  }
  if (stats.sampleCount < LEARNING_EVIDENCE.minOpportunities) {
    reasons.push(
      `Needs ${LEARNING_EVIDENCE.minOpportunities}+ opportunities (have ${stats.sampleCount}).`,
    );
  }
  if (stats.decisiveOutcomeCount < LEARNING_EVIDENCE.minDecisiveOutcomes) {
    reasons.push(
      `Needs ${LEARNING_EVIDENCE.minDecisiveOutcomes}+ decisive outcomes (have ${stats.decisiveOutcomeCount}).`,
    );
  }
  if (stats.maxOrgShare > LEARNING_EVIDENCE.maxSingleOrgShare) {
    reasons.push(
      "A single organization would dominate this pattern — blocked.",
    );
  }
  if (stats.dataQualityScore < LEARNING_EVIDENCE.minDataQuality) {
    reasons.push("Data quality below evidence threshold.");
  }
  if (stats.consistencyScore < LEARNING_EVIDENCE.minConsistency) {
    reasons.push("Historical results are not yet consistent enough.");
  }

  // Degradation paths
  if (
    (prev === "ACTIVE" || prev === "VERIFIED" || prev === "MONITORED") &&
    stats.dataQualityScore < LEARNING_EVIDENCE.retireQualityFloor
  ) {
    return {
      lifecycle: "RETIRED",
      canInfluence: false,
      reasons: [...reasons, "Pattern retired due to degraded evidence quality."],
    };
  }

  if (
    (prev === "ACTIVE" || prev === "VERIFIED") &&
    !meetsEvidenceFloor(stats)
  ) {
    return {
      lifecycle: "MONITORED",
      canInfluence: false,
      reasons: [...reasons, "Previously verified pattern under monitoring."],
    };
  }

  if (!meetsEvidenceFloor(stats)) {
    const lifecycle: LearningPatternLifecycle =
      stats.sampleCount >= 2 || stats.independentOrgCount >= 2
        ? "VALIDATING"
        : "CANDIDATE";
    return { lifecycle, canInfluence: false, reasons };
  }

  // Evidence floor met
  const activeReady =
    stats.sampleCount >=
    LEARNING_EVIDENCE.minOpportunities + LEARNING_EVIDENCE.activeExtraSamples;

  if (activeReady && stats.dataQualityScore >= LEARNING_EVIDENCE.minDataQuality) {
    return {
      lifecycle: "ACTIVE",
      canInfluence: true,
      reasons: ["Evidence requirements met — pattern is active."],
    };
  }

  return {
    lifecycle: "VERIFIED",
    canInfluence: true,
    reasons: ["Evidence requirements met — pattern verified."],
  };
}

export function canLifecycleInfluence(
  lifecycle: LearningPatternLifecycle | null | undefined,
): boolean {
  return lifecycle === "VERIFIED" || lifecycle === "ACTIVE";
}

/**
 * Decision priority gate: historical patterns never override current evidence.
 *
 * Priority:
 * 1. Current tender evidence
 * 2. Current company evidence
 * 3. Deterministic compliance rules
 * 4. Company-specific verified history
 * 5. Verified aggregated historical patterns
 * 6. AI interpretation
 */
export function applyDecisionPriorityGate(input: {
  missingMandatoryCount: number;
  hardNoBid: boolean;
  forcedReview: boolean;
  readinessMissing: number;
}): { influenceAllowed: boolean; suppressedReason: string | null } {
  if (input.hardNoBid) {
    return {
      influenceAllowed: false,
      suppressedReason:
        "Current tender evidence indicates a hard compliance blocker — historical patterns cannot override this.",
    };
  }
  if (input.missingMandatoryCount > 0) {
    return {
      influenceAllowed: false,
      suppressedReason:
        "Mandatory requirements are missing or unverified on the current tender — current requirements take priority over historical patterns.",
    };
  }
  if (input.readinessMissing > 0 && input.forcedReview) {
    return {
      influenceAllowed: false,
      suppressedReason:
        "Deterministic compliance review is required — historical success of similar opportunities does not recommend BID.",
    };
  }
  return { influenceAllowed: true, suppressedReason: null };
}
