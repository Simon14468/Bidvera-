import type { ClientRequestReminderOffset } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notificationService } from "@/services/notifications";

const REMINDER_PLANS: Array<{
  offset: ClientRequestReminderOffset;
  daysBefore: number;
}> = [
  { offset: "DAYS_14", daysBefore: 14 },
  { offset: "DAYS_7", daysBefore: 7 },
  { offset: "DAYS_3", daysBefore: 3 },
  { offset: "DAYS_1", daysBefore: 1 },
  { offset: "SAME_DAY", daysBefore: 0 },
];

function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function planClientRequestReminderFireTimes(
  deadline: Date,
): Array<{ offset: ClientRequestReminderOffset; fireAt: Date }> {
  return REMINDER_PLANS.map((plan) => ({
    offset: plan.offset,
    fireAt: addDays(deadline, -plan.daysBefore),
  }));
}

export async function cancelRemindersForRequest(
  companyId: string,
  requestId: string,
): Promise<void> {
  await prisma.clientRequestReminder.updateMany({
    where: { companyId, requestId, status: "SCHEDULED" },
    data: { status: "CANCELLED" },
  });
  await prisma.alert.updateMany({
    where: {
      companyId,
      status: "SCHEDULED",
      dedupeKey: { startsWith: `cr:${companyId}:${requestId}:` },
    },
    data: { status: "CANCELLED" },
  });
}

export async function scheduleRemindersForRequest(input: {
  companyId: string;
  requestId: string;
  clientName: string;
  title: string;
  deadline: Date;
}): Promise<number> {
  await cancelRemindersForRequest(input.companyId, input.requestId);
  const plans = planClientRequestReminderFireTimes(input.deadline);
  const now = Date.now();
  let n = 0;

  for (const plan of plans) {
    if (plan.fireAt.getTime() < now - 60_000) continue;
    const dedupeKey = `cr:${input.companyId}:${input.requestId}:${plan.offset}:${input.deadline.toISOString()}`;

    const existingAlert = await prisma.alert.findUnique({
      where: { dedupeKey },
      select: { id: true, status: true },
    });
    if (
      existingAlert &&
      (existingAlert.status === "SENT" ||
        existingAlert.status === "READ" ||
        existingAlert.status === "DISMISSED")
    ) {
      await prisma.clientRequestReminder.upsert({
        where: { dedupeKey },
        create: {
          companyId: input.companyId,
          requestId: input.requestId,
          offset: plan.offset,
          fireAt: plan.fireAt,
          status: existingAlert.status === "DISMISSED" ? "CANCELLED" : "SENT",
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

    const reminder = await prisma.clientRequestReminder.upsert({
      where: { dedupeKey },
      create: {
        companyId: input.companyId,
        requestId: input.requestId,
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
      title: `Client request: ${input.title}`,
      message: `${input.clientName} — deadline reminder (${plan.offset.replace("DAYS_", "").replace("_", " ")})`,
      href: `/client-requests/${input.requestId}`,
      scheduledFor: plan.fireAt,
      dedupeKey,
    });

    const alert = await prisma.alert.findUnique({
      where: { dedupeKey },
      select: { id: true },
    });
    if (alert) {
      await prisma.clientRequestReminder.update({
        where: { id: reminder.id },
        data: { alertId: alert.id },
      });
    }
    n += 1;
  }
  return n;
}
