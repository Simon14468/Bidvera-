import { prisma } from "@/lib/db";
import {
  ENTITLEMENT_CATALOG,
  isCommerciallyAvailableFeature,
} from "@/domain/billing/entitlement-catalog";
import {
  resolveGraceDaysRemaining,
  resolveTrialCountdown,
  resolveUserFacingPlanName,
} from "@/services/billing/billing-display";
import {
  resolvePlanBadgeIdentity,
  type PlanBadgeIdentity,
} from "@/services/billing/plan-identity";
import { companyHasUpgradePath } from "@/services/billing/upgrade-eligibility";
import { getEffectiveEntitlements } from "@/services/entitlements";
import { getTrialUsage } from "@/services/usage";

export type SettingsFeatureRow = {
  key: string;
  name: string;
  enabled: boolean;
};

export type SettingsBillingSummary = {
  badge: PlanBadgeIdentity;
  planName: string;
  planSlug: string;
  statusLabelKey: PlanBadgeIdentity["displayStatus"];
  billingInterval: "MONTH" | "YEAR" | null;
  provider: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canUpgrade: boolean;
  features: SettingsFeatureRow[];
  trialCountdown: ReturnType<typeof resolveTrialCountdown>;
  graceDaysRemaining: number | null;
  paymentProblem: boolean;
};

/**
 * Server-only billing snapshot for Settings.
 * Reuses subscription + entitlements — never trusts client plan claims.
 */
export async function loadSettingsBillingSummary(
  companyId: string,
): Promise<SettingsBillingSummary> {
  const [sub, entitlements, usage, canUpgrade] = await Promise.all([
    prisma.subscription.findUnique({
      where: { companyId },
      include: { billingPlan: true },
    }),
    getEffectiveEntitlements(companyId),
    getTrialUsage(companyId),
    companyHasUpgradePath(companyId).catch(() => false),
  ]);

  const status = sub?.status ?? usage.subscriptionStatus;
  const slug = sub?.billingPlan?.slug ?? entitlements.planSlug;
  const isFree = sub?.billingPlan?.isFree ?? entitlements.planSlug === "free";
  const planEnum = sub?.plan ?? usage.plan;

  const badge = resolvePlanBadgeIdentity({
    status,
    effectiveStatus: usage.effectiveStatus,
    reason: usage.isTrialExpired ? "trial_expired" : undefined,
    plan: planEnum,
    slug,
    isFree,
    planName: sub?.billingPlan?.name ?? entitlements.planName,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: sub?.currentPeriodEnd ?? usage.periodEndsAt,
  });

  const planName = resolveUserFacingPlanName({
    slug,
    isFree,
    planName: sub?.billingPlan?.name ?? entitlements.planName,
    fallback: badge.label === "TRIAL" ? "Trial" : badge.planName,
  });

  const features: SettingsFeatureRow[] = ENTITLEMENT_CATALOG.filter(
    (def) =>
      def.commerciallyAvailable !== false &&
      !def.hiddenInAdmin &&
      isCommerciallyAvailableFeature(def.key),
  ).map((def) => ({
    key: def.key,
    name: def.name,
    enabled: Boolean(entitlements.features[def.key]),
  }));

  const displayStatusForCountdown =
    badge.displayStatus === "EXPIRED" ? "EXPIRED" : status;

  const trialCountdown = resolveTrialCountdown({
    status: displayStatusForCountdown,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    trialEndsAt: sub?.currentPeriodEnd ?? usage.trialEndsAt,
  });

  const paymentProblem =
    badge.displayStatus === "PAST_DUE" ||
    badge.displayStatus === "PAYMENT_FAILED" ||
    badge.displayStatus === "UNPAID";

  return {
    badge,
    planName,
    planSlug: slug,
    statusLabelKey: badge.displayStatus,
    billingInterval: (sub?.billingInterval ?? entitlements.billingInterval) as
      | "MONTH"
      | "YEAR"
      | null,
    provider: sub?.provider ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd
      ? sub.currentPeriodEnd.toISOString()
      : usage.periodEndsAt
        ? new Date(usage.periodEndsAt).toISOString()
        : null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    canUpgrade,
    features,
    trialCountdown,
    graceDaysRemaining: resolveGraceDaysRemaining(
      usage.gracePeriodEndsAt ?? sub?.gracePeriodEndsAt ?? null,
    ),
    paymentProblem,
  };
}
