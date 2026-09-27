/**
 * Pending checkout is stored on Company, never on the live Subscription row.
 * Abandoned checkout must leave current access unchanged.
 * Pending is never proof of payment.
 */

import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { evaluateSubscriptionAccess } from "@/services/billing/lifecycle";
import type { BillingInterval } from "@prisma/client";

export const PENDING_CHECKOUT_STORAGE_UNAVAILABLE =
  "Checkout cannot start because billing checkout storage is not ready.";

export type PendingCheckoutRecord = {
  provider: "stripe" | "paypal";
  planId: string;
  interval: BillingInterval;
  providerRef: string | null;
  createdAt: string;
};

export function shouldPreserveSubscriptionOnCheckout(input: {
  status?: string | null;
  plan?: string | null;
  billingInterval?: BillingInterval | null;
  startedAt?: Date | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  gracePeriodEndsAt?: Date | null;
  cancelAtPeriodEnd?: boolean | null;
} | null | undefined): boolean {
  if (!input?.status) return false;
  return evaluateSubscriptionAccess({
    status: input.status as never,
    plan: input.plan ?? "TRIAL",
    billingInterval: input.billingInterval ?? null,
    startedAt: input.startedAt ?? null,
    currentPeriodStart: input.currentPeriodStart ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    gracePeriodEndsAt: input.gracePeriodEndsAt ?? null,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
  }).allowed;
}

export function parsePendingCheckout(value: unknown): PendingCheckoutRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const provider = row.provider;
  const planId = typeof row.planId === "string" ? row.planId.trim() : "";
  const interval = row.interval;
  if (provider !== "stripe" && provider !== "paypal") return null;
  if (!planId) return null;
  if (interval !== "MONTH" && interval !== "YEAR") return null;
  return {
    provider,
    planId,
    interval,
    providerRef: typeof row.providerRef === "string" && row.providerRef.trim()
      ? row.providerRef.trim()
      : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
  };
}

export function isStripeCheckoutSessionRef(ref: string | null | undefined): boolean {
  return typeof ref === "string" && ref.startsWith("cs_");
}

export function isMissingPendingCheckoutColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  return (
    code === "P2022" ||
    /column .*pendingCheckout/i.test(message) ||
    /Unknown argument `pendingCheckout`/i.test(message)
  );
}

export function pendingCheckoutStorageError(error: unknown): AppError | null {
  if (!isMissingPendingCheckoutColumn(error)) return null;
  return new AppError(ErrorCode.UPSTREAM, PENDING_CHECKOUT_STORAGE_UNAVAILABLE, 503);
}

/** Latest pending checkout wins; stale session/plan must be rejected, not activated. */
export function assertPendingCheckoutMatches(input: {
  pending: PendingCheckoutRecord;
  provider: "stripe" | "paypal";
  planId: string;
  checkoutSessionId?: string | null;
  providerSubscriptionId?: string | null;
}): void {
  if (input.pending.provider !== input.provider) {
    throw new AppError(ErrorCode.FORBIDDEN, "Checkout provider mismatch.", 403);
  }
  if (input.pending.planId !== input.planId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Plan does not match checkout session.", 403);
  }
  if (
    input.provider === "stripe" &&
    input.checkoutSessionId &&
    input.pending.providerRef &&
    input.pending.providerRef !== input.checkoutSessionId
  ) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Checkout session does not match pending checkout.",
      403,
    );
  }
  if (
    input.provider === "paypal" &&
    input.pending.providerRef &&
    input.providerSubscriptionId &&
    input.pending.providerRef !== input.providerSubscriptionId
  ) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Subscription id does not match checkout session.",
      403,
    );
  }
}

export function shouldClearPendingForRef(input: {
  pending: PendingCheckoutRecord | null;
  provider: "stripe" | "paypal";
  providerRef: string;
}): boolean {
  if (!input.pending) return false;
  if (input.pending.provider !== input.provider) return false;
  if (!input.pending.providerRef) return true;
  return input.pending.providerRef === input.providerRef;
}

export async function recordPendingCheckout(input: {
  companyId: string;
  provider: "stripe" | "paypal";
  planId: string;
  interval: BillingInterval;
  providerRef?: string | null;
}): Promise<void> {
  const payload: PendingCheckoutRecord = {
    provider: input.provider,
    planId: input.planId,
    interval: input.interval,
    providerRef: input.providerRef?.trim() || null,
    createdAt: new Date().toISOString(),
  };
  try {
    await prisma.company.update({
      where: { id: input.companyId },
      data: { pendingCheckout: payload } as never,
    });
  } catch (error) {
    const storage = pendingCheckoutStorageError(error);
    if (storage) throw storage;
    throw error;
  }
}

export async function readPendingCheckout(
  companyId: string,
): Promise<PendingCheckoutRecord | null> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });
    return parsePendingCheckout(
      (company as { pendingCheckout?: unknown } | null)?.pendingCheckout,
    );
  } catch (error) {
    if (isMissingPendingCheckoutColumn(error)) return null;
    throw error;
  }
}

export async function clearPendingCheckout(companyId: string): Promise<void> {
  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { pendingCheckout: null } as never,
    });
  } catch (error) {
    if (isMissingPendingCheckoutColumn(error)) return;
    throw error;
  }
}

export async function clearPendingCheckoutIfMatch(input: {
  companyId: string;
  provider: "stripe" | "paypal";
  providerRef: string;
}): Promise<void> {
  const pending = await readPendingCheckout(input.companyId);
  if (
    !shouldClearPendingForRef({
      pending,
      provider: input.provider,
      providerRef: input.providerRef,
    })
  ) {
    return;
  }
  await clearPendingCheckout(input.companyId);
}
