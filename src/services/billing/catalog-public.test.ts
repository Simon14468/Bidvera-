import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  publicEnabledFeatureKeys,
  publicStripeTrialDays,
  sanitizeFreeMarketingLabels,
} from "@/services/billing/catalog";
import { planDefaultFeatureKeys } from "@/domain/billing/entitlement-catalog";
import { DEFAULT_BILLING_GATEWAY_SETTINGS } from "@/services/billing/settings";
import { PRICING_FEATURE_GROUPS } from "@/components/marketing/pricing-feature-groups";
import { getDictionary } from "@/i18n/dictionaries";
import { locales } from "@/i18n/config";

const settingsOn = {
  ...DEFAULT_BILLING_GATEWAY_SETTINGS,
  defaultGateway: "stripe" as const,
  stripeEnabled: true,
  trialEnabled: true,
  trialDays: 14,
  requirePaymentMethodForTrial: true,
};

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("publicEnabledFeatureKeys uses commercially available keys only", () => {
  const keys = publicEnabledFeatureKeys({
    slug: "pro",
    planFeatures: [
      { enabled: true, feature: { key: "company_profile" } },
      { enabled: true, feature: { key: "matching_engine" } },
      { enabled: true, feature: { key: "tender_discovery" } },
      { enabled: true, feature: { key: "decision_simulator" } },
      { enabled: false, feature: { key: "pdf_export" } },
    ],
  } as Parameters<typeof publicEnabledFeatureKeys>[0]);

  assert.ok(keys.includes("company_profile"));
  assert.ok(keys.includes("decision_simulator"));
  assert.equal(keys.includes("matching_engine"), false);
  assert.equal(keys.includes("tender_discovery"), false);
  assert.equal(keys.includes("pdf_export"), false);
});

test("publicEnabledFeatureKeys falls back to slug defaults without PlanFeature rows", () => {
  const keys = publicEnabledFeatureKeys({ slug: "free" } as Parameters<
    typeof publicEnabledFeatureKeys
  >[0]);
  assert.deepEqual(keys, planDefaultFeatureKeys("free"));
  assert.deepEqual(keys, ["company_profile", "document_compliance"]);
  assert.equal(keys.includes("matching_engine"), false);
});

test("publicStripeTrialDays is 14 for eligible Stripe paid plans", () => {
  assert.equal(
    publicStripeTrialDays(
      {
        isFree: false,
        slug: "pro",
        trialEligible: true,
        trialDays: 14,
        gateways: ["stripe"],
      },
      settingsOn,
    ),
    14,
  );
});

test("publicStripeTrialDays is null when trial must not be advertised", () => {
  const paid = {
    isFree: false,
    slug: "starter",
    trialEligible: true,
    trialDays: 14,
    gateways: ["stripe"] as Array<"stripe" | "paypal">,
  };
  assert.equal(
    publicStripeTrialDays({ ...paid, isFree: true, slug: "free" }, settingsOn),
    null,
  );
  assert.equal(publicStripeTrialDays({ ...paid, slug: "trial" }, settingsOn), null);
  assert.equal(
    publicStripeTrialDays({ ...paid, gateways: ["paypal"] }, settingsOn),
    null,
  );
  assert.equal(
    publicStripeTrialDays(paid, { ...settingsOn, requirePaymentMethodForTrial: false }),
    null,
  );
  assert.equal(
    publicStripeTrialDays(paid, { ...settingsOn, trialEnabled: false }),
    null,
  );
  assert.equal(
    publicStripeTrialDays(paid, { ...settingsOn, defaultGateway: "paypal" }),
    null,
  );
});

test("sanitizeFreeMarketingLabels strips unlimited-analyses copy for Free Workspace", () => {
  const cleaned = sanitizeFreeMarketingLabels(
    { isFree: true, slug: "free" },
    ["Unlimited analyses / month", "Company Profile", "1 seat"],
  );
  assert.deepEqual(cleaned, ["Company Profile", "1 seat"]);
  assert.deepEqual(
    sanitizeFreeMarketingLabels(
      { isFree: false, slug: "pro" },
      ["Unlimited analyses / month"],
    ),
    ["Unlimited analyses / month"],
  );
});

test("pricing comparison groups never advertise Matching Engine, discovery, or Tender Analysis", () => {
  const keys: string[] = PRICING_FEATURE_GROUPS.flatMap((group) => group.keys);
  assert.equal(keys.includes("matching_engine"), false);
  assert.equal(keys.includes("tender_discovery"), false);
  assert.equal(keys.includes("tender_analysis"), false);
  assert.ok(keys.includes("company_profile"));
  assert.ok(keys.includes("document_compliance"));
  assert.ok(keys.includes("advanced_decision_engine"));
});

test("pricing UI copy does not use BID/REVIEW/NO-BID or fake trial language", () => {
  const files = [
    "src/app/(marketing)/(site)/pricing/page.tsx",
    "src/components/marketing/pricing-grid.tsx",
    "src/components/onboarding/plan-picker.tsx",
  ];
  const banned =
    /BID \/ REVIEW|NO-BID|Analyze your tender|AI PDF analyzer|Free forever trial|0 MAD transaction|Guaranteed no payment|matching_engine|Matching Engine/i;
  for (const file of files) {
    assert.doesNotMatch(readSrc(file), banned, file);
  }
});

test("all locales include pricing feature labels and trial copy", () => {
  for (const locale of locales) {
    const pricing = getDictionary(locale).pricing;
    assert.ok(pricing.startFreeWorkspace);
    assert.ok(pricing.noChargeToday);
    assert.ok(pricing.paymentMethodRequired);
    assert.ok(pricing.cancelBeforeTrial);
    assert.ok(pricing.features.company_profile);
    assert.ok(pricing.features.tender_analysis);
    assert.equal("matching_engine" in pricing.features, false);
    const onboarding = getDictionary(locale).app.onboarding;
    assert.ok(onboarding.freeCta);
    assert.doesNotMatch(onboarding.trialBody, /no card required/i);
  }
});
