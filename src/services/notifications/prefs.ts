import { alertTypePrefKey } from "@/domain/smart-alerts";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const notificationPrefsSchema = z.object({
  timezone: z.string().min(1).max(80).default("UTC"),
  inAppEnabled: z.boolean().default(true),
  emailEnabled: z.boolean().default(true),
  whatsappEnabled: z.boolean().default(false),
  smsEnabled: z.boolean().default(false),
  pushEnabled: z.boolean().default(false),
  deadlineAlert7d: z.boolean().default(true),
  deadlineAlert3d: z.boolean().default(true),
  deadlineAlert24h: z.boolean().default(true),
  deadlineAlertPassed: z.boolean().default(true),
  highRiskAlerts: z.boolean().default(true),
  decisionAlerts: z.boolean().default(true),
  missingDocAlerts: z.boolean().default(true),
  scoreChangeAlerts: z.boolean().default(true),
  requirementAlerts: z.boolean().default(true),
  decisionMemoryAlerts: z.boolean().default(true),
  workflowAlerts: z.boolean().default(true),
});

export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  timezone: "UTC",
  inAppEnabled: true,
  emailEnabled: true,
  whatsappEnabled: false,
  smsEnabled: false,
  pushEnabled: false,
  deadlineAlert7d: true,
  deadlineAlert3d: true,
  deadlineAlert24h: true,
  deadlineAlertPassed: true,
  highRiskAlerts: true,
  decisionAlerts: true,
  missingDocAlerts: true,
  scoreChangeAlerts: true,
  requirementAlerts: true,
  decisionMemoryAlerts: true,
  workflowAlerts: true,
};

export async function getCompanyNotificationPrefs(
  companyId: string,
): Promise<NotificationPrefs> {
  const row = await prisma.companyNotificationPrefs.findUnique({
    where: { companyId },
  });
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFS };
  return notificationPrefsSchema.parse({
    timezone: row.timezone,
    inAppEnabled: row.inAppEnabled,
    emailEnabled: row.emailEnabled,
    whatsappEnabled: row.whatsappEnabled,
    smsEnabled: row.smsEnabled,
    pushEnabled: row.pushEnabled,
    deadlineAlert7d: row.deadlineAlert7d,
    deadlineAlert3d: row.deadlineAlert3d,
    deadlineAlert24h: row.deadlineAlert24h,
    deadlineAlertPassed: row.deadlineAlertPassed,
    highRiskAlerts: row.highRiskAlerts,
    decisionAlerts: row.decisionAlerts,
    missingDocAlerts: row.missingDocAlerts,
    scoreChangeAlerts: row.scoreChangeAlerts,
    requirementAlerts: row.requirementAlerts,
    decisionMemoryAlerts: row.decisionMemoryAlerts,
    workflowAlerts: row.workflowAlerts,
  });
}

export async function saveCompanyNotificationPrefs(
  companyId: string,
  raw: unknown,
): Promise<NotificationPrefs> {
  const data = notificationPrefsSchema.parse(raw);
  await prisma.companyNotificationPrefs.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: { ...data },
  });
  return data;
}

export function prefersAlertType(
  prefs: NotificationPrefs,
  type: string,
): boolean {
  const key = alertTypePrefKey(type);
  switch (key) {
    case "deadline":
      return true; // finer gates applied at schedule time
    case "highRiskAlerts":
      return prefs.highRiskAlerts;
    case "decisionAlerts":
      return prefs.decisionAlerts;
    case "missingDocAlerts":
      return prefs.missingDocAlerts;
    case "scoreChangeAlerts":
      return prefs.scoreChangeAlerts;
    case "requirementAlerts":
      return prefs.requirementAlerts;
    case "decisionMemoryAlerts":
      return prefs.decisionMemoryAlerts;
    case "workflowAlerts":
      return prefs.workflowAlerts;
    default:
      return true;
  }
}
