import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";
import {
  getCheckoutPlanOrThrow,
  resolvePaypalPlanId,
  resolvePlanAmountCents,
  resolveStripePriceId,
} from "@/services/billing/catalog";
import { recordBillingAudit } from "@/services/billing/audit";
import type { BillingInterval, Plan } from "@prisma/client";
import type Stripe from "stripe";

export type PayPalCustomBinding = {
  companyId: string;
  planId: string;
  interval: BillingInterval;
  amountCents: number;
};

/** Parse checkout-bound custom_id — all segments required for activation. */
export function parsePayPalCustomId(customId: string): PayPalCustomBinding | null {
  const parts = customId.split(":");
  if (parts.length < 4) return null;
  const [companyId, planId, intervalRaw, amountRaw] = parts;
  if (!companyId || !planId || !intervalRaw || amountRaw == null) return null;
  const interval = intervalRaw === "YEAR" ? "YEAR" : intervalRaw === "MONTH" ? "MONTH" : null;
  if (!interval) return null;
  const amountCents = Number(amountRaw);
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null;
  return { companyId, planId, interval, amountCents };
}

export function assertExactAmountCents(expected: number, actual: number, label = "Payment") {
  if (expected !== actual) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      `${label} amount does not match plan.`,
      403,
      { expected, actual },
    );
  }
}

export function assertCurrencyMatch(expected: string, actual: string | null | undefined) {
  if (!actual) {
    throw new AppError(ErrorCode.FORBIDDEN, "Payment currency missing.", 403);
  }
  if (expected.toLowerCase() !== actual.toLowerCase()) {
    throw new AppError(ErrorCode.FORBIDDEN, "Payment currency does not match plan.", 403);
  }
}

/** Bind activation to local INCOMPLETE checkout row — prevents IDOR / foreign subscription activation. */
export async function assertLocalCheckoutBinding(input: {
  companyId: string;
  provider: "paypal" | "stripe";
  providerSubscriptionId: string;
  planId: string;
}) {
  const local = await prisma.subscription.findUnique({
    where: { companyId: input.companyId },
  });
  if (!local) {
    throw new AppError(ErrorCode.FORBIDDEN, "No checkout session for company.", 403);
  }
  if (local.provider !== input.provider) {
    throw new AppError(ErrorCode.FORBIDDEN, "Checkout provider mismatch.", 403);
  }
  if (
    local.providerSubscriptionId &&
    local.providerSubscriptionId !== input.providerSubscriptionId
  ) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Subscription id does not match checkout session.",
      403,
    );
  }
  if (local.planId && local.planId !== input.planId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Plan does not match checkout session.", 403);
  }
  if (
    local.status !== "INCOMPLETE" &&
    local.status !== "ACTIVE" &&
    local.status !== "PAST_DUE" &&
    local.status !== "TRIALING"
  ) {
    throw new AppError(ErrorCode.FORBIDDEN, "Checkout session is not eligible for activation.", 403);
  }
}

const STRIPE_CHECKOUT_BIND_STATUSES = new Set([
  "INCOMPLETE",
  "ACTIVE",
  "PAST_DUE",
  "TRIALING",
]);

const STRIPE_KNOWN_SUB_BIND_STATUSES = new Set([
  "INCOMPLETE",
  "ACTIVE",
  "PAST_DUE",
  "TRIALING",
  "PAYMENT_FAILED",
]);

export type StripeWebhookBindingRow = {
  companyId: string;
  provider: string | null;
  providerSubscriptionId: string | null;
  planId: string | null;
  status: string;
};

/**
 * Stripe subscription.created/updated must not grant paid access from metadata alone.
 * Allow: Bidvera checkout row for the company, or an already-trusted Stripe subscription id.
 */
export function resolveStripeSubscriptionWebhookBinding(input: {
  companyId: string;
  planId: string;
  providerSubscriptionId: string;
  knownByProviderId: StripeWebhookBindingRow | null;
  localByCompany: StripeWebhookBindingRow | null;
}): "existing" | "checkout" {
  if (input.knownByProviderId) {
    if (input.knownByProviderId.companyId !== input.companyId) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        "Stripe subscription does not match company.",
        403,
      );
    }
    if (
      input.knownByProviderId.planId &&
      input.knownByProviderId.planId !== input.planId
    ) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        "Plan does not match existing subscription.",
        403,
      );
    }
    if (!STRIPE_KNOWN_SUB_BIND_STATUSES.has(input.knownByProviderId.status)) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        "Existing subscription is not eligible for activation.",
        403,
      );
    }
    return "existing";
  }

  const local = input.localByCompany;
  if (!local) {
    throw new AppError(ErrorCode.FORBIDDEN, "No checkout session for company.", 403);
  }
  if (local.provider !== "stripe") {
    throw new AppError(ErrorCode.FORBIDDEN, "Checkout provider mismatch.", 403);
  }
  if (
    local.providerSubscriptionId &&
    local.providerSubscriptionId !== input.providerSubscriptionId
  ) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Subscription id does not match checkout session.",
      403,
    );
  }
  if (local.planId && local.planId !== input.planId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Plan does not match checkout session.", 403);
  }
  if (!STRIPE_CHECKOUT_BIND_STATUSES.has(local.status)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Checkout session is not eligible for activation.",
      403,
    );
  }
  return "checkout";
}

export async function assertStripeSubscriptionWebhookBinding(input: {
  companyId: string;
  planId: string;
  providerSubscriptionId: string;
}): Promise<"existing" | "checkout"> {
  const [knownByProviderId, localByCompany] = await Promise.all([
    prisma.subscription.findFirst({
      where: {
        provider: "stripe",
        providerSubscriptionId: input.providerSubscriptionId,
      },
      select: {
        companyId: true,
        provider: true,
        providerSubscriptionId: true,
        planId: true,
        status: true,
      },
    }),
    prisma.subscription.findUnique({
      where: { companyId: input.companyId },
      select: {
        companyId: true,
        provider: true,
        providerSubscriptionId: true,
        planId: true,
        status: true,
      },
    }),
  ]);

  return resolveStripeSubscriptionWebhookBinding({
    companyId: input.companyId,
    planId: input.planId,
    providerSubscriptionId: input.providerSubscriptionId,
    knownByProviderId,
    localByCompany,
  });
}

export type PayPalSubscriptionSnapshot = {
  status?: string;
  plan_id?: string;
  custom_id?: string;
  billing_info?: {
    next_billing_time?: string;
    last_payment?: {
      amount?: { value?: string; currency_code?: string };
      time?: string;
    };
  };
};

/**
 * Server-side PayPal verification — never trust client plan/price/status.
 * Only ACTIVE subscriptions with confirmed last_payment activate paid access.
 */
export async function verifyPayPalSubscriptionForActivation(input: {
  companyId: string;
  providerSubscriptionId: string;
  snapshot: PayPalSubscriptionSnapshot;
}): Promise<{
  plan: Plan;
  interval: BillingInterval;
  expectedAmountCents: number;
  currentPeriodEnd: Date | null;
}> {
  const { companyId, providerSubscriptionId, snapshot } = input;

  if (snapshot.status !== "ACTIVE") {
    await recordBillingAudit({
      companyId,
      eventType: "SUSPICIOUS_BILLING_ATTEMPT",
      metadata: {
        provider: "paypal",
        reason: "non_active_status",
        status: snapshot.status ?? null,
        providerSubscriptionId,
      },
    });
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "PayPal subscription is not fully active yet.",
      402,
    );
  }

  if (!snapshot.custom_id?.startsWith(`${companyId}:`)) {
    await recordBillingAudit({
      companyId,
      eventType: "SUSPICIOUS_BILLING_ATTEMPT",
      metadata: {
        provider: "paypal",
        reason: "custom_id_mismatch",
        providerSubscriptionId,
      },
    });
    throw new AppError(ErrorCode.FORBIDDEN, "Subscription does not match company.", 403);
  }

  const binding = parsePayPalCustomId(snapshot.custom_id);
  if (!binding || binding.companyId !== companyId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Invalid subscription binding.", 403);
  }

  const plan = await getCheckoutPlanOrThrow(binding.planId);
  const expectedAmountCents = resolvePlanAmountCents(plan, binding.interval);
  assertExactAmountCents(expectedAmountCents, binding.amountCents, "Checkout");

  const expectedPaypalPlanId = resolvePaypalPlanId(plan, binding.interval);
  if (!expectedPaypalPlanId) {
    throw new AppError(ErrorCode.UPSTREAM, "PayPal plan is not configured.", 503);
  }
  if (snapshot.plan_id !== expectedPaypalPlanId) {
    await recordBillingAudit({
      companyId,
      eventType: "SUSPICIOUS_BILLING_ATTEMPT",
      metadata: {
        provider: "paypal",
        reason: "plan_id_mismatch",
        expected: expectedPaypalPlanId,
        actual: snapshot.plan_id ?? null,
      },
    });
    throw new AppError(ErrorCode.FORBIDDEN, "PayPal plan does not match.", 403);
  }

  const lastPayment = snapshot.billing_info?.last_payment;
  if (!lastPayment?.amount?.value) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "PayPal payment is not confirmed yet.",
      402,
    );
  }
  assertCurrencyMatch(plan.currency, lastPayment.amount.currency_code);
  const paidCents = Math.round(Number(lastPayment.amount.value) * 100);
  if (!Number.isFinite(paidCents)) {
    throw new AppError(ErrorCode.FORBIDDEN, "Invalid PayPal payment amount.", 403);
  }
  assertExactAmountCents(expectedAmountCents, paidCents, "PayPal");

  await assertLocalCheckoutBinding({
    companyId,
    provider: "paypal",
    providerSubscriptionId,
    planId: plan.id,
  });

  return {
    plan,
    interval: binding.interval,
    expectedAmountCents,
    currentPeriodEnd: snapshot.billing_info?.next_billing_time
      ? new Date(snapshot.billing_info.next_billing_time)
      : null,
  };
}

export async function verifyStripePriceAgainstPlan(
  stripe: Stripe,
  plan: Plan,
  interval: BillingInterval,
  priceId: string,
) {
  const expectedPriceId = resolveStripePriceId(plan, interval);
  if (!expectedPriceId || expectedPriceId !== priceId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Stripe price does not match plan.", 403);
  }
  const price = await stripe.prices.retrieve(priceId);
  const expectedAmount = resolvePlanAmountCents(plan, interval);
  if (price.unit_amount == null) {
    throw new AppError(ErrorCode.FORBIDDEN, "Stripe price amount missing.", 403);
  }
  assertExactAmountCents(expectedAmount, price.unit_amount, "Stripe price");
  assertCurrencyMatch(plan.currency, price.currency);
  const expectedInterval = interval === "YEAR" ? "year" : "month";
  if (price.recurring?.interval !== expectedInterval) {
    throw new AppError(ErrorCode.FORBIDDEN, "Stripe billing interval does not match.", 403);
  }
}

export function assertStripeCheckoutPaid(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") {
    throw new AppError(ErrorCode.FORBIDDEN, "Payment is not complete yet.", 402);
  }
  if (session.status !== "complete") {
    throw new AppError(ErrorCode.FORBIDDEN, "Checkout session is not complete.", 402);
  }
}

/**
 * Paid checkout, or Stripe-native trial (complete + no_payment_required + subscription).
 * Does not accept unpaid/open sessions and does not invent a $0 charge.
 */
export function assertStripeCheckoutReadyForActivation(session: Stripe.Checkout.Session): {
  mode: "paid" | "trial";
} {
  if (session.status !== "complete") {
    throw new AppError(ErrorCode.FORBIDDEN, "Checkout session is not complete.", 402);
  }
  if (session.payment_status === "paid") {
    return { mode: "paid" };
  }
  if (session.payment_status === "no_payment_required" && session.subscription) {
    return { mode: "trial" };
  }
  throw new AppError(ErrorCode.FORBIDDEN, "Payment is not complete yet.", 402);
}

export function assertStripeSubscriptionActive(sub: Stripe.Subscription) {
  if (sub.status !== "active" && sub.status !== "trialing") {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Stripe subscription is not active.",
      402,
      { status: sub.status },
    );
  }
}
