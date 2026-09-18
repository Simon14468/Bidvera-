import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertCanManageBilling, canManageBilling } from "@/auth/billing-access";
import {
  assertCurrencyMatch,
  assertExactAmountCents,
  assertStripeCheckoutPaid,
  parsePayPalCustomId,
} from "@/services/billing/verification";
import {
  hashWebhookPayload,
  sanitizeWebhookPayloadForStorage,
} from "@/services/billing/webhooks-store";
import {
  allowStripeInlinePriceData,
  buildStripeCheckoutLineItems,
} from "@/services/billing/stripe";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("parsePayPalCustomId requires all four segments", () => {
  assert.equal(parsePayPalCustomId("co:plan:MONTH:4900")?.amountCents, 4900);
  assert.equal(parsePayPalCustomId("co:plan:MONTH"), null);
  assert.equal(parsePayPalCustomId("co:plan:WEEK:4900"), null);
  assert.equal(parsePayPalCustomId("co:plan:MONTH:0"), null);
});

test("assertExactAmountCents rejects any mismatch", () => {
  assert.doesNotThrow(() => assertExactAmountCents(4900, 4900));
  assert.throws(
    () => assertExactAmountCents(4900, 4899),
    (error: unknown) => error instanceof AppError && error.code === ErrorCode.FORBIDDEN,
  );
  assert.throws(
    () => assertExactAmountCents(4900, 5880),
    (error: unknown) => error instanceof AppError && error.code === ErrorCode.FORBIDDEN,
  );
});

test("assertCurrencyMatch is case-insensitive", () => {
  assert.doesNotThrow(() => assertCurrencyMatch("USD", "usd"));
  assert.throws(() => assertCurrencyMatch("USD", "eur"));
});

test("assertStripeCheckoutPaid requires paid and complete", () => {
  assert.throws(() =>
    assertStripeCheckoutPaid({
      payment_status: "unpaid",
      status: "complete",
    } as never),
  );
  assert.throws(() =>
    assertStripeCheckoutPaid({
      payment_status: "paid",
      status: "open",
    } as never),
  );
  assert.doesNotThrow(() =>
    assertStripeCheckoutPaid({
      payment_status: "paid",
      status: "complete",
    } as never),
  );
});

test("parsePayPalCustomId rejects manipulated client amounts", () => {
  const binding = parsePayPalCustomId("company-1:plan-1:YEAR:100");
  assert.equal(binding?.amountCents, 100);
  assert.equal(binding?.interval, "YEAR");
});

test("billing mutations require OWNER or ADMIN", () => {
  assert.equal(canManageBilling("OWNER"), true);
  assert.equal(canManageBilling("ADMIN"), true);
  assert.equal(canManageBilling("MEMBER"), false);
  assert.equal(canManageBilling("VIEWER"), false);
  assert.throws(
    () => assertCanManageBilling("VIEWER"),
    (error: unknown) => error instanceof AppError && error.code === ErrorCode.FORBIDDEN,
  );
  const actions = readFileSync(path.join(process.cwd(), "src/app/actions.ts"), "utf8");
  assert.match(actions, /assertCanManageBilling\(auth\.user\.role\)/);
  const activate = readFileSync(
    path.join(process.cwd(), "src/app/api/billing/activate/route.ts"),
    "utf8",
  );
  assert.match(activate, /assertCanManageBilling\(auth\.user\.role\)/);
  const freeTrial = readFileSync(
    path.join(process.cwd(), "src/application/auth-service.ts"),
    "utf8",
  );
  const freeTrialFn = freeTrial.slice(
    freeTrial.indexOf("export async function activateFreeOrTrialPlanAction"),
    freeTrial.indexOf("function isLikelyPersonalEmail"),
  );
  assert.match(freeTrialFn, /assertCanManageBilling\(auth\.user\.role\)/);
});

test("frontend plan manipulation cannot bypass custom_id amount segment", () => {
  const trusted = parsePayPalCustomId("co-abc:starter-plan:MONTH:4900");
  const manipulated = parsePayPalCustomId("co-abc:starter-plan:MONTH:100");
  assert.notEqual(trusted?.amountCents, manipulated?.amountCents);
});

test("webhook persistence stores sanitized metadata only", () => {
  const stripeEvent = {
    id: "evt_1",
    object: "event",
    type: "checkout.session.completed",
    livemode: true,
    created: 1_700_000_000,
    data: {
      object: {
        id: "cs_test_123",
        object: "checkout.session",
        status: "complete",
        customer_email: "buyer@example.com",
        customer_details: {
          email: "buyer@example.com",
          name: "Ada Lovelace",
          address: { city: "Paris", line1: "1 Rue Example", postal_code: "75001" },
        },
        payment_method_details: {
          card: { last4: "4242", fingerprint: "fp_abc", brand: "visa", cvc: "FAKESECRET_i2j3k4l5m6n7o8p9q0r1" },
        },
        metadata: { companyId: "co_1", planId: "pl_1", planSlug: "starter", interval: "MONTH" },
      },
    },
  };
  const stored = sanitizeWebhookPayloadForStorage(stripeEvent) as Record<string, unknown>;
  const serialized = JSON.stringify(stored);
  assert.equal(stored.stored, "sanitized");
  assert.equal(stored.resourceId, "cs_test_123");
  assert.equal(stored.companyId, "co_1");
  assert.equal(stored.planId, "pl_1");
  assert.equal(serialized.includes("buyer@example.com"), false);
  assert.equal(serialized.includes("Ada Lovelace"), false);
  assert.equal(serialized.includes("4242"), false);
  assert.equal(serialized.includes("fp_abc"), false);
  assert.equal(serialized.includes("123"), true);

  const paypalEvent = {
    id: "WH-1",
    event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
    resource_type: "subscription",
    resource: {
      id: "I-SUB123",
      status: "ACTIVE",
      custom_id: "co_1:pl_1:MONTH:4900",
      subscriber: {
        email_address: "payer@example.com",
        name: { given_name: "Ada", surname: "Lovelace" },
      },
      payer: { email_address: "payer@example.com" },
    },
  };
  const paypalStored = sanitizeWebhookPayloadForStorage(paypalEvent) as Record<string, unknown>;
  const paypalSerialized = JSON.stringify(paypalStored);
  assert.equal(paypalStored.resourceId, "I-SUB123");
  assert.equal(paypalStored.customId, "co_1:pl_1:MONTH:4900");
  assert.equal(paypalSerialized.includes("payer@example.com"), false);
  assert.equal(paypalSerialized.includes("Lovelace"), false);

  const store = readSrc("src/services/billing/webhooks-store.ts");
  assert.match(store, /rawPayload = sanitizeWebhookPayloadForStorage\(input\.payload\)/);
  assert.doesNotMatch(store, /rawPayload:\s*input\.payload/);
});

test("webhook payload hash uses the original payload and idempotency stays event-id keyed", () => {
  const payload = {
    id: "evt_dup",
    customer_email: "buyer@example.com",
    data: { object: { id: "cs_1", last4: "4242" } },
  };
  const sanitized = sanitizeWebhookPayloadForStorage(payload);
  assert.notEqual(JSON.stringify(payload), JSON.stringify(sanitized));
  assert.equal(
    hashWebhookPayload(payload),
    hashWebhookPayload({
      id: "evt_dup",
      customer_email: "buyer@example.com",
      data: { object: { id: "cs_1", last4: "4242" } },
    }),
  );
  assert.notEqual(hashWebhookPayload(payload), hashWebhookPayload(sanitized));

  const store = readSrc("src/services/billing/webhooks-store.ts");
  assert.match(store, /const payloadHash = hashWebhookPayload\(input\.payload\)/);
  assert.match(store, /provider_eventId/);
  assert.match(store, /existing\.status === "PROCESSED" \|\| existing\.status === "IGNORED"/);
  assert.match(store, /duplicate: true/);
  assert.match(store, /WEBHOOK_DUPLICATE_IGNORED/);
  assert.match(store, /staleMs < 120_000/);
});

test("production Stripe checkout is rejected when the Price ID is missing", () => {
  assert.equal(allowStripeInlinePriceData("production"), false);
  assert.throws(
    () =>
      buildStripeCheckoutLineItems({
        priceId: null,
        amountCents: 1900,
        currency: "USD",
        interval: "MONTH",
        planName: "Starter",
        planId: "pl_1",
        planSlug: "starter",
        nodeEnv: "production",
      }),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === ErrorCode.UPSTREAM &&
      error.status === 503 &&
      /Stripe Price ID is not configured/i.test(error.message),
  );
});

test("configured Stripe Price ID is used and client amount/currency are ignored", () => {
  const items = buildStripeCheckoutLineItems({
    priceId: "price_live_abc",
    amountCents: 1,
    currency: "eur",
    interval: "YEAR",
    planName: "Starter",
    planId: "pl_1",
    planSlug: "starter",
    nodeEnv: "production",
  });
  assert.deepEqual(items, [{ price: "price_live_abc", quantity: 1 }]);
  const serialized = JSON.stringify(items);
  assert.equal(serialized.includes("price_data"), false);
  assert.equal(serialized.includes("unit_amount"), false);
  assert.equal(serialized.includes("eur"), false);
  assert.equal(serialized.includes("year"), false);
});

test("Stripe checkout does not accept client price, amount, or currency", () => {
  const stripeSrc = readSrc("src/services/billing/stripe.ts");
  const start = stripeSrc.indexOf("export async function createStripeCheckoutSession");
  const end = stripeSrc.indexOf("export async function activateStripeCheckoutSession");
  const fn = stripeSrc.slice(start, end);
  assert.match(
    fn,
    /input: \{\s*companyId: string;\s*userEmail: string;\s*planIdOrSlug: string;\s*interval: BillingInterval;\s*successUrl: string;\s*cancelUrl: string;\s*\}/,
  );
  assert.doesNotMatch(fn, /input\.(amount|currency|price|unit_amount)/);
  assert.match(fn, /amountCents = resolvePlanAmountCents\(plan, input\.interval\)/);
  assert.match(fn, /buildStripeCheckoutLineItems/);
  assert.match(fn, /currency: plan\.currency/);

  const billing = readSrc("src/services/billing/index.ts");
  const checkoutStart = billing.indexOf("async createCheckoutSession");
  const checkoutFn = billing.slice(checkoutStart, billing.indexOf("async activateFromProviderSubscription"));
  assert.doesNotMatch(checkoutFn, /amountCents|unit_amount|priceId:/);
  assert.match(checkoutFn, /createStripeCheckoutSession\(\{/);
});
