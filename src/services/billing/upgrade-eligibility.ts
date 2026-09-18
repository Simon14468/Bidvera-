/**
 * Whether the company still has a higher public checkout plan available.
 * Used to show/hide Upgrade CTAs (header, settings) smartly.
 */

import { listPublicCheckoutPlans } from "@/services/billing/catalog";
import { getEffectiveLimits } from "@/services/plans/effective";

export function hasUpgradePathFromLimits(
  current: { planSlug: string; monthlyPriceCents: number },
  publicPlans: Array<{ id: string; slug: string; monthlyPriceCents: number }>,
): boolean {
  if (publicPlans.length === 0) return false;

  const highest = publicPlans.reduce((best, plan) =>
    plan.monthlyPriceCents > best.monthlyPriceCents ? plan : best,
  );

  const currentSlug = current.planSlug.toLowerCase();
  if (
    currentSlug === highest.slug.toLowerCase() ||
    currentSlug === highest.id.toLowerCase()
  ) {
    return false;
  }

  if (current.monthlyPriceCents >= highest.monthlyPriceCents) {
    return false;
  }

  return publicPlans.some(
    (p) => p.monthlyPriceCents > current.monthlyPriceCents,
  );
}

export async function companyHasUpgradePath(companyId: string): Promise<boolean> {
  const [limits, publicPlans] = await Promise.all([
    getEffectiveLimits(companyId),
    listPublicCheckoutPlans(),
  ]);

  return hasUpgradePathFromLimits(
    {
      planSlug: limits.planSlug,
      monthlyPriceCents: limits.monthlyPriceCents,
    },
    publicPlans,
  );
}
