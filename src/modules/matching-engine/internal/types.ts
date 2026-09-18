import type {
  MatchRecommendationStatus,
  MatchRecommendationType,
  MatchingIntentDirection,
  MatchingOpportunityStatus,
  MatchQualityState,
} from "@prisma/client";
import type { MatchingProfileSnapshot } from "@/domain/matching-engine";

export type PublicOpportunityDto = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  industry: string | null;
  services: string[];
  industries: string[];
  geographies: string[];
  certifications: string[];
  sizeBand: string | null;
  experienceHint: string | null;
  deadline: string | null;
  source: string;
  externalRef: string | null;
  status: MatchingOpportunityStatus;
  sponsored: boolean;
  /** Two-sided intent seam — public-safe only. */
  intentDirection: MatchingIntentDirection;
};

export type MatchRecommendationDto = {
  id: string;
  type: MatchRecommendationType;
  score: number;
  confidence: number;
  reasons: string[];
  explanation: string | null;
  status: MatchRecommendationStatus;
  qualityState: MatchQualityState;
  preferenceBoost: number;
  geographyBoost: number;
  aiRefineBoost: number;
  finalRankScore: number | null;
  isNew: boolean;
  rankedAt: string;
  opportunity: PublicOpportunityDto;
};

export type CompanyMatchingProfileDto = {
  companyId: string;
  eligible: boolean;
  completeness: number;
  contentHash: string;
  version: number;
  builtAt: string;
  snapshot: MatchingProfileSnapshot;
};

export type UpsertOpportunityInput = {
  id?: string;
  title: string;
  summary?: string | null;
  category?: string | null;
  industry?: string | null;
  services?: string[];
  industries?: string[];
  geographies?: string[];
  certifications?: string[];
  sizeBand?: string | null;
  experienceHint?: string | null;
  deadline?: Date | string | null;
  source?: string;
  externalRef?: string | null;
  status?: MatchingOpportunityStatus;
  /** Ignored on write — sponsored is owned by live MatchingSponsorship sync only. */
  sponsored?: boolean;
  sponsorshipMeta?: unknown;
  signalsJson?: unknown;
  intentDirection?: MatchingIntentDirection | string | null;
};
