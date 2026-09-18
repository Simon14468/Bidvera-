import assert from "node:assert/strict";
import { test } from "node:test";
import { hasUpgradePathFromLimits } from "./upgrade-eligibility";

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
