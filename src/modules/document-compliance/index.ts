/**
 * Document Compliance Manager — public module API.
 *
 * Import ONLY from `@/modules/document-compliance`.
 * Do not import `@/modules/document-compliance/internal` from other product modules.
 */

export {
  DOCUMENT_COMPLIANCE_FEATURE_KEY,
  DOCUMENT_COMPLIANCE_MODULE_ID,
  DOCUMENT_COMPLIANCE_MODULE_NAME,
  SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX,
  DEFAULT_CATEGORY_SEEDS,
} from "./constants";

export {
  assertDocumentComplianceAvailable,
  isSuperAdminEnterSession,
  isDocumentComplianceAvailable,
  isDocumentComplianceGloballyEnabled,
  documentComplianceUnavailableReason,
} from "./access";

export {
  requireDocumentComplianceModule,
  DOCUMENT_COMPLIANCE_DISABLED_REDIRECT,
} from "./guard";

export {
  uploadDocument,
  addDocumentVersion,
  listDocuments,
  getDocument,
  getDashboard,
  listCategories,
  getReminderSettings,
  updateReminderSettings,
  downloadVersionFile,
  listVersions,
  reconcileDocumentCompliance,
} from "./entry";

/** Pure helpers safe for unit tests (no tender-analysis coupling). */
export { extractComplianceMetadataFromText } from "./internal/extract-metadata";
export { computeComplianceStatus } from "./internal/status";
export { planReminderDates } from "./internal/repository";
export {
  addDaysDateOnly,
  daysBetweenDateOnly,
  formatDateOnly,
  todayDateOnly,
  parseLooseDateOnly,
  isDateOnlyString,
} from "./internal/date-only";
export type {
  ComplianceDocumentDto,
  ComplianceCategoryDto,
  ComplianceReminderSettingsDto,
  ComplianceDashboardDto,
} from "./internal/types";
