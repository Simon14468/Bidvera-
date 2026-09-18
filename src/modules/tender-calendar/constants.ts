export const TENDER_CALENDAR_MODULE_ID = "tender-calendar" as const;
export const TENDER_CALENDAR_FEATURE_KEY = "tender_calendar" as const;
export const TENDER_CALENDAR_MODULE_NAME = "Tender Calendar";
export const SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX = "sa-enter:" as const;

export const DEADLINE_TYPES = [
  "SUBMISSION",
  "CLARIFICATION",
  "OPENING",
  "SITE_VISIT",
  "MEETING",
  "OTHER",
] as const;

export const TENDER_STATUSES = [
  "OPEN",
  "WATCHING",
  "SUBMITTED",
  "CLOSED",
  "CANCELLED",
] as const;
