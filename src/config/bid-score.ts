/**
 * Configurable Bid Score priority bands and weights.
 * Thresholds are adjustable without changing scoring logic.
 */
export const BID_SCORE_BANDS = [
  { min: 90, max: 100, priority: "VERY_HIGH", label: "Very High Priority" },
  { min: 75, max: 89, priority: "HIGH", label: "High Priority" },
  { min: 60, max: 74, priority: "MEDIUM", label: "Medium / Review" },
  { min: 40, max: 59, priority: "LOW", label: "Low Priority" },
  { min: 0, max: 39, priority: "VERY_LOW", label: "Very Low Priority" },
] as const;

export const BID_SCORE_WEIGHTS = {
  fit: 0.35,
  readiness: 0.3,
  compliance: 0.2,
  /** Residual capacity for risk/effort/history adjustments (applied after blend) */
} as const;

export const BID_SCORE_PENALTIES = {
  highRisk: 5,
  criticalRisk: 8,
  maxRiskPenalty: 25,
  missingMandatory: 8,
  maxMissingMandatoryPenalty: 30,
  verifyMandatory: 3,
  maxVerifyMandatoryPenalty: 15,
  effortHigh: 8,
  effortMedium: 4,
  historicalPositive: 4,
  historicalNegative: 4,
} as const;

export type BidScoreBandConfig = (typeof BID_SCORE_BANDS)[number];
