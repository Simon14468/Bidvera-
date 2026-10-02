import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { Plan } from "@prisma/client";
import {
  assertIntervalGatewayMapping,
  configuredGatewaysForInterval,
} from "@/services/billing/catalog";
import {
  isUsablePaypalBillingPlanId,
  isUsableStripePriceId,
  normalizePlanGatewayWrite,
} from "@/services/billing/plan-gateway-ids";
import { readPaypalBillingPlan } from "@/services/billing/paypal";
import { AppError } from "@/lib/errors";

const STRIPE_MONTH = "price_1N4ValidMonthly01";
const STRIPE_YEAR = "price_1N4ValidAnnual0001";
const PAYPAL_MONTH = "P-5ML4271244454362WXNWU5NQ";
const PAYPAL_YEAR = "P-7PD94525LH9368714L5QSZLY";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function paid(overrides: Partial<Plan> = {}): Plan {
  return {
    name: "Starter",
    slug: "starter",
    isFree: false,
    monthlyEnabled: true,
    annualEnabled: true,
    stripeEnabled: true,
    paypalEnabled: true,
    stripePriceMonthly: STRIPE_MONTH,
    stripePriceAnnual: STRIPE_YEAR,
    stripePriceEnv: null,
    paypalPlanMonthly: PAYPAL_MONTH,
    paypalPlanAnnual: PAYPAL_YEAR,
    paypalPlanIdEnv: null,
    ...overrides,
  } as Plan;
}

describe("plan gateway mapping validation", () => {
  it("rejects Stripe enabled with a missing monthly Price ID", () => {
    const result = normalizePlanGatewayWrite({
      name: "Starter",
      slug: "starter",
      isFree: false,
      monthlyEnabled: true,
      annualEnabled: false,
      stripeEnabled: true,
      paypalEnabled: false,
      stripePriceMonthly: null,
      stripePriceAnnual: null,
      paypalPlanMonthly: null,
      paypalPlanAnnual: null,
    });
    assert.match(
      result.errors.join(" "),
      /Stripe is enabled for Starter, but the Monthly Stripe Price ID is missing/,
    );
  });

  it("rejects Stripe enabled with a missing annual Price ID", () => {
    const result = normalizePlanGatewayWrite({
      name: "Starter",
      slug: "starter",
      isFree: false,
      monthlyEnabled: false,
      annualEnabled: true,
      stripeEnabled: true,
      paypalEnabled: false,
      stripePriceMonthly: null,
      stripePriceAnnual: " ",
      paypalPlanMonthly: null,
      paypalPlanAnnual: null,
    });
    assert.match(
      result.errors.join(" "),
      /Stripe is enabled for Starter, but the Annual Stripe Price ID is missing/,
    );
  });

  it("accepts real Stripe Price IDs and rejects non-price identifiers", () => {
    const result = normalizePlanGatewayWrite({
      name: "Starter",
      slug: "starter",
      isFree: false,
      monthlyEnabled: true,
      annualEnabled: true,
      stripeEnabled: true,
      paypalEnabled: false,
      stripePriceMonthly: STRIPE_MONTH,
      stripePriceAnnual: STRIPE_YEAR,
      paypalPlanMonthly: null,
      paypalPlanAnnual: null,
    });
    assert.deepEqual(result.errors, []);
    assert.equal(isUsableStripePriceId("prod_123456789"), false);
    assert.equal(isUsableStripePriceId("sub_123456789"), false);
    assert.equal(isUsableStripePriceId("cus_123456789"), false);
    assert.equal(isUsableStripePriceId("price_test"), false);
    assert.equal(isUsableStripePriceId(STRIPE_MONTH), true);
  });

  it("rejects PayPal enabled with a missing monthly Plan ID", () => {
    const result = normalizePlanGatewayWrite({
      name: "Starter",
      slug: "starter",
      isFree: false,
      monthlyEnabled: true,
      annualEnabled: false,
      stripeEnabled: false,
      paypalEnabled: true,
      stripePriceMonthly: null,
      stripePriceAnnual: null,
      paypalPlanMonthly: null,
      paypalPlanAnnual: null,
    });
    assert.match(
      result.errors.join(" "),
      /PayPal is enabled for Starter, but the Monthly PayPal Plan ID is missing/,
    );
  });

  it("allows a missing PayPal annual Plan ID because annual is optional", () => {
    const result = normalizePlanGatewayWrite({
      name: "Starter",
      slug: "starter",
      isFree: false,
      monthlyEnabled: true,
      annualEnabled: true,
      stripeEnabled: false,
      paypalEnabled: true,
      stripePriceMonthly: null,
      stripePriceAnnual: null,
      paypalPlanMonthly: PAYPAL_MONTH,
      paypalPlanAnnual: null,
    });
    assert.deepEqual(result.errors, []);
  });

  it("accepts PayPal billing Plan IDs and rejects arbitrary strings", () => {
    const result = normalizePlanGatewayWrite({
      name: "Starter",
      slug: "starter",
      isFree: false,
      monthlyEnabled: true,
      annualEnabled: true,
      stripeEnabled: false,
      paypalEnabled: true,
      stripePriceMonthly: null,
      stripePriceAnnual: null,
      paypalPlanMonthly: PAYPAL_MONTH,
      paypalPlanAnnual: PAYPAL_YEAR,
    });
    assert.deepEqual(result.errors, []);
    assert.equal(isUsablePaypalBillingPlanId("P-TEST"), false);
    assert.equal(isUsablePaypalBillingPlanId("P-STARTER-M"), false);
    assert.equal(isUsablePaypalBillingPlanId("not-a-plan"), false);
    assert.equal(isUsablePaypalBillingPlanId(PAYPAL_MONTH), true);
  });

  it("does not require payment mappings for Free Workspace", () => {
    const result = normalizePlanGatewayWrite({
      name: "Free Workspace",
      slug: "free",
      isFree: true,
      monthlyEnabled: true,
      annualEnabled: true,
      stripeEnabled: true,
      paypalEnabled: true,
      stripePriceMonthly: null,
      stripePriceAnnual: null,
      paypalPlanMonthly: null,
      paypalPlanAnnual: null,
    });
    assert.deepEqual(result.errors, []);
    assert.equal(result.stripeEnabled, false);
    assert.equal(result.paypalEnabled, false);
  });

  it("does not require payment mappings for Trial", () => {
    const result = normalizePlanGatewayWrite({
      name: "Trial",
      slug: "trial",
      isFree: false,
      monthlyEnabled: true,
      annualEnabled: true,
      stripeEnabled: true,
      paypalEnabled: true,
      stripePriceMonthly: null,
      stripePriceAnnual: null,
      paypalPlanMonthly: null,
      paypalPlanAnnual: null,
    });
    assert.deepEqual(result.errors, []);
    assert.equal(result.stripeEnabled, false);
    assert.equal(result.paypalEnabled, false);
  });

  it("does not require an annual mapping when annual billing is off", () => {
    const result = normalizePlanGatewayWrite({
      name: "Starter",
      slug: "starter",
      isFree: false,
      monthlyEnabled: true,
      annualEnabled: false,
      stripeEnabled: true,
      paypalEnabled: true,
      stripePriceMonthly: STRIPE_MONTH,
      stripePriceAnnual: null,
      paypalPlanMonthly: PAYPAL_MONTH,
      paypalPlanAnnual: null,
    });
    assert.deepEqual(result.errors, []);
  });
});

describe("checkout catalog gateway availability", () => {
  const globalOn = { stripeEnabled: true, paypalEnabled: true };

  it("does not advertise a gateway for an interval whose mapping is missing", () => {
    const plan = paid({
      paypalPlanAnnual: null,
      stripePriceAnnual: null,
    });
    assert.deepEqual(configuredGatewaysForInterval(plan, "MONTH", globalOn), [
      "stripe",
      "paypal",
    ]);
    assert.deepEqual(configuredGatewaysForInterval(plan, "YEAR", globalOn), []);
  });

  it("does not advertise PayPal or Stripe for Free Workspace or Trial", () => {
    assert.deepEqual(
      configuredGatewaysForInterval(paid({ slug: "free", isFree: true }), "MONTH", globalOn),
      [],
    );
    assert.deepEqual(
      configuredGatewaysForInterval(paid({ slug: "trial", isFree: false }), "YEAR", globalOn),
      [],
    );
  });

  it("fails a direct checkout mapping check when the interval mapping is missing", () => {
    const plan = paid({ paypalPlanAnnual: null, paypalEnabled: true });
    assert.throws(
      () => assertIntervalGatewayMapping(plan, "paypal", "YEAR"),
      (error: unknown) => (error as { code?: string }).code === "PAYPAL_PLAN_NOT_CONFIGURED",
    );
    assert.doesNotThrow(() => assertIntervalGatewayMapping(plan, "paypal", "MONTH"));
  });

  it("fails Stripe checkout in production when the Price ID is missing", () => {
    assert.throws(
      () =>
        assertIntervalGatewayMapping(
          paid({ stripePriceMonthly: null }),
          "stripe",
          "MONTH",
          "production",
        ),
      (error: unknown) => (error as { code?: string }).code === "STRIPE_PRICE_NOT_CONFIGURED",
    );
    assert.doesNotThrow(() =>
      assertIntervalGatewayMapping(paid({ stripePriceMonthly: null }), "stripe", "MONTH", "test"),
    );
  });
});

describe("PayPal environment plan lookup", () => {
  it("accepts an active plan from the requested environment and rejects a missing one", async () => {
    const found = await readPaypalBillingPlan({
      planId: PAYPAL_MONTH,
      accessToken: "token",
      baseUrl: "https://api-m.paypal.com",
      environment: "live",
      fetchImpl: async (url) => {
        assert.match(String(url), /api-m\.paypal\.com\/v1\/billing\/plans\//);
        return new Response(JSON.stringify({ id: PAYPAL_MONTH, status: "ACTIVE" }), { status: 200 });
      },
    });
    assert.equal(found.environment, "live");
    assert.equal(found.status, "ACTIVE");

    await assert.rejects(
      () =>
        readPaypalBillingPlan({
          planId: PAYPAL_MONTH,
          accessToken: "token",
          baseUrl: "https://api-m.sandbox.paypal.com",
          environment: "sandbox",
          fetchImpl: async () => new Response("", { status: 404 }),
        }),
      (error: unknown) =>
        error instanceof AppError &&
        /not found in the current sandbox environment/.test(error.message),
    );
  });
});

describe("plan gateway admin authorization", () => {
  it("keeps gateway writes behind Super Admin and off company actions", () => {
    const actions = readSrc("src/app/actions/super-admin.ts");
    const companyActions = readSrc("src/app/actions.ts");
    const service = readSrc("src/application/admin/plan-gateway-service.ts");
    assert.match(actions, /export async function saUpdatePlanGateways/);
    assert.match(actions, /requireWritableSuperAdmin/);
    assert.match(service, /lookupPaypalBillingPlan/);
    assert.match(service, /normalizePlanGatewayWrite/);
    assert.doesNotMatch(companyActions, /saUpdatePlanGateways|updatePlanGatewaysForAdmin/);
  });

  it("keeps Sponsored Matching off subscription Plan IDs", () => {
    const sponsorship = readSrc("src/modules/matching-engine/internal/sponsorship-checkout.ts");
    assert.doesNotMatch(sponsorship, /paypalPlanMonthly|paypalPlanAnnual|stripePriceMonthly/);
  });

  it("checkout refuses an unadvertised interval instead of swapping gateways", () => {
    const billing = readSrc("src/services/billing/index.ts");
    const paypal = readSrc("src/services/billing/paypal.ts");
    assert.match(billing, /gatewaysByInterval/);
    assert.match(billing, /not available for the selected billing interval/);
    assert.match(paypal, /isUsablePaypalBillingPlanId/);
  });
});
