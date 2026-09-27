import { prisma } from "@/lib/db";
import { trackEvent } from "@/services/observability";
import { analysesLimitForPlan } from "@/services/entitlements";
import { shouldResetUsageForPeriod } from "@/services/billing/lifecycle";
import {
  hasConsumedFreeWorkspaceFirstSignupTrial,
  pickFreeWorkspaceTrialPlan,
  resolveFirstSignupTrialOffer,
  resolveTrialDurationDays,
  trialPeriodEndFromDays,
  type TrialSourcePlan,
} from "@/services/billing/trial-grant";
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
  cancelAtPeriodEnd?: boolean;
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
  const cancelAtPeriodEnd = input.cancelAtPeriodEnd ?? false;
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
        cancelAtPeriodEnd,
        canceledAt: cancelAtPeriodEnd ? (existing?.canceledAt ?? new Date()) : null,
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
        cancelAtPeriodEnd,
        canceledAt: cancelAtPeriodEnd ? (existing?.canceledAt ?? new Date()) : null,
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

  if (status === "ACTIVE" && eventType === "SUBSCRIPTION_ACTIVATED") {
    await import("@/services/billing/emails")
      .then(async ({
        buildPaidSubscriptionActivatedEmail,
        enqueueCompanyBillingEmail,
        loadBillingEmailAudience,
      }) => {
        const audience = await loadBillingEmailAudience(input.companyId);
        const email = buildPaidSubscriptionActivatedEmail({
          firstName: audience.firstName,
          companyName: audience.companyName,
          planName: audience.planName,
          interval: interval,
          amountCents: audience.amountCents,
          currency: audience.currency,
          nextBillingDate: periodEnd,
          paymentMethod: audience.paymentMethod,
        });
        await enqueueCompanyBillingEmail({
          companyId: input.companyId,
          subject: email.subject,
          html: email.html,
          text: email.text,
          dedupeKey: `billing:paid_activated:${input.companyId}:${input.providerSubscriptionId}`,
        });
      })
      .catch(() => null);
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
  if (
    input.eventType === "SUBSCRIPTION_CANCEL_SCHEDULED" ||
    input.eventType === "SUBSCRIPTION_CANCELLED"
  ) {
    await import("@/services/billing/emails")
      .then(async ({
        buildSubscriptionCancellationEmail,
        enqueueCompanyBillingEmail,
        loadBillingEmailAudience,
      }) => {
        const audience = await loadBillingEmailAudience(input.companyId);
        const email = buildSubscriptionCancellationEmail({
          firstName: audience.firstName,
          companyName: audience.companyName,
          planName: audience.planName,
          accessUntil: audience.currentPeriodEnd,
        });
        await enqueueCompanyBillingEmail({
          companyId: input.companyId,
          subject: email.subject,
          html: email.html,
          text: email.text,
          dedupeKey: `billing:cancelled:${input.companyId}:${input.eventType}`,
        });
      })
      .catch(() => null);
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
  const [existing, consumedAt] = await Promise.all([
    prisma.subscription.findUnique({
      where: { companyId },
    }),
    readFreeWorkspaceTrialConsumedAt(companyId),
  ]);

  if (
    existing?.status === "TRIALING" &&
    existing.plan === "TRIAL" &&
    !existing.planId
  ) {
    const backfillPlan = await findFreeWorkspaceTrialPlan();
    if (backfillPlan) {
      await prisma.subscription.update({
        where: { companyId },
        data: { planId: backfillPlan.id },
      });
    }
  }

  const [trialPlan, billingSettings] = await Promise.all([
    findFreeWorkspaceTrialPlan(),
    import("@/services/billing/settings").then((m) => m.getBillingGatewaySettings()),
  ]);

  const decision = resolveFirstSignupTrialOffer({
    grant,
    trialEnabled: billingSettings.trialEnabled,
    hasEligiblePlan: Boolean(trialPlan),
    consumedAt,
    existing,
  });

  if (
    existing?.status === "TRIALING" &&
    existing.plan === "TRIAL" &&
    decision.action === "skip" &&
    (decision.reason === "already_trialing" ||
      decision.reason === "already_consumed")
  ) {
    await persistConsumedMarkerIfMissing(companyId, consumedAt);
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

  if (decision.action === "skip" && decision.reason === "already_consumed") {
    await persistConsumedMarkerIfMissing(companyId, consumedAt);
    return;
  }

  if (
    decision.action === "skip" &&
    decision.reason === "locked" &&
    existing?.plan === "TRIAL" &&
    existing.status === "EXPIRED"
  ) {
    await persistConsumedMarkerIfMissing(companyId, consumedAt);
    return;
  }

  // Config gaps, temporary policy delays, and risk blocks must not persist EXPIRED
  // and must not consume the one-time first-signup trial.
  if (decision.action !== "grant" || !trialPlan) {
    return;
  }

  const trialDays = resolveTrialDurationDays({
    planTrialDays: trialPlan.trialDays,
    settingsTrialDays: billingSettings.trialDays,
  });

  const periodStart = new Date();
  const periodEnd = trialPeriodEndFromDays(periodStart, trialDays);
  const limit = analysesLimitForPlan(trialPlan, "MONTH");

  try {
    await prisma.$transaction(async (tx) => {
      const freshSub = await tx.subscription.findUnique({
        where: { companyId },
        select: { status: true, plan: true },
      });
      if (
        hasConsumedFreeWorkspaceFirstSignupTrial({
          consumedAt,
          existing: freshSub,
        })
      ) {
        return;
      }

      await tx.subscription.create({
        data: {
          companyId,
          plan: "TRIAL",
          planId: trialPlan.id,
          status: "TRIALING",
          provider: "manual",
          billingInterval: "MONTH",
          startedAt: periodStart,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          gracePeriodEndsAt: null,
        },
      });

      await tx.companyUsage.upsert({
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
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      await persistConsumedMarkerIfMissing(companyId, null);
      return;
    }
    throw error;
  }

  await persistConsumedMarkerIfMissing(companyId, null);

  await import("@/services/billing/emails")
    .then(async ({ buildFreeWorkspaceTrialStartedEmail, enqueueCompanyBillingEmail, loadBillingEmailAudience }) => {
      const audience = await loadBillingEmailAudience(companyId);
      const email = buildFreeWorkspaceTrialStartedEmail({
        firstName: audience.firstName,
        companyName: audience.companyName,
        daysRemaining: trialDays,
        trialEndDate: periodEnd,
      });
      await enqueueCompanyBillingEmail({
        companyId,
        subject: email.subject,
        html: email.html,
        text: email.text,
        dedupeKey: `billing:fw_trial_started:${companyId}`,
      });
    })
    .catch(() => null);
}

export async function workspaceHasConsumedFreeWorkspaceFirstSignupTrial(
  companyId: string,
): Promise<boolean> {
  const [consumedAt, existing] = await Promise.all([
    readFreeWorkspaceTrialConsumedAt(companyId),
    prisma.subscription.findUnique({
      where: { companyId },
      select: { status: true, plan: true },
    }),
  ]);
  return hasConsumedFreeWorkspaceFirstSignupTrial({
    consumedAt,
    existing,
  });
}

export async function canOfferFirstSignupFreeWorkspaceTrial(
  companyId: string,
): Promise<boolean> {
  const [consumedAt, existing, trialPlan, billingSettings] = await Promise.all([
    readFreeWorkspaceTrialConsumedAt(companyId),
    prisma.subscription.findUnique({
      where: { companyId },
      select: { status: true, plan: true },
    }),
    findFreeWorkspaceTrialPlan(),
    import("@/services/billing/settings").then((m) => m.getBillingGatewaySettings()),
  ]);
  const decision = resolveFirstSignupTrialOffer({
    grant: true,
    trialEnabled: billingSettings.trialEnabled,
    hasEligiblePlan: Boolean(trialPlan),
    consumedAt,
    existing,
  });
  return decision.action === "grant";
}

async function readFreeWorkspaceTrialConsumedAt(
  companyId: string,
): Promise<Date | null> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { freeWorkspaceTrialConsumedAt: true },
    });
    return company?.freeWorkspaceTrialConsumedAt ?? null;
  } catch (error) {
    if (isMissingConsumedAtFieldError(error)) return null;
    throw error;
  }
}

async function persistConsumedMarkerIfMissing(
  companyId: string,
  consumedAt?: Date | null,
) {
  if (consumedAt) return;
  try {
    await prisma.company.updateMany({
      where: { id: companyId, freeWorkspaceTrialConsumedAt: null },
      data: { freeWorkspaceTrialConsumedAt: new Date() },
    });
  } catch (error) {
    if (isMissingConsumedAtFieldError(error)) return;
    throw error;
  }
}

function isMissingConsumedAtFieldError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  return (
    message.includes("freeWorkspaceTrialConsumedAt") ||
    code === "P2022" ||
    /column .*freeWorkspaceTrialConsumedAt/i.test(message)
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function findFreeWorkspaceTrialPlan(): Promise<TrialSourcePlan | null> {
  const rows = await prisma.plan.findMany({
    where: {
      status: "ACTIVE",
      trialEligible: true,
      slug: "free",
      isFree: true,
    },
    select: {
      id: true,
      slug: true,
      status: true,
      isFree: true,
      trialEligible: true,
      trialDays: true,
      analysesLimit: true,
      analysesLimitYearly: true,
    },
    orderBy: { sortOrder: "asc" },
  });
  return pickFreeWorkspaceTrialPlan(rows);
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
