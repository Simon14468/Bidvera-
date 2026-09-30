import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasUpgradePathFromLimits,
  resolveTerminalCheckoutPlan,
} from "./upgrade-eligibility";

const starterPro = [
  { id: "1", slug: "starter", monthlyPriceCents: 1900 },
  { id: "2", slug: "pro", monthlyPriceCents: 4900 },
];

test("trial / starter can upgrade when Pro is top public plan", () => {
  assert.equal(
    hasUpgradePathFromLimits(
      { planSlug: "trial", monthlyPriceCents: 0 },
      starterPro,
    ),
    true,
  );
  assert.equal(
    hasUpgradePathFromLimits(
      { planSlug: "starter", monthlyPriceCents: 1900 },
      starterPro,
    ),
    true,
  );
});

test("Pro (highest public plan) hides Upgrade", () => {
  assert.equal(
    hasUpgradePathFromLimits(
      { planSlug: "pro", monthlyPriceCents: 4900 },
      starterPro,
    ),
    false,
  );
});

test("no public plans means no upgrade CTA", () => {
  assert.equal(
    hasUpgradePathFromLimits({ planSlug: "trial", monthlyPriceCents: 0 }, []),
    false,
  );
});

test("Recommended plan is terminal even if a pricier non-recommended exists", () => {
  const plans = [
    { id: "1", slug: "lite", monthlyPriceCents: 1300, highlighted: false },
    { id: "2", slug: "pro", monthlyPriceCents: 4900, highlighted: true },
    { id: "3", slug: "enterprise", monthlyPriceCents: 9900, highlighted: false },
  ];
  assert.equal(resolveTerminalCheckoutPlan(plans)?.slug, "pro");
  assert.equal(
    hasUpgradePathFromLimits(
      { planSlug: "pro", monthlyPriceCents: 4900 },
      plans,
    ),
    false,
  );
  assert.equal(
    hasUpgradePathFromLimits(
      { planSlug: "lite", monthlyPriceCents: 1300 },
      plans,
    ),
    true,
  );
});

test("without Recommended, highest price remains terminal", () => {
  const plans = [
    { id: "1", slug: "lite", monthlyPriceCents: 1300, highlighted: false },
    { id: "2", slug: "pro", monthlyPriceCents: 8900, highlighted: false },
  ];
  assert.equal(resolveTerminalCheckoutPlan(plans)?.slug, "pro");
  assert.equal(
    hasUpgradePathFromLimits(
      { planSlug: "pro", monthlyPriceCents: 8900 },
      plans,
    ),
    false,
  );
});
