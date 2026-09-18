/**
 * Card-verified trial eligibility — Stripe-native only.
 * PayPal remains immediate-paid checkout (no trial promise).
 */

import { prisma } from "@/lib/db";
import type { BillingGatewaySettings } from "@/services/billing/settings";
import { isLegacyOpenEndedTrial } from "@/services/billing/free-workspace";
import type { Plan } from "@prisma/client";

export type StripeTrialDecision = {
  offer: boolean;
  days: number;
  reason:
    | "offered"
    | "trials_disabled"
    | "plan_not_eligible"
    | "no_trial_days"
    | "payment_method_not_required"
    | "already_consumed"
    | "legacy_open_ended"
    | "paid_plan_required";
};

export function resolvePlanTrialDays(
  plan: Pick<Plan, "trialDays" | "trialEligible" | "isFree" | "slug">,
  settings: Pick<BillingGatewaySettings, "trialEnabled" | "trialDays">,
): number {
  if (!settings.trialEnabled) return 0;
  if (plan.isFree || plan.slug === "trial" || plan.slug === "free") return 0;
  if (plan.trialEligible === false) return 0;
  if (plan.trialDays != null && plan.trialDays > 0) return plan.trialDays;
  if (settings.trialDays > 0) return settings.trialDays;
  return 0;
}

export function decideStripeTrialCheckout(input: {
  settings: BillingGatewaySettings;
  plan: Pick<Plan, "trialDays" | "trialEligible" | "isFree" | "slug">;
  companyConsumedTrial: boolean;
  isLegacyOpenEndedTrial: boolean;
}): StripeTrialDecision {
  if (!input.settings.trialEnabled) {
    return { offer: false, days: 0, reason: "trials_disabled" };
  }
  if (input.plan.isFree || input.plan.slug === "trial" || input.plan.slug === "free") {
    return { offer: false, days: 0, reason: "paid_plan_required" };
  }
  if (input.plan.trialEligible === false) {
    return { offer: false, days: 0, reason: "plan_not_eligible" };
  }
  const days = resolvePlanTrialDays(input.plan, input.settings);
  if (days <= 0) {
    return { offer: false, days: 0, reason: "no_trial_days" };
  }
  if (!input.settings.requirePaymentMethodForTrial) {
    return { offer: false, days: 0, reason: "payment_method_not_required" };
  }
  if (input.companyConsumedTrial) {
    return { offer: false, days: 0, reason: "already_consumed" };
  }
  // Legacy open-ended trials stay grandfathered until they opt into checkout.
  // Checkout is not a backfill/expiry — they may still start a card-verified trial.
  if (input.isLegacyOpenEndedTrial) {
    return { offer: true, days, reason: "offered" };
  }
  return { offer: true, days, reason: "offered" };
}

/** Native Stripe Checkout extras — no $0 invoice, no fake charge. */
export function buildStripeTrialSubscriptionData(trialDays: number): {
  trial_period_days: number;
} {
  return { trial_period_days: trialDays };
}

export const STRIPE_TRIAL_PAYMENT_METHOD_COLLECTION = "always" as const;

export function isStripeTrialCheckoutSession(session: {
  payment_status?: string | null;
  subscription?: unknown;
}): boolean {
  return (
    session.payment_status === "no_payment_required" && session.subscription != null
  );
}

const TRIAL_CONSUMED_EVENTS = ["TRIAL_STARTED", "TRIAL_CONSUMED"];

export async function companyHasConsumedCardTrial(companyId: string): Promise<boolean> {
  const event = await prisma.subscriptionEvent.findFirst({
    where: {
      companyId,
      eventType: { in: TRIAL_CONSUMED_EVENTS },
    },
    select: { id: true },
  });
  return Boolean(event);
}

export async function loadStripeTrialContext(companyId: string): Promise<{
  companyConsumedTrial: boolean;
  isLegacyOpenEndedTrial: boolean;
}> {
  const sub = await prisma.subscription.findUnique({
    where: { companyId },
    select: {
      status: true,
      plan: true,
      currentPeriodEnd: true,
      provider: true,
    },
  });
  return {
    companyConsumedTrial: await companyHasConsumedCardTrial(companyId),
    isLegacyOpenEndedTrial: sub ? isLegacyOpenEndedTrial(sub) : false,
  };
}
