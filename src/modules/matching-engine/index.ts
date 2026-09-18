/**
 * Bidvera Matching Engine — public module API (Feature 8B–8F).
 *
 * Import ONLY from `@/modules/matching-engine`.
 * Isolated from Tender Analysis, Decision Engine, and Questionnaire semantics.
 */

export {
  MATCHING_ENGINE_DISABLED_REDIRECT,
  MATCHING_ENGINE_FEATURE_KEY,
  MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY,
  MATCHING_ENGINE_MODULE_ID,
  MATCHING_ENGINE_MODULE_NAME,
  SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX,
} from "./constants";

export {
  assertMatchingEngineAvailable,
  countEligibleMatchingCompanies,
  countEligibleMatchingCompaniesIncludingFixtures,
  getMatchingEngineMinEligibleCompanies,
  isMatchingEngineAvailable,
  isMatchingEngineGloballyEnabled,
  isMatchingEngineThresholdMet,
  isSuperAdminEnterSession,
} from "./access";

export {
  isMatchingTestFixtureCompany,
  matchingNonFixtureCompanyFilter,
  MATCHING_TEST_FIXTURE_SLUG_PREFIXES,
} from "./fixtures";

export { requireMatchingEngineModule } from "./guard";

export {
  countNewMatchesForCompany,
  createCompanySponsorship,
  dismissRecommendationForCompany,
  generateRecommendationsForCompany,
  getCompanyMatchingAnalytics,
  getMatchedStripForCompany,
  getMatchingEngineHealthAnalytics,
  getMatchingPreferencesForCompany,
  getMatchingProfileForCompany,
  getOpportunityMatchingRollups,
  getPlatformMatchingAnalytics,
  getPublicOpportunity,
  getRecommendationForCompany,
  impressionIdempotencyKey,
  engagementIdempotencyKey,
  listCompanySponsorships,
  listRecommendationsForCompany,
  listActiveSponsoredMatchingPlansForCompany,
  listSponsoredMatchingPlanRequestsForCompany,
  markRecommendationReadForCompany,
  rebuildMatchingPreferencesForCompany,
  rebuildMatchingProfileForCompany,
  previewMatchingProfileForCompany,
  reconcileMatchingOpportunityLifecycle,
  reconcileMatchingSponsorshipLifecycle,
  recordBehaviorEventForCompany,
  requestSponsoredMatchingPlanForCompany,
  transitionCompanySponsorship,
  transitionOpportunity,
  upsertOpportunity,
  upsertOpportunityBatch,
} from "./entry";

export {
  assertMatchingEngineCanEnableGlobally,
  getMatchingActivationReadiness,
} from "./internal/activation-readiness";

export type { MatchingActivationReadiness } from "./internal/activation-readiness";

export type {
  CompanyMatchingProfileDto,
  MatchRecommendationDto,
  PublicOpportunityDto,
  UpsertOpportunityInput,
} from "./internal/types";

export type { MatchingBehaviorEventDto } from "./internal/events";
export type { MatchingAnalyticsTotals } from "./internal/analytics";
export type { CompanyMatchingPreferenceDto } from "./internal/preferences";
export type { MatchingHealthAnalytics } from "./internal/health";
export type { MatchingAiAdminSnapshot } from "./internal/ai-config";
export type { MatchingSponsorshipDto } from "./internal/sponsorship";
export type {
  MatchingSponsorshipPricingPlanDto,
  MatchingSponsorshipPricingRequestDto,
} from "./internal/sponsorship-pricing";

export {
  getMatchingAiAdminSnapshot,
  MATCHING_AI_DEFAULT_MODEL,
  MATCHING_AI_SETTINGS_KEY,
  MATCHING_AI_VAULT_KEY,
} from "./internal/ai-config";

export {
  getMatchingAIProvider,
  testMatchingAiConnection,
} from "./internal/ai-provider";

export {
  MATCHING_SPONSORSHIP_SETTINGS_KEY,
  isMatchingSponsorshipGloballyEnabled,
  setMatchingSponsorshipGloballyEnabled,
} from "./internal/sponsorship-settings";

/** TED Search API v3 adapter — isolated from scoring; OFF by default. */
export {
  TED_SEARCH_URL,
  TED_SETTINGS_KEY,
  TED_SOURCE,
  TED_VAULT_KEY,
  TED_CONTROLLED_PILOT_GEOGRAPHIES,
  applyTedControlledPilotScope,
  getTedAdminSnapshot,
  runTedOpportunityDryRun,
  runTedOpportunityIngest,
  runTedOpportunityIngestIfScheduled,
} from "./ted";
export type {
  TedAdminSnapshot,
  TedDryRunReport,
  TedIngestRunResult,
  TedPublicSettings,
} from "./ted";
