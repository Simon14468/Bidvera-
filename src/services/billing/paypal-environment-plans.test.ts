import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { Plan } from "@prisma/client";
import {
  configuredGatewaysForInterval,
  isPublicCheckoutPlan,
} from "@/services/billing/catalog";
import {
  normalizePlanGatewayWrite,
  paypalIntervalStatus,
  paypalPlanIdForEnvironment,
} from "@/services/billing/plan-gateway-ids";
import { resolvePaypalEnvironmentFromSources } from "@/services/billing/provider-credentials";

const STRIPE_MONTH = "price_1N4ValidMonthly01";
const LIVE_MONTH = "P-5ML4271244454362WXNWU5NQ";
const LIVE_YEAR = "P-7PD94525LH9368714L5QSZLY";
const SANDBOX_MONTH = "P-8SD111111111111111111111";
const SANDBOX_YEAR = "P-9SD222222222222222222222";

function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    slug: "pro",
    name: "Pro",
    isFree: false,
    monthlyEnabled: true,
    annualEnabled: true,
    stripeEnabled: true,
    paypalEnabled: true,
    stripePriceMonthly: STRIPE_MONTH,
    stripePriceAnnual: "price_1N4ValidAnnual0001",
    stripePriceEnv: null,
    paypalPlanMonthly: LIVE_MONTH,
    paypalPlanAnnual: LIVE_YEAR,
    paypalSandboxPlanMonthly: SANDBOX_MONTH,
    paypalSandboxPlanAnnual: SANDBOX_YEAR,
    paypalPlanIdEnv: null,
    ...overrides,
  } as Plan;
}

const gatewaysOn = { stripeEnabled: true, paypalEnabled: true };

describe("PayPal Live and Sandbox plan IDs", () => {
  it("A. accepts a Live monthly Plan ID only in Live", () => {
    assert.equal(paypalPlanIdForEnvironment(plan(), "MONTH", "live"), LIVE_MONTH);
    assert.equal(
      paypalIntervalStatus({
        paypalEnabled: true,
        intervalEnabled: true,
        id: LIVE_MONTH,
        required: true,
      }),
      "Configured",
    );
  });

  it("B. accepts a Sandbox monthly Plan ID only in Sandbox", () => {
    assert.equal(
      paypalPlanIdForEnvironment(plan(), "MONTH", "sandbox"),
      SANDBOX_MONTH,
    );
  });

  it("C. does not treat a Live monthly Plan ID as a Sandbox ID", () => {
    const liveOnly = plan({
      paypalSandboxPlanMonthly: null,
      paypalSandboxPlanAnnual: null,
    });
    assert.equal(paypalPlanIdForEnvironment(liveOnly, "MONTH", "sandbox"), null);
    assert.equal(
      paypalIntervalStatus({
        paypalEnabled: true,
        intervalEnabled: true,
        id: paypalPlanIdForEnvironment(liveOnly, "MONTH", "sandbox"),
        required: true,
      }),
      "Missing",
    );
    const result = normalizePlanGatewayWrite(
      {
        name: "Pro",
        slug: "pro",
        isFree: false,
        monthlyEnabled: true,
        annualEnabled: true,
        stripeEnabled: false,
        paypalEnabled: true,
        stripePriceMonthly: null,
        stripePriceAnnual: null,
        paypalPlanMonthly: LIVE_MONTH,
        paypalPlanAnnual: null,
        paypalSandboxPlanMonthly: null,
        paypalSandboxPlanAnnual: null,
      },
      { paypalEnvironment: "sandbox" },
    );
    assert.match(result.errors.join(" "), /Sandbox Monthly PayPal Plan ID is missing/);
    assert.equal(result.paypalPlanMonthly, LIVE_MONTH);
    assert.equal(result.paypalSandboxPlanMonthly, null);
  });

  it("D. does not treat a Sandbox monthly Plan ID as a Live ID", () => {
    const sandboxOnly = plan({
      paypalPlanMonthly: null,
      paypalPlanAnnual: null,
    });
    assert.equal(paypalPlanIdForEnvironment(sandboxOnly, "MONTH", "live"), null);
    const result = normalizePlanGatewayWrite(
      {
        name: "Pro",
        slug: "pro",
        isFree: false,
        monthlyEnabled: true,
        annualEnabled: true,
        stripeEnabled: false,
        paypalEnabled: true,
        stripePriceMonthly: null,
        stripePriceAnnual: null,
        paypalPlanMonthly: null,
        paypalPlanAnnual: null,
        paypalSandboxPlanMonthly: SANDBOX_MONTH,
        paypalSandboxPlanAnnual: null,
      },
      { paypalEnvironment: "live" },
    );
    assert.match(result.errors.join(" "), /Monthly PayPal Plan ID is missing/);
    assert.equal(result.paypalSandboxPlanMonthly, SANDBOX_MONTH);
  });

  it("E. allows a missing PayPal annual Plan ID", () => {
    const result = normalizePlanGatewayWrite({
      name: "Pro",
      slug: "pro",
      isFree: false,
      monthlyEnabled: true,
      annualEnabled: true,
      stripeEnabled: true,
      paypalEnabled: true,
      stripePriceMonthly: STRIPE_MONTH,
      stripePriceAnnual: "price_1N4ValidAnnual0001",
      paypalPlanMonthly: LIVE_MONTH,
      paypalPlanAnnual: null,
      paypalSandboxPlanMonthly: SANDBOX_MONTH,
      paypalSandboxPlanAnnual: null,
    });
    assert.deepEqual(result.errors, []);
    assert.equal(
      paypalIntervalStatus({
        paypalEnabled: true,
        intervalEnabled: true,
        id: null,
        required: false,
      }),
      "Optional",
    );
  });

  it("F. keeps PayPal monthly unavailable when the Sandbox monthly ID is missing", () => {
    const liveOnly = plan({ paypalSandboxPlanMonthly: null });
    assert.deepEqual(
      configuredGatewaysForInterval(liveOnly, "MONTH", gatewaysOn, "sandbox"),
      ["stripe"],
    );
  });

  it("G. leaves Stripe available when PayPal is invalid for the active environment", () => {
    const liveOnly = plan({
      paypalSandboxPlanMonthly: null,
      paypalEnabled: true,
      stripeEnabled: true,
    });
    assert.deepEqual(
      configuredGatewaysForInterval(liveOnly, "MONTH", gatewaysOn, "sandbox"),
      ["stripe"],
    );
    assert.deepEqual(
      configuredGatewaysForInterval(
        plan({ stripeEnabled: true, paypalEnabled: false }),
        "MONTH",
        gatewaysOn,
        "sandbox",
      ),
      ["stripe"],
    );
  });

  it("H/I. switches the PayPal Plan ID with the vault environment", () => {
    const row = plan();
    const live = resolvePaypalEnvironmentFromSources({
      vaultEnvironment: "live",
      environmentEnv: "sandbox",
    });
    const sandbox = resolvePaypalEnvironmentFromSources({
      vaultEnvironment: "sandbox",
      environmentEnv: "live",
    });
    assert.equal(live, "live");
    assert.equal(sandbox, "sandbox");
    assert.equal(paypalPlanIdForEnvironment(row, "MONTH", live), LIVE_MONTH);
    assert.equal(paypalPlanIdForEnvironment(row, "MONTH", sandbox), SANDBOX_MONTH);
    const back = resolvePaypalEnvironmentFromSources({ vaultEnvironment: "live" });
    assert.equal(paypalPlanIdForEnvironment(row, "MONTH", back), LIVE_MONTH);
  });

  it("J. keeps a plan on upgrade when Stripe is valid and PayPal is not", () => {
    const gateways = configuredGatewaysForInterval(
      plan({ paypalSandboxPlanMonthly: null, paypalSandboxPlanAnnual: null }),
      "MONTH",
      gatewaysOn,
      "sandbox",
    );
    assert.equal(
      isPublicCheckoutPlan({
        isFree: false,
        monthlyEnabled: true,
        annualEnabled: true,
        gateways,
      }),
      true,
    );
  });

  it("K. hides upgrade checkout when no gateway is valid", () => {
    const gateways = configuredGatewaysForInterval(
      plan({
        stripeEnabled: false,
        stripePriceMonthly: null,
        paypalSandboxPlanMonthly: null,
        paypalSandboxPlanAnnual: null,
      }),
      "MONTH",
      { stripeEnabled: true, paypalEnabled: true },
      "sandbox",
    );
    assert.deepEqual(gateways, []);
    assert.equal(
      isPublicCheckoutPlan({
        isFree: false,
        monthlyEnabled: true,
        annualEnabled: false,
        gateways,
      }),
      false,
    );
  });

  it("does not copy live Plan IDs into sandbox columns", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20261002180000_paypal_environment_plan_ids/migration.sql",
      ),
      "utf8",
    );
    assert.match(sql, /ADD COLUMN "paypalSandboxPlanMonthly"/);
    assert.match(sql, /ADD COLUMN "paypalSandboxPlanAnnual"/);
    assert.doesNotMatch(sql, /UPDATE/i);
    const service = readFileSync(
      path.join(process.cwd(), "src/application/admin/plan-gateway-service.ts"),
      "utf8",
    );
    assert.doesNotMatch(
      service,
      /paypalSandboxPlanMonthly:\s*mapped\.paypalPlanMonthly/,
    );
  });
});
