import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildBillingWarningEmailHtml } from "@/services/billing/billing-warnings";
import {
  isRenewalReminderEligible,
} from "@/services/billing/renewal-reminders";
import {
  buildFreeWorkspaceTrialExpiredEmail,
  buildFreeWorkspaceTrialReminderEmail,
  buildFreeWorkspaceTrialStartedEmail,
  buildGenericBillingNoticeEmail,
  buildPaidRenewalReminderEmail,
  buildPaidSubscriptionActivatedEmail,
  buildPaymentFailedEmail,
  buildStripeCardTrialEndingEmail,
  buildSubscriptionCancellationEmail,
  safePaymentMethodLabel,
  sanitizePaymentMethodDisplay,
} from "@/services/billing/emails";

const ENV = { NEXT_PUBLIC_APP_URL: "https://getbidvera.com" };
const XSS_NAME = `<img src=x onerror=alert(1)>`;
const XSS_COMPANY = `Acme</p><script>alert(1)</script>`;
const XSS_PLAN = `Pro</td><script>alert(1)</script>`;

const STRIPE_AUTOCHARGE = /automatic payment|auto-convert|card will be charged|no charge today|payment method will be billed|starts automatically/i;

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
}

function assertAbsoluteHrefs(html: string) {
  const links = hrefs(html);
  assert.ok(links.length > 0, "expected at least one href");
  for (const href of links) {
    assert.match(href, /^https:\/\/getbidvera\.com(?:\/|$)/);
    assert.doesNotMatch(href, /^\//);
  }
}

function assertEscaped(html: string) {
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img|&lt;script/);
}

describe("Bidvera professional billing emails", () => {
  it("Free Workspace emails never contain Stripe auto-charge language", () => {
    const started = buildFreeWorkspaceTrialStartedEmail(
      { firstName: "Ada", companyName: "Acme", daysRemaining: 14, trialEndDate: "2026-10-11" },
      ENV,
    );
    const reminder = buildFreeWorkspaceTrialReminderEmail(
      { firstName: "Ada", daysRemaining: 7, trialEndDate: "2026-10-04" },
      ENV,
    );
    const expired = buildFreeWorkspaceTrialExpiredEmail({ firstName: "Ada" }, ENV);

    for (const mail of [started, reminder, expired]) {
      assert.doesNotMatch(mail.html, STRIPE_AUTOCHARGE);
      assert.doesNotMatch(mail.text, STRIPE_AUTOCHARGE);
      assert.doesNotMatch(mail.subject, STRIPE_AUTOCHARGE);
      assert.doesNotMatch(mail.html, /will be charged|autoconvert|auto convert/i);
    }
    assert.match(started.html, /Go to your workspace/);
    assert.match(started.html, /no payment method required/i);
    assert.match(reminder.html, /7 days remaining/);
    assert.match(reminder.html, /does not convert automatically/i);
  });

  it("Stripe card trial email may contain card-trial billing language", () => {
    const mail = buildStripeCardTrialEndingEmail(
      {
        firstName: "Ada",
        planName: "Pro",
        trialEndDate: "2026-10-01",
        amountCents: 4900,
        currency: "USD",
      },
      ENV,
    );
    assert.match(mail.html, /starts automatically/i);
    assert.match(mail.html, /payment method will be billed/i);
    assert.match(mail.html, /Stripe-managed card trial/i);
    assert.match(mail.html, /not the Free Workspace first-signup trial/i);
    assertAbsoluteHrefs(mail.html);
  });

  it("paid renewal email excludes FREE/TRIAL subscriptions", () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    const future = new Date("2026-10-01T12:00:00.000Z");
    const base = {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      isFreePlan: false,
      planSlug: "pro",
      currentPeriodEnd: future,
      now,
    };
    assert.equal(isRenewalReminderEligible(base), true);
    assert.equal(isRenewalReminderEligible({ ...base, isFreePlan: true }), false);
    assert.equal(isRenewalReminderEligible({ ...base, planSlug: "free" }), false);
    assert.equal(isRenewalReminderEligible({ ...base, planSlug: "trial" }), false);

    const src = readFileSync(
      path.join(process.cwd(), "src/services/billing/renewal-reminders.ts"),
      "utf8",
    );
    assert.match(src, /plan: \{ notIn: \["FREE", "TRIAL"\] \}/);
    assert.match(src, /buildPaidRenewalReminderEmail/);

    const mail = buildPaidRenewalReminderEmail(
      {
        firstName: "Ada",
        planName: "Pro",
        daysRemaining: 3,
        renewalDate: future,
        amountCents: 4900,
        currency: "USD",
        interval: "MONTH",
      },
      ENV,
    );
    assert.match(mail.html, /Free Workspace and first-signup trials are not billed/i);
    assertAbsoluteHrefs(mail.html);
  });

  it("billing links are absolute NEXT_PUBLIC_APP_URL URLs", () => {
    const mails = [
      buildFreeWorkspaceTrialStartedEmail({ firstName: "Ada" }, ENV),
      buildFreeWorkspaceTrialReminderEmail({ firstName: "Ada", daysRemaining: 3 }, ENV),
      buildFreeWorkspaceTrialExpiredEmail({ firstName: "Ada" }, ENV),
      buildPaidSubscriptionActivatedEmail({ firstName: "Ada", planName: "Pro" }, ENV),
      buildPaymentFailedEmail({ firstName: "Ada", planName: "Pro" }, ENV),
      buildSubscriptionCancellationEmail({ firstName: "Ada", planName: "Pro" }, ENV),
      buildPaidRenewalReminderEmail({ firstName: "Ada", planName: "Pro" }, ENV),
      buildStripeCardTrialEndingEmail({ firstName: "Ada", planName: "Pro" }, ENV),
      buildGenericBillingNoticeEmail({ headline: "Billing update", message: "Please review." }, ENV),
    ];
    for (const mail of mails) {
      assertAbsoluteHrefs(mail.html);
      assert.match(mail.text, /https:\/\/getbidvera\.com\//);
      assert.doesNotMatch(mail.html, /href="\/(billing|upgrade|dashboard)/);
    }
    const warning = buildBillingWarningEmailHtml("Trial ended", ENV);
    assert.match(warning, /href="https:\/\/getbidvera\.com\/billing"/);
    assert.match(warning, /href="https:\/\/getbidvera\.com\/upgrade"/);
  });

  it("dynamic values are HTML escaped", () => {
    const started = buildFreeWorkspaceTrialStartedEmail(
      { firstName: XSS_NAME, companyName: XSS_COMPANY },
      ENV,
    );
    const paid = buildPaidSubscriptionActivatedEmail(
      { firstName: XSS_NAME, companyName: XSS_COMPANY, planName: XSS_PLAN },
      ENV,
    );
    const warning = buildBillingWarningEmailHtml(`ended ${XSS_NAME}`, ENV);
    for (const html of [started.html, paid.html, warning]) {
      assertEscaped(html);
    }
    assert.doesNotMatch(started.text, /&lt;/);
    assert.match(started.html, /&lt;img/);
    assert.match(paid.html, /&lt;script&gt;/);
  });

  it("payment email does not expose sensitive payment data", () => {
    const mail = buildPaidSubscriptionActivatedEmail(
      {
        firstName: "Ada",
        planName: "Pro",
        paymentMethod: "4242424242424242",
      },
      ENV,
    );
    assert.doesNotMatch(mail.html, /4242424242424242/);
    assert.doesNotMatch(mail.text, /4242424242424242/);

    const tokenMail = buildPaidSubscriptionActivatedEmail(
      { paymentMethod: "tok_visa_secret" },
      ENV,
    );
    assert.doesNotMatch(tokenMail.html, /tok_visa_secret/);
    assert.doesNotMatch(tokenMail.html, /sk_live|pi_|whsec_/);

    assert.equal(sanitizePaymentMethodDisplay("4242424242424242"), "—");
    assert.equal(sanitizePaymentMethodDisplay("sk_live_abc"), "—");
    assert.equal(safePaymentMethodLabel("Visa", "4242424242424242"), "Visa");
    assert.equal(safePaymentMethodLabel("Visa", "4242"), "Visa ···· 4242");

    const safe = buildPaidSubscriptionActivatedEmail(
      { paymentMethod: "Visa ···· 4242" },
      ENV,
    );
    assert.match(safe.html, /Visa ···· 4242/);
  });

  it("Free Workspace expired email uses upgrade/plan CTA", () => {
    const mail = buildFreeWorkspaceTrialExpiredEmail({ firstName: "Ada" }, ENV);
    assert.match(mail.html, /Your Free Workspace trial has ended/);
    assert.match(mail.html, /Choose a plan/);
    assert.match(mail.html, /href="https:\/\/getbidvera\.com\/upgrade"/);
    assert.match(mail.html, /No payment was attempted/);
    assert.doesNotMatch(mail.html, /we charged|a payment was attempted|could not be completed/i);
  });

  it("email templates render with missing optional values safely", () => {
    const started = buildFreeWorkspaceTrialStartedEmail({}, ENV);
    const reminder = buildFreeWorkspaceTrialReminderEmail({ daysRemaining: 1 }, ENV);
    const expired = buildFreeWorkspaceTrialExpiredEmail({}, ENV);
    const paid = buildPaidSubscriptionActivatedEmail({}, ENV);
    const failed = buildPaymentFailedEmail({}, ENV);
    const cancel = buildSubscriptionCancellationEmail({}, ENV);
    const renewal = buildPaidRenewalReminderEmail({}, ENV);
    const card = buildStripeCardTrialEndingEmail({}, ENV);

    for (const mail of [started, reminder, expired, paid, failed, cancel, renewal, card]) {
      assert.ok(mail.subject.length > 0);
      assert.match(mail.html, /<!DOCTYPE html>/);
      assert.match(mail.html, /Bidvera/);
      assert.match(mail.html, /brand-logo\.png/);
      assert.match(mail.html, /Hi there,/);
      assertAbsoluteHrefs(mail.html);
      assert.doesNotMatch(mail.html, /undefined|null/);
    }
    assert.match(reminder.subject, /1 day remaining/);
    assert.match(paid.html, />—</);
  });

  it("does not invent a Free Workspace 7/3/1 scheduler", () => {
    const reminders = readFileSync(
      path.join(process.cwd(), "src/services/billing/renewal-reminders.ts"),
      "utf8",
    );
    const worker = readFileSync(path.join(process.cwd(), "src/worker/index.ts"), "utf8");
    const templates = readFileSync(
      path.join(process.cwd(), "src/services/billing/emails/templates.ts"),
      "utf8",
    );
    assert.match(templates, /No scheduler is attached in this pass/);
    assert.doesNotMatch(worker, /buildFreeWorkspaceTrialReminderEmail/);
    assert.doesNotMatch(reminders, /buildFreeWorkspaceTrialReminderEmail/);
  });
});
