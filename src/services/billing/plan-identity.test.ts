import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { resolvePlanBadgeIdentity } from "@/services/billing/plan-identity";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
const past = new Date(Date.now() - 7 * 86_400_000).toISOString();

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
});

test("ACTIVE PRO renders PRO badge", () => {
  const badge = resolvePlanBadgeIdentity({
    status: "ACTIVE",
    slug: "pro",
    isFree: false,
    plan: "PRO",
    planName: "Pro",
    currentPeriodEnd: future,
  });
  assert.equal(badge.label, "PRO");
  assert.equal(badge.tone, "premium");
  assert.equal(badge.hasPaidAccess, true);
  assert.equal(badge.showInChrome, true);
});

test("ACTIVE Starter does not show chrome PRO badge", () => {
  const badge = resolvePlanBadgeIdentity({
    status: "ACTIVE",
    slug: "starter",
    isFree: false,
    plan: "STARTER",
    planName: "Starter",
  });
  assert.equal(badge.label, "STARTER");
  assert.equal(badge.hasPaidAccess, true);
  assert.equal(badge.showInChrome, false);
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
  });
  assert.equal(badge.label, "FREE");
  assert.equal(badge.hasPaidAccess, false);
  assert.notEqual(badge.label, "PRO");
});

test("Plan badge helpers ignore URL / client state (source inspection)", () => {
  const identity = readSrc("src/services/billing/plan-identity.ts");
  assert.doesNotMatch(identity, /window\.|document\.cookie/);
  assert.doesNotMatch(identity, /searchParams\.get|localStorage\.getItem|sessionStorage\.getItem/);
  assert.doesNotMatch(identity, /\?stripe=|\?paypal=|session_id/);

  const badgeUi = readSrc("src/components/billing/plan-badge.tsx");
  assert.doesNotMatch(badgeUi, /localStorage\.|searchParams/);

  const topbar = readSrc("src/components/app/app-topbar.tsx");
  assert.match(topbar, /resolvePlanBadgeIdentity/);
  assert.match(topbar, /getEffectiveEntitlements/);
  assert.match(topbar, /showInChrome/);
  assert.doesNotMatch(topbar, /params\.stripe|params\.paypal|searchParams/);

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
  assert.doesNotMatch(summary, /hardcodedFeatures|FAKE_FEATURES/);
});

test("STARTER slug maps to STARTER badge label", () => {
  const badge = resolvePlanBadgeIdentity({
    status: "ACTIVE",
    slug: "starter",
    isFree: false,
    plan: "STARTER",
    planName: "Starter",
  });
  assert.equal(badge.label, "STARTER");
  assert.equal(badge.hasPaidAccess, true);
});
