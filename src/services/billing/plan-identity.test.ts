import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { PLAN_ENTITLEMENT_DEFAULTS } from "@/domain/billing/entitlement-catalog";
import { resolvePlanBadgeIdentity } from "@/services/billing/plan-identity";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
const past = new Date(Date.now() - 7 * 86_400_000).toISOString();
const fullFeatures = PLAN_ENTITLEMENT_DEFAULTS.pro!;
const partialFeatures = PLAN_ENTITLEMENT_DEFAULTS.starter!;

test("FREE workspace renders FREE badge", () => {
  const badge = resolvePlanBadgeIdentity({
    status: "ACTIVE",
    slug: "free",
    isFree: true,
    plan: "FREE",
    planName: "Free Workspace",
  });
  assert.equal(badge.label, "FREE");
  assert.equal(badge.tone, "free");
  assert.equal(badge.hasPaidAccess, false);
  assert.equal(badge.showInChrome, false);
});

test("TRIAL first-signup renders TRIAL badge", () => {
  const badge = resolvePlanBadgeIdentity({
    status: "TRIALING",
    slug: "free",
    isFree: true,
    plan: "TRIAL",
    planName: "Free Workspace",
    currentPeriodEnd: future,
  });
  assert.equal(badge.label, "TRIAL");
  assert.equal(badge.tone, "trial");
  assert.equal(badge.hasPaidAccess, false);
  assert.equal(badge.showInChrome, false);
});

test("ACTIVE PRO with full features shows chrome badge", () => {
  const badge = resolvePlanBadgeIdentity({
    status: "ACTIVE",
    slug: "pro",
    isFree: false,
    plan: "PRO",
    planName: "Pro",
    currentPeriodEnd: future,
    features: fullFeatures,
  });
  assert.equal(badge.label, "PRO");
  assert.equal(badge.tone, "premium");
  assert.equal(badge.hasPaidAccess, true);
  assert.equal(badge.showInChrome, true);
});

test("ACTIVE Starter with partial features hides chrome badge", () => {
  const badge = resolvePlanBadgeIdentity({
    status: "ACTIVE",
    slug: "starter",
    isFree: false,
    plan: "STARTER",
    planName: "Starter",
    features: partialFeatures,
  });
  assert.equal(badge.label, "STARTER");
  assert.equal(badge.tone, "limited");
  assert.equal(badge.hasPaidAccess, true);
  assert.equal(badge.showInChrome, false);
});

test("stale Subscription.plan PRO does not override active lite slug", () => {
  const badge = resolvePlanBadgeIdentity({
    status: "ACTIVE",
    slug: "lite",
    isFree: false,
    plan: "PRO",
    planName: "LITE",
    features: partialFeatures,
  });
  assert.equal(badge.label, "LITE");
  assert.equal(badge.tone, "limited");
  assert.equal(badge.planName, "LITE");
  assert.equal(badge.showInChrome, false);
  assert.notEqual(badge.label, "PRO");
});

test("partial plan never shows chrome even if slug is pro", () => {
  const badge = resolvePlanBadgeIdentity({
    status: "ACTIVE",
    slug: "pro",
    isFree: false,
    plan: "PRO",
    planName: "Pro",
    features: ["company_profile", "document_compliance"],
  });
  assert.equal(badge.label, "PRO");
  assert.equal(badge.tone, "limited");
  assert.equal(badge.showInChrome, false);
});

test("full feature coverage shows chrome for any paid slug", () => {
  const badge = resolvePlanBadgeIdentity({
    status: "ACTIVE",
    slug: "business",
    isFree: false,
    plan: "BUSINESS",
    planName: "Business",
    features: fullFeatures,
  });
  assert.equal(badge.label, "BUSINESS");
  assert.equal(badge.tone, "premium");
  assert.equal(badge.showInChrome, true);
});

test("CANCELED at period end still shows PRO while entitlement active", () => {
  const badge = resolvePlanBadgeIdentity({
    status: "ACTIVE",
    slug: "pro",
    isFree: false,
    plan: "PRO",
    planName: "Pro",
    cancelAtPeriodEnd: true,
    currentPeriodEnd: future,
    features: fullFeatures,
  });
  assert.equal(badge.label, "PRO");
  assert.equal(badge.hasPaidAccess, true);
  assert.equal(badge.showInChrome, true);
});

test("Expired subscription no longer displays PRO", () => {
  const badge = resolvePlanBadgeIdentity({
    status: "EXPIRED",
    effectiveStatus: "EXPIRED",
    reason: "trial_expired",
    slug: "free",
    isFree: true,
    plan: "FREE",
    currentPeriodEnd: past,
    features: fullFeatures,
  });
  assert.equal(badge.label, "FREE");
  assert.equal(badge.hasPaidAccess, false);
  assert.equal(badge.showInChrome, false);
  assert.notEqual(badge.label, "PRO");
});

test("Plan badge helpers ignore URL / client state (source inspection)", () => {
  const identity = readSrc("src/services/billing/plan-identity.ts");
  assert.doesNotMatch(identity, /window\.|document\.cookie/);
  assert.doesNotMatch(identity, /searchParams\.get|localStorage\.getItem|sessionStorage\.getItem/);
  assert.doesNotMatch(identity, /\?stripe=|\?paypal=|session_id/);
  assert.match(identity, /hasFullCommercialFeatureCoverage/);

  const badgeUi = readSrc("src/components/billing/plan-badge.tsx");
  assert.doesNotMatch(badgeUi, /localStorage\.|searchParams/);

  const topbar = readSrc("src/components/app/app-topbar.tsx");
  assert.match(topbar, /planBadge/);
  assert.match(topbar, /showInChrome/);
  assert.doesNotMatch(topbar, /params\.stripe|params\.paypal|searchParams/);
  assert.doesNotMatch(topbar, /getEffectiveEntitlements|companyHasUpgradePath/);

  const chrome = readSrc("src/application/app-chrome.ts");
  assert.match(chrome, /resolvePlanBadgeIdentity/);
  assert.match(chrome, /getEffectiveEntitlements/);
  assert.match(chrome, /features: entitlements\.features/);
  assert.match(chrome, /companyHasUpgradePath/);

  const settings = readSrc("src/app/(app)/settings/page.tsx");
  assert.match(settings, /loadSettingsBillingSummary/);
  assert.match(settings, /BillingSubscriptionSection/);
  assert.doesNotMatch(settings, /searchParams/);
});

test("Settings feature list comes from entitlement catalog", () => {
  const summary = readSrc("src/application/settings-billing-summary.ts");
  assert.match(summary, /ENTITLEMENT_CATALOG/);
  assert.match(summary, /getEffectiveEntitlements/);
  assert.match(summary, /isCommerciallyAvailableFeature/);
  assert.match(summary, /features: entitlements\.features/);
  assert.doesNotMatch(summary, /hardcodedFeatures|FAKE_FEATURES/);
});

test("STARTER slug maps to STARTER badge label", () => {
  const badge = resolvePlanBadgeIdentity({
    status: "ACTIVE",
    slug: "starter",
    isFree: false,
    plan: "STARTER",
    planName: "Starter",
    features: partialFeatures,
  });
  assert.equal(badge.label, "STARTER");
  assert.equal(badge.tone, "limited");
  assert.equal(badge.hasPaidAccess, true);
  assert.equal(badge.showInChrome, false);
});
