import type { VerificationAuditAction } from "@/domain/evidence-verification";
import { prisma } from "@/lib/db";
import { logInfo, trackEvent } from "@/services/observability";
import type { Prisma } from "@prisma/client";

export async function recordVerificationAudit(input: {
  companyId: string;
  tenderId: string;
  requirementId: string;
  evidenceId?: string | null;
  userId?: string | null;
  action: VerificationAuditAction;
  snapshot: Record<string, unknown>;
}) {
  await prisma.requirementVerificationAudit.create({
    data: {
      companyId: input.companyId,
      tenderId: input.tenderId,
      requirementId: input.requirementId,
      evidenceId: input.evidenceId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      snapshot: input.snapshot as Prisma.InputJsonValue,
    },
  });

  const auditMap: Record<VerificationAuditAction, string> = {
    EVIDENCE_FOUND: "EVIDENCE_FOUND",
    VERIFICATION_REQUESTED: "VERIFICATION_REQUESTED",
    VERIFIED: "VERIFIED",
    VERIFICATION_REJECTED: "VERIFICATION_REJECTED",
    EVIDENCE_UPDATED: "EVIDENCE_UPDATED",
  };

  await trackEvent({
    action: auditMap[input.action] as Parameters<typeof trackEvent>[0]["action"],
    companyId: input.companyId,
    userId: input.userId ?? undefined,
    metadata: {
      tenderId: input.tenderId,
      requirementId: input.requirementId,
      evidenceId: input.evidenceId,
      verificationAction: input.action,
    },
  }).catch(() => undefined);
}

export async function auditEvidenceFoundBatch(input: {
  companyId: string;
  tenderId: string;
  items: Array<{
    requirementId: string;
    evidenceId: string;
    sourcePage: number | null;
    documentId?: string | null;
  }>;
}) {
  if (input.items.length === 0) return;

  const startedAt = Date.now();
  const {
    chunkArray,
    ANALYSIS_WRITE_CHUNK_SIZE,
    buildEvidenceFoundBatchRows,
  } = await import("@/services/analysis-batch-writes");

  const { audits, auditLogs } = buildEvidenceFoundBatchRows(input);
  let auditBatches = 0;
  let dbWrites = 0;

  for (const chunk of chunkArray(audits, ANALYSIS_WRITE_CHUNK_SIZE)) {
    await prisma.requirementVerificationAudit.createMany({
      data: chunk.map((a) => ({
        companyId: a.companyId,
        tenderId: a.tenderId,
        requirementId: a.requirementId,
        evidenceId: a.evidenceId,
        userId: a.userId,
        action: a.action,
        snapshot: a.snapshot as Prisma.InputJsonValue,
      })),
    });
    auditBatches += 1;
    dbWrites += 1;
  }

  for (const chunk of chunkArray(auditLogs, ANALYSIS_WRITE_CHUNK_SIZE)) {
    await prisma.auditLog.createMany({
      data: chunk.map((a) => ({
        action: a.action,
        companyId: a.companyId,
        userId: a.userId,
        metadata: a.metadata as Prisma.InputJsonValue,
      })),
    });
    auditBatches += 1;
    dbWrites += 1;
  }

  logInfo("evidence.audit_batch", {
    tenderId: input.tenderId,
    companyId: input.companyId,
    itemCount: input.items.length,
    auditBatches,
    dbWrites,
    durationMs: Date.now() - startedAt,
  });
}
