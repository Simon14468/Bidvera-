import { prisma } from "@/lib/db";
import { logInfo } from "@/services/observability";
import type { Prisma } from "@prisma/client";

export type BillingAuditEventType =
  | "CHECKOUT_CREATED"
  | "PAYMENT_CONFIRMED"
  | "SUBSCRIPTION_ACTIVATED"
  | "SUBSCRIPTION_RENEWED"
  | "PAYMENT_FAILED"
  | "SUBSCRIPTION_CANCELED"
  | "REFUND"
  | "CHARGEBACK"
  | "DISPUTE"
  | "ENTITLEMENT_REVOKED"
  | "SUSPICIOUS_BILLING_ATTEMPT"
  | "WEBHOOK_REJECTED"
  | "WEBHOOK_DUPLICATE_IGNORED";

/** Structured billing audit — never log secrets or full payment payloads. */
export async function recordBillingAudit(input: {
  companyId?: string | null;
  subscriptionId?: string | null;
  eventType: BillingAuditEventType;
  metadata?: Record<string, unknown>;
}) {
  const safeMeta = sanitizeAuditMetadata(input.metadata);
  logInfo("billing.audit", {
    eventType: input.eventType,
    companyId: input.companyId ?? null,
    subscriptionId: input.subscriptionId ?? null,
    ...safeMeta,
  });

  if (input.companyId) {
    await prisma.subscriptionEvent.create({
      data: {
        companyId: input.companyId,
        subscriptionId: input.subscriptionId ?? null,
        eventType: input.eventType,
        metadata: safeMeta as Prisma.InputJsonValue,
      },
    });
  }
}

function sanitizeAuditMetadata(meta?: Record<string, unknown>): Record<string, unknown> {
  if (!meta) return {};
  const blocked = new Set([
    "secret",
    "token",
    "apikey",
    "api_key",
    "client_secret",
    "clientsecret",
    "card",
    "cvv",
    "cvc",
    "password",
    "rawpayload",
    "raw_payload",
    "fingerprint",
    "paymentfingerprint",
    "payment_fingerprint",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (blocked.has(key.toLowerCase()) || blocked.has(normalized)) continue;
    if (typeof value === "string" && value.length > 500) {
      out[key] = `${value.slice(0, 500)}…`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export { sanitizeAuditMetadata };
