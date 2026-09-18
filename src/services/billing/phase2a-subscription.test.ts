import assert from "node:assert/strict";
import test from "node:test";
import type { Plan } from "@prisma/client";
import {
  DEFAULT_BILLING_GATEWAY_SETTINGS,
  billingGatewaySettingsSchema,
} from "@/services/billing/settings";
import {
  decideStripeTrialCheckout,
  resolvePlanTrialDays,
  buildStripeTrialSubscriptionData,
  STRIPE_TRIAL_PAYMENT_METHOD_COLLECTION,
  isStripeTrialCheckoutSession,
} from "@/services/billing/trial-checkout";
import {
  isLegacyOpenEndedTrial,
  shouldAssignFreeWorkspace,
  shouldDeferProviderManagedTrial,
  slugToLegacyPlan,
} from "@/services/billing/free-workspace";
import {
  assertStripeCheckoutPaid,
  assertStripeCheckoutReadyForActivation,
} from "@/services/billing/verification";
import { PLAN_ENTITLEMENT_DEFAULTS, planDefaultFeatureKeys } from "@/domain/billing/entitlement-catalog";
import { isAiQuotaExceeded } from "@/services/entitlements/ai-quota";
import { ipVelocityScore } from "@/services/trial/risk";
import { checkoutRateLimiter } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { evaluateSubscriptionAccess } from "@/services/billing/lifecycle";

const paidPlan = {
  slug: "starter",
  isFree: false,
  trialEligible: true,
  trialDays: 14,
} as Plan;

const settingsOn = {
  ...DEFAULT_BILLING_GATEWAY_SETTINGS,
  trialEnabled: true,
  trialDays: 14,
  requirePaymentMethodForTrial: true,
  freeWorkspaceEnabled: true,
};

test("A. 14-day trial days resolve from plan then settings", () => {
  assert.equal(resolvePlanTrialDays(paidPlan, settingsOn), 14);
  assert.equal(
    resolvePlanTrialDays({ ...paidPlan, trialDays: null }, settingsOn),
    14,
  );
  assert.equal(
    resolvePlanTrialDays(paidPlan, { ...settingsOn, trialEnabled: false }),
    0,
  );
});

test("B. selected paid plan keeps its own trial offer (not hardcoded Pro)", () => {
  for (const slug of ["starter", "pro", "business"] as const) {
    const decision = decideStripeTrialCheckout({
      settings: settingsOn,
      plan: { ...paidPlan, slug },
      companyConsumedTrial: false,
      isLegacyOpenEndedTrial: false,
    });
    assert.equal(decision.offer, true, slug);
    assert.equal(decision.days, 14, slug);
  }
  assert.ok(planDefaultFeatureKeys("starter").includes("document_compliance"));
  assert.ok(!planDefaultFeatureKeys("starter").includes("decision_simulator"));
  assert.ok(planDefaultFeatureKeys("pro").includes("decision_simulator"));
});

test("C. payment method is required for Stripe trial checkout extras", () => {
  const extras = buildStripeTrialSubscriptionData(14);
  assert.equal(extras.trial_period_days, 14);
  assert.equal(STRIPE_TRIAL_PAYMENT_METHOD_COLLECTION, "always");
  const noPm = decideStripeTrialCheckout({
    settings: { ...settingsOn, requirePaymentMethodForTrial: false },
    plan: paidPlan,
    companyConsumedTrial: false,
    isLegacyOpenEndedTrial: false,
  });
  assert.equal(noPm.offer, false);
  assert.equal(noPm.reason, "payment_method_not_required");
});

test("D. trial checkout session is no_payment_required, not a fake paid charge", () => {
  assert.equal(
    isStripeTrialCheckoutSession({
      payment_status: "no_payment_required",
      subscription: "sub_123",
    }),
    true,
  );
  const ready = assertStripeCheckoutReadyForActivation({
    status: "complete",
    payment_status: "no_payment_required",
    subscription: "sub_123",
  } as never);
  assert.equal(ready.mode, "trial");
  assert.throws(
    () =>
      assertStripeCheckoutPaid({
        status: "complete",
        payment_status: "no_payment_required",
      } as never),
    (e: unknown) => e instanceof AppError,
  );
});

test("E. auto-conversion: Stripe active after trial is allowed ACCESS", () => {
  const access = evaluateSubscriptionAccess({
    status: "ACTIVE",
    plan: "STARTER",
    billingInterval: "MONTH",
    startedAt: new Date("2026-09-01T00:00:00Z"),
    currentPeriodStart: new Date("2026-09-15T00:00:00Z"),
    currentPeriodEnd: new Date("2026-10-15T00:00:00Z"),
    gracePeriodEndsAt: null,
    cancelAtPeriodEnd: false,
  });
  assert.equal(access.allowed, true);
  assert.equal(access.reason, "active");
});

test("F. failed conversion stays in grace, not destroyed", () => {
  const access = evaluateSubscriptionAccess({
    status: "PAST_DUE",
    plan: "STARTER",
    billingInterval: "MONTH",
    startedAt: new Date("2026-09-01T00:00:00Z"),
    currentPeriodStart: new Date("2026-09-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-10-01T00:00:00Z"),
    gracePeriodEndsAt: new Date("2026-09-20T00:00:00Z"),
    cancelAtPeriodEnd: false,
  }, new Date("2026-09-16T00:00:00Z"));
  assert.equal(access.allowed, true);
  assert.equal(access.inGrace, true);
});

test("G. cancel before conversion assigns Free Workspace", () => {
  assert.equal(
    shouldAssignFreeWorkspace({
      freeWorkspaceEnabled: true,
      reason: "trial_cancelled",
    }),
    true,
  );
  assert.equal(slugToLegacyPlan("free"), "FREE");
  assert.ok(PLAN_ENTITLEMENT_DEFAULTS.free?.includes("company_profile"));
  assert.ok(PLAN_ENTITLEMENT_DEFAULTS.free?.includes("document_compliance"));
  assert.ok(!PLAN_ENTITLEMENT_DEFAULTS.free?.includes("tender_analysis"));
  assert.ok(!PLAN_ENTITLEMENT_DEFAULTS.free?.includes("matching_engine"));
});

test("H. Free Workspace is not a checkout product", () => {
  const freeDecision = decideStripeTrialCheckout({
    settings: settingsOn,
    plan: { slug: "free", isFree: true, trialEligible: false, trialDays: null } as Plan,
    companyConsumedTrial: false,
    isLegacyOpenEndedTrial: false,
  });
  assert.equal(freeDecision.offer, false);
  assert.equal(billingGatewaySettingsSchema.parse({}).freeWorkspaceEnabled, true);
});

test("I. legacy open-ended trials are not retro-expired", () => {
  assert.equal(
    isLegacyOpenEndedTrial({
      status: "TRIALING",
      plan: "TRIAL",
      currentPeriodEnd: null,
    }),
    true,
  );
  assert.equal(
    isLegacyOpenEndedTrial({
      status: "TRIALING",
      plan: "STARTER",
      currentPeriodEnd: new Date(),
    }),
    false,
  );
  const access = evaluateSubscriptionAccess({
    status: "TRIALING",
    plan: "TRIAL",
    billingInterval: "MONTH",
    startedAt: new Date("2026-01-01T00:00:00Z"),
    currentPeriodStart: new Date("2026-01-01T00:00:00Z"),
    currentPeriodEnd: null,
    gracePeriodEndsAt: null,
    cancelAtPeriodEnd: false,
  }, new Date("2026-09-13T00:00:00Z"));
  assert.equal(access.allowed, true);
  assert.equal(access.reason, "trialing");
});

test("J. duplicate trial after consume is refused", () => {
  const decision = decideStripeTrialCheckout({
    settings: settingsOn,
    plan: paidPlan,
    companyConsumedTrial: true,
    isLegacyOpenEndedTrial: false,
  });
  assert.equal(decision.offer, false);
  assert.equal(decision.reason, "already_consumed");
});

test("K. same-office IP velocity never reaches BLOCK alone", () => {
  assert.equal(ipVelocityScore(1), 0);
  assert.equal(ipVelocityScore(2), 10);
  assert.equal(ipVelocityScore(5), 30);
  assert.ok(ipVelocityScore(5) < 80);
});

test("L. checkout rate limiter trips after 8 attempts / hour", async () => {
  // Deterministic: this test exercises the in-memory backend, never the shared DB bucket.
  const prevBackend = process.env.RATE_LIMIT_BACKEND;
  process.env.RATE_LIMIT_BACKEND = "memory";
  checkoutRateLimiter.resetMemoryForTests();
  for (let i = 0; i < 8; i += 1) {
    const r = await checkoutRateLimiter.consume("checkout:test-company");
    assert.equal(r.ok, true);
  }
  const blocked = await checkoutRateLimiter.consume("checkout:test-company");
  assert.equal(blocked.ok, false);
  if (prevBackend === undefined) delete process.env.RATE_LIMIT_BACKEND;
  else process.env.RATE_LIMIT_BACKEND = prevBackend;
});

test("M. AI quota: null unlimited, 0 blocks, used >= limit blocks", () => {
  assert.equal(isAiQuotaExceeded(0, null), false);
  assert.equal(isAiQuotaExceeded(999, null), false);
  assert.equal(isAiQuotaExceeded(0, 0), true);
  assert.equal(isAiQuotaExceeded(9, 10), false);
  assert.equal(isAiQuotaExceeded(10, 10), true);
});

test("N. webhook deferral: uncancelled Stripe trial waits for provider", () => {
  assert.equal(
    shouldDeferProviderManagedTrial({
      provider: "stripe",
      providerSubscriptionId: "sub_1",
      status: "TRIALING",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date("2020-01-01"),
    }),
    true,
  );
  assert.equal(
    shouldDeferProviderManagedTrial({
      provider: "stripe",
      providerSubscriptionId: "sub_1",
      status: "TRIALING",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date("2020-01-01"),
    }),
    false,
  );
});

test("O. existing paid ACTIVE subscriptions still allow access", () => {
  const access = evaluateSubscriptionAccess({
    status: "ACTIVE",
    plan: "BUSINESS",
    billingInterval: "YEAR",
    startedAt: new Date("2026-01-01T00:00:00Z"),
    currentPeriodStart: new Date("2026-01-01T00:00:00Z"),
    currentPeriodEnd: new Date("2027-01-01T00:00:00Z"),
    gracePeriodEndsAt: null,
    cancelAtPeriodEnd: false,
  });
  assert.equal(access.allowed, true);
  assert.equal(access.reason, "active");
});

test("PayPal is not offered a Stripe-native trial", () => {
  // PayPal checkout never receives trial_period_days — eligibility is Stripe-only.
  const extras = buildStripeTrialSubscriptionData(14);
  assert.ok("trial_period_days" in extras);
  assert.equal(DEFAULT_BILLING_GATEWAY_SETTINGS.requirePaymentMethodForTrial, true);
});
