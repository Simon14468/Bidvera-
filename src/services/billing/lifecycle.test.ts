import assert from "node:assert/strict";
import test from "node:test";
import {
  computeGracePeriodEndsAt,
  evaluateSubscriptionAccess,
  nextPeriodWindow,
  normalizePaymentFailureStatus,
  shouldResetUsageForPeriod,
  type LifecycleSubscriptionSnapshot,
} from "./lifecycle";

function sub(
  partial: Partial<LifecycleSubscriptionSnapshot> &
    Pick<LifecycleSubscriptionSnapshot, "status">,
): LifecycleSubscriptionSnapshot {
  return {
    plan: "STARTER",
    billingInterval: "MONTH",
    startedAt: new Date("2026-01-01T00:00:00Z"),
    currentPeriodStart: new Date("2026-01-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-02-01T00:00:00Z"),
    gracePeriodEndsAt: null,
    cancelAtPeriodEnd: false,
    ...partial,
  };
}

const midPeriod = new Date("2026-01-15T12:00:00Z");
const afterPeriod = new Date("2026-02-02T00:00:00Z");

test("ACTIVE within period allows access", () => {
  const access = evaluateSubscriptionAccess(sub({ status: "ACTIVE" }), midPeriod);
  assert.equal(access.allowed, true);
  assert.equal(access.reason, "active");
  assert.equal(access.inGrace, false);
});

test("ACTIVE after period end blocks and maps to EXPIRED", () => {
  const access = evaluateSubscriptionAccess(sub({ status: "ACTIVE" }), afterPeriod);
  assert.equal(access.allowed, false);
  assert.equal(access.reason, "period_expired");
  assert.equal(access.effectiveStatus, "EXPIRED");
});

test("TRIALING after period end is trial_expired", () => {
  const access = evaluateSubscriptionAccess(
    sub({ status: "TRIALING", plan: "TRIAL" }),
    afterPeriod,
  );
  assert.equal(access.allowed, false);
  assert.equal(access.reason, "trial_expired");
  assert.equal(access.effectiveStatus, "EXPIRED");
});

test("TRIALING within period allows access", () => {
  const access = evaluateSubscriptionAccess(
    sub({ status: "TRIALING", plan: "TRIAL" }),
    midPeriod,
  );
  assert.equal(access.allowed, true);
  assert.equal(access.reason, "trialing");
});

test("PAST_DUE within grace allows access with warning", () => {
  const access = evaluateSubscriptionAccess(
    sub({
      status: "PAST_DUE",
      gracePeriodEndsAt: new Date("2026-01-20T00:00:00Z"),
    }),
    midPeriod,
  );
  assert.equal(access.allowed, true);
  assert.equal(access.inGrace, true);
  assert.equal(access.billingWarning, true);
  assert.equal(access.reason, "grace");
});

test("PAST_DUE after grace blocks", () => {
  const access = evaluateSubscriptionAccess(
    sub({
      status: "PAST_DUE",
      gracePeriodEndsAt: new Date("2026-01-10T00:00:00Z"),
    }),
    midPeriod,
  );
  assert.equal(access.allowed, false);
  assert.equal(access.reason, "past_due_expired");
  assert.equal(access.effectiveStatus, "EXPIRED");
});

test("PAYMENT_FAILED uses same grace rules", () => {
  const access = evaluateSubscriptionAccess(
    sub({
      status: "PAYMENT_FAILED",
      gracePeriodEndsAt: new Date("2026-01-20T00:00:00Z"),
    }),
    midPeriod,
  );
  assert.equal(access.allowed, true);
  assert.equal(access.inGrace, true);
});

test("CANCELED keeps access until period end", () => {
  const access = evaluateSubscriptionAccess(
    sub({ status: "CANCELED", cancelAtPeriodEnd: true }),
    midPeriod,
  );
  assert.equal(access.allowed, true);
  assert.equal(access.reason, "canceled_until_period_end");
});

test("CANCELED after period end blocks", () => {
  const access = evaluateSubscriptionAccess(
    sub({ status: "CANCELED" }),
    afterPeriod,
  );
  assert.equal(access.allowed, false);
  assert.equal(access.reason, "canceled");
});

test("EXPIRED / UNPAID / INCOMPLETE never allow", () => {
  for (const status of ["EXPIRED", "UNPAID", "INCOMPLETE"] as const) {
    const access = evaluateSubscriptionAccess(sub({ status }), midPeriod);
    assert.equal(access.allowed, false, status);
  }
});

test("missing subscription denies access", () => {
  const access = evaluateSubscriptionAccess(null, midPeriod);
  assert.equal(access.allowed, false);
  assert.equal(access.reason, "missing");
});

test("nextPeriodWindow advances month and year", () => {
  const from = new Date("2026-01-15T00:00:00Z");
  const month = nextPeriodWindow({ from, interval: "MONTH" });
  assert.equal(month.end.getUTCMonth(), 1);
  const year = nextPeriodWindow({ from, interval: "YEAR", annualMonths: 12 });
  assert.equal(year.end.getUTCFullYear(), 2027);
});

test("shouldResetUsageForPeriod only when period advances", () => {
  assert.equal(
    shouldResetUsageForPeriod({
      previousPeriodStart: new Date("2026-01-01"),
      nextPeriodStart: new Date("2026-02-01"),
    }),
    true,
  );
  assert.equal(
    shouldResetUsageForPeriod({
      previousPeriodStart: new Date("2026-01-01"),
      nextPeriodStart: new Date("2026-01-01"),
    }),
    false,
  );
  assert.equal(
    shouldResetUsageForPeriod({
      previousPeriodStart: null,
      nextPeriodStart: new Date("2026-01-01"),
    }),
    true,
  );
});

test("computeGracePeriodEndsAt respects zero days", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(computeGracePeriodEndsAt(now, 0), null);
  const end = computeGracePeriodEndsAt(now, 3);
  assert.ok(end);
  assert.equal(end!.getTime() - now.getTime(), 3 * 86_400_000);
});

test("normalizePaymentFailureStatus is PAST_DUE", () => {
  assert.equal(normalizePaymentFailureStatus(), "PAST_DUE");
});

test("YEARLY interval snapshot respects period end independently of calendar month", () => {
  const yearly = sub({
    status: "ACTIVE",
    billingInterval: "YEAR",
    currentPeriodStart: new Date("2026-01-01T00:00:00Z"),
    currentPeriodEnd: new Date("2027-01-01T00:00:00Z"),
  });
  // Mid-year still allowed (not calendar-month based)
  assert.equal(
    evaluateSubscriptionAccess(yearly, new Date("2026-08-15T00:00:00Z")).allowed,
    true,
  );
  assert.equal(
    evaluateSubscriptionAccess(yearly, new Date("2027-01-02T00:00:00Z")).allowed,
    false,
  );
});
