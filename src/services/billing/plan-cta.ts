/**
 * Paid plan card CTA copy for Paywall / PricingGrid.
 * Professional ladder: Activated on current, Upgrade only toward a higher tier
 * when a smaller/earlier plan is already active.
 */

export type PaidPlanCtaKind = "activated" | "upgrade" | "get_plan";

export function isSameBillingPlan(
  plan: { id: string; slug: string },
  current: { planId?: string | null; planSlug?: string | null },
): boolean {
  if (current.planId && plan.id === current.planId) return true;
  if (
    current.planSlug &&
    plan.slug.toLowerCase() === current.planSlug.toLowerCase()
  ) {
    return true;
  }
  return false;
}

/**
 * @param hasActivePaidPlan — workspace is on a live paid (or paid-equivalent) plan
 * @param currentMonthlyPriceCents — effective monthly price of the active plan
 */
export function resolvePaidPlanCtaKind(input: {
  plan: { id: string; slug: string; monthlyPriceCents: number };
  currentPlanId?: string | null;
  currentPlanSlug?: string | null;
  currentMonthlyPriceCents?: number | null;
  hasActivePaidPlan?: boolean;
}): PaidPlanCtaKind {
  const {
    plan,
    currentPlanId = null,
    currentPlanSlug = null,
    currentMonthlyPriceCents = null,
    hasActivePaidPlan = false,
  } = input;

  if (isSameBillingPlan(plan, { planId: currentPlanId, planSlug: currentPlanSlug })) {
    return "activated";
  }

  if (
    hasActivePaidPlan &&
    currentMonthlyPriceCents != null &&
    Number.isFinite(currentMonthlyPriceCents) &&
    plan.monthlyPriceCents > currentMonthlyPriceCents
  ) {
    return "upgrade";
  }

  return "get_plan";
}
