/**
 * Bounded batch helpers for high-volume analysis write paths.
 * Pure utilities — keep chunk size small enough for Neon round-trips.
 */

export const ANALYSIS_WRITE_CHUNK_SIZE = 50;

export function chunkArray<T>(items: readonly T[], size = ANALYSIS_WRITE_CHUNK_SIZE): T[][] {
  if (size < 1) throw new Error("chunk size must be >= 1");
  if (items.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export type SeedTaskWriteRow = {
  companyId: string;
  tenderId: string;
  kind: string;
  title: string;
  description: string | null;
  requiredResponse: string | null;
  department: string | null;
  priority: string;
  deadline: Date | null;
  dedupeKey: string;
  requirementId: string | null;
  riskId: string | null;
  missingDocId: string | null;
  clarificationId: string | null;
  createdById: string | null;
  status: "PENDING";
};

export type SeedEventWriteRow = {
  companyId: string;
  taskId: string;
  actorUserId: string | null;
  eventType: "CREATED";
  toStatus: "PENDING";
  message: string;
};

export type SeedVerificationAuditWriteRow = {
  companyId: string;
  tenderId: string;
  requirementId: string;
  evidenceId: null;
  userId: string | null;
  action: "VERIFICATION_REQUESTED";
  snapshot: {
    taskId: string;
    kind: string;
    title: string;
  };
};

export type SeedAuditLogWriteRow = {
  action: "VERIFICATION_REQUESTED";
  companyId: string;
  userId: string | null;
  metadata: {
    tenderId: string;
    requirementId: string;
    evidenceId: null;
    verificationAction: "VERIFICATION_REQUESTED";
  };
};

/** Map candidates + created task ids into event/audit batch rows (candidate order). */
export function buildSeedSideEffectRows(input: {
  companyId: string;
  tenderId: string;
  actorUserId: string | null;
  candidatesInOrder: Array<{
    dedupeKey: string;
    kind: string;
    title: string;
    requirementId?: string | null;
  }>;
  tasksByDedupeKey: Map<
    string,
    { id: string; kind: string; title: string; requirementId: string | null }
  >;
}): {
  events: SeedEventWriteRow[];
  verificationAudits: SeedVerificationAuditWriteRow[];
  auditLogs: SeedAuditLogWriteRow[];
} {
  const events: SeedEventWriteRow[] = [];
  const verificationAudits: SeedVerificationAuditWriteRow[] = [];
  const auditLogs: SeedAuditLogWriteRow[] = [];

  for (const c of input.candidatesInOrder) {
    const task = input.tasksByDedupeKey.get(c.dedupeKey);
    if (!task) continue;

    events.push({
      companyId: input.companyId,
      taskId: task.id,
      actorUserId: input.actorUserId,
      eventType: "CREATED",
      toStatus: "PENDING",
      message: `Auto-seeded from analysis: ${c.kind}`,
    });

    if (c.requirementId && c.dedupeKey.includes(":verify:")) {
      verificationAudits.push({
        companyId: input.companyId,
        tenderId: input.tenderId,
        requirementId: c.requirementId,
        evidenceId: null,
        userId: input.actorUserId,
        action: "VERIFICATION_REQUESTED",
        snapshot: {
          taskId: task.id,
          kind: c.kind,
          title: c.title,
        },
      });
      auditLogs.push({
        action: "VERIFICATION_REQUESTED",
        companyId: input.companyId,
        userId: input.actorUserId,
        metadata: {
          tenderId: input.tenderId,
          requirementId: c.requirementId,
          evidenceId: null,
          verificationAction: "VERIFICATION_REQUESTED",
        },
      });
    }
  }

  return { events, verificationAudits, auditLogs };
}

export type EvidenceFoundAuditWriteRow = {
  companyId: string;
  tenderId: string;
  requirementId: string;
  evidenceId: string;
  userId: null;
  action: "EVIDENCE_FOUND";
  snapshot: {
    sourcePage: number | null;
    documentId: string | null;
  };
};

export type EvidenceFoundAuditLogWriteRow = {
  action: "EVIDENCE_FOUND";
  companyId: string;
  userId: null;
  metadata: {
    tenderId: string;
    requirementId: string;
    evidenceId: string;
    verificationAction: "EVIDENCE_FOUND";
  };
};

export function buildEvidenceFoundBatchRows(input: {
  companyId: string;
  tenderId: string;
  items: Array<{
    requirementId: string;
    evidenceId: string;
    sourcePage: number | null;
    documentId?: string | null;
  }>;
}): {
  audits: EvidenceFoundAuditWriteRow[];
  auditLogs: EvidenceFoundAuditLogWriteRow[];
} {
  const audits: EvidenceFoundAuditWriteRow[] = [];
  const auditLogs: EvidenceFoundAuditLogWriteRow[] = [];
  for (const item of input.items) {
    audits.push({
      companyId: input.companyId,
      tenderId: input.tenderId,
      requirementId: item.requirementId,
      evidenceId: item.evidenceId,
      userId: null,
      action: "EVIDENCE_FOUND",
      snapshot: {
        sourcePage: item.sourcePage,
        documentId: item.documentId ?? null,
      },
    });
    auditLogs.push({
      action: "EVIDENCE_FOUND",
      companyId: input.companyId,
      userId: null,
      metadata: {
        tenderId: input.tenderId,
        requirementId: item.requirementId,
        evidenceId: item.evidenceId,
        verificationAction: "EVIDENCE_FOUND",
      },
    });
  }
  return { audits, auditLogs };
}
