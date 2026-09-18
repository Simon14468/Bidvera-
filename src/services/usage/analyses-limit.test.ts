import assert from "node:assert/strict";
import { test } from "node:test";
import { isAnalysesBlocked, isUnlimitedAnalyses } from "@/config/usage";
import { isAnalysisCreditsExhausted } from "@/services/usage";
import { buildEntitlementMarketingLabels } from "@/domain/billing/entitlement-catalog";
import { PLAN_ENTITLEMENT_DEFAULTS } from "@/domain/billing/entitlement-catalog";

test("H. analysesLimit 0 is blocked", () => {
  assert.equal(isUnlimitedAnalyses(0), false);
  assert.equal(isAnalysesBlocked(0), true);
  assert.equal(isAnalysisCreditsExhausted(0, 0), true);
  assert.equal(isAnalysisCreditsExhausted(1, 0), true);
});

test("I. analysesLimit null is unlimited", () => {
  assert.equal(isUnlimitedAnalyses(null), true);
  assert.equal(isUnlimitedAnalyses(undefined), true);
  assert.equal(isAnalysesBlocked(null), false);
  assert.equal(isAnalysisCreditsExhausted(0, null), false);
  assert.equal(isAnalysisCreditsExhausted(10_000, null), false);
});

test("J. positive analysesLimit is enforced", () => {
  assert.equal(isUnlimitedAnalyses(3), false);
  assert.equal(isAnalysesBlocked(20), false);
  assert.equal(isAnalysisCreditsExhausted(0, 3), false);
  assert.equal(isAnalysisCreditsExhausted(2, 3), false);
  assert.equal(isAnalysisCreditsExhausted(3, 3), true);
  assert.equal(isAnalysisCreditsExhausted(4, 20), false);
});

test("Free Workspace cannot receive unlimited analyses from a 0 limit", () => {
  const freeLimit = 0;
  assert.equal(isUnlimitedAnalyses(freeLimit), false);
  assert.equal(isAnalysisCreditsExhausted(0, freeLimit), true);
  const { labels } = buildEntitlementMarketingLabels({
    analysesLimit: freeLimit,
    seatsLimit: 1,
    enabledKeys: PLAN_ENTITLEMENT_DEFAULTS.free ?? ["company_profile", "document_compliance"],
  });
  assert.equal(labels.some((line) => /unlimited analyses/i.test(line)), false);
  assert.ok(PLAN_ENTITLEMENT_DEFAULTS.free?.includes("company_profile"));
  assert.ok(PLAN_ENTITLEMENT_DEFAULTS.free?.includes("document_compliance"));
  assert.equal(PLAN_ENTITLEMENT_DEFAULTS.free?.includes("tender_analysis"), false);
});
