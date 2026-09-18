export {
  generateMatchRecommendations,
  getCompanyMatchingProfile,
  getDashboardMatchedStrip,
  getMatchRecommendationForCompany,
  getMatchingOpportunityPublic,
  listMatchRecommendations,
  markRecommendationRead,
  dismissRecommendation,
  rebuildCompanyMatchingProfile,
  previewCompanyMatchingProfile,
  type MatchingProfilePreview,
  upsertMatchingOpportunity,
  upsertMatchingOpportunityBatch,
  countNewRelevantMatches,
} from "./service";

export {
  transitionOpportunityStatus,
  reconcileExpiredMatchingOpportunities,
  invalidateRecommendationsForOpportunity,
} from "./lifecycle";

export {
  recordMatchingBehaviorEvent,
  impressionIdempotencyKey,
  engagementIdempotencyKey,
} from "./events";

export {
  getMatchingCompanyAnalytics,
  getMatchingPlatformAnalytics,
  getOpportunityAnalyticsRollups,
  incrementMatchingDailyRollups,
} from "./analytics";

export {
  rebuildCompanyMatchingPreferences,
  getCompanyMatchingPreferences,
  scheduleMatchingPreferenceRebuild,
} from "./preferences";

export { getMatchingHealthAnalytics } from "./health";

export {
  getMatchingAiAdminSnapshot,
  getMatchingAiRuntimeConfig,
  MATCHING_AI_DEFAULT_MODEL,
  MATCHING_AI_SETTINGS_KEY,
  MATCHING_AI_VAULT_KEY,
} from "./ai-config";

export {
  createMatchingAiReorderFn,
  getMatchingAIProvider,
  testMatchingAiConnection,
} from "./ai-provider";

export type {
  CompanyMatchingProfileDto,
  MatchRecommendationDto,
  PublicOpportunityDto,
  UpsertOpportunityInput,
} from "./types";

export type { MatchingBehaviorEventDto } from "./events";
export type { MatchingAnalyticsTotals } from "./analytics";
export type { CompanyMatchingPreferenceDto } from "./preferences";
export type { MatchingHealthAnalytics } from "./health";
export type { MatchingSponsorshipDto } from "./sponsorship";
export {
  reconcileOpportunitySponsoredFlag,
  clearOrphanedSponsoredOpportunityFlags,
} from "./sponsorship";

export {
  getMatchingActivationReadiness,
  assertMatchingEngineCanEnableGlobally,
} from "./activation-readiness";

export type { MatchingActivationReadiness } from "./activation-readiness";
