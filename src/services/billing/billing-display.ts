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
  reason?: string | null;
  plan?: string | null;
  slug?: string | null;
  isFree?: boolean | null;
}): BillingDisplayStatus {
  const expired =
    input.status === "EXPIRED" ||
    input.effectiveStatus === "EXPIRED" ||
    input.reason === "trial_expired" ||
    input.reason === "expired";
  if (expired) return "EXPIRED";

  if (input.status === "TRIALING") return "TRIALING";
  if (isFreeWorkspacePlan(input) && input.status === "ACTIVE") {
    return "FREE_WORKSPACE";
  }

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
  hoursRemaining: number | null;
  endsAt: Date | null;
};

export type FreeWorkspaceTrialRemaining =
  | "days"
  | "day"
  | "hours"
  | "hour"
  | "ending_soon";

export type FreeWorkspaceTrialChrome =
  | {
      kind: "active";
      countdown: TrialCountdown;
      remainingLabel: FreeWorkspaceTrialRemaining;
      remainingValue: number | null;
    }
  | { kind: "expired" };

export type FreeWorkspaceTrialBannerCopy = {
  titleDays: string;
  titleDay: string;
  titleHours: string;
  titleHour: string;
  titleEnding: string;
  hint: string;
  expiredTitle: string;
  expiredBody: string;
  cta: string;
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
      hoursRemaining: null,
      endsAt,
    };
  }

  if (!endsAt || Number.isNaN(endsAt.getTime())) {
    return {
      show: true,
      cancelled: input.cancelAtPeriodEnd,
      endingToday: false,
      daysRemaining: null,
      hoursRemaining: null,
      endsAt: null,
    };
  }

  const now = input.now ?? new Date();
  const msLeft = endsAt.getTime() - now.getTime();
  const days = differenceInCalendarDays(endsAt, now);
  const hoursRemaining =
    msLeft > 0 ? Math.max(1, Math.ceil(msLeft / 3_600_000)) : 0;
  return {
    show: true,
    cancelled: input.cancelAtPeriodEnd,
    endingToday: days <= 0,
    daysRemaining: Math.max(0, days),
    hoursRemaining: days <= 0 ? hoursRemaining : null,
    endsAt,
  };
}

function isFreeWorkspaceCatalogPlan(input: {
  slug?: string | null;
  isFree?: boolean | null;
}): boolean {
  return input.slug === "free" || input.isFree === true;
}

function isPeriodEnded(
  currentPeriodEnd?: Date | string | null,
  now?: Date,
): boolean {
  if (!currentPeriodEnd) return false;
  const endsAt =
    typeof currentPeriodEnd === "string" ? new Date(currentPeriodEnd) : currentPeriodEnd;
  if (Number.isNaN(endsAt.getTime())) return false;
  return endsAt.getTime() < (now ?? new Date()).getTime();
}

/**
 * First-signup Free Workspace trial expiry only.
 * Lifecycle `reason === "trial_expired"` is not sufficient — Stripe card trials
 * also emit that reason when TRIALING reaches currentPeriodEnd.
 */
export function resolveIsTrialExpired(input: {
  reason?: string | null;
  status?: string | null;
  plan?: string | null;
  slug?: string | null;
  isFree?: boolean | null;
  provider?: string | null;
  currentPeriodEnd?: Date | string | null;
  now?: Date;
}): boolean {
  const surfaceStatus =
    input.status === "TRIALING" || input.status === "EXPIRED"
      ? input.status
      : input.reason === "trial_expired" || isPeriodEnded(input.currentPeriodEnd, input.now)
        ? "EXPIRED"
        : input.status ?? "";

  if (
    input.provider === "stripe" &&
    !isFirstSignupFreeWorkspaceSurface({
      status: surfaceStatus || "TRIALING",
      plan: input.plan,
      slug: input.slug,
      isFree: input.isFree,
    })
  ) {
    return false;
  }

  const ended =
    input.status === "EXPIRED" ||
    input.reason === "trial_expired" ||
    isPeriodEnded(input.currentPeriodEnd, input.now);
  if (!ended) return false;

  return isFirstSignupFreeWorkspaceSurface({
    status: surfaceStatus === "TRIALING" || surfaceStatus === "EXPIRED"
      ? surfaceStatus
      : "EXPIRED",
    plan: input.plan,
    slug: input.slug,
    isFree: input.isFree,
  });
}

/** Stripe Checkout card-verified trial — payment method / auto-convert copy only. */
export function isStripeManagedCardTrial(input: {
  status: string;
  provider?: string | null;
  plan?: string | null;
  slug?: string | null;
  isFree?: boolean | null;
}): boolean {
  if (input.status !== "TRIALING") return false;
  if (isFirstSignupFreeWorkspaceSurface(input)) return false;
  return input.provider === "stripe";
}

/** First-signup Free Workspace trial surfaces — not paid Stripe trials or ACTIVE FREE downgrades. */
export function isFirstSignupFreeWorkspaceSurface(input: {
  status: string;
  plan?: string | null;
  slug?: string | null;
  isFree?: boolean | null;
}): boolean {
  const isFreePlan = isFreeWorkspaceCatalogPlan(input);
  if (input.status === "TRIALING") {
    return isFreePlan || (input.plan === "TRIAL" && !input.slug);
  }
  if (input.status === "EXPIRED") {
    return isFreePlan || input.plan === "TRIAL";
  }
  return false;
}

function describeTrialRemaining(
  countdown: TrialCountdown,
): {
  remainingLabel: FreeWorkspaceTrialRemaining;
  remainingValue: number | null;
} {
  const days = countdown.daysRemaining ?? 0;
  if (days > 1) return { remainingLabel: "days", remainingValue: days };
  if (days === 1) return { remainingLabel: "day", remainingValue: 1 };
  const hours = countdown.hoursRemaining ?? 0;
  if (hours > 1) return { remainingLabel: "hours", remainingValue: hours };
  if (hours === 1) return { remainingLabel: "hour", remainingValue: 1 };
  return { remainingLabel: "ending_soon", remainingValue: null };
}

export function resolveFreeWorkspaceTrialChrome(input: {
  status: string;
  plan?: string | null;
  slug?: string | null;
  isFree?: boolean | null;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean;
  now?: Date;
}): FreeWorkspaceTrialChrome | null {
  if (!isFirstSignupFreeWorkspaceSurface(input)) return null;

  if (input.status === "EXPIRED") {
    return { kind: "expired" };
  }

  const countdown = resolveTrialCountdown({
    status: input.status,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    trialEndsAt: input.currentPeriodEnd,
    now: input.now,
  });
  if (!countdown.show) return null;

  const now = input.now ?? new Date();
  if (countdown.endsAt && countdown.endsAt.getTime() <= now.getTime()) {
    return { kind: "expired" };
  }

  const remaining = describeTrialRemaining(countdown);
  return { kind: "active", countdown, ...remaining };
}

export function formatFreeWorkspaceTrialBanner(
  chrome: FreeWorkspaceTrialChrome,
  copy: FreeWorkspaceTrialBannerCopy,
): {
  title: string;
  body: string;
  cta: string;
  href: string;
  tone: "trial" | "expired";
} {
  if (chrome.kind === "expired") {
    return {
      title: copy.expiredTitle,
      body: copy.expiredBody,
      cta: copy.cta,
      href: "/upgrade?reason=trial_expired",
      tone: "expired",
    };
  }

  const title =
    chrome.remainingLabel === "days"
      ? copy.titleDays.replaceAll("{days}", String(chrome.remainingValue ?? 0))
      : chrome.remainingLabel === "day"
        ? copy.titleDay
        : chrome.remainingLabel === "hours"
          ? copy.titleHours.replaceAll("{hours}", String(chrome.remainingValue ?? 0))
          : chrome.remainingLabel === "hour"
            ? copy.titleHour
            : copy.titleEnding;

  return {
    title,
    body: copy.hint,
    cta: copy.cta,
    href: "/upgrade",
    tone: "trial",
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

/** User-facing name while internal plan enum may still be TRIAL. */
export function resolveUserFacingPlanName(input: {
  slug?: string | null;
  isFree?: boolean | null;
  planName?: string | null;
  fallback?: string | null;
}): string {
  if (input.slug === "free" || input.isFree === true) {
    return input.planName?.trim() || "Free Workspace";
  }
  if (input.planName?.trim()) return input.planName.trim();
  return input.fallback?.trim() || "Free Workspace";
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
