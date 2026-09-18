/**
 * TED procurement source adapter (Phase 1).
 * Official TED Search API v3 only — isolated from Matching Engine scoring.
 */

export {
  TED_API_VERSION,
  TED_DEFAULT_FORM_TYPES,
  TED_FAIR_USE_HTTP_PER_MINUTE,
  TED_SEARCH_FIELDS,
  TED_SEARCH_MAX_LIMIT,
  TED_SEARCH_URL,
  TED_SETTINGS_KEY,
  TED_SOURCE,
  TED_VAULT_KEY,
} from "./constants";

export {
  DEFAULT_TED_SETTINGS,
  buildTedExpertQuery,
  decryptTedVault,
  encryptTedVault,
  getTedAdminSnapshot,
  getTedApiKey,
  getTedPublicSettings,
  saveTedAdminSettings,
  sanitizeTedErrorMessage,
  tedAdminSaveSchema,
  tedApiKeyHint,
  tedFiltersConfigured,
  tedPublicSettingsSchema,
  type TedAdminSnapshot,
  type TedPublicSettings,
} from "./config";

export { tedSearchNotices, assertFieldCellBudget, type TedClientOptions } from "./client";
export { TedHttpError, type TedNoticeRaw, type TedSearchResponse } from "./types";
export {
  normalizeTedNotice,
  normalizeTedPublicationNumber,
  pickTedLocalizedText,
  tedNoticeUrl,
} from "./normalize";
export { filterTedOpportunity, type TedRelevanceFilterConfig } from "./filter";
export { mapCpvCodesToServices, normalizeCpvCode } from "./cpv";
export { mapTedPlacesToGeographies, resolveIso3ToCountry } from "./geography";
export {
  runTedOpportunityIngest,
  runTedOpportunityIngestIfScheduled,
  type TedIngestRunResult,
} from "./ingest";
export {
  runTedOpportunityDryRun,
  type TedDryRunPreview,
  type TedDryRunReport,
  type TedDryRunQualityMetrics,
} from "./dry-run";
export {
  TED_CONTROLLED_PILOT_GEOGRAPHIES,
  TED_CONTROLLED_PILOT_COUNTRY_LABELS,
  TED_CONTROLLED_PILOT_CPV_FILTERS,
  TED_CONTROLLED_PILOT_LABEL,
  TED_CONTROLLED_PILOT_LIMITS,
  applyTedControlledPilotScope,
} from "./pilot";
export {
  TED_ABSOLUTE_MAX_PAGES,
  fetchTedNoticesBounded,
  resolveTedPageBudget,
} from "./fetch";
export {
  buildTedFreshnessQueryClause,
  formatTedPublicationDateYmd,
  freshnessCutoffDate,
  isPublicationWithinFreshness,
  parseTedDateValue,
  parseTedPublicationDate,
} from "./freshness";
export {
  DEFAULT_TED_PILOT_QUALITY_CRITERIA,
  evaluateTedPilotQuality,
  type TedPilotQualityVerdict,
} from "./quality";
