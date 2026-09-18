import assert from "node:assert/strict";
import test from "node:test";
import type { Plan } from "@prisma/client";
import {
  planRequiresStripePriceId,
  resolvePlanAmountCents,
  resolveStripePriceId,
  resolvePaypalPlanId,
} from "@/services/billing/catalog";
import {
  extractRevocationReferenceIds,
  shouldSkipRevocation,
} from "@/services/billing/revocation-idempotency";
import { isAnalysisCreditsExhausted } from "@/services/usage";
import { evaluateSubscriptionAccess } from "@/services/billing/lifecycle";

const basePlan = {
  monthlyPriceCents: 1900,
  annualPriceCents: 19000,
  currency: "USD",
  stripePriceMonthly: "price_starter_month",
  stripePriceAnnual: "price_starter_year",
  stripePriceEnv: null,
  paypalPlanMonthly: "P-STarter-M",
  paypalPlanAnnual: "P-Starter-Y",
  paypalPlanIdEnv: null,
} as Plan;

test("resolveStripePriceId maps monthly vs yearly from Super Admin fields", () => {
  assert.equal(resolveStripePriceId(basePlan, "MONTH"), "price_starter_month");
  assert.equal(resolveStripePriceId(basePlan, "YEAR"), "price_starter_year");
  assert.equal(planRequiresStripePriceId(basePlan, "MONTH"), true);
  assert.equal(planRequiresStripePriceId(basePlan, "YEAR"), true);
});

test("resolvePaypalPlanId maps monthly vs yearly independently", () => {
  assert.equal(resolvePaypalPlanId(basePlan, "MONTH"), "P-STarter-M");
  assert.equal(resolvePaypalPlanId(basePlan, "YEAR"), "P-Starter-Y");
});

test("resolvePlanAmountCents returns distinct monthly and yearly DB amounts", () => {
  assert.equal(resolvePlanAmountCents(basePlan, "MONTH"), 1900);
  assert.equal(resolvePlanAmountCents(basePlan, "YEAR"), 19000);
  assert.notEqual(
    resolvePlanAmountCents(basePlan, "MONTH"),
    resolvePlanAmountCents(basePlan, "YEAR"),
  );
});

test("trial blocks 4th analysis when 3 credits used", () => {
  assert.equal(isAnalysisCreditsExhausted(0, 3), false);
  assert.equal(isAnalysisCreditsExhausted(2, 3), false);
  assert.equal(isAnalysisCreditsExhausted(3, 3), true);
  assert.equal(isAnalysisCreditsExhausted(4, 3), true);
});

test("analysesLimit 0 is blocked, not unlimited", () => {
  assert.equal(isAnalysisCreditsExhausted(0, 0), true);
  assert.equal(isAnalysisCreditsExhausted(999, 0), true);
});

test("analysesLimit null is unlimited", () => {
  assert.equal(isAnalysisCreditsExhausted(0, null), false);
  assert.equal(isAnalysisCreditsExhausted(999, null), false);
});

test("trialing subscription access ends when period expires", () => {
  const past = new Date(Date.now() - 86400000);
  const access = evaluateSubscriptionAccess({
    status: "TRIALING",
    plan: "TRIAL",
    billingInterval: "MONTH",
    startedAt: past,
    currentPeriodStart: past,
    currentPeriodEnd: past,
    gracePeriodEndsAt: null,
    cancelAtPeriodEnd: false,
  });
  assert.equal(access.allowed, false);
  assert.equal(access.reason, "trial_expired");
});

test("revocation idempotency skips duplicate providerReferenceId", () => {
  assert.equal(
    shouldSkipRevocation({
      status: "ACTIVE",
      plan: "PRO",
      analysesLimit: 100,
      providerReferenceId: "ch_123",
      processedReferenceIds: ["ch_123"],
    }),
    true,
  );
});

test("revocation idempotency skips already EXPIRED restricted state", () => {
  assert.equal(
    shouldSkipRevocation({
      status: "EXPIRED",
      plan: "PRO",
      analysesLimit: 0,
      providerReferenceId: "ch_new",
      processedReferenceIds: [],
    }),
    true,
  );
});

test("revocation idempotency allows first revocation on ACTIVE paid plan", () => {
  assert.equal(
    shouldSkipRevocation({
      status: "ACTIVE",
      plan: "PRO",
      analysesLimit: 100,
      providerReferenceId: "ch_first",
      processedReferenceIds: [],
    }),
    false,
  );
});

test("extractRevocationReferenceIds collects provider ids from events", () => {
  const ids = extractRevocationReferenceIds([
    { metadata: { providerReferenceId: "dp_1" } },
    { metadata: { reason: "refund" } },
    { metadata: { providerReferenceId: "ch_9" } },
  ]);
  assert.deepEqual(ids, ["dp_1", "ch_9"]);
});

test("paid ACTIVE subscription allows access until revoked", () => {
  const future = new Date(Date.now() + 30 * 86400000);
  const access = evaluateSubscriptionAccess({
    status: "ACTIVE",
    plan: "PRO",
    billingInterval: "MONTH",
    startedAt: new Date(),
    currentPeriodStart: new Date(),
    currentPeriodEnd: future,
    gracePeriodEndsAt: null,
    cancelAtPeriodEnd: false,
  });
  assert.equal(access.allowed, true);
});

test("EXPIRED paid subscription denies access after refund revocation", () => {
  const access = evaluateSubscriptionAccess({
    status: "EXPIRED",
    plan: "PRO",
    billingInterval: "MONTH",
    startedAt: new Date(),
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(),
    gracePeriodEndsAt: null,
    cancelAtPeriodEnd: false,
  });
  assert.equal(access.allowed, false);
  assert.equal(access.reason, "expired");
});
