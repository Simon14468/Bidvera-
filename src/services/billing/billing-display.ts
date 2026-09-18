import { differenceInCalendarDays } from "date-fns";

export type BillingDisplayStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "PAYMENT_FAILED"
  | "CANCELED"
  | "UNPAID"
  | "EXPIRED"
  | "FREE_WORKSPACE"
  | "INCOMPLETE";

export function isFreeWorkspacePlan(input: {
  plan?: string | null;
  slug?: string | null;
  isFree?: boolean | null;
}): boolean {
  return (
    input.plan === "FREE" ||
    input.slug === "free" ||
    input.isFree === true
  );
}

export function resolveBillingDisplayStatus(input: {
  status: string;
  effectiveStatus?: string | null;
  plan?: string | null;
  slug?: string | null;
  isFree?: boolean | null;
}): BillingDisplayStatus {
  if (input.status === "TRIALING") return "TRIALING";
  if (isFreeWorkspacePlan(input)) return "FREE_WORKSPACE";

  const raw = input.effectiveStatus ?? input.status;
  switch (raw) {
    case "TRIALING":
      return "TRIALING";
    case "ACTIVE":
      return "ACTIVE";
    case "PAST_DUE":
      return "PAST_DUE";
    case "PAYMENT_FAILED":
      return "PAYMENT_FAILED";
    case "CANCELED":
      return "CANCELED";
    case "UNPAID":
      return "UNPAID";
    case "EXPIRED":
      return "EXPIRED";
    case "INCOMPLETE":
      return "INCOMPLETE";
    case "FREE_WORKSPACE":
      return "FREE_WORKSPACE";
    default:
      return "EXPIRED";
  }
}

export type TrialCountdown = {
  show: boolean;
  cancelled: boolean;
  endingToday: boolean;
  daysRemaining: number | null;
  endsAt: Date | null;
};

export function resolveTrialCountdown(input: {
  status: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: Date | string | null | undefined;
  now?: Date;
}): TrialCountdown {
  const endsAt = input.trialEndsAt
    ? typeof input.trialEndsAt === "string"
      ? new Date(input.trialEndsAt)
      : input.trialEndsAt
    : null;

  if (input.status !== "TRIALING") {
    return {
      show: false,
      cancelled: false,
      endingToday: false,
      daysRemaining: null,
      endsAt,
    };
  }

  if (!endsAt || Number.isNaN(endsAt.getTime())) {
    return {
      show: true,
      cancelled: input.cancelAtPeriodEnd,
      endingToday: false,
      daysRemaining: null,
      endsAt: null,
    };
  }

  const days = differenceInCalendarDays(endsAt, input.now ?? new Date());
  return {
    show: true,
    cancelled: input.cancelAtPeriodEnd,
    endingToday: days <= 0,
    daysRemaining: Math.max(0, days),
    endsAt,
  };
}

/**
 * Whole days remaining in the payment grace window, from server dates only.
 * Returns null when there is no active grace window.
 */
export function resolveGraceDaysRemaining(
  gracePeriodEndsAt: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!gracePeriodEndsAt) return null;
  const endsAt =
    typeof gracePeriodEndsAt === "string"
      ? new Date(gracePeriodEndsAt)
      : gracePeriodEndsAt;
  if (Number.isNaN(endsAt.getTime())) return null;
  const msLeft = endsAt.getTime() - now.getTime();
  if (msLeft <= 0) return null;
  return Math.max(1, Math.ceil(msLeft / 86_400_000));
}

export function canCancelProviderSubscription(input: {
  status: string;
  providerSubscriptionId?: string | null;
  cancelAtPeriodEnd: boolean;
}): boolean {
  if (!input.providerSubscriptionId) return false;
  if (input.cancelAtPeriodEnd) return false;
  return input.status === "TRIALING" || input.status === "ACTIVE";
}
