/**
 * Tender Calendar & Notifications — public module API.
 *
 * Import ONLY from `@/modules/tender-calendar`.
 * Do not import `@/modules/tender-calendar/internal` from other modules.
 * Uses CalendarTender* tables — never the Tender Analysis `Tender` model.
 */

export {
  TENDER_CALENDAR_FEATURE_KEY,
  TENDER_CALENDAR_MODULE_ID,
  TENDER_CALENDAR_MODULE_NAME,
  SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX,
  DEADLINE_TYPES,
  TENDER_STATUSES,
} from "./constants";

export {
  assertTenderCalendarAvailable,
  isSuperAdminEnterSession,
  isTenderCalendarAvailable,
  isTenderCalendarGloballyEnabled,
  tenderCalendarUnavailableReason,
} from "./access";

export {
  requireTenderCalendarModule,
  TENDER_CALENDAR_DISABLED_REDIRECT,
} from "./guard";

export {
  listCalendarTenders,
  getCalendarTender,
  createCalendarTender,
  updateCalendarTender,
  removeCalendarTender,
  listCalendarDeadlines,
  addCalendarDeadline,
  editCalendarDeadline,
  removeCalendarDeadline,
  listCalendarEvents,
  addCalendarEvent,
  removeCalendarEvent,
  getCalendarDashboard,
  getCalendarMonth,
  getCalendarReminderSettings,
  updateCalendarReminderSettings,
  reconcileTenderCalendar,
} from "./entry";

export {
  parseOccurrenceInput,
  computeMilestoneStatus,
  orderByOccursAtAsc,
  planReminderFireTimes,
  isDateOnlyString,
  formatDateOnly,
} from "./internal";

export type {
  CalendarTenderDto,
  CalendarDeadlineDto,
  CalendarEventDto,
  ReminderSettingsDto,
  CalendarDashboardDto,
} from "./internal/types";
