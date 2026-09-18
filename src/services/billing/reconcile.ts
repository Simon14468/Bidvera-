/**
 * Persist subscription lifecycle transitions (expire, grace end, usage period reset).
 */

import { prisma } from "@/lib/db";
import {
  computeGracePeriodEndsAt,
  evaluateSubscriptionAccess,
  normalizePaymentFailureStatus,
  shouldResetUsageForPeriod,
  type LifecycleSubscriptionSnapshot,
} from "@/services/billing/lifecycle";
import { getBillingGatewaySettings } from "@/services/billing/settings";
import {
  isLegacyOpenEndedTrial,
  shouldDeferProviderManagedTrial,
} from "@/services/billing/free-workspace";
import { analysesLimitForPlan } from "@/services/entitlements";
import { recordSubscriptionEvent } from "@/services/billing/subscription-state";
import type { BillingInterval, SubscriptionStatus } from "@prisma/client";

function toSnapshot(sub: {
  status: SubscriptionStatus;
  plan: string;
  billingInterval: BillingInterval | null;
  startedAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  gracePeriodEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
}): LifecycleSubscriptionSnapshot {
  return {
    status: sub.status,
    plan: sub.plan,
    billingInterval: sub.billingInterval,
    startedAt: sub.startedAt,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    gracePeriodEndsAt: sub.gracePeriodEndsAt,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}

export async function resolveGraceDays(planId: string | null | undefined): Promise<number> {
  const settings = await getBillingGatewaySettings();
  if (planId) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { graceDays: true },
    });
    if (plan?.graceDays != null && plan.graceDays >= 0) return plan.graceDays;
  }
  return settings.graceDays;
}

/**
 * Flip subscription to PAST_DUE and open grace window from billing settings / plan.
 */
export async function markSubscriptionPaymentFailed(input: {
  companyId: string;
  eventType?: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await prisma.subscription.findUnique({
    where: { companyId: input.companyId },
  });
  if (!existing) return null;

  const graceDays = await resolveGraceDays(existing.planId);
  const now = new Date();
  const gracePeriodEndsAt = computeGracePeriodEndsAt(now, graceDays);
  const status = normalizePaymentFailureStatus();

  const updated = await prisma.subscription.update({
    where: { companyId: input.companyId },
    data: {
      status,
      gracePeriodEndsAt,
    },
  });

  await recordSubscriptionEvent({
    companyId: input.companyId,
    subscriptionId: updated.id,
    eventType: input.eventType ?? "PAYMENT_FAILED",
    fromStatus: existing.status,
    toStatus: status,
    fromPlan: existing.plan,
    toPlan: existing.plan,
    metadata: {
      ...(input.metadata ?? {}),
      graceDays,
      gracePeriodEndsAt: gracePeriodEndsAt?.toISOString() ?? null,
    },
  });

  // Best-effort billing warning via smart alerts / email queue
  try {
    const { enqueueBillingWarning } = await import(
      "@/services/billing/billing-warnings"
    );
    await enqueueBillingWarning({
      companyId: input.companyId,
      kind: "payment_failed",
      gracePeriodEndsAt,
    });
  } catch {
    /* non-fatal */
  }

  return updated;
}

/**
 * Apply period renewal: advance dates, clear grace, reset usage when period advances.
 */
export async function applyBillingPeriodRenewal(input: {
  companyId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
  status?: SubscriptionStatus;
  analysesLimit?: number;
}) {
  const existing = await prisma.subscription.findUnique({
    where: { companyId: input.companyId },
    include: { billingPlan: true },
  });
  if (!existing) return null;

  const resetUsage = shouldResetUsageForPeriod({
    previousPeriodStart: existing.currentPeriodStart,
    nextPeriodStart: input.currentPeriodStart,
  });

  const limit =
    input.analysesLimit ??
    (existing.billingPlan
      ? analysesLimitForPlan(existing.billingPlan, existing.billingInterval)
      : undefined);

  const status = input.status ?? "ACTIVE";

  const updated = await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.update({
      where: { companyId: input.companyId },
      data: {
        status,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        startedAt: existing.startedAt ?? existing.currentPeriodStart ?? new Date(),
      },
    });

    await tx.companyUsage.upsert({
      where: { companyId: input.companyId },
      create: {
        companyId: input.companyId,
        analysesUsed: 0,
        analysesLimit: limit ?? 0,
        periodStart: input.currentPeriodStart,
        periodEnd: input.currentPeriodEnd,
      },
      update: {
        ...(resetUsage ? { analysesUsed: 0 } : {}),
        ...(limit != null ? { analysesLimit: limit } : {}),
        periodStart: input.currentPeriodStart,
        periodEnd: input.currentPeriodEnd,
      },
    });

    return sub;
  });

  if (resetUsage) {
    await recordSubscriptionEvent({
      companyId: input.companyId,
      subscriptionId: updated.id,
      eventType: "USAGE_PERIOD_RESET",
      fromStatus: existing.status,
      toStatus: status,
      fromPlan: existing.plan,
      toPlan: existing.plan,
      metadata: {
        previousPeriodStart: existing.currentPeriodStart?.toISOString() ?? null,
        nextPeriodStart: input.currentPeriodStart.toISOString(),
      },
    });
  }

  return updated;
}

/**
 * Reconcile one company: expire trials/paid periods, end grace, align usage windows.
 * Idempotent. Never deletes customer data. Never throws to callers (auth/UI safe).
 */
export async function reconcileCompanySubscription(
  companyId: string,
  now: Date = new Date(),
): Promise<{
  changed: boolean;
  access: ReturnType<typeof evaluateSubscriptionAccess>;
}> {
  try {
    return await reconcileCompanySubscriptionInner(companyId, now);
  } catch {
    const sub = await prisma.subscription
      .findUnique({ where: { companyId } })
      .catch(() => null);
    return {
      changed: false,
      access: evaluateSubscriptionAccess(sub ? toSnapshot(sub) : null, now),
    };
  }
}

async function reconcileCompanySubscriptionInner(
  companyId: string,
  now: Date,
): Promise<{
  changed: boolean;
  access: ReturnType<typeof evaluateSubscriptionAccess>;
}> {
  const sub = await prisma.subscription.findUnique({
    where: { companyId },
    include: { billingPlan: true },
  });

  if (!sub) {
    return {
      changed: false,
      access: evaluateSubscriptionAccess(null, now),
    };
  }

  const access = evaluateSubscriptionAccess(toSnapshot(sub), now);
  let changed = false;

  if (isLegacyOpenEndedTrial(sub)) {
    return { changed: false, access };
  }

  const settings = await getBillingGatewaySettings();
  if (
    shouldDeferProviderManagedTrial({
      provider: sub.provider,
      providerSubscriptionId: sub.providerSubscriptionId,
      status: sub.status,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      currentPeriodEnd: sub.currentPeriodEnd,
    })
  ) {
    return { changed: false, access };
  }

  if (
    settings.freeWorkspaceEnabled &&
    !access.allowed &&
    (access.reason === "trial_expired" ||
      access.reason === "period_expired" ||
      access.reason === "past_due_expired" ||
      access.reason === "canceled")
  ) {
    const { assignFreeWorkspace } = await import(
      "@/services/billing/free-workspace"
    );
    await assignFreeWorkspace(companyId, access.reason);
    const fresh = await prisma.subscription.findUnique({ where: { companyId } });
    return {
      changed: true,
      access: evaluateSubscriptionAccess(fresh ? toSnapshot(fresh) : toSnapshot(sub), now),
    };
  }

  // Persist effective EXPIRED when evaluation says so and Free Workspace is off
  if (
    access.effectiveStatus === "EXPIRED" &&
    sub.status !== "EXPIRED" &&
    (access.reason === "trial_expired" ||
      access.reason === "period_expired" ||
      access.reason === "past_due_expired")
  ) {
    await prisma.subscription.update({
      where: { companyId },
      data: {
        status: "EXPIRED",
        gracePeriodEndsAt: null,
        canceledAt: sub.canceledAt ?? now,
      },
    });
    await recordSubscriptionEvent({
      companyId,
      subscriptionId: sub.id,
      eventType:
        access.reason === "trial_expired"
          ? "TRIAL_EXPIRED"
          : access.reason === "past_due_expired"
            ? "GRACE_EXPIRED"
            : "PERIOD_EXPIRED",
      fromStatus: sub.status,
      toStatus: "EXPIRED",
      fromPlan: sub.plan,
      toPlan: sub.plan,
      metadata: { reason: access.reason },
    });
    changed = true;

    try {
      const { enqueueBillingWarning } = await import(
        "@/services/billing/billing-warnings"
      );
      await enqueueBillingWarning({
        companyId,
        kind:
          access.reason === "trial_expired" ? "trial_expired" : "subscription_expired",
        gracePeriodEndsAt: null,
      });
    } catch {
      /* non-fatal */
    }
  }

  // Align usage period window to subscription when missing / stale past end.
  // Never fail the request if usage sync cannot run (schema drift / locked client).
  try {
    const usage = await prisma.companyUsage.findUnique({ where: { companyId } });
    const periodStart = sub.currentPeriodStart;
    if (usage && periodStart) {
      const usageStartMs =
        usage.periodStart instanceof Date
          ? usage.periodStart.getTime()
          : usage.periodStart
            ? new Date(usage.periodStart).getTime()
            : null;
      const usageEndMs =
        usage.periodEnd instanceof Date
          ? usage.periodEnd.getTime()
          : usage.periodEnd
            ? new Date(usage.periodEnd).getTime()
            : null;
      const nowMs = now.getTime();
      const usagePeriodEnded = usageEndMs != null && usageEndMs < nowMs;
      const windowMismatch =
        usageStartMs == null || usageStartMs !== periodStart.getTime();

      if (
        access.allowed &&
        (windowMismatch || usagePeriodEnded) &&
        shouldResetUsageForPeriod({
          previousPeriodStart: usage.periodStart,
          nextPeriodStart: periodStart,
        })
      ) {
        if (usageStartMs == null || periodStart.getTime() > usageStartMs) {
          await prisma.companyUsage.update({
            where: { companyId },
            data: {
              analysesUsed: 0,
              periodStart,
              periodEnd: sub.currentPeriodEnd,
            },
          });
          changed = true;
        }
      } else if (windowMismatch && access.allowed) {
        await prisma.companyUsage.update({
          where: { companyId },
          data: {
            periodStart,
            periodEnd: sub.currentPeriodEnd,
          },
        });
        changed = true;
      }
    }
  } catch {
    /* usage window sync is best-effort — do not block authorization */
  }

  const fresh = changed
    ? await prisma.subscription.findUnique({ where: { companyId } })
    : sub;

  return {
    changed,
    access: evaluateSubscriptionAccess(
      fresh ? toSnapshot(fresh) : toSnapshot(sub),
      now,
    ),
  };
}

/**
 * Batch reconcile for worker. Caps batch size.
 */
export async function reconcileDueSubscriptions(limit = 50): Promise<number> {
  const now = new Date();
  const candidates = await prisma.subscription.findMany({
    where: {
      OR: [
        {
          status: { in: ["TRIALING", "ACTIVE", "CANCELED"] },
          currentPeriodEnd: { lt: now },
        },
        {
          status: { in: ["PAST_DUE", "PAYMENT_FAILED"] },
          OR: [
            { gracePeriodEndsAt: { lt: now } },
            { gracePeriodEndsAt: null },
          ],
        },
      ],
    },
    select: { companyId: true },
    take: limit,
  });

  let n = 0;
  for (const row of candidates) {
    const result = await reconcileCompanySubscription(row.companyId, now);
    if (result.changed) n += 1;
  }
  return n;
}

/** Access check after reconcile — use before analyses / premium features. */
export async function assertSubscriptionAllowsAccess(companyId: string) {
  const { access } = await reconcileCompanySubscription(companyId);
  return access;
}

export async function getSubscriptionAccessForCompany(companyId: string) {
  const sub = await prisma.subscription.findUnique({ where: { companyId } });
  return evaluateSubscriptionAccess(sub ? toSnapshot(sub) : null);
}
