/**
 * Matching Engine domain types (Feature 8B).
 * Isolated from Tender Analysis / Decision Engine semantics.
 */

export type MatchingTrustTier = "strong" | "normal" | "soft";

export type MatchingDimensionKey =
  | "service"
  | "industry"
  | "experience"
  | "size"
  | "country"
  | "geography"
  | "qualifications";

export type MatchingSignal = {
  value: string;
  trust: MatchingTrustTier;
  source: string;
};

export type MatchingProfileSnapshot = {
  services: MatchingSignal[];
  industries: MatchingSignal[];
  /**
   * Registered / HQ country signals (separate from geographic coverage).
   * Optional on older stored snapshots — scorer falls back to geographies.
   */
  countries?: MatchingSignal[];
  /** Coverage regions / markets (may include country-level labels from coverage lists). */
  geographies: MatchingSignal[];
  certifications: MatchingSignal[];
  size: MatchingSignal | null;
  experienceYears: { value: number; trust: MatchingTrustTier; source: string } | null;
  dcmCategories: MatchingSignal[];
  softNotes: string[];
  /**
   * Canonical company IANA timezone from notification prefs.
   * Used for local deadline interpretation / Matching AI context — not a geography signal.
   * Optional for older stored snapshots that predate this field.
   */
  timezone?: MatchingSignal | null;
};

export type MatchingTrustSummary = {
  strong: number;
  normal: number;
  soft: number;
};

export type OpportunityMatchingSignals = {
  services: string[];
  industries: string[];
  /** Country-level location(s) for the opportunity. */
  countries: string[];
  /** Broader geography / region / city coverage (excludes values already in countries when derived). */
  geographies: string[];
  certifications: string[];
  /** When set, company must match this country (hard gate). */
  requiredCountry: string | null;
  /** When true, country mismatch fails the hard gate. */
  countryRequired: boolean;
  /** Certifications that must be present (hard gate). Empty = soft scoring only. */
  mandatoryCertifications: string[];
  /**
   * Explicit required capabilities/services (hard gate).
   * Empty = soft service scoring, but when opportunity.services is non-empty,
   * service dimension must still clear the hard capability floor (precision).
   */
  mandatoryServices: string[];
  sizeBand: string | null;
  experienceYearsRequired: number | null;
  category: string | null;
  industry: string | null;
};

export type MatchedDimensionResult = {
  key: MatchingDimensionKey;
  label: string;
  score: number | null;
  status: "scored" | "unknown" | "not_applicable";
  trustUsed: MatchingTrustTier | "none";
  note: string;
};

export type MatchScoreResult = {
  /** Professional fit score 0–100 (deterministic). */
  score: number;
  confidence: number;
  dimensions: MatchedDimensionResult[];
  /** Dimensions that positively support the match (score ≥ 50). */
  matchedDimensions: MatchedDimensionResult[];
  /** Missing / weak dimensions and hard-gate failures for explainability. */
  gapDimensions: MatchedDimensionResult[];
  reasons: string[];
  explanation: string;
  /** True when score and hard-dimension rules pass the relevance floor. */
  meetsRelevanceThreshold: boolean;
  /** Structured gate failure reasons (empty when threshold met). */
  gateFailures: string[];
};

/**
 * Country + geography weights together equal the former geography weight (0.18)
 * so ME8C / existing fixtures remain score-stable when both match the same token.
 */
export const MATCHING_DIMENSION_WEIGHTS: Record<MatchingDimensionKey, number> = {
  service: 0.28,
  industry: 0.18,
  country: 0.08,
  geography: 0.1,
  qualifications: 0.16,
  experience: 0.1,
  size: 0.1,
};

/** Named relevance floor — not the eligible-companies SystemSetting. */
export const MATCHING_MIN_RELEVANCE_SCORE = 40;

/** At least one hard (strong/normal) dimension must score above this. */
export const MATCHING_MIN_HARD_DIMENSION_SCORE = 50;

/** Canonical company-size bands used by Matching. */
export const MATCHING_SIZE_BANDS = [
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1000+",
] as const;

export type MatchingSizeBand = (typeof MATCHING_SIZE_BANDS)[number];
