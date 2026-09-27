/**
 * Billing warning notifications (in-app + email) — best-effort, never blocks auth.
 */

import { notificationService } from "@/services/notifications";
import { logInfo } from "@/services/observability";
import {
  buildFreeWorkspaceTrialExpiredEmail,
  buildGenericBillingNoticeEmail,
  buildPaymentFailedEmail,
  buildStripeCardTrialEndingEmail,
  enqueueCompanyBillingEmail,
  loadBillingEmailAudience,
} from "@/services/billing/emails";

export function buildBillingWarningEmailHtml(
  message: string,
  env: Record<string, string | undefined> = process.env,
): string {
  return buildGenericBillingNoticeEmail(
    {
      headline: "Billing update",
      message,
      firstName: "there",
    },
    env,
  ).html;
}

export async function enqueueBillingWarning(input: {
  companyId: string;
  kind:
    | "payment_failed"
    | "trial_expired"
    | "trial_ending"
    | "subscription_expired"
    | "grace_reminder";
  gracePeriodEndsAt: Date | null;
}) {
  const audience = await loadBillingEmailAudience(input.companyId).catch(() => null);

  const title =
    input.kind === "payment_failed"
      ? "Payment failed"
      : input.kind === "trial_expired"
        ? audience?.isFirstSignupTrial
          ? "Free Workspace trial ended"
          : "Trial ended"
        : input.kind === "trial_ending"
          ? "Card trial ending soon"
          : input.kind === "grace_reminder"
            ? "Grace period ending"
            : "Subscription expired";

  const graceLine = input.gracePeriodEndsAt
    ? ` Access continues until ${input.gracePeriodEndsAt.toISOString().slice(0, 10)} (grace).`
    : "";

  const message =
    input.kind === "payment_failed"
      ? `We could not process your payment.${graceLine} Update billing to keep Bidvera access.`
      : input.kind === "trial_expired"
        ? audience?.isFirstSignupTrial
          ? "Your Free Workspace trial has ended. Choose a plan to continue with paid Bidvera capabilities."
          : "Your trial has ended. Upgrade to continue using paid Bidvera capabilities."
        : input.kind === "trial_ending"
          ? "Your card trial ends soon. The selected plan starts automatically unless you cancel."
          : input.kind === "grace_reminder"
            ? `Your billing grace period is ending soon.${graceLine}`
            : "Your subscription period has ended. Renew or upgrade to restore access.";

  const dedupeKey = `billing:${input.kind}:${input.companyId}:${input.gracePeriodEndsAt?.toISOString().slice(0, 10) ?? "none"}`;

  await notificationService.createInAppAlert({
    companyId: input.companyId,
    tenderId: null,
    type: input.kind === "trial_expired" ? "TRIAL_LIMIT" : "SYSTEM",
    title,
    message,
    href: "/billing",
    dedupeKey,
  });

  const person = {
    firstName: audience?.firstName,
    companyName: audience?.companyName,
  };

  const email =
    input.kind === "payment_failed" || input.kind === "grace_reminder"
      ? buildPaymentFailedEmail({
          ...person,
          planName: audience?.planName,
          graceUntil: input.gracePeriodEndsAt,
        })
      : input.kind === "trial_expired" && audience?.isFirstSignupTrial
        ? buildFreeWorkspaceTrialExpiredEmail(person)
        : input.kind === "trial_ending"
          ? buildStripeCardTrialEndingEmail({
              ...person,
              planName: audience?.planName,
              trialEndDate: audience?.currentPeriodEnd ?? input.gracePeriodEndsAt,
              amountCents: audience?.amountCents,
              currency: audience?.currency,
            })
          : buildGenericBillingNoticeEmail({
              ...person,
              headline: title,
              message,
              ctaLabel: input.kind === "trial_expired" ? "Choose a plan" : "Manage billing",
            });

  await enqueueCompanyBillingEmail({
    companyId: input.companyId,
    subject: email.subject,
    html: email.html,
    text: email.text,
    dedupeKey,
  });

  logInfo("billing.warning_enqueued", {
    companyId: input.companyId,
    kind: input.kind,
    recipients: 1,
  });
}
