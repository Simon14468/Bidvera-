/**
 * Privacy-safe similar-company learning types.
 *
 * Pattern lifecycle:
 * CANDIDATE → VALIDATING → VERIFIED → ACTIVE → MONITORED → RETIRED
 *
 * Only VERIFIED / ACTIVE may influence recommendations.
 * Current tender + company evidence always outrank historical patterns.
 */

export type LearningPatternLifecycle =
  | "CANDIDATE"
  | "VALIDATING"
  | "VERIFIED"
  | "ACTIVE"
  | "MONITORED"
  | "RETIRED";

export type LearningFeatures = {
  industryBucket: string;
  countryBucket: string;
  sizeBand: string;
  fitBand: string;
  readinessBand: string;
  decisionAtAnalysis: "BID" | "REVIEW" | "NO_BID";
  mandatoryGapBand: string;
  valueBand: string;
};

export type LearningOutcome =
  | "WON"
  | "LOST"
  | "WITHDRAWN"
  | "CANCELLED"
  | "NOT_SUBMITTED"
  | "PENDING"
  | "BID_SUBMITTED"
  | "NO_BID_CONFIRMED";

export type LearningSignalStrength = "LOW" | "MEDIUM" | "HIGH";

export type LearningOutcomeLean =
  | "more_often_successful"
  | "more_often_unsuccessful"
  | "mixed"
  | "insufficient";

/**
 * Probabilistic historical signal — never a guarantee, never identifies peers.
 */
export type SimilarCompanyLearningSignal = {
  detected: boolean;
  strength: LearningSignalStrength | null;
  similarity: number | null;
  outcomeLean: LearningOutcomeLean | null;
  headline: string;
  detail: string;
  priorityNote: string;
  /** Pattern met evidence requirements and is VERIFIED/ACTIVE */
  validated: boolean;
  lifecycle: LearningPatternLifecycle | null;
  /**
   * False when current tender/company evidence blocks influence
   * (e.g. missing mandatory certification). Signal may still be informational.
   */
  influenceAllowed: boolean;
  suppressedReason: string | null;
  /** Opaque pattern id for audit — not a company id */
  patternRef: string | null;
};

/**
 * Company-private history — never mixed into global aggregates for other tenants.
 */
export type CompanyHistorySignal = {
  detected: boolean;
  priorOutcomes: number;
  headline: string;
  detail: string;
  priorityNote: string;
};

export const EMPTY_LEARNING_SIGNAL: SimilarCompanyLearningSignal = {
  detected: false,
  strength: null,
  similarity: null,
  outcomeLean: null,
  headline: "",
  detail: "",
  priorityNote:
    "Decision priority: current tender evidence → company evidence → compliance rules → company history → verified aggregated patterns → AI interpretation.",
  validated: false,
  lifecycle: null,
  influenceAllowed: false,
  suppressedReason: null,
  patternRef: null,
};

export const EMPTY_COMPANY_HISTORY_SIGNAL: CompanyHistorySignal = {
  detected: false,
  priorOutcomes: 0,
  headline: "",
  detail: "",
  priorityNote:
    "Company-specific history stays private to your organization and never overrides current tender requirements.",
};

/** @deprecated Use LEARNING_EVIDENCE from config/learning — kept for import stability */
export const LEARNING_MIN_COHORT = 5;
