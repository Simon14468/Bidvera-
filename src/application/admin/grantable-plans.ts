export type GrantableAdminPlan = {
  slug: string;
  name: string;
  sortOrder: number;
  isFree: boolean;
  trialEligible: boolean;
};

type CatalogPlan = {
  slug: string;
  name: string;
  sortOrder: number;
  isFree: boolean;
  trialEligible: boolean;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED" | string;
};

/** Plans an admin can grant — the live Plans catalog, not hardcoded Free/Trial rows. */
export function toGrantableAdminPlans(
  plans: CatalogPlan[],
  currentSlug?: string | null,
): GrantableAdminPlan[] {
  return plans
    .filter((plan) => plan.status === "ACTIVE" || plan.slug === currentSlug)
    .map((plan) => ({
      slug: plan.slug,
      name: plan.name,
      sortOrder: plan.sortOrder,
      isFree: plan.isFree,
      trialEligible: plan.trialEligible,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function defaultStatusForGrantablePlan(
  plan: Pick<GrantableAdminPlan, "isFree" | "trialEligible">,
): "ACTIVE" | "TRIALING" {
  if (plan.trialEligible || plan.isFree) return "TRIALING";
  return "ACTIVE";
}
