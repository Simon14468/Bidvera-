/**
 * Application-level uniqueness for the designated Free Workspace system plan.
 * Does not delete historical duplicates — callers detect and reject new ones.
 */

export function claimsFreeWorkspaceIdentity(plan: {
  slug: string;
  isFree?: boolean;
}): boolean {
  return plan.slug === "free" || plan.isFree === true;
}

export function isDesignatedFreeWorkspaceIdentity(plan: {
  slug: string;
  isFree: boolean;
}): boolean {
  return plan.slug === "free" && plan.isFree;
}

export function listConflictingFreeWorkspacePlans<
  T extends { id: string; slug: string; isFree: boolean },
>(plans: readonly T[]): T[] {
  const designated = plans.filter(isDesignatedFreeWorkspaceIdentity);
  return plans.filter((plan) => {
    if (!claimsFreeWorkspaceIdentity(plan)) return false;
    if (isDesignatedFreeWorkspaceIdentity(plan) && designated.length <= 1) {
      return false;
    }
    return !isDesignatedFreeWorkspaceIdentity(plan) || designated.length > 1;
  });
}

export function hasDuplicateFreeWorkspacePlans(
  plans: readonly { slug: string; isFree: boolean }[],
): boolean {
  return plans.filter(claimsFreeWorkspaceIdentity).length > 1;
}

/**
 * Reject creating another Free Workspace identity, or turning a paid plan into one,
 * when a designated / isFree candidate already exists. Editing the existing row is allowed.
 */
export function shouldRejectDuplicateFreeWorkspacePlan(input: {
  incoming: { slug: string; isFree: boolean };
  previous: { id: string; slug: string; isFree: boolean } | null;
  existingCandidates: { id: string; slug: string; isFree: boolean }[];
}): boolean {
  if (!claimsFreeWorkspaceIdentity(input.incoming)) return false;
  const others = input.existingCandidates.filter(
    (plan) => !input.previous || plan.id !== input.previous.id,
  );
  if (others.length === 0) return false;
  const newlyClaiming =
    !input.previous ||
    (input.incoming.slug === "free" && input.previous.slug !== "free") ||
    (input.incoming.isFree && !input.previous.isFree);
  return newlyClaiming;
}

export function isPublicCommercialPricingPlan(plan: {
  isFree: boolean;
  slug: string;
}): boolean {
  if (plan.isFree) return false;
  if (plan.slug === "free" || plan.slug === "trial") return false;
  return true;
}
