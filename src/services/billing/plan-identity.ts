/**
 * Canonical plan badge identity for UI.
 * Derived only from server-side subscription / entitlement fields — never from
 * URL params, localStorage, or client-controlled state.
 */

import {
  isFirstSignupFreeWorkspaceSurface,
  isFreeWorkspacePlan,
  resolveBillingDisplayStatus,
  type BillingDisplayStatus,
} from "@/services/billing/billing-display";

export type PlanBadgeTone = "premium" | "trial" | "free" | "neutral";

export type PlanBadgeIdentity = {
  /** Short label shown in the chip (PRO, TRIAL, FREE, STARTER, …). */
  label: string;
  tone: PlanBadgeTone;
  /** Full plan name for tooltips / settings. */
  planName: string;
  displayStatus: BillingDisplayStatus;
  /** True when the workspace still has paid (non-free) entitlements. */
  hasPaidAccess: boolean;
  /**
   * Topbar / chrome: only the Pro tier gets the premium chip.
   * FREE / TRIAL / Starter still resolve for Settings, but stay off the header.
   */
  showInChrome: boolean;
};

export type PlanBadgeInput = {
  status: string;
  effectiveStatus?: string | null;
  reason?: string | null;
  plan?: string | null;
  slug?: string | null;
  isFree?: boolean | null;
  planName?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | string | null;
  now?: Date;
};

function slugToBadgeLabel(slug: string): string {
  const cleaned = slug.trim().toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  if (!cleaned) return "PLAN";
  // Prefer a compact token (PRO, STARTER, BUSINESS).
  const first = cleaned.split(/\s+/)[0] ?? cleaned;
  if (first.length <= 12) return first;
  return first.slice(0, 12);
}

/** True for the commercial Pro tier (slug/plan), not Starter / Free / Trial. */
export function isProPlanTier(input: {
  slug?: string | null;
  plan?: string | null;
}): boolean {
  const slug = (input.slug ?? "").trim().toLowerCase();
  const plan = (input.plan ?? "").trim().toUpperCase();
  return slug === "pro" || plan === "PRO";
}

/**
 * Resolve the account plan badge from canonical subscription + entitlement fields.
 */
export function resolvePlanBadgeIdentity(input: PlanBadgeInput): PlanBadgeIdentity {
  const displayStatus = resolveBillingDisplayStatus({
    status: input.status,
    effectiveStatus: input.effectiveStatus,
    reason: input.reason,
    plan: input.plan,
    slug: input.slug,
    isFree: input.isFree,
  });

  const freePlan = isFreeWorkspacePlan({
    plan: input.plan,
    slug: input.slug,
    isFree: input.isFree,
  });

  const firstSignupTrial = isFirstSignupFreeWorkspaceSurface({
    status: input.status === "EXPIRED" ? "EXPIRED" : input.status,
    plan: input.plan,
    slug: input.slug,
    isFree: input.isFree,
  });

  const periodStillOpen = (() => {
    if (!input.currentPeriodEnd) return false;
    const ends =
      typeof input.currentPeriodEnd === "string"
        ? new Date(input.currentPeriodEnd)
        : input.currentPeriodEnd;
    if (Number.isNaN(ends.getTime())) return false;
    return ends.getTime() >= (input.now ?? new Date()).getTime();
  })();

  // Canceled-at-period-end keeps paid access until the period ends.
  const canceledButActive =
    Boolean(input.cancelAtPeriodEnd) &&
    periodStillOpen &&
    !freePlan &&
    displayStatus !== "EXPIRED" &&
    displayStatus !== "FREE_WORKSPACE";

  const hasPaidAccess =
    (!freePlan &&
      (displayStatus === "ACTIVE" ||
        displayStatus === "TRIALING" ||
        displayStatus === "PAST_DUE" ||
        displayStatus === "PAYMENT_FAILED" ||
        displayStatus === "CANCELED" ||
        canceledButActive)) ||
    canceledButActive;

  const planName =
    input.planName?.trim() ||
    (freePlan
      ? "Free Workspace"
      : firstSignupTrial
        ? "Trial"
        : input.slug?.trim() || "Plan");

  const chromePro =
    hasPaidAccess && isProPlanTier({ slug: input.slug, plan: input.plan });

  if (displayStatus === "EXPIRED" || (freePlan && displayStatus === "FREE_WORKSPACE")) {
    return {
      label: "FREE",
      tone: "free",
      planName: freePlan ? planName : "Free Workspace",
      displayStatus: freePlan ? "FREE_WORKSPACE" : displayStatus,
      hasPaidAccess: false,
      showInChrome: false,
    };
  }

  if (freePlan && displayStatus === "ACTIVE") {
    return {
      label: "FREE",
      tone: "free",
      planName,
      displayStatus: "FREE_WORKSPACE",
      hasPaidAccess: false,
      showInChrome: false,
    };
  }

  if (firstSignupTrial && displayStatus === "TRIALING") {
    return {
      label: "TRIAL",
      tone: "trial",
      planName,
      displayStatus,
      hasPaidAccess: false,
      showInChrome: false,
    };
  }

  if (!hasPaidAccess) {
    return {
      label: "FREE",
      tone: "free",
      planName: freePlan ? planName : "Free Workspace",
      displayStatus: freePlan ? "FREE_WORKSPACE" : displayStatus,
      hasPaidAccess: false,
      showInChrome: false,
    };
  }

  // Paid / premium — use catalog slug (pro → PRO). Never invent from URL.
  const slug = (input.slug ?? "").trim().toLowerCase();
  let label = "PRO";
  if (slug && slug !== "free" && slug !== "trial") {
    label = slugToBadgeLabel(slug);
  } else if (input.plan && input.plan !== "TRIAL" && input.plan !== "FREE") {
    label = slugToBadgeLabel(input.plan);
  }

  // Header chrome: only the Pro tier — Starter/Business stay badge-free in the topbar.
  if (chromePro) {
    label = "PRO";
  }

  const tone: PlanBadgeTone =
    displayStatus === "PAST_DUE" || displayStatus === "PAYMENT_FAILED"
      ? "neutral"
      : "premium";

  return {
    label,
    tone,
    planName,
    displayStatus,
    hasPaidAccess: true,
    showInChrome: chromePro,
  };
}
