import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePaidPlanCtaKind } from "./plan-cta";

test("current plan is Activated", () => {
  assert.equal(
    resolvePaidPlanCtaKind({
      plan: { id: "1", slug: "lite", monthlyPriceCents: 1300 },
      currentPlanId: "1",
      currentPlanSlug: "lite",
      currentMonthlyPriceCents: 1300,
      hasActivePaidPlan: true,
    }),
    "activated",
  );
});

test("higher plan shows Upgrade when a smaller plan is active", () => {
  assert.equal(
    resolvePaidPlanCtaKind({
      plan: { id: "2", slug: "pro", monthlyPriceCents: 8900 },
      currentPlanId: "1",
      currentPlanSlug: "lite",
      currentMonthlyPriceCents: 1300,
      hasActivePaidPlan: true,
    }),
    "upgrade",
  );
});

test("lower plan does not show Upgrade", () => {
  assert.equal(
    resolvePaidPlanCtaKind({
      plan: { id: "1", slug: "lite", monthlyPriceCents: 1300 },
      currentPlanId: "2",
      currentPlanSlug: "pro",
      currentMonthlyPriceCents: 8900,
      hasActivePaidPlan: true,
    }),
    "get_plan",
  );
});

test("no active paid plan keeps Get plan", () => {
  assert.equal(
    resolvePaidPlanCtaKind({
      plan: { id: "2", slug: "pro", monthlyPriceCents: 8900 },
      currentPlanSlug: "free",
      currentMonthlyPriceCents: 0,
      hasActivePaidPlan: false,
    }),
    "get_plan",
  );
});
