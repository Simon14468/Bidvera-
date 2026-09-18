import type { CalendarReminderOffset } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notificationService } from "@/services/notifications";
import { addDays } from "./datetime";
import type { ReminderSettingsDto } from "./types";

export const REMINDER_PLANS: Array<{
  offset: CalendarReminderOffset;
  daysBefore: number;
  settingKey: keyof ReminderSettingsDto;
}> = [
  { offset: "DAYS_30", daysBefore: 30, settingKey: "remind30d" },
  { offset: "DAYS_14", daysBefore: 14, settingKey: "remind14d" },
  { offset: "DAYS_7", daysBefore: 7, settingKey: "remind7d" },
  { offset: "DAYS_3", daysBefore: 3, settingKey: "remind3d" },
  { offset: "DAYS_1", daysBefore: 1, settingKey: "remind1d" },
  { offset: "SAME_DAY", daysBefore: 0, settingKey: "remindSameDay" },
];

export function planReminderFireTimes(
  occursAt: Date,
  settings: ReminderSettingsDto,
): Array<{ offset: CalendarReminderOffset; fireAt: Date }> {
  const out: Array<{ offset: CalendarReminderOffset; fireAt: Date }> = [];
  for (const plan of REMINDER_PLANS) {
    if (!settings[plan.settingKey]) continue;
    out.push({
      offset: plan.offset,
      fireAt: addDays(occursAt, -plan.daysBefore),
    });
  }
  return out;
}

export async function getOrCreateReminderSettings(
  companyId: string,
): Promise<ReminderSettingsDto> {
  const row = await prisma.calendarTenderReminderSettings.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
  });
  return {
    remind30d: row.remind30d,
    remind14d: row.remind14d,
    remind7d: row.remind7d,
    remind3d: row.remind3d,
    remind1d: row.remind1d,
    remindSameDay: row.remindSameDay,
  };
}

export async function updateReminderSettings(
  companyId: string,
  patch: Partial<ReminderSettingsDto>,
): Promise<ReminderSettingsDto> {
  const row = await prisma.calendarTenderReminderSettings.upsert({
    where: { companyId },
    create: {
      companyId,
      remind30d: patch.remind30d ?? true,
      remind14d: patch.remind14d ?? true,
      remind7d: patch.remind7d ?? true,
      remind3d: patch.remind3d ?? true,
      remind1d: patch.remind1d ?? true,
      remindSameDay: patch.remindSameDay ?? true,
    },
    update: { ...patch },
  });
  return {
    remind30d: row.remind30d,
    remind14d: row.remind14d,
    remind7d: row.remind7d,
    remind3d: row.remind3d,
    remind1d: row.remind1d,
    remindSameDay: row.remindSameDay,
  };
}

/** Cancel calendar reminders and any SCHEDULED alerts for this deadline (any occursAt). */
export async function cancelRemindersForDeadline(
  companyId: string,
  deadlineId: string,
): Promise<void> {
  await prisma.calendarTenderReminder.updateMany({
    where: { companyId, deadlineId, status: "SCHEDULED" },
    data: { status: "CANCELLED" },
  });
  await prisma.alert.updateMany({
    where: {
      companyId,
      status: "SCHEDULED",
      dedupeKey: { startsWith: `tc:${companyId}:${deadlineId}:` },
    },
    data: { status: "CANCELLED" },
  });
}

export async function scheduleRemindersForDeadline(input: {
  companyId: string;
  tenderId: string;
  tenderTitle: string;
  deadlineId: string;
  deadlineTitle: string;
  occursAt: Date;
}): Promise<number> {
  await cancelRemindersForDeadline(input.companyId, input.deadlineId);
  const settings = await getOrCreateReminderSettings(input.companyId);
  const plans = planReminderFireTimes(input.occursAt, settings);
  const now = Date.now();
  let n = 0;

  for (const plan of plans) {
    if (plan.fireAt.getTime() < now - 60_000) continue;
    const dedupeKey = `tc:${input.companyId}:${input.deadlineId}:${plan.offset}:${input.occursAt.toISOString()}`;

    const existingAlert = await prisma.alert.findUnique({
      where: { dedupeKey },
      select: { id: true, status: true },
    });
    // Preserve SENT/READ/DISMISSED. CANCELLED is re-schedulable after cancelReminders.
    if (
      existingAlert &&
      (existingAlert.status === "SENT" ||
        existingAlert.status === "READ" ||
        existingAlert.status === "DISMISSED")
    ) {
      await prisma.calendarTenderReminder.upsert({
        where: { dedupeKey },
        create: {
          companyId: input.companyId,
          tenderId: input.tenderId,
          deadlineId: input.deadlineId,
          offset: plan.offset,
          fireAt: plan.fireAt,
          status:
            existingAlert.status === "DISMISSED" ? "CANCELLED" : "SENT",
          alertId: existingAlert.id,
          dedupeKey,
        },
        update: {
          fireAt: plan.fireAt,
          alertId: existingAlert.id,
        },
      });
      continue;
    }

    const reminder = await prisma.calendarTenderReminder.upsert({
      where: { dedupeKey },
      create: {
        companyId: input.companyId,
        tenderId: input.tenderId,
        deadlineId: input.deadlineId,
        offset: plan.offset,
        fireAt: plan.fireAt,
        status: "SCHEDULED",
        dedupeKey,
      },
      update: {
        fireAt: plan.fireAt,
        status: "SCHEDULED",
      },
    });

    await notificationService.createInAppAlert({
      companyId: input.companyId,
      type: "SYSTEM",
      title: `Calendar: ${input.deadlineTitle}`,
      message: `${input.tenderTitle} — ${input.deadlineTitle} (${plan.offset.replace("DAYS_", "").replace("_", " ")})`,
      href: `/tender-calendar/${input.tenderId}`,
      scheduledFor: plan.fireAt,
      dedupeKey,
    });

    const alert = await prisma.alert.findUnique({
      where: { dedupeKey },
      select: { id: true },
    });
    if (alert) {
      await prisma.calendarTenderReminder.update({
        where: { id: reminder.id },
        data: { alertId: alert.id },
      });
    }
    n += 1;
  }
  return n;
}
