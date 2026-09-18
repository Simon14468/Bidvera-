import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildEntitlementMarketingLabels,
  canonicalFeatureKey,
} from "@/domain/billing/entitlement-catalog";
import {
  analysesLimitForPlan,
  seatsLimitForPlan,
} from "@/services/entitlements";

test("canonicalFeatureKey maps alerts → smart_alerts", () => {
  assert.equal(canonicalFeatureKey("alerts"), "smart_alerts");
  assert.equal(canonicalFeatureKey("pdf_export"), "pdf_export");
});

test("marketing labels derive from structured limits + keys", () => {
  const { labels, displayOnly } = buildEntitlementMarketingLabels({
    analysesLimit: 20,
    seatsLimit: 2,
    enabledKeys: ["pdf_export", "decision_memory", "smart_alerts"],
    displayOnlyExtras: ["Custom badge text", "Priority processing"],
  });
  assert.ok(labels.some((l) => l.includes("20 analyses")));
  assert.ok(labels.some((l) => l.includes("2 seats")));
  assert.ok(labels.includes("PDF decision reports"));
  assert.ok(labels.includes("Decision Memory"));
  assert.deepEqual(displayOnly, ["Custom badge text"]);
});

test("interval limits prefer yearly when set", () => {
  const plan = {
    analysesLimit: 20,
    analysesLimitYearly: 300,
    seatsLimit: 2,
    seatsLimitYearly: 5,
  };
  assert.equal(analysesLimitForPlan(plan, "MONTH"), 20);
  assert.equal(analysesLimitForPlan(plan, "YEAR"), 300);
  assert.equal(seatsLimitForPlan(plan, "MONTH"), 2);
  assert.equal(seatsLimitForPlan(plan, "YEAR"), 5);
  assert.equal(
    analysesLimitForPlan({ analysesLimit: 20, analysesLimitYearly: null }, "YEAR"),
    20,
  );
});
