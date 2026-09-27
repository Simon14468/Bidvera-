import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { evaluateSubscriptionAccess } from "@/services/billing/lifecycle";
import {
  isStripeManagedCardTrial,
  resolveIsTrialExpired,
} from "@/services/billing/billing-display";
import {
  assertPendingCheckoutMatches,
  isMissingPendingCheckoutColumn,
  parsePendingCheckout,
  pendingCheckoutStorageError,
  shouldClearPendingForRef,
  shouldPreserveSubscriptionOnCheckout,
} from "@/services/billing/pending-checkout";
import { resolveStripeSubscriptionWebhookBinding } from "@/services/billing/verification";
import { resolveCommercialFeatureAccess } from "@/services/entitlements";
import { billingAbsoluteUrl, billingAppOrigin } from "@/services/billing/billing-app-url";
import { buildBillingWarningEmailHtml } from "@/services/billing/billing-warnings";
import { AppError } from "@/lib/errors";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const periodEnd = new Date("2026-10-10T12:00:00.000Z");
const now = new Date("2026-10-01T12:00:00.000Z");

const liveTrial = {
  status: "TRIALING" as const,
  plan: "TRIAL",
  billingInterval: "MONTH" as const,
  startedAt: now,
  currentPeriodStart: now,
  currentPeriodEnd: periodEnd,
  gracePeriodEndsAt: null,
  cancelAtPeriodEnd: false,
};

const livePaid = {
  ...liveTrial,
  status: "ACTIVE" as const,
  plan: "STARTER",
};

test("a) active trial access is preserved when checkout starts", () => {
  assert.equal(shouldPreserveSubscriptionOnCheckout(liveTrial), true);
  assert.equal(evaluateSubscriptionAccess(liveTrial, now).allowed, true);
  const stripe = readSrc("src/services/billing/stripe.ts");
  const create = stripe.slice(
    stripe.indexOf("export async function createStripeCheckoutSession"),
    stripe.indexOf("export async function activateStripeCheckoutSession"),
  );
  assert.match(create, /recordPendingCheckout/);
  assert.doesNotMatch(create, /status: "INCOMPLETE"/);
  assert.doesNotMatch(create, /subscription\.upsert/);
});

test("b) active paid access is preserved when checkout starts", () => {
  assert.equal(shouldPreserveSubscriptionOnCheckout(livePaid), true);
  assert.equal(evaluateSubscriptionAccess(livePaid, now).allowed, true);
  const paypal = readSrc("src/services/billing/paypal.ts");
  const create = paypal.slice(
    paypal.indexOf("export async function createPayPalCheckoutSession"),
    paypal.indexOf("export async function activatePayPalSubscription"),
  );
  assert.match(create, /recordPendingCheckout/);
  assert.doesNotMatch(create, /status: "INCOMPLETE"/);
  assert.doesNotMatch(create, /subscription\.upsert/);
});

test("c) abandoned checkout leaves current access unchanged", () => {
  assert.equal(
    evaluateSubscriptionAccess(liveTrial, now).reason,
    "trialing",
  );
  assert.equal(evaluateSubscriptionAccess(livePaid, now).reason, "active");
  const pending = parsePendingCheckout({
    provider: "stripe",
    planId: "plan_pro",
    interval: "MONTH",
    providerRef: "cs_test_abandoned",
    createdAt: now.toISOString(),
  });
  assert.equal(pending?.planId, "plan_pro");
  assert.equal(
    resolveStripeSubscriptionWebhookBinding({
      companyId: "co_1",
      planId: "plan_pro",
      providerSubscriptionId: "sub_new",
      knownByProviderId: null,
      localByCompany: {
        companyId: "co_1",
        provider: "manual",
        providerSubscriptionId: null,
        planId: "plan_free",
        status: "TRIALING",
      },
      pendingCheckout: { provider: "stripe", planId: "plan_pro" },
    }),
    "checkout",
  );
});

test("d) successful payment still activates through applyPaidPlanActivation", () => {
  const stripe = readSrc("src/services/billing/stripe.ts");
  const activate = stripe.slice(
    stripe.indexOf("export async function activateStripeCheckoutSession"),
    stripe.indexOf("export async function handleStripeWebhook"),
  );
  assert.match(activate, /applyPaidPlanActivation/);
  assert.match(activate, /clearPendingCheckout/);
  const paypal = readSrc("src/services/billing/paypal.ts");
  const activatePaypal = paypal.slice(
    paypal.indexOf("export async function activatePayPalSubscription"),
    paypal.indexOf("export async function handlePayPalWebhook"),
  );
  assert.match(activatePaypal, /applyPaidPlanActivation/);
  assert.match(activatePaypal, /clearPendingCheckout/);
});

test("unbound Stripe webhooks still require a checkout binding", () => {
  assert.throws(
    () =>
      resolveStripeSubscriptionWebhookBinding({
        companyId: "co_1",
        planId: "plan_starter",
        providerSubscriptionId: "sub_foreign",
        knownByProviderId: null,
        localByCompany: null,
      }),
    (error: unknown) =>
      error instanceof AppError && /No checkout session/.test(error.message),
  );
});

test("Stripe cancel_at_period_end is persisted and keeps access until period end", () => {
  const access = evaluateSubscriptionAccess(
    { ...livePaid, cancelAtPeriodEnd: true },
    now,
  );
  assert.equal(access.allowed, true);
  assert.equal(access.reason, "active");
  const afterEnd = evaluateSubscriptionAccess(
    { ...livePaid, cancelAtPeriodEnd: true },
    new Date(periodEnd.getTime() + 1000),
  );
  assert.equal(afterEnd.allowed, false);
  const state = readSrc("src/services/billing/subscription-state.ts");
  const apply = state.slice(
    state.indexOf("export async function applyPaidPlanActivation"),
    state.indexOf("export async function updateSubscriptionStatus"),
  );
  assert.match(apply, /cancelAtPeriodEnd,/);
  assert.doesNotMatch(apply, /cancelAtPeriodEnd: false,/);
  const stripe = readSrc("src/services/billing/stripe.ts");
  assert.match(stripe, /cancel_at_period_end/);
  assert.match(stripe, /cancelAtPeriodEnd: Boolean\(sub\.cancel_at_period_end\)/);
});

test("isTrialExpired is only true for first-signup Free Workspace trial", () => {
  assert.equal(
    resolveIsTrialExpired({ reason: "trial_expired", status: "TRIALING", plan: "TRIAL" }),
    true,
  );
  assert.equal(
    resolveIsTrialExpired({
      status: "EXPIRED",
      plan: "TRIAL",
      slug: "free",
      isFree: true,
    }),
    true,
  );
  assert.equal(
    resolveIsTrialExpired({
      status: "EXPIRED",
      plan: "STARTER",
      slug: "starter",
      isFree: false,
    }),
    false,
  );
  assert.equal(
    resolveIsTrialExpired({
      reason: "expired",
      status: "EXPIRED",
      plan: "PRO",
      slug: "pro",
    }),
    false,
  );
  assert.equal(
    resolveIsTrialExpired({
      reason: "trial_expired",
      status: "TRIALING",
      plan: "STARTER",
      slug: "starter",
      isFree: false,
      provider: "stripe",
    }),
    false,
  );
  assert.equal(
    resolveIsTrialExpired({
      reason: "expired",
      status: "EXPIRED",
      plan: "BUSINESS",
      slug: "business",
      isFree: false,
      provider: "stripe",
    }),
    false,
  );
  assert.equal(
    resolveIsTrialExpired({
      status: "EXPIRED",
      plan: "TRIAL",
    }),
    true,
  );
});

test("Free Workspace trial UI is not Stripe auto-convert copy", () => {
  assert.equal(
    isStripeManagedCardTrial({
      status: "TRIALING",
      provider: "manual",
      plan: "TRIAL",
      slug: "free",
      isFree: true,
    }),
    false,
  );
  assert.equal(
    isStripeManagedCardTrial({
      status: "TRIALING",
      provider: "stripe",
      plan: "STARTER",
      slug: "starter",
      isFree: false,
    }),
    true,
  );
  const page = readSrc("src/app/(app)/billing/page.tsx");
  assert.match(page, /isStripeManagedCardTrial/);
  assert.match(page, /firstSignupTrial/);
  assert.match(page, /stripeCardTrial \?/);
  assert.match(page, /usage\.isTrialExpired && !stripeCardTrial/);
  const stripeCopy = page.slice(
    page.indexOf("{stripeCardTrial ? ("),
    page.indexOf("{isFreeWorkspace ? ("),
  );
  assert.match(stripeCopy, /t\.noChargeToday/);
  assert.doesNotMatch(stripeCopy, /trialEndedTitle/);
  assert.doesNotMatch(stripeCopy, /freeWorkspaceTrialExpired/);
});

test("company feature override cannot keep commercial access after expiry", () => {
  assert.equal(
    resolveCommercialFeatureAccess({
      isolated: false,
      override: true,
      enabledGlobal: true,
      accessAllowed: false,
      entitled: true,
    }),
    false,
  );
  assert.equal(
    resolveCommercialFeatureAccess({
      isolated: false,
      override: true,
      enabledGlobal: true,
      accessAllowed: true,
      entitled: false,
    }),
    true,
  );
  assert.equal(
    resolveCommercialFeatureAccess({
      isolated: true,
      override: true,
      enabledGlobal: true,
      accessAllowed: true,
      entitled: false,
    }),
    false,
  );
});

test("billing email links are absolute production URLs", () => {
  assert.equal(billingAppOrigin({ NEXT_PUBLIC_APP_URL: "https://getbidvera.com/" }), "https://getbidvera.com");
  assert.equal(
    billingAbsoluteUrl("/billing", { NEXT_PUBLIC_APP_URL: "https://getbidvera.com" }),
    "https://getbidvera.com/billing",
  );
  const html = buildBillingWarningEmailHtml("Trial ended", {
    NEXT_PUBLIC_APP_URL: "https://getbidvera.com",
  });
  assert.match(html, /href="https:\/\/getbidvera\.com\/billing"/);
  assert.match(html, /href="https:\/\/getbidvera\.com\/upgrade"/);
  assert.doesNotMatch(html, /href="\/billing"/);
  const reminders = readSrc("src/services/billing/renewal-reminders.ts");
  assert.match(reminders, /billingAbsoluteUrl\("\/billing"\)/);
  assert.doesNotMatch(reminders, /href="\/billing"/);
});

test("3) stale Stripe checkout cannot activate the wrong plan", () => {
  const latest = parsePendingCheckout({
    provider: "stripe",
    planId: "plan_pro",
    interval: "MONTH",
    providerRef: "cs_latest",
    createdAt: now.toISOString(),
  });
  assert.ok(latest);
  assert.throws(
    () =>
      assertPendingCheckoutMatches({
        pending: latest,
        provider: "stripe",
        planId: "plan_starter",
        checkoutSessionId: "cs_stale",
      }),
    (error: unknown) =>
      error instanceof AppError && /Plan does not match checkout/.test(error.message),
  );
  assert.throws(
    () =>
      resolveStripeSubscriptionWebhookBinding({
        companyId: "co_1",
        planId: "plan_starter",
        providerSubscriptionId: "sub_stale",
        knownByProviderId: null,
        localByCompany: null,
        pendingCheckout: { provider: "stripe", planId: "plan_pro", providerRef: "cs_latest" },
      }),
    (error: unknown) =>
      error instanceof AppError && /Plan does not match checkout/.test(error.message),
  );
});

test("4) Stripe session / providerRef mismatch is rejected", () => {
  const pending = parsePendingCheckout({
    provider: "stripe",
    planId: "plan_pro",
    interval: "MONTH",
    providerRef: "cs_latest",
    createdAt: now.toISOString(),
  });
  assert.ok(pending);
  assert.throws(
    () =>
      assertPendingCheckoutMatches({
        pending,
        provider: "stripe",
        planId: "plan_pro",
        checkoutSessionId: "cs_stale",
      }),
    (error: unknown) =>
      error instanceof AppError && /session does not match pending/.test(error.message),
  );
  assert.doesNotThrow(() =>
    assertPendingCheckoutMatches({
      pending,
      provider: "stripe",
      planId: "plan_pro",
      checkoutSessionId: "cs_latest",
    }),
  );
  const stripe = readSrc("src/services/billing/stripe.ts");
  const activate = stripe.slice(
    stripe.indexOf("export async function activateStripeCheckoutSession"),
    stripe.indexOf("export async function handleStripeWebhook"),
  );
  assert.match(activate, /checkoutSessionId: input\.sessionId/);
});

test("5) wrong company / tenant is rejected", () => {
  assert.throws(
    () =>
      resolveStripeSubscriptionWebhookBinding({
        companyId: "co_victim",
        planId: "plan_starter",
        providerSubscriptionId: "sub_live",
        knownByProviderId: {
          companyId: "co_owner",
          provider: "stripe",
          providerSubscriptionId: "sub_live",
          planId: "plan_starter",
          status: "ACTIVE",
        },
        localByCompany: null,
      }),
    (error: unknown) =>
      error instanceof AppError && /does not match company/.test(error.message),
  );
  const stripe = readSrc("src/services/billing/stripe.ts");
  assert.match(stripe, /sessionCompanyId !== input\.companyId/);
});

test("6) successful valid checkout still activates", () => {
  const pending = parsePendingCheckout({
    provider: "stripe",
    planId: "plan_pro",
    interval: "MONTH",
    providerRef: "cs_ok",
    createdAt: now.toISOString(),
  });
  assert.ok(pending);
  assert.doesNotThrow(() =>
    assertPendingCheckoutMatches({
      pending,
      provider: "stripe",
      planId: "plan_pro",
      checkoutSessionId: "cs_ok",
    }),
  );
  assert.equal(
    resolveStripeSubscriptionWebhookBinding({
      companyId: "co_1",
      planId: "plan_pro",
      providerSubscriptionId: "sub_new",
      knownByProviderId: null,
      localByCompany: null,
      pendingCheckout: { provider: "stripe", planId: "plan_pro" },
      checkoutSessionId: "cs_ok",
    }),
    "checkout",
  );
});

test("7) abandoned checkout cannot remove access", () => {
  assert.equal(evaluateSubscriptionAccess(liveTrial, now).allowed, true);
  assert.equal(evaluateSubscriptionAccess(livePaid, now).allowed, true);
  assert.equal(
    shouldClearPendingForRef({
      pending: parsePendingCheckout({
        provider: "stripe",
        planId: "plan_pro",
        interval: "MONTH",
        providerRef: "cs_abandoned",
        createdAt: now.toISOString(),
      }),
      provider: "stripe",
      providerRef: "cs_other",
    }),
    false,
  );
  const stripe = readSrc("src/services/billing/stripe.ts");
  const create = stripe.slice(
    stripe.indexOf("export async function createStripeCheckoutSession"),
    stripe.indexOf("export async function activateStripeCheckoutSession"),
  );
  assert.doesNotMatch(create, /subscription\.upsert/);
  assert.doesNotMatch(create, /status: "INCOMPLETE"/);
});

test("8) repeated checkout cannot activate the wrong plan", () => {
  const second = parsePendingCheckout({
    provider: "stripe",
    planId: "plan_business",
    interval: "MONTH",
    providerRef: "cs_second",
    createdAt: now.toISOString(),
  });
  assert.ok(second);
  assert.throws(
    () =>
      assertPendingCheckoutMatches({
        pending: second,
        provider: "stripe",
        planId: "plan_pro",
        checkoutSessionId: "cs_first",
      }),
    (error: unknown) =>
      error instanceof AppError && /Plan does not match checkout/.test(error.message),
  );
  assert.equal(
    shouldClearPendingForRef({
      pending: second,
      provider: "stripe",
      providerRef: "cs_first",
    }),
    false,
  );
  assert.throws(
    () =>
      resolveStripeSubscriptionWebhookBinding({
        companyId: "co_1",
        planId: "plan_pro",
        providerSubscriptionId: "sub_first",
        knownByProviderId: null,
        localByCompany: null,
        pendingCheckout: {
          provider: "stripe",
          planId: "plan_business",
          providerRef: "cs_second",
        },
      }),
    (error: unknown) =>
      error instanceof AppError && /Plan does not match checkout/.test(error.message),
  );
  assert.throws(
    () =>
      resolveStripeSubscriptionWebhookBinding({
        companyId: "co_1",
        planId: "plan_pro",
        providerSubscriptionId: "sub_first",
        knownByProviderId: null,
        localByCompany: null,
        pendingCheckout: {
          provider: "stripe",
          planId: "plan_pro",
          providerRef: "cs_second",
        },
      }),
    (error: unknown) =>
      error instanceof AppError && /No checkout session/.test(error.message),
  );
});

test("9) missing pendingCheckout column is explicit and fail-closed on write", () => {
  const missing = pendingCheckoutStorageError({
    code: "P2022",
    message: 'The column `pendingCheckout` does not exist',
  });
  assert.equal(missing?.status, 503);
  assert.match(missing?.message ?? "", /billing checkout storage is not ready/);
  assert.equal(isMissingPendingCheckoutColumn(new Error("unrelated prisma timeout")), false);
  const src = readSrc("src/services/billing/pending-checkout.ts");
  const write = src.slice(
    src.indexOf("export async function recordPendingCheckout"),
    src.indexOf("export async function readPendingCheckout"),
  );
  assert.match(write, /pendingCheckoutStorageError/);
  assert.match(write, /if \(storage\) throw storage/);
  assert.doesNotMatch(write, /if \(isMissingPendingCheckoutColumn\(error\)\) return;/);
  const stripe = readSrc("src/services/billing/stripe.ts");
  assert.match(stripe, /checkout\.session\.expired/);
  assert.match(stripe, /webhookBinding === "checkout"/);
});
