/**
 * Pure helpers for the Free Workspace 14-day trial grant.
 * Internal subscription values stay TRIAL / TRIALING; planId points at the live free plan.
 */

export type TrialGrantSkipReason =
  | "locked"
  | "already_trialing"
  | "already_consumed"
  | "config_unavailable"
  | "grant_not_allowed";

export type TrialGrantDecision =
  | { action: "grant" }
  | { action: "skip"; reason: TrialGrantSkipReason };

export function isLockedForTrialGrant(existing: {
  status: string;
  plan: string;
}): boolean {
  return (
    existing.status === "ACTIVE" ||
    existing.status === "PAST_DUE" ||
    existing.status === "PAYMENT_FAILED" ||
    existing.status === "CANCELED" ||
    existing.status === "EXPIRED" ||
    existing.status === "UNPAID" ||
    existing.status === "INCOMPLETE" ||
    (existing.plan !== "TRIAL" && existing.status !== "TRIALING")
  );
}

/**
 * Decide whether to persist a new TRIALING row.
 * Config gaps and policy denials skip without writing EXPIRED, so a later valid grant can retry.
 * A genuinely expired (or otherwise locked) subscription stays locked.
 */
export function resolveTrialGrantDecision(input: {
  grant: boolean;
  trialEnabled: boolean;
  hasEligiblePlan: boolean;
  alreadyConsumed?: boolean;
  existing?: { status: string; plan: string } | null;
}): TrialGrantDecision {
  if (input.alreadyConsumed) {
    return { action: "skip", reason: "already_consumed" };
  }
  if (input.existing) {
    if (isLockedForTrialGrant(input.existing)) {
      return { action: "skip", reason: "locked" };
    }
    if (input.existing.status === "TRIALING") {
      return { action: "skip", reason: "already_trialing" };
    }
  }
  if (!input.trialEnabled || !input.hasEligiblePlan) {
    return { action: "skip", reason: "config_unavailable" };
  }
  if (!input.grant) {
    return { action: "skip", reason: "grant_not_allowed" };
  }
  return { action: "grant" };
}

/** Durable marker or a successful first-signup trial row (TRIALING/EXPIRED + TRIAL). */
export function hasConsumedFreeWorkspaceFirstSignupTrial(input: {
  consumedAt?: Date | null;
  existing?: { status: string; plan: string } | null;
}): boolean {
  if (input.consumedAt) return true;
  const existing = input.existing;
  if (!existing) return false;
  if (existing.plan !== "TRIAL") return false;
  return existing.status === "TRIALING" || existing.status === "EXPIRED";
}

export function shouldConsumeTrialOnSuccessfulGrant(
  decision: TrialGrantDecision,
): boolean {
  return decision.action === "grant";
}

export type TrialSourcePlan = {
  id: string;
  slug: string;
  status: string;
  isFree: boolean;
  trialEligible: boolean;
  trialDays: number | null;
  analysesLimit: number;
  analysesLimitYearly: number | null;
};

/** Official system Free Workspace identity — slug `free` AND isFree. */
export function isDesignatedFreeWorkspacePlan(plan: {
  slug: string;
  isFree: boolean;
}): boolean {
  return plan.slug === "free" && plan.isFree;
}

export function isFreeWorkspaceTrialPlan(
  plan: Pick<TrialSourcePlan, "slug" | "isFree" | "status" | "trialEligible">,
): boolean {
  if (plan.status !== "ACTIVE") return false;
  if (!plan.trialEligible) return false;
  return isDesignatedFreeWorkspacePlan(plan);
}

/** Resolve the designated Free Workspace system plan only — never any isFree row. */
export function pickFreeWorkspaceTrialPlan<T extends TrialSourcePlan>(
  plans: T[],
): T | null {
  return plans.find(isFreeWorkspaceTrialPlan) ?? null;
}

export function resolveFirstSignupTrialOffer(input: {
  grant: boolean;
  trialEnabled: boolean;
  hasEligiblePlan: boolean;
  consumedAt?: Date | null;
  existing?: { status: string; plan: string } | null;
}): TrialGrantDecision {
  return resolveTrialGrantDecision({
    grant: input.grant,
    trialEnabled: input.trialEnabled,
    hasEligiblePlan: input.hasEligiblePlan,
    alreadyConsumed: hasConsumedFreeWorkspaceFirstSignupTrial({
      consumedAt: input.consumedAt,
      existing: input.existing,
    }),
    existing: input.existing,
  });
}

export function resolveTrialDurationDays(input: {
  planTrialDays?: number | null;
  settingsTrialDays?: number | null;
}): number {
  if (input.planTrialDays && input.planTrialDays > 0) return input.planTrialDays;
  if (input.settingsTrialDays && input.settingsTrialDays > 0) {
    return input.settingsTrialDays;
  }
  return 14;
}

export function trialPeriodEndFromDays(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 86_400_000);
}
