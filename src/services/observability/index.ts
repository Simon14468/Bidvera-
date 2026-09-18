import { prisma } from "@/lib/db";
import type { AuditAction, Prisma } from "@prisma/client";

export async function trackEvent(input: {
  action: AuditAction;
  companyId?: string | null;
  userId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipHash?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      companyId: input.companyId ?? null,
      userId: input.userId ?? null,
      metadata: input.metadata ?? undefined,
      ipHash: input.ipHash ?? null,
    },
  });
}

/** Structured server log — never log tender document contents. */
export function logInfo(event: string, meta?: Record<string, unknown>) {
  console.info(JSON.stringify({ level: "info", event, ...meta, ts: new Date().toISOString() }));
}

export function logError(event: string, meta?: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "error", event, ...meta, ts: new Date().toISOString() }));
}
