/** Module-private — do not import from outside @/modules/document-compliance. */

export {
  extractComplianceMetadataFromText,
  type ExtractedComplianceMetadata,
  type ExtractionProvenanceEntry,
} from "./extract-metadata";
export {
  computeComplianceStatus,
  type StatusInput,
} from "./status";
export {
  addDaysDateOnly,
  dateOnlyToUtcDate,
  daysBetweenDateOnly,
  formatDateOnly,
  isDateOnlyString,
  parseLooseDateOnly,
  todayDateOnly,
} from "./date-only";
export {
  planReminderDates,
} from "./repository";
export {
  scheduleRemindersForDocument,
  reconcileDocumentComplianceReminders,
} from "./reminders";
export {
  uploadComplianceDocument,
  addComplianceDocumentVersion,
  getComplianceDashboard,
  getComplianceDocument,
  listComplianceDocuments,
  listComplianceCategories,
  getComplianceReminderSettings,
  saveComplianceReminderSettings,
  getComplianceFileForDownload,
  listDocumentVersions,
} from "./service";
export type {
  ComplianceDocumentDto,
  ComplianceCategoryDto,
  ComplianceReminderSettingsDto,
  ComplianceDashboardDto,
  UploadComplianceDocumentInput,
  AddComplianceVersionInput,
} from "./types";
