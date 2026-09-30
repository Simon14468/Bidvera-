/**
 * Canonical plan badge identity for UI.
 * Derived only from server-side subscription / entitlement fields — never from
 * URL params, localStorage, or client-controlled state.
 */

import { hasFullCommercialFeatureCoverage } from "@/domain/billing/entitlement-catalog";
import {
  isFirstSignupFreeWorkspaceSurface,
  isFreeWorkspacePlan,
  resolveBillingDisplayStatus,
  type BillingDisplayStatus,
} from "@/services/billing/billing-display";

export type PlanBadgeTone = "premium" | "limited" | "trial" | "free" | "neutral";

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
   * Topbar / chrome: only when the active plan has every sellable feature
   * enabled in Plan Editor (full commercial coverage). Partial plans never show.
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
  /** Effective feature map or enabled key list from entitlements / PlanFeature. */
  features?: Record<string, boolean> | readonly string[] | null;
};

function slugToBadgeLabel(slug: string): string {
  const cleaned = slug.trim().toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  if (!cleaned) return "PLAN";
  // Prefer a compact token (PRO, STARTER, BUSINESS).
  const first = cleaned.split(/\s+/)[0] ?? cleaned;
  if (first.length <= 12) return first;
  return first.slice(0, 12);
}

/** True for the commercial Pro tier from the active billing plan slug. */
export function isProPlanTier(input: {
  slug?: string | null;
  plan?: string | null;
}): boolean {
  const slug = (input.slug ?? "").trim().toLowerCase();
  // Prefer catalog slug — never let a stale Subscription.plan enum override it.
  if (slug) {
    return slug === "pro";
  }
  const plan = (input.plan ?? "").trim().toUpperCase();
  return plan === "PRO";
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

  const fullCoverage = hasFullCommercialFeatureCoverage(input.features);

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

  // Paid — label from active catalog slug/name only (never invent PRO from legacy enum).
  const slug = (input.slug ?? "").trim().toLowerCase();
  let label = "PLAN";
  if (slug && slug !== "free" && slug !== "trial") {
    label = slugToBadgeLabel(slug);
  } else if (input.planName?.trim()) {
    label = slugToBadgeLabel(input.planName);
  } else if (input.plan && input.plan !== "TRIAL" && input.plan !== "FREE") {
    label = slugToBadgeLabel(input.plan);
  }

  const tone: PlanBadgeTone =
    displayStatus === "PAST_DUE" || displayStatus === "PAYMENT_FAILED"
      ? "neutral"
      : fullCoverage
        ? "premium"
        : "limited";

  return {
    label,
    tone,
    planName,
    displayStatus,
    hasPaidAccess: true,
    // Chrome only for full Plan Editor coverage (all sellable features on).
    showInChrome: fullCoverage,
  };
}
