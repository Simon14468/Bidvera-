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
  geographies: MatchingSignal[];
  certifications: MatchingSignal[];
  size: MatchingSignal | null;
  experienceYears: { value: number; trust: MatchingTrustTier; source: string } | null;
  dcmCategories: MatchingSignal[];
  softNotes: string[];
};

export type MatchingTrustSummary = {
  strong: number;
  normal: number;
  soft: number;
};

export type OpportunityMatchingSignals = {
  services: string[];
  industries: string[];
  geographies: string[];
  certifications: string[];
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
  score: number;
  confidence: number;
  dimensions: MatchedDimensionResult[];
  reasons: string[];
  explanation: string;
  /** True when score and hard-dimension rules pass the relevance floor. */
  meetsRelevanceThreshold: boolean;
};

export const MATCHING_DIMENSION_WEIGHTS: Record<MatchingDimensionKey, number> = {
  service: 0.28,
  industry: 0.18,
  geography: 0.18,
  qualifications: 0.16,
  experience: 0.1,
  size: 0.1,
};

/** Named relevance floor — not the eligible-companies SystemSetting. */
export const MATCHING_MIN_RELEVANCE_SCORE = 40;

/** At least one hard (strong/normal) dimension must score above this. */
export const MATCHING_MIN_HARD_DIMENSION_SCORE = 50;
