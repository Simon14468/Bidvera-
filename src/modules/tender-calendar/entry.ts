import { assertTenderCalendarAvailable } from "./access";
import {
  createDeadline,
  createEvent,
  createTender,
  deleteDeadline,
  deleteEvent,
  deleteTender,
  getDashboard,
  getReminderSettings,
  getTender,
  listCalendarMonth,
  listDeadlines,
  listEvents,
  listTenders,
  reconcileTenderCalendar,
  saveReminderSettings,
  updateDeadline,
  updateTender,
} from "./internal";

export async function listCalendarTenders(input: {
  companyId: string;
  status?: string;
  category?: string;
  country?: string;
  q?: string;
}) {
  await assertTenderCalendarAvailable(input.companyId);
  return listTenders(input);
}

export async function getCalendarTender(companyId: string, tenderId: string) {
  await assertTenderCalendarAvailable(companyId);
  return getTender(companyId, tenderId);
}

export async function createCalendarTender(companyId: string, raw: unknown) {
  await assertTenderCalendarAvailable(companyId);
  return createTender(companyId, raw);
}

export async function updateCalendarTender(
  companyId: string,
  tenderId: string,
  raw: unknown,
) {
  await assertTenderCalendarAvailable(companyId);
  return updateTender(companyId, tenderId, raw);
}

export async function removeCalendarTender(companyId: string, tenderId: string) {
  await assertTenderCalendarAvailable(companyId);
  return deleteTender(companyId, tenderId);
}

export async function listCalendarDeadlines(companyId: string, tenderId: string) {
  await assertTenderCalendarAvailable(companyId);
  return listDeadlines(companyId, tenderId);
}

export async function addCalendarDeadline(
  companyId: string,
  tenderId: string,
  raw: unknown,
) {
  await assertTenderCalendarAvailable(companyId);
  return createDeadline(companyId, tenderId, raw);
}

export async function editCalendarDeadline(
  companyId: string,
  deadlineId: string,
  raw: unknown,
) {
  await assertTenderCalendarAvailable(companyId);
  return updateDeadline(companyId, deadlineId, raw);
}

export async function removeCalendarDeadline(
  companyId: string,
  deadlineId: string,
) {
  await assertTenderCalendarAvailable(companyId);
  return deleteDeadline(companyId, deadlineId);
}

export async function listCalendarEvents(companyId: string, tenderId: string) {
  await assertTenderCalendarAvailable(companyId);
  return listEvents(companyId, tenderId);
}

export async function addCalendarEvent(
  companyId: string,
  tenderId: string,
  raw: unknown,
) {
  await assertTenderCalendarAvailable(companyId);
  return createEvent(companyId, tenderId, raw);
}

export async function removeCalendarEvent(companyId: string, eventId: string) {
  await assertTenderCalendarAvailable(companyId);
  return deleteEvent(companyId, eventId);
}

export async function getCalendarDashboard(companyId: string) {
  await assertTenderCalendarAvailable(companyId);
  return getDashboard(companyId);
}

export async function getCalendarMonth(input: {
  companyId: string;
  year: number;
  month: number;
}) {
  await assertTenderCalendarAvailable(input.companyId);
  return listCalendarMonth(input);
}

export async function getCalendarReminderSettings(companyId: string) {
  await assertTenderCalendarAvailable(companyId);
  return getReminderSettings(companyId);
}

export async function updateCalendarReminderSettings(
  companyId: string,
  raw: unknown,
) {
  await assertTenderCalendarAvailable(companyId);
  return saveReminderSettings(companyId, raw);
}

export { reconcileTenderCalendar };
