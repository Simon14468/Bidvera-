/**
 * Billing warning notifications (in-app + email) — best-effort, never blocks auth.
 */

import { enqueueJob } from "@/services/jobs";
import { notificationService } from "@/services/notifications";
import { logInfo } from "@/services/observability";
import { prisma } from "@/lib/db";
import { escapeHtml } from "@/lib/html";

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
  const owners = await prisma.user.findMany({
    where: { companyId: input.companyId, role: { in: ["OWNER", "ADMIN"] } },
    select: { email: true },
    take: 5,
  });

  const title =
    input.kind === "payment_failed"
      ? "Payment failed"
      : input.kind === "trial_expired"
        ? "Trial ended"
        : input.kind === "trial_ending"
          ? "Trial ending soon"
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
        ? "Your free trial has ended. Upgrade to continue using paid Bidvera capabilities."
        : input.kind === "trial_ending"
          ? "Your free trial ends soon. The selected plan starts automatically unless you cancel."
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

  const subject = `Bidvera: ${title}`;
  const html = `<p>${escapeHtml(message)}</p><p><a href="/billing">Manage billing</a> · <a href="/upgrade">Upgrade</a></p>`;

  for (const user of owners) {
    if (!user.email) continue;
    await enqueueJob({
      companyId: input.companyId,
      type: "SEND_EMAIL",
      payload: {
        to: user.email,
        subject,
        html,
        text: message,
      },
      idempotencyKey: `${dedupeKey}:${user.email}`,
    }).catch(() => null);
  }

  logInfo("billing.warning_enqueued", {
    companyId: input.companyId,
    kind: input.kind,
    recipients: owners.length,
  });
}
