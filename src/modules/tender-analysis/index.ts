/**
 * Tender Analysis — public module API.
 *
 * Import ONLY from `@/modules/tender-analysis`.
 * Do not import `@/modules/tender-analysis/internal` from other product modules.
 */

export {
  TENDER_ANALYSIS_FEATURE_KEY,
  TENDER_ANALYSIS_MODULE_ID,
  TENDER_ANALYSIS_MODULE_NAME,
  SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX,
} from "./constants";

export {
  TENDER_ANALYSIS_OWNERSHIP,
  TENDER_ANALYSIS_OWNED_PACKAGES,
  TENDER_ANALYSIS_PIPELINE,
} from "./ownership";

export {
  assertTenderAnalysisAvailable,
  isSuperAdminEnterSession,
  isTenderAnalysisAvailable,
  isTenderAnalysisGloballyEnabled,
  tenderAnalysisUnavailableReason,
} from "./access";

export {
  getTenderAnalysisStatus,
  processTenderAnalysis,
  uploadAndQueueTenderPackage,
} from "./entry";

export {
  requireTenderAnalysisModule,
  TENDER_ANALYSIS_DISABLED_REDIRECT,
} from "./guard";
