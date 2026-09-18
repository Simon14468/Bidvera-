import assert from "node:assert/strict";
import test from "node:test";
import {
  billingGatewaySettingsSchema,
  DEFAULT_BILLING_GATEWAY_SETTINGS,
} from "./settings";
import { resolvePlanAmountCents } from "./catalog";
import type { Plan } from "@prisma/client";

test("billing gateway schema rejects invalid default gateway", () => {
  const parsed = billingGatewaySettingsSchema.safeParse({
    ...DEFAULT_BILLING_GATEWAY_SETTINGS,
    defaultGateway: "bitcoin",
  });
  assert.equal(parsed.success, false);
});

test("billing gateway schema accepts stripe/paypal defaults", () => {
  const parsed = billingGatewaySettingsSchema.parse(DEFAULT_BILLING_GATEWAY_SETTINGS);
  assert.equal(parsed.paypalEnabled, true);
  assert.equal(parsed.defaultGateway, "paypal");
  assert.equal(parsed.graceDays, 3);
  assert.equal(parsed.trialDays, 14);
  assert.equal(parsed.freeWorkspaceEnabled, true);
  assert.equal(parsed.requirePaymentMethodForTrial, true);
});

test("billing gateway schema accepts custom graceDays", () => {
  const parsed = billingGatewaySettingsSchema.parse({
    ...DEFAULT_BILLING_GATEWAY_SETTINGS,
    graceDays: 7,
  });
  assert.equal(parsed.graceDays, 7);
});

test("resolvePlanAmountCents uses DB amounts only", () => {
  const plan = {
    monthlyPriceCents: 4900,
    annualPriceCents: 49000,
  } as Plan;
  assert.equal(resolvePlanAmountCents(plan, "MONTH"), 4900);
  assert.equal(resolvePlanAmountCents(plan, "YEAR"), 49000);
  assert.throws(() =>
    resolvePlanAmountCents(
      { monthlyPriceCents: 0, annualPriceCents: null } as Plan,
      "MONTH",
    ),
  );
});

test("disabled gateway settings keep cancel flags off by default", () => {
  const parsed = billingGatewaySettingsSchema.parse({});
  assert.equal(parsed.cancelSubsOnPlanDisable, false);
  assert.equal(parsed.cancelSubsOnGatewayDisable, false);
});
