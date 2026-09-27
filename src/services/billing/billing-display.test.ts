import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  canCancelProviderSubscription,
  formatFreeWorkspaceTrialBanner,
  isFreeWorkspacePlan,
  resolveBillingDisplayStatus,
  resolveFreeWorkspaceTrialChrome,
  resolveIsTrialExpired,
  resolveTrialCountdown,
} from "@/services/billing/billing-display";
import { evaluateSubscriptionAccess } from "@/services/billing/lifecycle";
import { hasUpgradePathFromLimits } from "@/services/billing/upgrade-eligibility";
import { getDictionary } from "@/i18n/dictionaries";
import { locales } from "@/i18n/config";

const now = new Date("2026-09-13T12:00:00.000Z");

function daysFromNow(days: number): Date {
  return new Date(now.getTime() + days * 86_400_000);
}

test("A. trial countdown uses the actual end date", () => {
  const over7 = resolveTrialCountdown({
    status: "TRIALING",
    cancelAtPeriodEnd: false,
    trialEndsAt: daysFromNow(10),
    now,
  });
  assert.equal(over7.show, true);
  assert.equal(over7.daysRemaining, 10);
  assert.equal(over7.endingToday, false);

  const seven = resolveTrialCountdown({
    status: "TRIALING",
    cancelAtPeriodEnd: false,
    trialEndsAt: daysFromNow(7),
    now,
  });
  assert.equal(seven.daysRemaining, 7);

  const three = resolveTrialCountdown({
    status: "TRIALING",
    cancelAtPeriodEnd: false,
    trialEndsAt: daysFromNow(3),
    now,
  });
  assert.equal(three.daysRemaining, 3);

  const two = resolveTrialCountdown({
    status: "TRIALING",
    cancelAtPeriodEnd: false,
    trialEndsAt: daysFromNow(2),
    now,
  });
  assert.equal(two.daysRemaining, 2);

  const one = resolveTrialCountdown({
    status: "TRIALING",
    cancelAtPeriodEnd: false,
    trialEndsAt: daysFromNow(1),
    now,
  });
  assert.equal(one.daysRemaining, 1);
  assert.equal(one.endingToday, false);

  const today = resolveTrialCountdown({
    status: "TRIALING",
    cancelAtPeriodEnd: false,
    trialEndsAt: now,
    now,
  });
  assert.equal(today.show, true);
  assert.equal(today.endingToday, true);
  assert.equal(today.daysRemaining, 0);
});

test("B. active subscription never shows a trial countdown", () => {
  const countdown = resolveTrialCountdown({
    status: "ACTIVE",
    cancelAtPeriodEnd: false,
    trialEndsAt: daysFromNow(5),
    now,
  });
  assert.equal(countdown.show, false);
  assert.equal(resolveBillingDisplayStatus({ status: "ACTIVE", plan: "PRO" }), "ACTIVE");
});

test("C. cancelled trial still shows countdown as cancelled", () => {
  const countdown = resolveTrialCountdown({
    status: "TRIALING",
    cancelAtPeriodEnd: true,
    trialEndsAt: daysFromNow(4),
    now,
  });
  assert.equal(countdown.show, true);
  assert.equal(countdown.cancelled, true);
  assert.equal(countdown.daysRemaining, 4);
  assert.equal(canCancelProviderSubscription({
    status: "TRIALING",
    providerSubscriptionId: "sub_1",
    cancelAtPeriodEnd: true,
  }), false);
});

test("D. cancel-at-period-end keeps access until the period ends", () => {
  const end = daysFromNow(12);
  const access = evaluateSubscriptionAccess({
    status: "CANCELED",
    plan: "PRO",
    billingInterval: "MONTH",
    startedAt: now,
    currentPeriodStart: now,
    currentPeriodEnd: end,
    gracePeriodEndsAt: null,
    cancelAtPeriodEnd: true,
  }, now);
  assert.equal(access.allowed, true);
  assert.equal(access.reason, "canceled_until_period_end");
  assert.equal(
    canCancelProviderSubscription({
      status: "ACTIVE",
      providerSubscriptionId: "sub_paid",
      cancelAtPeriodEnd: true,
    }),
    false,
  );
});

test("E. Free Workspace is a distinct display state", () => {
  assert.equal(isFreeWorkspacePlan({ plan: "FREE", slug: "free", isFree: true }), true);
  assert.equal(
    resolveBillingDisplayStatus({
      status: "ACTIVE",
      plan: "FREE",
      slug: "free",
      isFree: true,
    }),
    "FREE_WORKSPACE",
  );
  assert.equal(
    resolveBillingDisplayStatus({
      status: "TRIALING",
      plan: "TRIAL",
      slug: "free",
      isFree: true,
    }),
    "TRIALING",
  );
  assert.equal(
    resolveBillingDisplayStatus({
      status: "EXPIRED",
      effectiveStatus: "EXPIRED",
      reason: "trial_expired",
      plan: "TRIAL",
      slug: "free",
      isFree: true,
    }),
    "EXPIRED",
  );
  const countdown = resolveTrialCountdown({
    status: "ACTIVE",
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    now,
  });
  assert.equal(countdown.show, false);
});

test("F. upgrade path uses live public checkout plans", () => {
  assert.equal(
    hasUpgradePathFromLimits(
      { planSlug: "free", monthlyPriceCents: 0 },
      [
        { id: "p1", slug: "starter", monthlyPriceCents: 1900 },
        { id: "p2", slug: "pro", monthlyPriceCents: 4900 },
      ],
    ),
    true,
  );
  assert.equal(
    hasUpgradePathFromLimits(
      { planSlug: "pro", monthlyPriceCents: 4900 },
      [{ id: "p2", slug: "pro", monthlyPriceCents: 4900 }],
    ),
    false,
  );
});

test("converted trial and payment failure do not show a trial countdown", () => {
  assert.equal(
    resolveTrialCountdown({
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      trialEndsAt: daysFromNow(2),
      now,
    }).show,
    false,
  );
  assert.equal(
    resolveTrialCountdown({
      status: "PAST_DUE",
      cancelAtPeriodEnd: false,
      trialEndsAt: daysFromNow(2),
      now,
    }).show,
    false,
  );
  assert.equal(
    resolveBillingDisplayStatus({ status: "PAYMENT_FAILED", plan: "STARTER" }),
    "PAYMENT_FAILED",
  );
  assert.equal(
    resolveBillingDisplayStatus({ status: "PAST_DUE", plan: "STARTER" }),
    "PAST_DUE",
  );
});

const bannerCopy = {
  titleDays: "Free Workspace trial — {days} days remaining.",
  titleDay: "Free Workspace trial — 1 day remaining.",
  titleHours: "Free Workspace trial — {hours} hours remaining.",
  titleHour: "Free Workspace trial — 1 hour remaining.",
  titleEnding: "Free Workspace trial — ending soon.",
  hint: "Choose a paid plan before your trial ends to keep access.",
  expiredTitle: "Your Free Workspace trial has ended.",
  expiredBody: "Payment is required to continue. Choose a paid plan to restore access.",
  cta: "Choose a plan",
};

test("Free Workspace trial banner uses currentPeriodEnd, not a hardcoded 14 days", () => {
  const four = resolveFreeWorkspaceTrialChrome({
    status: "TRIALING",
    plan: "TRIAL",
    slug: "free",
    isFree: true,
    currentPeriodEnd: daysFromNow(4),
    now,
  });
  assert.equal(four?.kind, "active");
  if (four?.kind !== "active") throw new Error("expected active chrome");
  assert.equal(four.countdown.daysRemaining, 4);
  assert.equal(four.remainingLabel, "days");
  assert.equal(four.remainingValue, 4);
  const fourCopy = formatFreeWorkspaceTrialBanner(four, bannerCopy);
  assert.equal(fourCopy.title, "Free Workspace trial — 4 days remaining.");
  assert.equal(fourCopy.href, "/upgrade");
  assert.doesNotMatch(fourCopy.title, /14 days remaining/);

  const fourteen = resolveFreeWorkspaceTrialChrome({
    status: "TRIALING",
    plan: "TRIAL",
    slug: "free",
    isFree: true,
    currentPeriodEnd: daysFromNow(14),
    now,
  });
  assert.equal(fourteen?.kind, "active");
  if (fourteen?.kind !== "active") throw new Error("expected active chrome");
  assert.equal(fourteen.remainingValue, 14);
  assert.equal(
    formatFreeWorkspaceTrialBanner(fourteen, bannerCopy).title,
    "Free Workspace trial — 14 days remaining.",
  );

  const one = resolveFreeWorkspaceTrialChrome({
    status: "TRIALING",
    plan: "TRIAL",
    slug: "free",
    isFree: true,
    currentPeriodEnd: daysFromNow(1),
    now,
  });
  assert.equal(one?.kind, "active");
  if (one?.kind !== "active") throw new Error("expected active chrome");
  assert.equal(
    formatFreeWorkspaceTrialBanner(one, bannerCopy).title,
    "Free Workspace trial — 1 day remaining.",
  );

  const hours = resolveFreeWorkspaceTrialChrome({
    status: "TRIALING",
    plan: "TRIAL",
    slug: "free",
    isFree: true,
    currentPeriodEnd: new Date(now.getTime() + 5 * 3_600_000),
    now,
  });
  assert.equal(hours?.kind, "active");
  if (hours?.kind !== "active") throw new Error("expected active chrome");
  assert.equal(hours.countdown.daysRemaining, 0);
  assert.equal(hours.countdown.hoursRemaining, 5);
  assert.equal(
    formatFreeWorkspaceTrialBanner(hours, bannerCopy).title,
    "Free Workspace trial — 5 hours remaining.",
  );
});

test("expired Free Workspace trial shows payment-required chrome, not an active countdown", () => {
  const expired = resolveFreeWorkspaceTrialChrome({
    status: "EXPIRED",
    plan: "TRIAL",
    slug: "free",
    isFree: true,
    currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
    now,
  });
  assert.equal(expired?.kind, "expired");
  const copy = formatFreeWorkspaceTrialBanner(expired!, bannerCopy);
  assert.equal(copy.tone, "expired");
  assert.equal(copy.href, "/upgrade?reason=trial_expired");
  assert.match(copy.body, /Payment is required/);

  const endedRow = resolveFreeWorkspaceTrialChrome({
    status: "TRIALING",
    plan: "TRIAL",
    slug: "free",
    isFree: true,
    currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
    now,
  });
  assert.equal(endedRow?.kind, "expired");
});

test("paid cancellation Free Workspace and paid Stripe trials do not use first-signup chrome", () => {
  assert.equal(
    resolveFreeWorkspaceTrialChrome({
      status: "ACTIVE",
      plan: "FREE",
      slug: "free",
      isFree: true,
      currentPeriodEnd: daysFromNow(30),
      now,
    }),
    null,
  );
  assert.equal(
    resolveFreeWorkspaceTrialChrome({
      status: "TRIALING",
      plan: "STARTER",
      slug: "starter",
      isFree: false,
      currentPeriodEnd: daysFromNow(7),
      now,
    }),
    null,
  );
});

test("billing dictionary covers trial, cancel, and Free Workspace copy", () => {
  for (const locale of locales) {
    const billing = getDictionary(locale).app.billing;
    assert.ok(billing.trialEndsIn);
    assert.ok(billing.trialEndingToday);
    assert.ok(billing.noChargeToday);
    assert.ok(billing.cancelTrial);
    assert.ok(billing.freeWorkspace);
    assert.ok(billing.freeWorkspaceTrialBannerDays);
    assert.ok(billing.freeWorkspaceTrialBannerDay);
    assert.ok(billing.freeWorkspaceTrialCta);
    assert.ok(billing.freeWorkspaceTrialExpiredTitle);
    assert.ok(billing.nextBillingDate);
    assert.ok(billing.paymentFailed);
    assert.ok(billing.pastDue);
    assert.match(billing.freeWorkspaceTrialBannerDays, /\{days\}/);
  }
});

test("K. billing page and cancel action stay tenant-scoped", () => {
  const page = readFileSync(
    path.join(process.cwd(), "src/app/(app)/billing/page.tsx"),
    "utf8",
  );
  const actions = readFileSync(
    path.join(process.cwd(), "src/app/actions.ts"),
    "utf8",
  );
  assert.match(page, /requireCompanyId/);
  assert.match(actions, /export async function cancelSubscriptionAction/);
  assert.match(actions, /requireCompanyId/);
  assert.doesNotMatch(page, /paymentFingerprint|riskScore|cardNumber|cvc/i);
});

test("resolveIsTrialExpired is first-signup Free Workspace only", () => {
  const ended = new Date("2026-09-01T12:00:00.000Z");
  assert.equal(
    resolveIsTrialExpired({
      reason: "trial_expired",
      status: "TRIALING",
      plan: "TRIAL",
      slug: "free",
      isFree: true,
      currentPeriodEnd: ended,
      now,
    }),
    true,
  );
  assert.equal(
    resolveIsTrialExpired({
      reason: "trial_expired",
      status: "TRIALING",
      plan: "STARTER",
      slug: "starter",
      isFree: false,
      provider: "stripe",
      currentPeriodEnd: ended,
      now,
    }),
    false,
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

test("expired trial billing UI requires payment and is not labeled Free Workspace", () => {
  const page = readFileSync(
    path.join(process.cwd(), "src/app/(app)/billing/page.tsx"),
    "utf8",
  );
  const upgrade = readFileSync(
    path.join(process.cwd(), "src/app/(app)/upgrade/page.tsx"),
    "utf8",
  );
  assert.match(page, /reason: usage\.isTrialExpired \? "trial_expired"/);
  assert.match(page, /displayStatus === "EXPIRED"/);
  assert.match(page, /usage\.isTrialExpired/);
  assert.match(page, /href="\/upgrade"/);
  assert.match(upgrade, /params\.reason === "trial_expired"/);
  assert.match(upgrade, /Payment is required/);
});
