/**
 * Professional Bidvera billing email templates.
 * Free Workspace copy never uses Stripe card-trial auto-charge language.
 * FW 7/3/1 reminder scheduling is not wired here — template only.
 */

import { billingAbsoluteUrl } from "@/services/billing/billing-app-url";
import {
  firstNameFrom,
  formatEmailAmount,
  formatEmailDate,
  formatIntervalLabel,
  renderBillingEmail,
  sanitizePaymentMethodDisplay,
  type BillingEmailEnv,
} from "@/services/billing/emails/layout";

export type BillingEmailPayload = {
  subject: string;
  html: string;
  text: string;
};

export type BillingEmailPerson = {
  firstName?: string | null;
  companyName?: string | null;
};

function greeting(person: BillingEmailPerson): string {
  return `Hi ${firstNameFrom(person.firstName)},`;
}

function workspaceLine(person: BillingEmailPerson): string {
  return person.companyName?.trim()
    ? `Workspace: ${person.companyName.trim()}`
    : "";
}

export function buildFreeWorkspaceTrialStartedEmail(
  input: BillingEmailPerson & {
    daysRemaining?: number | null;
    trialEndDate?: Date | string | null;
  },
  env: BillingEmailEnv = process.env,
): BillingEmailPayload {
  const days =
    input.daysRemaining != null && Number.isFinite(input.daysRemaining)
      ? Math.max(0, Math.round(input.daysRemaining))
      : 14;
  const end = formatEmailDate(input.trialEndDate);
  const rendered = renderBillingEmail(
    {
      preheader: "Your 14-day Free Workspace trial is now active.",
      eyebrow: "Free Workspace",
      headline: "Your 14-day Free Workspace trial has started",
      intro: [
        greeting(input),
        `Your Bidvera Free Workspace trial is active for ${days} day${days === 1 ? "" : "s"}${end !== "—" ? ` (until ${end})` : ""}.`,
        "You can set up your company profile, organize compliance documents, and explore Bidvera — no payment method required.",
        workspaceLine(input),
      ],
      banner: {
        tone: "info",
        text: "This is a first-signup trial. Choose a paid plan only if you want to continue after it ends.",
      },
      details: [
        { label: "Trial length", value: `${days} days` },
        { label: "Trial ends", value: end },
      ],
      cta: {
        label: "Go to your workspace",
        href: billingAbsoluteUrl("/dashboard", env),
      },
      secondary: {
        label: "View plans",
        href: billingAbsoluteUrl("/upgrade", env),
      },
    },
    env,
  );
  return {
    subject: "Welcome to Bidvera — your 14-day Free Workspace trial has started",
    ...rendered,
  };
}

/** Reusable FW reminder body. No scheduler is attached in this pass. */
export function buildFreeWorkspaceTrialReminderEmail(
  input: BillingEmailPerson & {
    daysRemaining: number;
    trialEndDate?: Date | string | null;
  },
  env: BillingEmailEnv = process.env,
): BillingEmailPayload {
  const days = Math.max(0, Math.round(input.daysRemaining));
  const end = formatEmailDate(input.trialEndDate);
  const dayLabel =
    days === 1 ? "1 day remaining" : `${days} days remaining`;
  const rendered = renderBillingEmail(
    {
      preheader: `Your Free Workspace trial has ${dayLabel}.`,
      eyebrow: "Free Workspace trial",
      headline: `Your Free Workspace trial has ${dayLabel}`,
      intro: [
        greeting(input),
        `Your first-signup Free Workspace trial ${days === 0 ? "ends today" : `ends in ${dayLabel}`}${end !== "—" ? ` (${end})` : ""}.`,
        "To keep paid Bidvera capabilities after the trial, choose a plan. Nothing is charged unless you upgrade.",
        workspaceLine(input),
      ],
      banner: {
        tone: "warning",
        text: "This trial does not convert automatically and does not require a card.",
      },
      details: [
        { label: "Days remaining", value: String(days) },
        { label: "Trial ends", value: end },
      ],
      cta: {
        label: "Choose a plan",
        href: billingAbsoluteUrl("/upgrade", env),
      },
      secondary: {
        label: "Open billing",
        href: billingAbsoluteUrl("/billing", env),
      },
    },
    env,
  );
  return {
    subject: `Bidvera: ${dayLabel} on your Free Workspace trial`,
    ...rendered,
  };
}

export function buildFreeWorkspaceTrialExpiredEmail(
  input: BillingEmailPerson,
  env: BillingEmailEnv = process.env,
): BillingEmailPayload {
  const rendered = renderBillingEmail(
    {
      preheader: "Your Free Workspace trial has ended.",
      eyebrow: "Free Workspace",
      headline: "Your Free Workspace trial has ended",
      intro: [
        greeting(input),
        "Your first-signup Free Workspace trial is over. Access is now limited according to Bidvera’s billing rules.",
        "No payment was attempted. Choose a plan if you want to restore paid capabilities.",
        workspaceLine(input),
      ],
      banner: { tone: "warning", text: "Payment is required to continue with a paid plan." },
      cta: {
        label: "Choose a plan",
        href: billingAbsoluteUrl("/upgrade", env),
      },
      secondary: {
        label: "Manage billing",
        href: billingAbsoluteUrl("/billing", env),
      },
    },
    env,
  );
  return {
    subject: "Bidvera: your Free Workspace trial has ended",
    ...rendered,
  };
}

export function buildPaidSubscriptionActivatedEmail(
  input: BillingEmailPerson & {
    planName?: string | null;
    interval?: string | null;
    amountCents?: number | null;
    currency?: string | null;
    nextBillingDate?: Date | string | null;
    paymentMethod?: string | null;
  },
  env: BillingEmailEnv = process.env,
): BillingEmailPayload {
  const rendered = renderBillingEmail(
    {
      preheader: "Your Bidvera subscription is active.",
      eyebrow: "Payment confirmed",
      headline: "Your Bidvera subscription is active",
      intro: [
        greeting(input),
        "Thank you. Your paid plan is now active and ready to use.",
        workspaceLine(input),
      ],
      banner: { tone: "success", text: "Payment successful" },
      details: [
        { label: "Plan", value: input.planName?.trim() || "—" },
        { label: "Billing cycle", value: formatIntervalLabel(input.interval) },
        { label: "Amount", value: formatEmailAmount(input.amountCents, input.currency) },
        { label: "Next billing date", value: formatEmailDate(input.nextBillingDate) },
        { label: "Payment method", value: sanitizePaymentMethodDisplay(input.paymentMethod) },
      ],
      cta: {
        label: "Go to your workspace",
        href: billingAbsoluteUrl("/dashboard", env),
      },
      secondary: {
        label: "Manage billing",
        href: billingAbsoluteUrl("/billing", env),
      },
    },
    env,
  );
  return {
    subject: "Bidvera: payment successful — subscription active",
    ...rendered,
  };
}

export function buildPaymentFailedEmail(
  input: BillingEmailPerson & {
    planName?: string | null;
    graceUntil?: Date | string | null;
  },
  env: BillingEmailEnv = process.env,
): BillingEmailPayload {
  const grace = formatEmailDate(input.graceUntil);
  const rendered = renderBillingEmail(
    {
      preheader: "We could not complete your Bidvera payment.",
      eyebrow: "Billing",
      headline: "We could not complete your payment",
      intro: [
        greeting(input),
        "Your payment could not be processed. Update your billing details to keep your Bidvera plan active.",
        grace !== "—"
          ? `If a grace period applies, access can continue until ${grace}.`
          : "Please retry payment from the billing page when you are ready.",
        workspaceLine(input),
      ],
      banner: { tone: "warning", text: "Action needed: update billing" },
      details: [
        { label: "Plan", value: input.planName?.trim() || "—" },
        { label: "Grace until", value: grace },
      ],
      cta: {
        label: "Update billing",
        href: billingAbsoluteUrl("/billing", env),
      },
    },
    env,
  );
  return {
    subject: "Bidvera: payment could not be completed",
    ...rendered,
  };
}

export function buildSubscriptionCancellationEmail(
  input: BillingEmailPerson & {
    planName?: string | null;
    accessUntil?: Date | string | null;
  },
  env: BillingEmailEnv = process.env,
): BillingEmailPayload {
  const until = formatEmailDate(input.accessUntil);
  const rendered = renderBillingEmail(
    {
      preheader: "Your Bidvera cancellation is confirmed.",
      eyebrow: "Subscription",
      headline: "Your cancellation is confirmed",
      intro: [
        greeting(input),
        until !== "—"
          ? `Your ${input.planName?.trim() || "Bidvera"} plan will remain available until ${until}. After that date, paid access ends.`
          : `Your ${input.planName?.trim() || "Bidvera"} plan will not renew.`,
        "You can resubscribe from billing at any time if you want to continue.",
        workspaceLine(input),
      ],
      details: [
        { label: "Plan", value: input.planName?.trim() || "—" },
        { label: "Access until", value: until },
      ],
      cta: {
        label: "Manage subscription",
        href: billingAbsoluteUrl("/billing", env),
      },
    },
    env,
  );
  return {
    subject: "Bidvera: cancellation confirmed",
    ...rendered,
  };
}

export function buildPaidRenewalReminderEmail(
  input: BillingEmailPerson & {
    daysRemaining?: number | null;
    planName?: string | null;
    renewalDate?: Date | string | null;
    amountCents?: number | null;
    currency?: string | null;
    interval?: string | null;
  },
  env: BillingEmailEnv = process.env,
): BillingEmailPayload {
  const date = formatEmailDate(input.renewalDate);
  const days =
    input.daysRemaining != null && Number.isFinite(input.daysRemaining)
      ? Math.max(0, Math.round(input.daysRemaining))
      : null;
  const rendered = renderBillingEmail(
    {
      preheader: `Your ${input.planName?.trim() || "Bidvera"} plan renews soon.`,
      eyebrow: "Upcoming renewal",
      headline:
        days === 1
          ? `Your ${input.planName?.trim() || "plan"} renews tomorrow`
          : `Your ${input.planName?.trim() || "plan"} renews on ${date}`,
      intro: [
        greeting(input),
        "This is a reminder for your paid Bidvera subscription. Free Workspace and first-signup trials are not billed by this notice.",
        workspaceLine(input),
      ],
      details: [
        { label: "Plan", value: input.planName?.trim() || "—" },
        { label: "Renewal date", value: date },
        { label: "Amount", value: formatEmailAmount(input.amountCents, input.currency) },
        { label: "Billing cycle", value: formatIntervalLabel(input.interval) },
      ],
      cta: {
        label: "Manage subscription",
        href: billingAbsoluteUrl("/billing", env),
      },
    },
    env,
  );
  return {
    subject: `Bidvera: ${input.planName?.trim() || "your plan"} renews ${date !== "—" ? `on ${date}` : "soon"}`,
    ...rendered,
  };
}

/** Stripe-managed card trial only — may mention automatic billing. */
export function buildStripeCardTrialEndingEmail(
  input: BillingEmailPerson & {
    planName?: string | null;
    trialEndDate?: Date | string | null;
    amountCents?: number | null;
    currency?: string | null;
  },
  env: BillingEmailEnv = process.env,
): BillingEmailPayload {
  const end = formatEmailDate(input.trialEndDate);
  const amount = formatEmailAmount(input.amountCents, input.currency);
  const rendered = renderBillingEmail(
    {
      preheader: "Your Stripe card trial ends soon.",
      eyebrow: "Card trial",
      headline: "Your card trial ends soon",
      intro: [
        greeting(input),
        `Your ${input.planName?.trim() || "paid"} card trial ${end !== "—" ? `ends on ${end}` : "is ending soon"}.`,
        amount !== "—"
          ? `Unless you cancel, the selected plan starts automatically and your payment method will be billed ${amount}.`
          : "Unless you cancel, the selected plan starts automatically and your payment method will be billed.",
        workspaceLine(input),
      ],
      banner: {
        tone: "info",
        text: "This is a Stripe-managed card trial, not the Free Workspace first-signup trial.",
      },
      details: [
        { label: "Plan", value: input.planName?.trim() || "—" },
        { label: "Trial ends", value: end },
        { label: "Upcoming amount", value: amount },
      ],
      cta: {
        label: "Manage billing",
        href: billingAbsoluteUrl("/billing", env),
      },
    },
    env,
  );
  return {
    subject: "Bidvera: your card trial ends soon",
    ...rendered,
  };
}

export function buildGenericBillingNoticeEmail(
  input: BillingEmailPerson & {
    headline: string;
    message: string;
    ctaLabel?: string;
  },
  env: BillingEmailEnv = process.env,
): BillingEmailPayload {
  const rendered = renderBillingEmail(
    {
      headline: input.headline,
      intro: [greeting(input), input.message, workspaceLine(input)],
      cta: {
        label: input.ctaLabel ?? "Manage billing",
        href: billingAbsoluteUrl("/billing", env),
      },
      secondary: {
        label: "Upgrade",
        href: billingAbsoluteUrl("/upgrade", env),
      },
    },
    env,
  );
  return {
    subject: `Bidvera: ${input.headline}`,
    ...rendered,
  };
}
