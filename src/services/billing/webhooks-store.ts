import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { recordBillingAudit } from "@/services/billing/audit";
import { enqueueJob } from "@/services/jobs";
import type { BillingProvider, Prisma } from "@prisma/client";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickShortId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 200
    ? value
    : undefined;
}

/** Hash the verified live payload for integrity — never a substitute for provider+eventId idempotency. */
export function hashWebhookPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Persist only operational webhook metadata. Provider verification and lifecycle
 * processing use the in-memory payload; this must never store PAN, CVC, emails,
 * addresses, last4, fingerprints, payment methods, or subscriber/payer PII.
 */
export function sanitizeWebhookPayloadForStorage(payload: unknown): Prisma.InputJsonValue {
  const root = asRecord(payload);
  if (!root) {
    return { stored: "sanitized" };
  }

  const data = asRecord(root.data);
  const dataObject = data ? asRecord(data.object) : null;
  const resource = asRecord(root.resource) ?? dataObject;
  const metadata = resource ? asRecord(resource.metadata) : null;

  const stored: Record<string, unknown> = { stored: "sanitized" };

  const objectType =
    pickShortId(root.object) ??
    pickShortId(resource?.object) ??
    pickShortId(root.resource_type);
  if (objectType) stored.object = objectType;

  if (typeof root.livemode === "boolean") stored.livemode = root.livemode;
  if (typeof root.created === "number") stored.created = root.created;
  if (typeof root.create_time === "string" && root.create_time.length <= 40) {
    stored.createTime = root.create_time;
  }

  const resourceId = pickShortId(resource?.id);
  if (resourceId) stored.resourceId = resourceId;

  const resourceStatus = pickShortId(resource?.status);
  if (resourceStatus) stored.resourceStatus = resourceStatus;

  const resourceObject = pickShortId(resource?.object);
  if (resourceObject) stored.resourceObject = resourceObject;

  const customId = pickShortId(resource?.custom_id) ?? pickShortId(resource?.customId);
  if (customId) stored.customId = customId;

  const billingAgreementId = pickShortId(resource?.billing_agreement_id);
  if (billingAgreementId) stored.billingAgreementId = billingAgreementId;

  if (metadata) {
    const companyId = pickShortId(metadata.companyId);
    const planId = pickShortId(metadata.planId);
    const planSlug = pickShortId(metadata.planSlug);
    const interval = pickShortId(metadata.interval);
    if (companyId) stored.companyId = companyId;
    if (planId) stored.planId = planId;
    if (planSlug) stored.planSlug = planSlug;
    if (interval) stored.interval = interval;
  }

  return stored as Prisma.InputJsonValue;
}

export async function beginWebhookProcessing(input: {
  provider: BillingProvider;
  eventId: string;
  eventType: string;
  companyId?: string | null;
  payload: unknown;
}): Promise<{ duplicate: boolean; webhookEventId: string }> {
  const payloadHash = hashWebhookPayload(input.payload);
  const rawPayload = sanitizeWebhookPayloadForStorage(input.payload);

  try {
    const row = await prisma.webhookEvent.create({
      data: {
        provider: input.provider,
        eventId: input.eventId,
        eventType: input.eventType,
        status: "PROCESSING",
        payloadHash,
        companyId: input.companyId ?? null,
        rawPayload,
        attempts: 1,
      },
    });
    return { duplicate: false, webhookEventId: row.id };
  } catch {
    const existing = await prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: { provider: input.provider, eventId: input.eventId },
      },
    });
    if (!existing) {
      throw new Error("WEBHOOK_IDEMPOTENCY_FAILED");
    }

    if (existing.status === "PROCESSED" || existing.status === "IGNORED") {
      await recordBillingAudit({
        companyId: existing.companyId,
        eventType: "WEBHOOK_DUPLICATE_IGNORED",
        metadata: {
          provider: input.provider,
          eventId: input.eventId,
          eventType: input.eventType,
        },
      });
      return { duplicate: true, webhookEventId: existing.id };
    }

    if (existing.status === "PROCESSING") {
      const staleMs = Date.now() - existing.updatedAt.getTime();
      if (staleMs < 120_000) {
        return { duplicate: true, webhookEventId: existing.id };
      }
    }

    const claimed = await prisma.webhookEvent.updateMany({
      where: {
        id: existing.id,
        status: { in: ["RECEIVED", "FAILED", "PROCESSING"] },
      },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        payloadHash,
        rawPayload,
      },
    });

    if (claimed.count === 0) {
      await recordBillingAudit({
        companyId: existing.companyId,
        eventType: "WEBHOOK_DUPLICATE_IGNORED",
        metadata: {
          provider: input.provider,
          eventId: input.eventId,
          reason: "concurrent_claim_failed",
        },
      });
      return { duplicate: true, webhookEventId: existing.id };
    }

    return { duplicate: false, webhookEventId: existing.id };
  }
}

export async function markWebhookProcessed(id: string) {
  await prisma.webhookEvent.update({
    where: { id },
    data: { status: "PROCESSED", processedAt: new Date(), errorMessage: null },
  });
}

export async function markWebhookFailed(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Webhook failed";
  await prisma.webhookEvent.update({
    where: { id },
    data: {
      status: "FAILED",
      errorMessage: message.slice(0, 1000),
    },
  });
}

export async function markWebhookIgnored(id: string, reason?: string) {
  await prisma.webhookEvent.update({
    where: { id },
    data: {
      status: "IGNORED",
      processedAt: new Date(),
      errorMessage: reason?.slice(0, 500) ?? null,
    },
  });
}

/** Fast ACK path — queue heavy work when a system company exists; else process inline. */
export async function enqueueBillingWebhookJob(input: {
  companyId: string;
  provider: BillingProvider;
  webhookEventId: string;
  eventType: string;
}) {
  return enqueueJob({
    companyId: input.companyId,
    type: "PROCESS_BILLING_WEBHOOK",
    payload: {
      webhookEventId: input.webhookEventId,
      provider: input.provider,
      eventType: input.eventType,
    },
    idempotencyKey: `billing-webhook:${input.provider}:${input.webhookEventId}`,
  });
}
