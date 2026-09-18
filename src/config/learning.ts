/**
 * Configurable evidence requirements for safe learning validation.
 * Patterns must NOT activate from a simplistic “N successes” rule.
 */
export const LEARNING_EVIDENCE = {
  /** Distinct organizations required before a pattern can verify */
  minIndependentOrgs: 3,
  /** Distinct opportunities (samples) required */
  minOpportunities: 5,
  /** WON + LOST observations required (decisive outcomes) */
  minDecisiveOutcomes: 4,
  /** Minimum weighted similarity to surface a signal */
  minSimilarityForSignal: 0.7,
  /** Data-quality score 0–100 */
  minDataQuality: 60,
  /** Consistency score 0–100 (stable lean, not noise) */
  minConsistency: 55,
  /**
   * Max share of contributions from a single organization (0–1).
   * One company must never dominate the global layer.
   */
  maxSingleOrgShare: 0.4,
  /** Extra samples beyond verify threshold before promoting to ACTIVE */
  activeExtraSamples: 3,
  /** If metrics degrade while ACTIVE, move to MONITORED */
  monitorQualityFloor: 50,
  /** Below this, retire the pattern from recommendation influence */
  retireQualityFloor: 35,
} as const;

export type LearningEvidenceConfig = typeof LEARNING_EVIDENCE;
