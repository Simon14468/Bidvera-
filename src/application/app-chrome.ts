import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import {
  resolveFreeWorkspaceTrialChrome,
  type FreeWorkspaceTrialChrome,
} from "@/services/billing/billing-display";
import {
  resolvePlanBadgeIdentity,
  type PlanBadgeIdentity,
} from "@/services/billing/plan-identity";
import { companyHasUpgradePath } from "@/services/billing/upgrade-eligibility";
import { getEffectiveEntitlements } from "@/services/entitlements";
import { notificationService } from "@/services/notifications";
import { getTrialUsage } from "@/services/usage";
import { prisma } from "@/lib/db";

export type AppChromeSnapshot = {
  companyName: string;
  showUpgrade: boolean;
  planBadge: PlanBadgeIdentity | null;
  unreadAlerts: number;
  trialChrome: FreeWorkspaceTrialChrome | null;
};

/**
 * One parallel chrome load for app layout + topbar.
 * Avoids duplicate subscription / upgrade / entitlements queries across shell pieces.
 */
export async function loadAppChromeSnapshot(
  companyId: string,
  locale: Locale,
): Promise<AppChromeSnapshot> {
  const dict = getDictionary(locale);
  const fallbackName = dict.app.shell.yourCompany;

  const [company, showUpgrade, unreadAlerts, sub, entitlements, usage] =
    await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      }),
      companyHasUpgradePath(companyId).catch(() => false),
      notificationService.countUnread(companyId).catch(() => 0),
      prisma.subscription.findUnique({
        where: { companyId },
        select: {
          status: true,
          plan: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          billingPlan: { select: { slug: true, name: true, isFree: true } },
        },
      }),
      getEffectiveEntitlements(companyId).catch(() => null),
      getTrialUsage(companyId).catch(() => null),
    ]);

  let planBadge: PlanBadgeIdentity | null = null;
  if (entitlements && usage) {
    try {
      planBadge = resolvePlanBadgeIdentity({
        status: sub?.status ?? usage.subscriptionStatus,
        effectiveStatus: usage.effectiveStatus,
        reason: usage.isTrialExpired ? "trial_expired" : undefined,
        plan: sub?.plan ?? usage.plan,
        slug: sub?.billingPlan?.slug ?? entitlements.planSlug,
        isFree: sub?.billingPlan?.isFree ?? entitlements.planSlug === "free",
        planName: sub?.billingPlan?.name ?? entitlements.planName,
        cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
        currentPeriodEnd: sub?.currentPeriodEnd ?? usage.periodEndsAt,
        features: entitlements.features,
      });
    } catch {
      planBadge = null;
    }
  }

  const trialChrome = sub
    ? resolveFreeWorkspaceTrialChrome({
        status: sub.status,
        plan: sub.plan,
        slug: sub.billingPlan?.slug ?? null,
        isFree: sub.billingPlan?.isFree ?? null,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      })
    : null;

  return {
    companyName: company?.name?.trim() || fallbackName,
    showUpgrade,
    planBadge,
    unreadAlerts,
    trialChrome,
  };
}
