/**
 * Upcoming-renewal reminders (7d / 3d / 24h) for ACTIVE paid subscriptions.
 *
 * Provider-agnostic: reads only the local subscription row + DB plan catalog.
 * Delivery reuses the existing notification service (in-app, deduped by
 * dedupeKey) and the existing SEND_EMAIL job queue (deduped by idempotencyKey).
 * Never invents amounts — the renewal amount comes from the DB plan.
 */

import { prisma } from "@/lib/db";
import { escapeHtml } from "@/lib/html";
import { enqueueJob } from "@/services/jobs";
import { notificationService } from "@/services/notifications";
import { logInfo } from "@/services/observability";
import type { BillingInterval, Plan } from "@prisma/client";

export type RenewalReminderStage = "7d" | "3d" | "24h";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure: which reminder window applies right now. Uses server/UTC timestamps only.
 * Returns the most urgent applicable stage, or null outside all windows.
 */
export function resolveRenewalReminderStage(
  currentPeriodEnd: Date | null | undefined,
  now: Date,
): RenewalReminderStage | null {
  if (!currentPeriodEnd) return null;
  const msLeft = currentPeriodEnd.getTime() - now.getTime();
  if (msLeft <= 0) return null;
  if (msLeft <= DAY_MS) return "24h";
  if (msLeft <= 3 * DAY_MS) return "3d";
  if (msLeft <= 7 * DAY_MS) return "7d";
  return null;
}

/**
 * Pure eligibility: only an ACTIVE paid subscription with a real future renewal
 * date, not scheduled for cancellation, and not Free Workspace / trial.
 */
export function isRenewalReminderEligible(input: {
  status: string;
  cancelAtPeriodEnd: boolean;
  isFreePlan: boolean;
  planSlug?: string | null;
  currentPeriodEnd: Date | null | undefined;
  now: Date;
}): boolean {
  if (input.status !== "ACTIVE") return false;
  if (input.cancelAtPeriodEnd) return false;
  if (input.isFreePlan) return false;
  if (input.planSlug === "free" || input.planSlug === "trial") return false;
  if (!input.currentPeriodEnd) return false;
  return input.currentPeriodEnd.getTime() > input.now.getTime();
}

/** Stable per-stage-per-period key so retries and reruns never duplicate. */
export function renewalReminderDedupeKey(input: {
  companyId: string;
  stage: RenewalReminderStage;
  currentPeriodEnd: Date;
}): string {
  const day = input.currentPeriodEnd.toISOString().slice(0, 10);
  return `billing:renewal:${input.stage}:${input.companyId}:${day}`;
}

function providerLabel(provider: string | null | undefined): string {
  if (provider === "paypal") return "PayPal";
  if (provider === "stripe") return "Stripe";
  return provider ?? "your payment provider";
}

function formatAmount(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function renewalAmountCents(
  plan: Pick<Plan, "monthlyPriceCents" | "annualPriceCents">,
  interval: BillingInterval | null,
): number | null {
  const cents =
    interval === "YEAR" ? plan.annualPriceCents : plan.monthlyPriceCents;
  return cents != null && cents > 0 ? cents : null;
}

export function buildRenewalReminderMessage(input: {
  stage: RenewalReminderStage;
  planName: string;
  amountCents: number | null;
  currency: string;
  interval: BillingInterval | null;
  provider: string | null;
  renewsAt: Date;
}): { title: string; message: string } {
  const dateLabel = input.renewsAt.toISOString().slice(0, 10);
  const title =
    input.stage === "24h"
      ? `Your ${input.planName} plan renews tomorrow`
      : `Your ${input.planName} plan renews on ${dateLabel}`;
  const amountLine =
    input.amountCents != null
      ? `Your subscription will renew automatically for ${formatAmount(input.amountCents, input.currency)} (${
          input.interval === "YEAR" ? "yearly" : "monthly"
        }) via ${providerLabel(input.provider)}.`
      : `Your subscription will renew automatically via ${providerLabel(input.provider)}.`;
  return {
    title,
    message: `${amountLine} Renewal date: ${dateLabel}. Manage your subscription from the billing page.`,
  };
}

/**
 * Worker entry: send due renewal reminders. Idempotent (alert dedupeKey +
 * email job idempotencyKey), tenant-scoped, based on server dates only.
 */
export async function sendDueRenewalReminders(
  limit = 50,
  now: Date = new Date(),
): Promise<number> {
  const windowEnd = new Date(now.getTime() + 7 * DAY_MS);
  const candidates = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: { gt: now, lte: windowEnd },
      plan: { notIn: ["FREE", "TRIAL"] },
    },
    include: { billingPlan: true },
    take: limit,
  });

  let sent = 0;
  for (const sub of candidates) {
    if (!sub.currentPeriodEnd) continue;
    if (
      !isRenewalReminderEligible({
        status: sub.status,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        isFreePlan: sub.billingPlan?.isFree ?? false,
        planSlug: sub.billingPlan?.slug,
        currentPeriodEnd: sub.currentPeriodEnd,
        now,
      })
    ) {
      continue;
    }
    const stage = resolveRenewalReminderStage(sub.currentPeriodEnd, now);
    if (!stage) continue;

    const amountCents = sub.billingPlan
      ? renewalAmountCents(sub.billingPlan, sub.billingInterval)
      : null;
    const { title, message } = buildRenewalReminderMessage({
      stage,
      planName: sub.billingPlan?.name ?? sub.plan,
      amountCents,
      currency: sub.billingPlan?.currency ?? "USD",
      interval: sub.billingInterval,
      provider: sub.provider,
      renewsAt: sub.currentPeriodEnd,
    });
    const dedupeKey = renewalReminderDedupeKey({
      companyId: sub.companyId,
      stage,
      currentPeriodEnd: sub.currentPeriodEnd,
    });

    await notificationService.createInAppAlert({
      companyId: sub.companyId,
      tenderId: null,
      type: "SYSTEM",
      title,
      message,
      href: "/billing",
      dedupeKey,
    });

    const owners = await prisma.user.findMany({
      where: { companyId: sub.companyId, role: { in: ["OWNER", "ADMIN"] } },
      select: { email: true },
      take: 5,
    });
    for (const user of owners) {
      if (!user.email) continue;
      await enqueueJob({
        companyId: sub.companyId,
        type: "SEND_EMAIL",
        payload: {
          to: user.email,
          subject: `Bidvera: ${title}`,
          html: `<p>${escapeHtml(title)}</p><p>${escapeHtml(message)}</p><p><a href="/billing">Manage subscription</a></p>`,
          text: message,
        },
        idempotencyKey: `${dedupeKey}:${user.email}`,
      }).catch(() => null);
    }

    sent += 1;
  }

  if (sent > 0) {
    logInfo("billing.renewal_reminders_sent", { sent });
  }
  return sent;
}
