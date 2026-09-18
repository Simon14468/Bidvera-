import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  buildRenewalReminderMessage,
  isRenewalReminderEligible,
  renewalReminderDedupeKey,
  resolveRenewalReminderStage,
} from "@/services/billing/renewal-reminders";
import {
  resolveGraceDaysRemaining,
  resolveBillingDisplayStatus,
} from "@/services/billing/billing-display";
import {
  computeGracePeriodEndsAt,
  evaluateSubscriptionAccess,
  normalizePaymentFailureStatus,
} from "@/services/billing/lifecycle";
import { shouldAssignFreeWorkspace } from "@/services/billing/free-workspace";
import { getDictionary } from "@/i18n/dictionaries";
import { locales } from "@/i18n/config";

const NOW = new Date("2026-06-01T12:00:00Z");
const DAY = 86_400_000;

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("renewal reminder stages: 7 days, 3 days, 24 hours", () => {
  assert.equal(
    resolveRenewalReminderStage(new Date(NOW.getTime() + 6.5 * DAY), NOW),
    "7d",
  );
  assert.equal(
    resolveRenewalReminderStage(new Date(NOW.getTime() + 2.5 * DAY), NOW),
    "3d",
  );
  assert.equal(
    resolveRenewalReminderStage(new Date(NOW.getTime() + 12 * 60 * 60 * 1000), NOW),
    "24h",
  );
  // Outside windows / past dates
  assert.equal(
    resolveRenewalReminderStage(new Date(NOW.getTime() + 10 * DAY), NOW),
    null,
  );
  assert.equal(
    resolveRenewalReminderStage(new Date(NOW.getTime() - DAY), NOW),
    null,
  );
  assert.equal(resolveRenewalReminderStage(null, NOW), null);
});

test("no reminder after cancellation, expiry, Free Workspace, or missing renewal date", () => {
  const base = {
    status: "ACTIVE",
    cancelAtPeriodEnd: false,
    isFreePlan: false,
    planSlug: "pro",
    currentPeriodEnd: new Date(NOW.getTime() + 2 * DAY),
    now: NOW,
  };
  assert.equal(isRenewalReminderEligible(base), true);
  assert.equal(
    isRenewalReminderEligible({ ...base, cancelAtPeriodEnd: true }),
    false,
  );
  assert.equal(isRenewalReminderEligible({ ...base, status: "CANCELED" }), false);
  assert.equal(isRenewalReminderEligible({ ...base, status: "EXPIRED" }), false);
  assert.equal(isRenewalReminderEligible({ ...base, status: "PAST_DUE" }), false);
  assert.equal(isRenewalReminderEligible({ ...base, isFreePlan: true }), false);
  assert.equal(
    isRenewalReminderEligible({ ...base, planSlug: "free" }),
    false,
  );
  assert.equal(
    isRenewalReminderEligible({ ...base, planSlug: "trial" }),
    false,
  );
  assert.equal(
    isRenewalReminderEligible({ ...base, currentPeriodEnd: null }),
    false,
  );
  assert.equal(
    isRenewalReminderEligible({
      ...base,
      currentPeriodEnd: new Date(NOW.getTime() - DAY),
    }),
    false,
  );
});

test("duplicate notification prevention: stable dedupe key per stage and period", () => {
  const key1 = renewalReminderDedupeKey({
    companyId: "co-1",
    stage: "3d",
    currentPeriodEnd: new Date("2026-06-04T09:00:00Z"),
  });
  const key2 = renewalReminderDedupeKey({
    companyId: "co-1",
    stage: "3d",
    currentPeriodEnd: new Date("2026-06-04T21:30:00Z"),
  });
  assert.equal(key1, key2); // retries in the same window never duplicate
  assert.equal(key1, "billing:renewal:3d:co-1:2026-06-04");
  // Different stage or company gets its own key
  assert.notEqual(
    key1,
    renewalReminderDedupeKey({
      companyId: "co-1",
      stage: "24h",
      currentPeriodEnd: new Date("2026-06-04T09:00:00Z"),
    }),
  );
  assert.notEqual(
    key1,
    renewalReminderDedupeKey({
      companyId: "co-2",
      stage: "3d",
      currentPeriodEnd: new Date("2026-06-04T09:00:00Z"),
    }),
  );
  // Delivery reuses the existing dedupe mechanisms
  const reminders = readSrc("src/services/billing/renewal-reminders.ts");
  assert.match(reminders, /dedupeKey/);
  assert.match(reminders, /idempotencyKey: `\$\{dedupeKey\}:\$\{user.email\}`/);
  const notifications = readSrc("src/services/notifications/index.ts");
  assert.match(notifications, /dedupeKey/);
  assert.match(notifications, /never duplicate/i);
});

test("reminder message shows plan, renewal date, amount, interval, provider", () => {
  const { title, message } = buildRenewalReminderMessage({
    stage: "24h",
    planName: "Pro",
    amountCents: 4900,
    currency: "EUR",
    interval: "MONTH",
    provider: "paypal",
    renewsAt: new Date("2026-06-02T12:00:00Z"),
  });
  assert.equal(title, "Your Pro plan renews tomorrow");
  assert.match(message, /€49/);
  assert.match(message, /monthly/);
  assert.match(message, /PayPal/);
  assert.match(message, /2026-06-02/);
  assert.match(message, /Manage your subscription/);

  const stripeYearly = buildRenewalReminderMessage({
    stage: "7d",
    planName: "Business",
    amountCents: 99000,
    currency: "USD",
    interval: "YEAR",
    provider: "stripe",
    renewsAt: new Date("2026-06-08T12:00:00Z"),
  });
  assert.match(stripeYearly.title, /renews on 2026-06-08/);
  assert.match(stripeYearly.message, /yearly/);
  assert.match(stripeYearly.message, /Stripe/);
});

test("payment failure maps to PAST_DUE with a server-computed grace window", () => {
  assert.equal(normalizePaymentFailureStatus(), "PAST_DUE");
  const graceEnds = computeGracePeriodEndsAt(NOW, 3);
  assert.ok(graceEnds);
  assert.equal(graceEnds.getTime(), NOW.getTime() + 3 * DAY);
  assert.equal(computeGracePeriodEndsAt(NOW, 0), null);
});

test("grace-period countdown is computed from real server dates", () => {
  assert.equal(
    resolveGraceDaysRemaining(new Date(NOW.getTime() + 3 * DAY), NOW),
    3,
  );
  assert.equal(
    resolveGraceDaysRemaining(new Date(NOW.getTime() + 0.5 * DAY), NOW),
    1,
  );
  assert.equal(
    resolveGraceDaysRemaining(new Date(NOW.getTime() - DAY), NOW),
    null,
  );
  assert.equal(resolveGraceDaysRemaining(null, NOW), null);
  // Accepts ISO strings from server DTOs, still no client-controlled dates
  assert.equal(
    resolveGraceDaysRemaining(
      new Date(NOW.getTime() + 2 * DAY).toISOString(),
      NOW,
    ),
    2,
  );
});

test("expiration downgrades through the existing Free Workspace mechanism", () => {
  for (const reason of [
    "trial_expired",
    "period_expired",
    "past_due_expired",
    "canceled",
  ] as const) {
    assert.equal(
      shouldAssignFreeWorkspace({ freeWorkspaceEnabled: true, reason }),
      true,
      reason,
    );
    assert.equal(
      shouldAssignFreeWorkspace({ freeWorkspaceEnabled: false, reason }),
      false,
      reason,
    );
  }
  const reconcile = readSrc("src/services/billing/reconcile.ts");
  assert.match(reconcile, /assignFreeWorkspace/);
  assert.match(reconcile, /past_due_expired/);
});

test("company data is preserved on downgrade", () => {
  const freeWorkspace = readSrc("src/services/billing/free-workspace.ts");
  assert.match(freeWorkspace, /Preserves company, users, documents, history/);
  assert.match(freeWorkspace, /Do not reset analysesUsed or delete historical usage/);
  assert.doesNotMatch(freeWorkspace, /\.delete\(/);
  assert.doesNotMatch(freeWorkspace, /deleteMany/);
  const reminders = readSrc("src/services/billing/renewal-reminders.ts");
  assert.doesNotMatch(reminders, /\.delete\(/);
  assert.doesNotMatch(reminders, /deleteMany/);
});

test("tenant isolation: reminders and billing page stay company-scoped", () => {
  const reminders = readSrc("src/services/billing/renewal-reminders.ts");
  // Recipients come from the subscription's own company row, never a client id
  assert.match(reminders, /companyId: sub.companyId/);
  assert.match(reminders, /where: \{ companyId: sub.companyId/);
  assert.doesNotMatch(reminders, /searchParams|request\.|headers\(/);
  const page = readSrc("src/app/(app)/billing/page.tsx");
  assert.match(page, /requireCompanyId\(\)/);
});

test("lifecycle layer is provider-independent (PayPal now, Stripe later)", () => {
  const reminders = readSrc("src/services/billing/renewal-reminders.ts");
  assert.doesNotMatch(reminders, /from "@\/services\/billing\/paypal"/);
  assert.doesNotMatch(reminders, /from "@\/services\/billing\/stripe"/);
  // Same eligibility for both providers
  for (const provider of ["paypal", "stripe"]) {
    const { message } = buildRenewalReminderMessage({
      stage: "3d",
      planName: "Starter",
      amountCents: 1900,
      currency: "USD",
      interval: "MONTH",
      provider,
      renewsAt: new Date(NOW.getTime() + 3 * DAY),
    });
    assert.ok(message.length > 0, provider);
  }
  // Reconciliation applies the same access rules regardless of provider
  const expiredAccess = evaluateSubscriptionAccess(
    {
      status: "PAST_DUE",
      plan: "PRO",
      billingInterval: "MONTH",
      startedAt: NOW,
      currentPeriodStart: NOW,
      currentPeriodEnd: new Date(NOW.getTime() + 20 * DAY),
      gracePeriodEndsAt: new Date(NOW.getTime() - DAY),
      cancelAtPeriodEnd: false,
    },
    NOW,
  );
  assert.equal(expiredAccess.allowed, false);
  assert.equal(expiredAccess.reason, "past_due_expired");
});

test("worker integrates lifecycle reminders into the existing loop", () => {
  const worker = readSrc("src/worker/index.ts");
  assert.match(worker, /sendDueRenewalReminders/);
  assert.match(worker, /reconcileDueSubscriptions/);
});

test("canceled-at-period-end keeps paid access and billing page communicates states", () => {
  const canceledAccess = evaluateSubscriptionAccess(
    {
      status: "CANCELED",
      plan: "PRO",
      billingInterval: "MONTH",
      startedAt: NOW,
      currentPeriodStart: NOW,
      currentPeriodEnd: new Date(NOW.getTime() + 10 * DAY),
      gracePeriodEndsAt: null,
      cancelAtPeriodEnd: true,
    },
    NOW,
  );
  assert.equal(canceledAccess.allowed, true);
  assert.equal(canceledAccess.reason, "canceled_until_period_end");

  assert.equal(
    resolveBillingDisplayStatus({ status: "ACTIVE", plan: "FREE" }),
    "FREE_WORKSPACE",
  );
  const page = readSrc("src/app/(app)/billing/page.tsx");
  assert.match(page, /canceledAlertTitle/);
  assert.match(page, /subscriptionEndedTitle/);
  assert.match(page, /graceDaysRemaining/);
  assert.match(page, /FREE_WORKSPACE_ASSIGNED/);
});

test("all locales include the new lifecycle billing copy", () => {
  for (const locale of locales) {
    const billing = getDictionary(locale).app.billing;
    assert.ok(billing.canceledAlertTitle, locale);
    assert.ok(billing.subscriptionEndedTitle, locale);
    assert.ok(billing.subscriptionEndedBody, locale);
    assert.ok(billing.choosePlan, locale);
    assert.match(billing.graceDaysRemaining, /\{days\}/, locale);
    assert.ok(billing.graceDaysRemainingOne, locale);
  }
});

test("no sensitive payment credentials in reminder content or logs", () => {
  const reminders = readSrc("src/services/billing/renewal-reminders.ts");
  assert.doesNotMatch(reminders, /PAYPAL_CLIENT_SECRET|STRIPE_SECRET_KEY/);
  assert.doesNotMatch(reminders, /paymentMethod|card|last4/i);
  const { message } = buildRenewalReminderMessage({
    stage: "24h",
    planName: "Pro",
    amountCents: 4900,
    currency: "USD",
    interval: "MONTH",
    provider: "paypal",
    renewsAt: new Date(NOW.getTime() + DAY),
  });
  assert.doesNotMatch(message, /secret|token|password/i);
});
