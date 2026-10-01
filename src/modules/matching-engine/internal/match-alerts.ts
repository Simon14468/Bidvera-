/**
 * Matched-opportunity notifications — single source of truth.
 * Topbar badge, /alerts inbox, and Email (Resend) all use the same Alert
 * rows (title/message/href). Never invent a parallel mailer or badge count.
 */

import { prisma } from "@/lib/db";
import { notificationService } from "@/services/notifications";
import { logInfo } from "@/services/observability";

export const MATCHED_OPPORTUNITIES_ALERT_HREF = "/matched-opportunities";

export function matchedOpportunityAlertDedupeKey(
  companyId: string,
  opportunityId: string,
): string {
  return `${companyId}:matched-opp:${opportunityId}`;
}

export function buildMatchedOpportunityAlertCopy(input: {
  title: string;
}): { title: string; message: string } {
  const name = input.title.trim() || "Untitled opportunity";
  return {
    title: `Matched opportunity: ${name}`,
    message: `${name} matches your company profile. Open Matched Opportunities to review fit and next steps.`,
  };
}

/** Create one Alert per new opportunity — emailed via the same deliverAlert path. */
export async function emitNewMatchedOpportunityAlerts(input: {
  companyId: string;
  created: Array<{ opportunityId: string; title: string }>;
}): Promise<void> {
  const seen = new Set<string>();
  let emitted = 0;
  for (const item of input.created) {
    const opportunityId = item.opportunityId?.trim();
    if (!opportunityId || seen.has(opportunityId)) continue;
    seen.add(opportunityId);

    const copy = buildMatchedOpportunityAlertCopy({ title: item.title });
    await notificationService.createInAppAlert({
      companyId: input.companyId,
      type: "SYSTEM",
      title: copy.title,
      message: copy.message,
      href: MATCHED_OPPORTUNITIES_ALERT_HREF,
      dedupeKey: matchedOpportunityAlertDedupeKey(
        input.companyId,
        opportunityId,
      ),
    });
    emitted += 1;
  }

  if (emitted > 0) {
    logInfo("matching_engine.alerts.new_matches", {
      companyId: input.companyId,
      created: emitted,
    });
  }
}

/** Unread match alerts — same set that Email delivers (status SENT). */
export async function countUnreadMatchedOpportunityAlerts(
  companyId: string,
): Promise<number> {
  return prisma.alert.count({
    where: {
      companyId,
      status: "SENT",
      href: MATCHED_OPPORTUNITIES_ALERT_HREF,
    },
  });
}

export async function markMatchedOpportunityAlertRead(
  companyId: string,
  opportunityId: string,
): Promise<void> {
  await prisma.alert.updateMany({
    where: {
      companyId,
      dedupeKey: matchedOpportunityAlertDedupeKey(companyId, opportunityId),
      status: { in: ["SENT", "SCHEDULED"] },
    },
    data: { status: "READ", readAt: new Date() },
  });
}

/** Opening Matched Opportunities acknowledges the same notifications Email sent. */
export async function markAllMatchedOpportunityAlertsRead(
  companyId: string,
): Promise<number> {
  const result = await prisma.alert.updateMany({
    where: {
      companyId,
      status: "SENT",
      href: MATCHED_OPPORTUNITIES_ALERT_HREF,
    },
    data: { status: "READ", readAt: new Date() },
  });
  return result.count;
}

/**
 * Acknowledge match notifications in one place: unread Alert rows (email/inbox)
 * and recommendation isNew flags — never leave the topbar disagreeing with Email.
 */
export async function acknowledgeMatchedOpportunityNotifications(
  companyId: string,
): Promise<{ alertsRead: number }> {
  const alertsRead = await markAllMatchedOpportunityAlertsRead(companyId);
  await prisma.matchRecommendation.updateMany({
    where: {
      companyId,
      isNew: true,
      status: { in: ["ACTIVE", "READ"] },
    },
    data: { isNew: false },
  });
  return { alertsRead };
}
