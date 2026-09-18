import { prisma } from "@/lib/db";
import { trackEvent } from "@/services/observability";
import { analysesLimitForPlan } from "@/services/entitlements";
import { shouldResetUsageForPeriod } from "@/services/billing/lifecycle";
import type {
  BillingInterval,
  BillingProvider,
  Plan,
  Prisma,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";

function analysesLimitForInterval(
  plan: Plan,
  interval: BillingInterval | null | undefined,
): number {
  return analysesLimitForPlan(plan, interval);
}

export async function recordSubscriptionEvent(input: {
  companyId: string;
  subscriptionId?: string | null;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  fromPlan?: string | null;
  toPlan?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.subscriptionEvent.create({
    data: {
      companyId: input.companyId,
      subscriptionId: input.subscriptionId ?? null,
      eventType: input.eventType,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      fromPlan: input.fromPlan ?? null,
      toPlan: input.toPlan ?? null,
      metadata: input.metadata,
    },
  });
}

export async function applyPaidPlanActivation(input: {
  companyId: string;
  plan: Plan;
  provider: "stripe" | "paypal";
  providerSubscriptionId: string;
  providerCustomerId?: string | null;
  billingInterval?: BillingInterval | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  paymentMethodBrand?: string | null;
  paymentMethodLast4?: string | null;
  status?: SubscriptionStatus;
}) {
  const legacy = (input.plan.legacyEnum ?? slugToLegacy(input.plan.slug)) as SubscriptionPlan;
  const existing = await prisma.subscription.findUnique({
    where: { companyId: input.companyId },
  });

  if (
    existing?.status === "ACTIVE" &&
    existing.providerSubscriptionId === input.providerSubscriptionId &&
    existing.planId === input.plan.id &&
    !input.status
  ) {
    return existing;
  }

  const status = input.status ?? "ACTIVE";
  const interval = input.billingInterval ?? existing?.billingInterval ?? "MONTH";
  const periodStart = input.currentPeriodStart ?? new Date();
  const periodEnd = input.currentPeriodEnd ?? null;
  const startedAt = existing?.startedAt ?? existing?.currentPeriodStart ?? periodStart;
  const resetUsage = shouldResetUsageForPeriod({
    previousPeriodStart: existing?.currentPeriodStart,
    nextPeriodStart: periodStart,
  });
  const planChanged = Boolean(existing?.planId && existing.planId !== input.plan.id);
  const shouldReset = resetUsage || planChanged || !existing;

  let gracePeriodEndsAt: Date | null = null;
  if (status === "PAST_DUE" || status === "PAYMENT_FAILED") {
    const { getBillingGatewaySettings } = await import("@/services/billing/settings");
    const { computeGracePeriodEndsAt } = await import("@/services/billing/lifecycle");
    const settings = await getBillingGatewaySettings();
    const graceDays =
      input.plan.graceDays != null && input.plan.graceDays >= 0
        ? input.plan.graceDays
        : settings.graceDays;
    gracePeriodEndsAt =
      existing?.gracePeriodEndsAt && existing.gracePeriodEndsAt.getTime() > Date.now()
        ? existing.gracePeriodEndsAt
        : computeGracePeriodEndsAt(new Date(), graceDays);
  }

  const sub = await prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        provider: input.provider,
        providerSubscriptionId: input.providerSubscriptionId,
        providerCustomerId: input.providerCustomerId ?? null,
        plan: legacy,
        planId: input.plan.id,
        status,
        billingInterval: interval,
        startedAt,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        gracePeriodEndsAt,
        paymentMethodBrand: input.paymentMethodBrand ?? null,
        paymentMethodLast4: input.paymentMethodLast4 ?? null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
      update: {
        provider: input.provider,
        providerSubscriptionId: input.providerSubscriptionId,
        providerCustomerId: input.providerCustomerId ?? undefined,
        plan: legacy,
        planId: input.plan.id,
        status,
        billingInterval: interval,
        startedAt: existing?.startedAt ?? startedAt,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd ?? undefined,
        gracePeriodEndsAt,
        paymentMethodBrand: input.paymentMethodBrand ?? undefined,
        paymentMethodLast4: input.paymentMethodLast4 ?? undefined,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });

    const analysesLimit = analysesLimitForInterval(input.plan, interval);

    await tx.companyUsage.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        analysesUsed: 0,
        analysesLimit,
        periodStart,
        periodEnd,
      },
      update: {
        analysesLimit,
        periodStart,
        periodEnd,
        ...(shouldReset ? { analysesUsed: 0 } : {}),
      },
    });

    return updated;
  });

  const eventType =
    existing?.status === "ACTIVE" && !planChanged
      ? "SUBSCRIPTION_RENEWED"
      : planChanged && existing
        ? "SUBSCRIPTION_PLAN_CHANGED"
        : "SUBSCRIPTION_ACTIVATED";

  await recordSubscriptionEvent({
    companyId: input.companyId,
    subscriptionId: sub.id,
    eventType,
    fromStatus: existing?.status ?? null,
    toStatus: status,
    fromPlan: existing?.plan ?? null,
    toPlan: legacy,
    metadata: {
      provider: input.provider,
      planSlug: input.plan.slug,
      providerSubscriptionId: input.providerSubscriptionId,
      billingInterval: interval,
      usageReset: shouldReset,
    },
  });

  await trackEvent({
    action: "SUBSCRIPTION_CREATED",
    companyId: input.companyId,
    metadata: {
      planId: input.plan.id,
      planSlug: input.plan.slug,
      provider: input.provider,
    },
  });

  if (status === "ACTIVE" || status === "TRIALING") {
    const { markOnboardingDoneIfSubscribed } = await import(
      "@/services/auth/onboarding-complete"
    );
    await markOnboardingDoneIfSubscribed(input.companyId);
  }

  return sub;
}

export async function updateSubscriptionStatus(input: {
  companyId: string;
  status: SubscriptionStatus;
  eventType: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  gracePeriodEndsAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const existing = await prisma.subscription.findUnique({
    where: { companyId: input.companyId },
  });
  if (!existing) return null;

  const updated = await prisma.subscription.update({
    where: { companyId: input.companyId },
    data: {
      status: input.status,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? existing.cancelAtPeriodEnd,
      canceledAt:
        input.canceledAt !== undefined
          ? input.canceledAt
          : input.status === "CANCELED"
            ? new Date()
            : existing.canceledAt,
      ...(input.gracePeriodEndsAt !== undefined
        ? { gracePeriodEndsAt: input.gracePeriodEndsAt }
        : input.status === "ACTIVE" || input.status === "TRIALING"
          ? { gracePeriodEndsAt: null }
          : {}),
    },
  });

  await recordSubscriptionEvent({
    companyId: input.companyId,
    subscriptionId: updated.id,
    eventType: input.eventType,
    fromStatus: existing.status,
    toStatus: input.status,
    fromPlan: existing.plan,
    toPlan: existing.plan,
    metadata: input.metadata,
  });

  if (input.status === "CANCELED") {
    await trackEvent({
      action: "SUBSCRIPTION_CANCELED",
      companyId: input.companyId,
      metadata: input.metadata,
    });
  }
  if (input.status === "PAST_DUE" || input.status === "PAYMENT_FAILED") {
    await trackEvent({
      action: "PAYMENT_FAILURE",
      companyId: input.companyId,
      metadata: input.metadata,
    });
  }

  return updated;
}

/**
 * Grant trial once. Never resets trial clock / credits on existing companies.
 * Respects global trialEnabled, plan.trialEligible, and prior paid/expired state.
 */
export async function ensureTrialSubscription(
  companyId: string,
  options?: { grant?: boolean },
) {
  const grant = options?.grant ?? true;
  const existing = await prisma.subscription.findUnique({
    where: { companyId },
  });

  if (existing) {
    const locked =
      existing.status === "ACTIVE" ||
      existing.status === "PAST_DUE" ||
      existing.status === "PAYMENT_FAILED" ||
      existing.status === "CANCELED" ||
      existing.status === "EXPIRED" ||
      existing.status === "UNPAID" ||
      existing.status === "INCOMPLETE" ||
      (existing.plan !== "TRIAL" && existing.status !== "TRIALING");

    if (locked) {
      if (
        existing.status === "TRIALING" &&
        existing.plan === "TRIAL" &&
        !existing.planId
      ) {
        const trialPlan = await prisma.plan.findFirst({
          where: {
            OR: [{ slug: "trial" }, { legacyEnum: "TRIAL" }],
            status: "ACTIVE",
          },
        });
        if (trialPlan) {
          await prisma.subscription.update({
            where: { companyId },
            data: { planId: trialPlan.id },
          });
        }
      }
      return;
    }

    if (existing.status === "TRIALING") {
      await prisma.companyUsage.upsert({
        where: { companyId },
        create: {
          companyId,
          analysesUsed: 0,
          analysesLimit: 3,
          periodStart: existing.currentPeriodStart,
          periodEnd: existing.currentPeriodEnd,
        },
        update: {},
      });
      return;
    }
  }

  const [trialPlan, billingSettings] = await Promise.all([
    prisma.plan.findFirst({
      where: { OR: [{ slug: "trial" }, { legacyEnum: "TRIAL" }], status: "ACTIVE" },
    }),
    import("@/services/billing/settings").then((m) => m.getBillingGatewaySettings()),
  ]);

  if (billingSettings.requirePaymentMethodForTrial) {
    // Card-verified trials start only via Stripe Checkout — do not auto-grant.
    return;
  }

  const planAllowsTrial = trialPlan ? trialPlan.trialEligible !== false : true;
  const trialsOn = grant && billingSettings.trialEnabled && planAllowsTrial;

  const trialDays =
    trialPlan?.trialDays && trialPlan.trialDays > 0
      ? trialPlan.trialDays
      : billingSettings.trialDays > 0
        ? billingSettings.trialDays
        : null;

  const periodStart = new Date();
  const periodEnd = trialDays ? new Date(Date.now() + trialDays * 86400000) : null;
  const status: SubscriptionStatus = trialsOn ? "TRIALING" : "EXPIRED";
  const limit = trialsOn ? (trialPlan?.analysesLimit ?? 3) : 0;

  await prisma.subscription.create({
    data: {
      companyId,
      plan: "TRIAL",
      planId: trialPlan?.id ?? null,
      status,
      provider: "manual",
      billingInterval: "MONTH",
      startedAt: periodStart,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      gracePeriodEndsAt: null,
    },
  });

  await prisma.companyUsage.upsert({
    where: { companyId },
    create: {
      companyId,
      analysesUsed: 0,
      analysesLimit: limit,
      periodStart,
      periodEnd,
    },
    update: {
      analysesLimit: limit,
      periodStart,
      periodEnd,
    },
  });
}

function slugToLegacy(slug: string): SubscriptionPlan {
  const map: Record<string, SubscriptionPlan> = {
    free: "FREE",
    trial: "TRIAL",
    starter: "STARTER",
    pro: "PRO",
    business: "BUSINESS",
  };
  return map[slug] ?? "STARTER";
}

export { slugToLegacy };

export function providerEnum(provider: "stripe" | "paypal" | "manual"): BillingProvider {
  if (provider === "stripe") return "STRIPE";
  if (provider === "paypal") return "PAYPAL";
  return "MANUAL";
}
