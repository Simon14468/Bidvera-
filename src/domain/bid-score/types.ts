/**
 * Bid Score + Expected Value — decision-support only.
 *
 * NOT a win probability. NOT a Bid/No-Bid replacement.
 * Never invents financial numbers.
 */

export type BidPriority =
  | "VERY_HIGH"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "VERY_LOW";

export type QualitativeLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type ValueProvenance = "KNOWN" | "ESTIMATED" | "INFERRED" | "UNKNOWN";

export type ScoreDriver = {
  direction: "positive" | "negative";
  label: string;
};

export type BidScoreBreakdown = {
  /** When false, numeric score is not a valid prioritization signal. */
  scoringAvailable?: boolean;
  /** 0–100 priority / attractiveness — NOT win probability */
  score: number;
  priority: BidPriority;
  priorityLabel: string;
  /** User-facing interpretation — careful language */
  interpretation: string;
  expectedValue: QualitativeLevel;
  expectedValueNote: string;
  /** Never fabricated — null when not specified by tender */
  contractValue: number | null;
  contractValueLabel: string;
  contractValueProvenance: ValueProvenance;
  /** Never fabricated */
  pursuitCost: number | null;
  pursuitCostLabel: string;
  pursuitCostProvenance: ValueProvenance;
  /** Never a fake % — only "Not available" or qualitative signal note */
  winProbabilityLabel: string;
  winProbabilityProvenance: ValueProvenance;
  effort: QualitativeLevel;
  effortNote: string;
  riskLevel: QualitativeLevel;
  drivers: ScoreDriver[];
  /** True when important inputs missing — score still shown but certainty reduced */
  reducedCertainty: boolean;
  certaintyNote: string | null;
  disclaimer: string;
};

export type BidScoreInput = {
  fitScore: number | null;
  readinessScore: number | null;
  compliance: {
    total: number;
    ready: number;
    missing: number;
    verify: number;
    missingMandatory: number;
    verifyMandatory: number;
  };
  highRiskCount: number;
  criticalRiskCount: number;
  estimatedValue: number | null;
  /** Days until deadline when known; null if unknown */
  daysUntilDeadline: number | null;
  requirementCount: number;
  /** Only VERIFIED/ACTIVE + influenceAllowed historical signal */
  historical: {
    detected: boolean;
    influenceAllowed: boolean;
    lean: "more_often_successful" | "more_often_unsuccessful" | "mixed" | "insufficient" | null;
  } | null;
  /** Existing Bid/No-Bid — for drivers only; does not force score equality */
  decision: "BID" | "REVIEW" | "NO_BID" | null;
};
