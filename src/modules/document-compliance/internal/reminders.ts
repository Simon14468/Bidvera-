/**
 * Expiry reminder scheduling — uses existing notificationService (SYSTEM alerts).
 * Date-only fire dates; no timezone conversion of calendar expiry dates.
 * Idempotent: never re-arms SENT/READ/DISMISSED alerts; never resets SENT reminders.
 */

import { prisma } from "@/lib/db";
import { notificationService } from "@/services/notifications";
import type { ComplianceReminderKind } from "@prisma/client";
import { hasFeature } from "@/services/entitlements";
import { DOCUMENT_COMPLIANCE_FEATURE_KEY } from "../constants";
import {
  cancelRemindersForDocument,
  formatDateOnly,
  getOrCreateReminderSettings,
  planReminderDates,
  scheduledForFromDateOnly,
  todayDateOnly,
} from "./repository";

function reminderTitle(kind: ComplianceReminderKind, name: string): string {
  switch (kind) {
    case "DAYS_90":
      return `Compliance: ${name} expires in 90 days`;
    case "DAYS_30":
      return `Compliance: ${name} expires in 30 days`;
    case "DAYS_7":
      return `Compliance: ${name} expires in 7 days`;
    case "EXPIRED":
      return `Compliance: ${name} has expired`;
  }
}

function reminderMessage(
  kind: ComplianceReminderKind,
  name: string,
  expiryYmd: string,
): string {
  switch (kind) {
    case "DAYS_90":
      return `${name} expires on ${expiryYmd} (90-day reminder).`;
    case "DAYS_30":
      return `${name} expires on ${expiryYmd} (30-day reminder).`;
    case "DAYS_7":
      return `${name} expires on ${expiryYmd} (7-day reminder).`;
    case "EXPIRED":
      return `${name} expired on ${expiryYmd}.`;
  }
}

export async function scheduleRemindersForDocument(input: {
  companyId: string;
  documentId: string;
  documentName: string;
  expiryDateYmd: string | null;
}): Promise<void> {
  const { companyId, documentId } = input;
  await cancelRemindersForDocument(companyId, documentId);

  if (!input.expiryDateYmd) return;

  const settings = await getOrCreateReminderSettings(companyId);
  const plans = planReminderDates(input.expiryDateYmd, settings);
  const today = todayDateOnly();

  for (const plan of plans) {
    if (plan.fireOnDate < today && plan.kind !== "EXPIRED") continue;
    if (plan.kind === "EXPIRED" && plan.fireOnDate < today) {
      plan.fireOnDate = today;
    }

    const dedupeKey = `dcm:${companyId}:${documentId}:${plan.kind}:${input.expiryDateYmd}`;
    const scheduledFor = scheduledForFromDateOnly(plan.fireOnDate);

    const existingAlert = await prisma.alert.findUnique({
      where: { dedupeKey },
      select: { id: true, status: true },
    });
    // Preserve user/terminal alert states. CANCELLED is re-schedulable
    // (cancelReminders runs before schedule; createInAppAlert re-arms CANCELLED).
    if (
      existingAlert &&
      (existingAlert.status === "SENT" ||
        existingAlert.status === "READ" ||
        existingAlert.status === "DISMISSED")
    ) {
      await prisma.complianceExpiryReminder.upsert({
        where: { dedupeKey },
        create: {
          companyId,
          documentId,
          kind: plan.kind,
          fireOnDate: scheduledForFromDateOnly(plan.fireOnDate),
          scheduledFor,
          status:
            existingAlert.status === "DISMISSED" ? "CANCELLED" : "SENT",
          alertId: existingAlert.id,
          dedupeKey,
        },
        update: {
          // Preserve terminal reminder state — do not flip SENT → SCHEDULED.
          fireOnDate: scheduledForFromDateOnly(plan.fireOnDate),
          scheduledFor,
          alertId: existingAlert.id,
        },
      });
      continue;
    }

    const reminder = await prisma.complianceExpiryReminder.upsert({
      where: { dedupeKey },
      create: {
        companyId,
        documentId,
        kind: plan.kind,
        fireOnDate: scheduledForFromDateOnly(plan.fireOnDate),
        scheduledFor,
        status: "SCHEDULED",
        dedupeKey,
      },
      update: {
        fireOnDate: scheduledForFromDateOnly(plan.fireOnDate),
        scheduledFor,
        status: "SCHEDULED",
      },
    });

    await notificationService.createInAppAlert({
      companyId,
      type: "SYSTEM",
      title: reminderTitle(plan.kind, input.documentName),
      message: reminderMessage(plan.kind, input.documentName, input.expiryDateYmd),
      href: `/document-compliance/${documentId}`,
      scheduledFor,
      dedupeKey,
    });

    const alert = await prisma.alert.findUnique({
      where: { dedupeKey },
      select: { id: true },
    });
    if (alert) {
      await prisma.complianceExpiryReminder.update({
        where: { id: reminder.id },
        data: { alertId: alert.id },
      });
    }
  }
}

export async function reconcileDocumentComplianceReminders(
  limit = 40,
): Promise<number> {
  const docs = await prisma.complianceDocument.findMany({
    where: { expiryDate: { not: null } },
    take: limit,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      companyId: true,
      name: true,
      expiryDate: true,
    },
  });

  let n = 0;
  const entitlementCache = new Map<string, boolean>();
  for (const doc of docs) {
    if (!doc.expiryDate) continue;
    let allowed = entitlementCache.get(doc.companyId);
    if (allowed === undefined) {
      allowed = await hasFeature(doc.companyId, DOCUMENT_COMPLIANCE_FEATURE_KEY);
      entitlementCache.set(doc.companyId, allowed);
    }
    if (!allowed) continue;

    await scheduleRemindersForDocument({
      companyId: doc.companyId,
      documentId: doc.id,
      documentName: doc.name,
      expiryDateYmd: formatDateOnly(doc.expiryDate),
    });
    n += 1;
  }
  return n;
}
