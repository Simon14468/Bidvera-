/**
 * Subscription lifecycle — single source of truth for access, expiration, grace, period reset.
 * Frontend never authorizes; every gate must use evaluateSubscriptionAccess / reconcile.
 */

import type { BillingInterval, SubscriptionStatus } from "@prisma/client";

export type SubscriptionAccessReason =
  | "active"
  | "trialing"
  | "grace"
  | "canceled_until_period_end"
  | "trial_expired"
  | "period_expired"
  | "past_due_expired"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "expired"
  | "missing";

export type SubscriptionAccess = {
  /** Premium entitlements + analyses allowed */
  allowed: boolean;
  /** Soft access after payment failure */
  inGrace: boolean;
  /** Billing warning should be shown */
  billingWarning: boolean;
  reason: SubscriptionAccessReason;
  /** Status after reconcile (may differ from stored when period ended) */
  effectiveStatus: SubscriptionStatus | "MISSING";
};

export type LifecycleSubscriptionSnapshot = {
  status: SubscriptionStatus;
  plan: string;
  billingInterval: BillingInterval | null;
  startedAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  gracePeriodEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
};

/** Pure: decide access from subscription row + now. Never trusts the client. */
export function evaluateSubscriptionAccess(
  sub: LifecycleSubscriptionSnapshot | null | undefined,
  now: Date = new Date(),
): SubscriptionAccess {
  if (!sub) {
    return {
      allowed: false,
      inGrace: false,
      billingWarning: true,
      reason: "missing",
      effectiveStatus: "MISSING",
    };
  }

  const nowMs = now.getTime();
  const periodEndMs = sub.currentPeriodEnd?.getTime() ?? null;
  const periodEnded = periodEndMs != null && periodEndMs < nowMs;
  const graceActive =
    sub.gracePeriodEndsAt != null && sub.gracePeriodEndsAt.getTime() >= nowMs;

  switch (sub.status) {
    case "INCOMPLETE":
      return {
        allowed: false,
        inGrace: false,
        billingWarning: true,
        reason: "incomplete",
        effectiveStatus: "INCOMPLETE",
      };
    case "UNPAID":
      return {
        allowed: false,
        inGrace: false,
        billingWarning: true,
        reason: "unpaid",
        effectiveStatus: "UNPAID",
      };
    case "EXPIRED":
      return {
        allowed: false,
        inGrace: false,
        billingWarning: true,
        reason: "expired",
        effectiveStatus: "EXPIRED",
      };
    case "TRIALING": {
      if (periodEnded) {
        return {
          allowed: false,
          inGrace: false,
          billingWarning: true,
          reason: "trial_expired",
          effectiveStatus: "EXPIRED",
        };
      }
      return {
        allowed: true,
        inGrace: false,
        billingWarning: false,
        reason: "trialing",
        effectiveStatus: "TRIALING",
      };
    }
    case "ACTIVE": {
      if (periodEnded) {
        return {
          allowed: false,
          inGrace: false,
          billingWarning: true,
          reason: "period_expired",
          effectiveStatus: "EXPIRED",
        };
      }
      return {
        allowed: true,
        inGrace: false,
        billingWarning: false,
        reason: "active",
        effectiveStatus: "ACTIVE",
      };
    }
    case "CANCELED": {
      if (!periodEnded && periodEndMs != null) {
        return {
          allowed: true,
          inGrace: false,
          billingWarning: true,
          reason: "canceled_until_period_end",
          effectiveStatus: "CANCELED",
        };
      }
      return {
        allowed: false,
        inGrace: false,
        billingWarning: true,
        reason: "canceled",
        effectiveStatus: "CANCELED",
      };
    }
    case "PAST_DUE":
    case "PAYMENT_FAILED": {
      if (graceActive) {
        return {
          allowed: true,
          inGrace: true,
          billingWarning: true,
          reason: "grace",
          effectiveStatus: sub.status,
        };
      }
      return {
        allowed: false,
        inGrace: false,
        billingWarning: true,
        reason: "past_due_expired",
        effectiveStatus: "EXPIRED",
      };
    }
    default:
      return {
        allowed: false,
        inGrace: false,
        billingWarning: true,
        reason: "expired",
        effectiveStatus: "EXPIRED",
      };
  }
}

/** Advance period by billing interval (server-side only). */
export function nextPeriodWindow(input: {
  from: Date;
  interval: BillingInterval;
  annualMonths?: number;
}): { start: Date; end: Date } {
  const start = new Date(input.from);
  const end = new Date(input.from);
  if (input.interval === "YEAR") {
    const months = input.annualMonths && input.annualMonths > 0 ? input.annualMonths : 12;
    end.setUTCMonth(end.getUTCMonth() + months);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return { start, end };
}

/** Whether usage counters should reset for a new billing period. */
export function shouldResetUsageForPeriod(input: {
  previousPeriodStart: Date | null | undefined;
  nextPeriodStart: Date | null | undefined;
}): boolean {
  if (!input.nextPeriodStart) return false;
  if (!input.previousPeriodStart) return true;
  return input.nextPeriodStart.getTime() > input.previousPeriodStart.getTime();
}

export function computeGracePeriodEndsAt(
  now: Date,
  graceDays: number,
): Date | null {
  if (graceDays <= 0) return null;
  return new Date(now.getTime() + graceDays * 86_400_000);
}

/** Canonical status for payment failure (grace applies). */
export function normalizePaymentFailureStatus(): SubscriptionStatus {
  return "PAST_DUE";
}
