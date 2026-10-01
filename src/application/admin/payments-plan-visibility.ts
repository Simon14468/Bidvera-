/**
 * Super Admin /payments commercial-field rules.
 * Official Free Workspace is the designated identity, not the display name.
 */

import { isDesignatedFreeWorkspaceIdentity } from "@/services/billing/free-workspace-identity";
import { isFreeWorkspaceTrialPlan } from "@/services/billing/trial-grant";

export function isOfficialFreeWorkspacePaymentsPlan(plan: {
  slug: string;
  isFree: boolean;
}): boolean {
  return isDesignatedFreeWorkspaceIdentity(plan);
}

/** Grant-eligible official row: slug=free + isFree + ACTIVE + trialEligible. */
export function isOfficialFreeWorkspaceGrantEligible(plan: {
  slug: string;
  isFree: boolean;
  status: string;
  trialEligible: boolean;
}): boolean {
  return isFreeWorkspaceTrialPlan(plan);
}

export function shouldRenderCommercialPaymentFields(plan: {
  slug: string;
  isFree: boolean;
}): boolean {
  if (plan.slug === "trial") return false;
  return !isOfficialFreeWorkspacePaymentsPlan(plan);
}
