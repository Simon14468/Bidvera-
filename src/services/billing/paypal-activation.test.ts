import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { AppError, ErrorCode } from "@/lib/errors";
import { SECRET_SETTING_KEYS } from "@/config/super-admin";
import {
  publicStripeTrialDays,
  resolvePlanAmountCents,
  resolvePaypalPlanId,
} from "@/services/billing/catalog";
import { shouldAssignFreeWorkspace } from "@/services/billing/free-workspace";
import { evaluateSubscriptionAccess } from "@/services/billing/lifecycle";
import {
  handlePayPalWebhook,
  paypalBaseUrl,
  resolvePaypalEnvironment,
  getPaypalIntegrationStatus,
  assertPaypalRuntimeReady,
  resolvePayPalWebhookAction,
  resolvePayPalWebhookSubscriptionId,
} from "@/services/billing/paypal";
import {
  DEFAULT_BILLING_GATEWAY_SETTINGS,
  billingGatewaySettingsSchema,
  parseBillingGatewaySettings,
} from "@/services/billing/settings";
import { parsePayPalCustomId } from "@/services/billing/verification";
import type { Plan } from "@prisma/client";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function setNodeEnv(value: string | undefined) {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

const paidPlan = {
  monthlyPriceCents: 4900,
  annualPriceCents: 49000,
  paypalPlanMonthly: "P-STARTER-M",
  paypalPlanAnnual: "P-STARTER-Y",
  paypalPlanIdEnv: null,
} as Plan;

test("PayPal is the default provider and Stripe is not", () => {
  const parsed = billingGatewaySettingsSchema.parse({});
  assert.equal(parsed.defaultGateway, "paypal");
  assert.equal(parsed.paypalEnabled, true);
  assert.notEqual(parsed.defaultGateway, "stripe");
  assert.equal(DEFAULT_BILLING_GATEWAY_SETTINGS.defaultGateway, "paypal");
  assert.equal(DEFAULT_BILLING_GATEWAY_SETTINGS.paypalEnabled, true);
  assert.equal(DEFAULT_BILLING_GATEWAY_SETTINGS.stripeEnabled, false);
});

test("parseBillingGatewaySettings recovers to PayPal default on invalid input", () => {
  const recovered = parseBillingGatewaySettings({ defaultGateway: "bitcoin" });
  assert.equal(recovered.defaultGateway, "paypal");
  assert.equal(recovered.paypalEnabled, true);
});

test("checkout selects PayPal when no gateway is requested", () => {
  const requested: "stripe" | "paypal" | undefined = undefined;
  const gateway = requested ?? DEFAULT_BILLING_GATEWAY_SETTINGS.defaultGateway;
  assert.equal(gateway, "paypal");
  assert.notEqual(gateway, "stripe");
});

test("valid PayPal checkout maps plan amount and PayPal plan ID from the catalog", () => {
  assert.equal(resolvePlanAmountCents(paidPlan, "MONTH"), 4900);
  assert.equal(resolvePlanAmountCents(paidPlan, "YEAR"), 49000);
  assert.equal(resolvePaypalPlanId(paidPlan, "MONTH"), "P-STARTER-M");
  assert.equal(resolvePaypalPlanId(paidPlan, "YEAR"), "P-STARTER-Y");
});

test("invalid or unknown checkout plans are rejected", () => {
  assert.throws(() =>
    resolvePlanAmountCents(
      { monthlyPriceCents: 0, annualPriceCents: null } as Plan,
      "MONTH",
    ),
  );
  assert.equal(resolvePaypalPlanId({ ...paidPlan, paypalPlanMonthly: null } as Plan, "MONTH"), null);
  const catalog = readSrc("src/services/billing/catalog.ts");
  assert.match(catalog, /PLAN_UNAVAILABLE/);
  assert.match(catalog, /getCheckoutPlanOrThrow/);
  assert.match(catalog, /slug === "trial"/);
  assert.match(catalog, /slug === "free"/);
  const billing = readSrc("src/services/billing/index.ts");
  assert.match(billing, /Cannot checkout the trial or free plan/);
  assert.match(billing, /This plan is not available for checkout/);
});

test("successful PayPal subscription requires ACTIVE paid custom_id binding", () => {
  const customId = "company-a:plan-starter:MONTH:4900";
  const binding = parsePayPalCustomId(customId);
  assert.deepEqual(binding, {
    companyId: "company-a",
    planId: "plan-starter",
    interval: "MONTH",
    amountCents: 4900,
  });
  const verification = readSrc("src/services/billing/verification.ts");
  assert.match(verification, /snapshot.status !== "ACTIVE"/);
  assert.match(verification, /last_payment/);
  assert.match(verification, /assertLocalCheckoutBinding/);
  assert.match(verification, /custom_id_mismatch/);
});

test("tenant isolation rejects another company's custom_id", () => {
  const attacker = parsePayPalCustomId("company-b:plan-starter:MONTH:4900");
  const sessionCompanyId = "company-a";
  assert.ok(attacker);
  assert.notEqual(attacker.companyId, sessionCompanyId);
  const verification = readSrc("src/services/billing/verification.ts");
  assert.match(verification, /Subscription does not match company/);
  assert.match(verification, /binding.companyId !== companyId/);
});

test("PayPal webhook actions cover the required lifecycle events", () => {
  assert.equal(resolvePayPalWebhookAction("BILLING.SUBSCRIPTION.ACTIVATED"), "activate");
  assert.equal(resolvePayPalWebhookAction("BILLING.SUBSCRIPTION.UPDATED"), "activate");
  assert.equal(resolvePayPalWebhookAction("BILLING.SUBSCRIPTION.CANCELLED"), "cancel");
  assert.equal(resolvePayPalWebhookAction("BILLING.SUBSCRIPTION.SUSPENDED"), "payment_failed");
  assert.equal(resolvePayPalWebhookAction("BILLING.SUBSCRIPTION.PAYMENT.FAILED"), "payment_failed");
  assert.equal(resolvePayPalWebhookAction("PAYMENT.SALE.DENIED"), "payment_failed");
  assert.equal(resolvePayPalWebhookAction("BILLING.SUBSCRIPTION.EXPIRED"), "expired");
  assert.equal(resolvePayPalWebhookAction("PAYMENT.SALE.REFUNDED"), "refund");
  assert.equal(resolvePayPalWebhookAction("BILLING.SUBSCRIPTION.CREATED"), "ignore");
});

test("sale webhooks resolve the subscription from billing_agreement_id", () => {
  assert.equal(
    resolvePayPalWebhookSubscriptionId({
      event_type: "PAYMENT.SALE.DENIED",
      resource: { id: "sale-1", billing_agreement_id: "I-SUB" },
    }),
    "I-SUB",
  );
  assert.equal(
    resolvePayPalWebhookSubscriptionId({
      event_type: "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
      resource: { id: "I-SUB" },
    }),
    "I-SUB",
  );
});

test("unconfigured or invalid PayPal webhooks are rejected", async () => {
  const prev = {
    id: process.env.PAYPAL_WEBHOOK_ID,
    client: process.env.PAYPAL_CLIENT_ID,
    secret: process.env.PAYPAL_CLIENT_SECRET,
  };
  const restore = () => {
    restoreEnv("PAYPAL_WEBHOOK_ID", prev.id);
    restoreEnv("PAYPAL_CLIENT_ID", prev.client);
    restoreEnv("PAYPAL_CLIENT_SECRET", prev.secret);
  };
  try {
    delete process.env.PAYPAL_WEBHOOK_ID;
    delete process.env.PAYPAL_CLIENT_ID;
    await assert.rejects(
      () => handlePayPalWebhook("{}", new Headers()),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === ErrorCode.UPSTREAM &&
        error.status === 503,
    );

    process.env.PAYPAL_WEBHOOK_ID = "WH-TEST";
    process.env.PAYPAL_CLIENT_ID = "client-test";
    process.env.PAYPAL_CLIENT_SECRET = "secret-test";
    await assert.rejects(
      () => handlePayPalWebhook("not-json", new Headers()),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === ErrorCode.VALIDATION &&
        error.status === 400,
    );
  } finally {
    restore();
  }
});

test("invalid PayPal webhook signature is rejected", async () => {
  const prev = {
    id: process.env.PAYPAL_WEBHOOK_ID,
    client: process.env.PAYPAL_CLIENT_ID,
    secret: process.env.PAYPAL_CLIENT_SECRET,
  };
  process.env.PAYPAL_WEBHOOK_ID = "WH-TEST";
  process.env.PAYPAL_CLIENT_ID = "client-test";
  process.env.PAYPAL_CLIENT_SECRET = "secret-test";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
    }
    if (url.includes("/v1/notifications/verify-webhook-signature")) {
      return new Response(JSON.stringify({ verification_status: "FAILURE" }), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        handlePayPalWebhook(
          JSON.stringify({ id: "WH-EVT-1", event_type: "BILLING.SUBSCRIPTION.ACTIVATED" }),
          new Headers({
            "paypal-auth-algo": "SHA256withRSA",
            "paypal-cert-url": "https://api.paypal.com/cert",
            "paypal-transmission-id": "tx-1",
            "paypal-transmission-sig": "sig",
            "paypal-transmission-time": "2026-01-01T00:00:00Z",
          }),
        ),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === ErrorCode.FORBIDDEN &&
        error.status === 401,
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("PAYPAL_WEBHOOK_ID", prev.id);
    restoreEnv("PAYPAL_CLIENT_ID", prev.client);
    restoreEnv("PAYPAL_CLIENT_SECRET", prev.secret);
  }
});

test("duplicate webhook processing is idempotent", () => {
  const store = readSrc("src/services/billing/webhooks-store.ts");
  assert.match(store, /duplicate: true/);
  assert.match(store, /WEBHOOK_DUPLICATE_IGNORED/);
  assert.match(store, /provider_eventId/);
  const paypal = readSrc("src/services/billing/paypal.ts");
  assert.match(paypal, /beginWebhookProcessing/);
  assert.match(paypal, /if \(duplicate\) return/);
});

test("payment success synchronization activates the bound PayPal subscription", () => {
  const paypal = readSrc("src/services/billing/paypal.ts");
  assert.match(paypal, /BILLING.SUBSCRIPTION.ACTIVATED/);
  assert.match(paypal, /applyPaidPlanActivation/);
  assert.match(paypal, /verifyPayPalSubscriptionForActivation/);
  assert.equal(resolvePayPalWebhookAction("BILLING.SUBSCRIPTION.ACTIVATED"), "activate");
});

test("payment failure synchronization uses the existing PAST_DUE grace machine", () => {
  assert.equal(
    resolvePayPalWebhookAction("BILLING.SUBSCRIPTION.PAYMENT.FAILED"),
    "payment_failed",
  );
  const paypal = readSrc("src/services/billing/paypal.ts");
  assert.match(paypal, /markSubscriptionPaymentFailed/);
  const future = new Date(Date.now() + 2 * 86_400_000);
  const access = evaluateSubscriptionAccess({
    status: "PAST_DUE",
    plan: "STARTER",
    billingInterval: "MONTH",
    startedAt: new Date(),
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
    gracePeriodEndsAt: future,
    cancelAtPeriodEnd: false,
  });
  assert.equal(access.allowed, true);
  assert.equal(access.inGrace, true);
  assert.equal(access.reason, "grace");
});

test("cancellation synchronization keeps access until period end", () => {
  assert.equal(resolvePayPalWebhookAction("BILLING.SUBSCRIPTION.CANCELLED"), "cancel");
  const paypal = readSrc("src/services/billing/paypal.ts");
  assert.match(paypal, /status: "CANCELED"/);
  assert.match(paypal, /cancelAtPeriodEnd: true/);
  const periodEnd = new Date(Date.now() + 10 * 86_400_000);
  const access = evaluateSubscriptionAccess({
    status: "CANCELED",
    plan: "STARTER",
    billingInterval: "MONTH",
    startedAt: new Date(),
    currentPeriodStart: new Date(),
    currentPeriodEnd: periodEnd,
    gracePeriodEndsAt: null,
    cancelAtPeriodEnd: true,
  });
  assert.equal(access.allowed, true);
  assert.equal(access.reason, "canceled_until_period_end");
});

test("Free Workspace downgrade after PayPal expiration uses existing assigner", () => {
  assert.equal(resolvePayPalWebhookAction("BILLING.SUBSCRIPTION.EXPIRED"), "expired");
  assert.equal(
    shouldAssignFreeWorkspace({
      freeWorkspaceEnabled: true,
      reason: "subscription_deleted",
    }),
    true,
  );
  const paypal = readSrc("src/services/billing/paypal.ts");
  assert.match(paypal, /assignFreeWorkspace/);
  assert.match(paypal, /subscription_deleted/);
  const free = readSrc("src/services/billing/free-workspace.ts");
  assert.match(free, /Never deletes company data/);
});

test("PayPal does not advertise the Stripe 14-day trial", () => {
  assert.equal(
    publicStripeTrialDays(
      {
        isFree: false,
        slug: "pro",
        trialEligible: true,
        trialDays: 14,
        gateways: ["stripe", "paypal"],
      },
      DEFAULT_BILLING_GATEWAY_SETTINGS,
    ),
    null,
  );
  const picker = readSrc("src/components/onboarding/plan-picker.tsx");
  assert.match(picker, /showStripeTrial = Boolean\(plan.stripeTrialDays\) && gateway === "stripe"/);
});

test("PayPal environment and secrets stay on the server", () => {
  const prevEnv = process.env.PAYPAL_ENVIRONMENT;
  const prevMode = process.env.PAYPAL_MODE;
  const prevId = process.env.PAYPAL_CLIENT_ID;
  const prevSecret = process.env.PAYPAL_CLIENT_SECRET;
  const prevWebhook = process.env.PAYPAL_WEBHOOK_ID;
  const prevNodeEnv = process.env.NODE_ENV;

  try {
  setNodeEnv("test");
  delete process.env.PAYPAL_ENVIRONMENT;
  delete process.env.PAYPAL_MODE;
  assert.equal(resolvePaypalEnvironment(), "sandbox");
  assert.equal(paypalBaseUrl(), "https://api-m.sandbox.paypal.com");

  process.env.PAYPAL_ENVIRONMENT = "production";
  assert.equal(resolvePaypalEnvironment(), "live");
  assert.equal(paypalBaseUrl(), "https://api-m.paypal.com");

  delete process.env.PAYPAL_ENVIRONMENT;
  process.env.PAYPAL_MODE = "live";
  assert.equal(resolvePaypalEnvironment(), "live");

  process.env.PAYPAL_CLIENT_ID = "live-client-id";
  process.env.PAYPAL_CLIENT_SECRET = "super-secret-value";
  process.env.PAYPAL_WEBHOOK_ID = "WH-123";
  const status = getPaypalIntegrationStatus();
  assert.equal(status.credentialsConfigured, true);
  assert.equal(status.webhookConfigured, true);
  assert.equal(status.environment, "live");
  assert.equal(JSON.stringify(status).includes("super-secret-value"), false);
  assert.equal(JSON.stringify(status).includes("live-client-id"), false);
  assert.equal(JSON.stringify(status).includes("WH-123"), false);

  assert.ok(SECRET_SETTING_KEYS.has("PAYPAL_CLIENT_SECRET"));
  const example = readSrc(".env.example");
  assert.match(example, /PAYPAL_ENVIRONMENT/);
  assert.match(example, /never NEXT_PUBLIC_\*/);
  assert.doesNotMatch(example, /PAYPAL_CLIENT_SECRET="[^"]+"/);
  assert.doesNotMatch(example, /NEXT_PUBLIC_PAYPAL/);

  const frontendHits = [
    "src/components/onboarding/plan-picker.tsx",
    "src/components/billing/paypal-activate.tsx",
    "src/components/super-admin/payments-admin.tsx",
  ];
  for (const file of frontendHits) {
    assert.doesNotMatch(readSrc(file), /PAYPAL_CLIENT_SECRET/);
  }

  } finally {
    restoreEnv("PAYPAL_ENVIRONMENT", prevEnv);
    restoreEnv("PAYPAL_MODE", prevMode);
    restoreEnv("PAYPAL_CLIENT_ID", prevId);
    restoreEnv("PAYPAL_CLIENT_SECRET", prevSecret);
    restoreEnv("PAYPAL_WEBHOOK_ID", prevWebhook);
    setNodeEnv(prevNodeEnv);
  }
});

test("PayPal production fail-closed never defaults to sandbox", () => {
  const prevEnv = process.env.PAYPAL_ENVIRONMENT;
  const prevMode = process.env.PAYPAL_MODE;
  const prevId = process.env.PAYPAL_CLIENT_ID;
  const prevSecret = process.env.PAYPAL_CLIENT_SECRET;
  const prevWebhook = process.env.PAYPAL_WEBHOOK_ID;
  const prevNodeEnv = process.env.NODE_ENV;

  try {
    setNodeEnv("production");
    delete process.env.PAYPAL_ENVIRONMENT;
    delete process.env.PAYPAL_MODE;
    assert.throws(
      () => resolvePaypalEnvironment(),
      (error: unknown) =>
        error instanceof AppError &&
        error.status === 503 &&
        /PAYPAL_ENVIRONMENT=production/i.test(error.message),
    );
    assert.throws(() => paypalBaseUrl(), (error: unknown) => error instanceof AppError);

    // Status must not silently advertise sandbox under NODE_ENV=production.
    const misconfigured = getPaypalIntegrationStatus();
    assert.equal(misconfigured.environment, "live");
    assert.equal(misconfigured.productionReady, false);

    process.env.PAYPAL_ENVIRONMENT = "sandbox";
    assert.throws(
      () => resolvePaypalEnvironment(),
      (error: unknown) => error instanceof AppError && error.status === 503,
    );

    process.env.PAYPAL_ENVIRONMENT = "production";
    process.env.PAYPAL_CLIENT_ID = "sb-sandbox-client";
    process.env.PAYPAL_CLIENT_SECRET = "secret";
    delete process.env.PAYPAL_WEBHOOK_ID;
    assert.throws(
      () => assertPaypalRuntimeReady(),
      (error: unknown) =>
        error instanceof AppError &&
        error.status === 503 &&
        /sandbox client/i.test(error.message),
    );

    process.env.PAYPAL_CLIENT_ID = "live-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "live-secret";
    assert.throws(
      () => assertPaypalRuntimeReady(),
      (error: unknown) =>
        error instanceof AppError &&
        error.status === 503 &&
        /PAYPAL_WEBHOOK_ID/i.test(error.message),
    );

    process.env.PAYPAL_WEBHOOK_ID = "WH-LIVE";
    assert.equal(resolvePaypalEnvironment(), "live");
    assert.equal(paypalBaseUrl(), "https://api-m.paypal.com");
    assert.doesNotThrow(() => assertPaypalRuntimeReady());
    const ready = getPaypalIntegrationStatus();
    assert.equal(ready.environment, "live");
    assert.equal(ready.productionReady, true);
    assert.equal(ready.webhookConfigured, true);
  } finally {
    restoreEnv("PAYPAL_ENVIRONMENT", prevEnv);
    restoreEnv("PAYPAL_MODE", prevMode);
    restoreEnv("PAYPAL_CLIENT_ID", prevId);
    restoreEnv("PAYPAL_CLIENT_SECRET", prevSecret);
    restoreEnv("PAYPAL_WEBHOOK_ID", prevWebhook);
    setNodeEnv(prevNodeEnv);
  }
});
