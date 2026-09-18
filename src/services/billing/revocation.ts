/**
 * Revoke paid entitlements on refund/chargeback — preserve customer data.
 */

import { prisma } from "@/lib/db";
import { recordBillingAudit } from "@/services/billing/audit";
import {
  extractRevocationReferenceIds,
  shouldSkipRevocation,
} from "@/services/billing/revocation-idempotency";
import { recordSubscriptionEvent } from "@/services/billing/subscription-state";
import type { RevocationReason } from "@/services/billing/revocation-types";

export type { RevocationReason } from "@/services/billing/revocation-types";

async function loadProcessedRevocationRefs(companyId: string): Promise<string[]> {
  const events = await prisma.subscriptionEvent.findMany({
    where: { companyId, eventType: "ENTITLEMENT_REVOKED" },
    select: { metadata: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return extractRevocationReferenceIds(events);
}

/**
 * Policy: confirmed refund/chargeback/dispute immediately removes paid access.
 * Historical tenders, decisions, and reports are never deleted.
 * Idempotent per providerReferenceId and terminal EXPIRED state.
 */
export async function revokePaidEntitlements(input: {
  companyId: string;
  reason: RevocationReason;
  provider: "stripe" | "paypal";
  providerReferenceId?: string;
}) {
  const existing = await prisma.subscription.findUnique({
    where: { companyId: input.companyId },
  });
  if (!existing) return null;

  const usage = await prisma.companyUsage.findUnique({
    where: { companyId: input.companyId },
  });
  const processedReferenceIds = await loadProcessedRevocationRefs(input.companyId);

  if (
    shouldSkipRevocation({
      status: existing.status,
      plan: existing.plan,
      analysesLimit: usage?.analysesLimit,
      providerReferenceId: input.providerReferenceId,
      processedReferenceIds,
    })
  ) {
    return existing;
  }

  const wasPaid =
    existing.status === "ACTIVE" ||
    existing.status === "PAST_DUE" ||
    existing.status === "PAYMENT_FAILED" ||
    (existing.plan !== "TRIAL" && existing.status !== "TRIALING");

  if (!wasPaid) return existing;

  const updated = await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.update({
      where: { companyId: input.companyId },
      data: {
        status: "EXPIRED",
        cancelAtPeriodEnd: false,
        canceledAt: existing.canceledAt ?? new Date(),
        gracePeriodEndsAt: null,
        currentPeriodEnd: new Date(),
      },
    });

    await tx.companyUsage.updateMany({
      where: { companyId: input.companyId },
      data: { analysesLimit: 0 },
    });

    return sub;
  });

  const auditType =
    input.reason === "chargeback"
      ? "CHARGEBACK"
      : input.reason === "dispute"
        ? "DISPUTE"
        : "REFUND";

  await recordBillingAudit({
    companyId: input.companyId,
    subscriptionId: existing.id,
    eventType: auditType,
    metadata: {
      provider: input.provider,
      providerReferenceId: input.providerReferenceId ?? null,
      previousStatus: existing.status,
      previousPlan: existing.plan,
    },
  });

  await recordSubscriptionEvent({
    companyId: input.companyId,
    subscriptionId: existing.id,
    eventType: "ENTITLEMENT_REVOKED",
    fromStatus: existing.status,
    toStatus: "EXPIRED",
    fromPlan: existing.plan,
    toPlan: existing.plan,
    metadata: {
      reason: input.reason,
      provider: input.provider,
      providerReferenceId: input.providerReferenceId ?? null,
    },
  });

  return updated;
}

/** Resolve company from PayPal subscription billing_agreement_id (provider subscription id). */
export async function revokePayPalSubscriptionPayment(input: {
  providerSubscriptionId: string;
  reason: "refund" | "chargeback";
  providerReferenceId: string;
}) {
  const existing = await prisma.subscription.findFirst({
    where: { providerSubscriptionId: input.providerSubscriptionId, provider: "paypal" },
  });
  if (!existing) return null;
  return revokePaidEntitlements({
    companyId: existing.companyId,
    reason: input.reason,
    provider: "paypal",
    providerReferenceId: input.providerReferenceId,
  });
}

