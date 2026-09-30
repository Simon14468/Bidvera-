/**
 * Whether the company still has a higher public checkout plan available.
 * Used to show/hide Upgrade CTAs (header, settings) smartly.
 *
 * Terminal plan = Plan Editor “Recommended” (highlighted) when set;
 * otherwise the highest monthly public checkout price (Adobe-style).
 */

import { listPublicCheckoutPlans } from "@/services/billing/catalog";
import { getEffectiveLimits } from "@/services/plans/effective";

export type UpgradePlanRef = {
  id: string;
  slug: string;
  monthlyPriceCents: number;
  highlighted?: boolean;
};

export function resolveTerminalCheckoutPlan(
  publicPlans: UpgradePlanRef[],
): UpgradePlanRef | null {
  if (publicPlans.length === 0) return null;

  const recommended = publicPlans.filter((p) => p.highlighted);
  const pool = recommended.length > 0 ? recommended : publicPlans;

  return pool.reduce((best, plan) =>
    plan.monthlyPriceCents > best.monthlyPriceCents ? plan : best,
  );
}

function samePlan(
  current: { planSlug: string; planId?: string | null },
  plan: UpgradePlanRef,
): boolean {
  const slug = current.planSlug.toLowerCase();
  if (slug === plan.slug.toLowerCase()) return true;
  if (slug === plan.id.toLowerCase()) return true;
  if (current.planId && current.planId === plan.id) return true;
  return false;
}

export function hasUpgradePathFromLimits(
  current: {
    planSlug: string;
    monthlyPriceCents: number;
    planId?: string | null;
  },
  publicPlans: UpgradePlanRef[],
): boolean {
  const terminal = resolveTerminalCheckoutPlan(publicPlans);
  if (!terminal) return false;

  // Already on the Recommended / top professional plan — no Upgrade CTA.
  if (samePlan(current, terminal)) return false;
  if (current.monthlyPriceCents >= terminal.monthlyPriceCents) return false;

  // Something above current exists (terminal itself, or a higher-priced card).
  return publicPlans.some(
    (p) =>
      samePlan({ planSlug: p.slug, planId: p.id }, terminal) ||
      p.monthlyPriceCents > current.monthlyPriceCents,
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
      planId: limits.planId,
    },
    publicPlans.map((p) => ({
      id: p.id,
      slug: p.slug,
      monthlyPriceCents: p.monthlyPriceCents,
      highlighted: p.highlighted,
    })),
  );
}
