import { assertSameCompany, requireCompanyId } from "@/auth/session";
import { assertCanMutateTenderAnalysis, assertCanViewTenderAnalysis, canMutateTenderAnalysis } from "@/auth/tender-access";
import { getCanonicalTenderAnalysis } from "@/application/canonical-tender-analysis";
import { mapTenderDetailFromCanonical } from "@/application/tender-detail-from-canonical";
import {
  getPremiumFeatureAccess,
} from "@/services/entitlements/intelligence-projection";
import type { CompanyTenderFitBreakdown } from "@/domain/decision/company-fit";
import { displayFitScore } from "@/domain/decision/extraction-gate";
import type { TenderReadinessBreakdown } from "@/domain/decision/tender-readiness";
import type { TenderIntelligenceBreakdown } from "@/domain/tender-intelligence";
import { tenderFiltersSchema, tenderPackageUploadSchema } from "@/domain/schemas";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { analysisRateLimiter, uploadRateLimiter } from "@/lib/rate-limit";
import { enqueueJob } from "@/services/jobs";
import { trackEvent } from "@/services/observability";
import {
  messageForPhase,
  progressForPhase,
} from "@/services/tender-processing/analysis-phases";
import { storageService } from "@/services/storage";
import { canAnalyze, consumeAnalysisCredit, getTrialUsage } from "@/services/usage";
import type { Prisma } from "@prisma/client";

export type FitBreakdownView = CompanyTenderFitBreakdown;
export type ReadinessBreakdownView = TenderReadinessBreakdown;
export type IntelligenceBreakdownView = TenderIntelligenceBreakdown;

export async function listTendersForSession(rawFilters?: unknown) {
  const { companyId } = await requireCompanyId();
  const filters = tenderFiltersSchema.parse(rawFilters ?? {});

  const where: Prisma.TenderWhereInput = {
    companyId,
    status: { not: "ARCHIVED" },
  };

  if (filters.query) {
    where.OR = [
      { title: { contains: filters.query, mode: "insensitive" } },
      { client: { contains: filters.query, mode: "insensitive" } },
    ];
  }

  if (filters.decision !== "ALL") {
    where.decision = { decision: filters.decision };
  }

  if (filters.deadline !== "ALL") {
    const now = new Date();
    if (filters.deadline === "OVERDUE") {
      where.deadline = { lt: now };
    } else {
      const days = filters.deadline === "7D" ? 7 : filters.deadline === "14D" ? 14 : 30;
      const until = new Date(now);
      until.setDate(until.getDate() + days);
      where.deadline = { gte: now, lte: until };
    }
  }

  const orderBy: Prisma.TenderOrderByWithRelationInput =
    filters.sort === "deadline_asc"
      ? { deadline: "asc" }
      : filters.sort === "deadline_desc"
        ? { deadline: "desc" }
        : filters.sort === "title_asc"
          ? { title: "asc" }
          : filters.sort === "fit_desc"
            ? { decision: { fitScore: "desc" } }
            : { analyzedAt: "desc" };

  const items = await prisma.tender.findMany({
    where,
    include: {
      decision: true,
      risks: { orderBy: { severity: "desc" }, take: 1 },
      nextActions: { orderBy: { priority: "asc" }, take: 1 },
    },
    orderBy,
    take: 100,
  });

  const mapped = items
    .filter((t) => {
      if (filters.risk === "ALL") return true;
      return t.risks[0]?.severity === filters.risk;
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      clientName: t.client,
      deadline: t.deadline?.toISOString() ?? null,
      fitScore: displayFitScore({
        fitScore: t.decision?.fitScore,
        fitBreakdown: t.decision?.fitBreakdown as CompanyTenderFitBreakdown | null,
      }),
      decision:
        (t.decision?.fitBreakdown as CompanyTenderFitBreakdown | null)
          ?.companyKnowledgeOnly === true
          ? null
          : (t.decision?.decision ?? null),
      riskLevel: t.risks[0]?.severity ?? null,
      analyzedAt: t.analyzedAt?.toISOString() ?? null,
      nextAction: t.nextActions[0]?.title ?? null,
      status: t.analysisStatus,
    }));

  return { items: mapped, total: mapped.length };
}

export async function getTenderDetailForSession(tenderId: string) {
  const { auth, companyId } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);

  /**
   * Shell for in-progress tenders — return status only.
   */
  const shell = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      decision: { select: { id: true, createdAt: true, isAiSuggested: true } },
      documents: { take: 1, orderBy: { createdAt: "asc" }, select: { fileName: true } },
      risks: { orderBy: { sortOrder: "asc" }, take: 1, select: { severity: true } },
      nextActions: { orderBy: { sortOrder: "asc" }, take: 1, select: { title: true } },
    },
  });
  if (!shell) throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  assertSameCompany(shell.companyId, companyId);

  if (!shell.decision) {
    return {
      id: shell.id,
      title: shell.title,
      clientName: shell.client,
      referenceCode: null,
      deadline: shell.deadline?.toISOString() ?? null,
      fitScore: null,
      decision: null,
      riskLevel: shell.risks[0]?.severity ?? null,
      analyzedAt: shell.analyzedAt?.toISOString() ?? null,
      nextAction: shell.nextActions[0]?.title ?? null,
      status: shell.analysisStatus,
      fileName: shell.documents[0]?.fileName ?? null,
      outcome: null,
      analysis: null,
      decisionDetail: null,
      requirements: [],
      risks: [],
      missingDocuments: [],
      evidence: [],
      nextActions: [],
      intelligence: null,
      historicalSignals: [],
      bidScore: null,
      canMutate: canMutateTenderAnalysis(auth.user.role),
    };
  }

  // ONE canonical analysis — identical for every authorized company role.
  const canonical = await getCanonicalTenderAnalysis(tenderId, companyId);
  const premiumAccess = await getPremiumFeatureAccess(companyId);

  return mapTenderDetailFromCanonical({
    canonical,
    premiumAccess,
    shellDecision: shell.decision,
    role: auth.user.role,
  });
}

export async function getTenderSourceForSession(
  tenderId: string,
  query: { requirementId?: string; evidenceId?: string; view?: "tender" | "company" },
) {
  const { auth, companyId } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      documents: { orderBy: { createdAt: "asc" } },
      requirements: true,
      evidence: true,
      decision: true,
    },
  });
  if (!tender) throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  assertSameCompany(tender.companyId, companyId);

  const { PLACEHOLDER_TENDER_EVIDENCE, NO_COMPANY_EVIDENCE_MESSAGE } = await import(
    "@/domain/provenance"
  );
  const view = query.view ?? "tender";

  const evidence = query.evidenceId
    ? tender.evidence.find((e) => e.id === query.evidenceId)
    : query.requirementId
      ? tender.evidence.find((e) => e.requirementId === query.requirementId)
      : undefined;

  const requirement = query.requirementId
    ? tender.requirements.find((r) => r.id === query.requirementId)
    : evidence?.requirementId
      ? tender.requirements.find((r) => r.id === evidence!.requirementId)
      : undefined;

  const resolveDoc = (documentId: string | null | undefined) => {
    if (documentId) {
      const doc = tender.documents.find((d) => d.id === documentId);
      if (doc) return { id: doc.id, name: doc.fileName };
    }
    const first = tender.documents[0];
    return first ? { id: first.id, name: first.fileName } : { id: null, name: null };
  };

  const humanVerified =
    Boolean(evidence?.teamTaskId) && evidence?.verificationStatus === "VERIFIED";

  if (view === "company") {
    const doc = resolveDoc(evidence?.documentId);
    const companyExcerpt =
      humanVerified && evidence?.verificationReason?.trim()
        ? evidence.verificationReason.trim()
        : null;
    const located = !!companyExcerpt;
    return {
      kind: "COMPANY_EVIDENCE" as const,
      documentName: doc.name,
      documentId: doc.id,
      pageNumber: null,
      section: null,
      excerpt: companyExcerpt ? companyExcerpt.slice(0, 2000) : null,
      basis: humanVerified ? ("DIRECT_SOURCE" as const) : ("UNKNOWN" as const),
      located,
      message: companyExcerpt ? null : NO_COMPANY_EVIDENCE_MESSAGE,
      requirementId: requirement?.id ?? null,
      evidenceId: evidence?.id ?? null,
    };
  }

  const tenderExcerptRaw = requirement?.evidence ?? null;
  const hasExcerpt =
    !!tenderExcerptRaw &&
    tenderExcerptRaw.trim().length > 0 &&
    tenderExcerptRaw !== PLACEHOLDER_TENDER_EVIDENCE;
  const page = requirement?.sourcePage ?? evidence?.sourcePage ?? null;
  const section = requirement?.sourceSection ?? evidence?.sourceSection ?? null;
  const doc = resolveDoc(evidence?.documentId);
  const located = hasExcerpt && (page != null || !!section?.trim());

  let basis: "DIRECT_SOURCE" | "AI_INTERPRETATION" | "COMPANY_INFORMATION" | "UNKNOWN" =
    "UNKNOWN";
  if (hasExcerpt) basis = "AI_INTERPRETATION";

  return {
    kind: "TENDER_SOURCE" as const,
    documentName: doc.name,
    documentId: doc.id,
    pageNumber: page,
    section,
    excerpt: hasExcerpt ? tenderExcerptRaw!.slice(0, 2000) : null,
    basis,
    located,
    message: located ? null : "Source could not be precisely located.",
    requirementId: requirement?.id ?? null,
    evidenceId: evidence?.id ?? null,
  };
}

export async function getDashboardDataForSession() {
  const { companyId } = await requireCompanyId();
  const [decisions, upcoming, highRisk, recent, usage] = await Promise.all([
    prisma.tenderDecision.groupBy({
      by: ["decision"],
      where: { companyId },
      _count: true,
    }),
    prisma.tender.findMany({
      where: {
        companyId,
        deadline: { gte: new Date() },
        decision: { decision: { not: "NO_BID" } },
      },
      include: { decision: true },
      orderBy: { deadline: "asc" },
      take: 4,
    }),
    prisma.tender.findMany({
      where: {
        companyId,
        risks: { some: { severity: { in: ["HIGH", "CRITICAL"] } } },
      },
      include: {
        decision: true,
        risks: { orderBy: { severity: "desc" }, take: 1 },
        nextActions: { take: 1 },
      },
      take: 3,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.tender.findMany({
      where: { companyId, decision: { isNot: null } },
      include: {
        decision: true,
        risks: { take: 1 },
        nextActions: { take: 1 },
      },
      orderBy: { analyzedAt: "desc" },
      take: 5,
    }),
    getTrialUsage(companyId),
  ]);

  const count = (d: "BID" | "REVIEW" | "NO_BID") =>
    decisions.find((x) => x.decision === d)?._count ?? 0;

  return {
    stats: {
      activeTenders: count("BID") + count("REVIEW"),
      bidCount: count("BID"),
      reviewCount: count("REVIEW"),
      noBidCount: count("NO_BID"),
      analysesRemaining: usage.analysesRemaining,
      analysesUsed: usage.analysesUsed,
      analysesLimit: usage.analysesLimit,
      estimatedHoursSaved: usage.estimatedHoursSaved,
    },
    usage,
    upcoming: upcoming.map((t) => ({
      tenderId: t.id,
      title: t.title,
      deadline: t.deadline!.toISOString(),
      decision: t.decision?.decision ?? null,
    })),
    highRisk: highRisk.map(mapListItem),
    recent: recent.map(mapListItem),
  };
}

function mapListItem(t: {
  id: string;
  title: string;
  client: string | null;
  deadline: Date | null;
  analyzedAt: Date | null;
  analysisStatus: string;
  decision: { decision: "BID" | "REVIEW" | "NO_BID"; fitScore: number } | null;
  risks: Array<{ severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }>;
  nextActions: Array<{ title: string }>;
}) {
  return {
    id: t.id,
    title: t.title,
    clientName: t.client,
    deadline: t.deadline?.toISOString() ?? null,
    fitScore: t.decision?.fitScore ?? null,
    decision: t.decision?.decision ?? null,
    riskLevel: t.risks[0]?.severity ?? null,
    analyzedAt: t.analyzedAt?.toISOString() ?? null,
    nextAction: t.nextActions[0]?.title ?? null,
    status: t.analysisStatus,
  };
}

export async function uploadAndQueueTender(input: {
  fileName: string;
  mimeType: string;
  fileSize: number;
  bytes: Buffer;
  title?: string;
  idempotencyKey?: string;
}): Promise<{ tenderId: string; reused: boolean }> {
  return uploadAndQueueTenderPackage({
    files: [
      {
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        bytes: input.bytes,
      },
    ],
    title: input.title,
    idempotencyKey: input.idempotencyKey,
  });
}

/**
 * Upload 1–5 files as one Tender Package (same tenderId).
 * Processing already loops every TenderDocument for that tender.
 */
export async function uploadAndQueueTenderPackage(input: {
  files: Array<{
    fileName: string;
    mimeType: string;
    fileSize: number;
    bytes: Buffer;
  }>;
  title?: string;
  idempotencyKey?: string;
  /** Ephemeral archive passwords by fileName — never persisted. */
  passwordsByFileName?: Record<string, string>;
}) {
  const { auth, companyId } = await requireCompanyId();
  assertCanMutateTenderAnalysis(auth.user.role);

  const { UPLOAD_LIMITS } = await import("@/config/server");
  if (input.files.length === 0) {
    throw new AppError(ErrorCode.VALIDATION, "At least one file is required.", 400);
  }
  // Bound selected uploads (archives count as one selection each) before expansion.
  if (input.files.length > UPLOAD_LIMITS.maxFilesPerPackage) {
    throw new AppError(
      ErrorCode.VALIDATION,
      `A Tender Package accepts a maximum of ${UPLOAD_LIMITS.maxFilesPerPackage} documents.`,
      400,
    );
  }
  const selectedBytes = input.files.reduce((n, f) => n + f.bytes.byteLength, 0);
  if (selectedBytes > UPLOAD_LIMITS.maxPackageBytes) {
    throw new AppError(
      ErrorCode.VALIDATION,
      `Tender package exceeds the ${Math.floor(UPLOAD_LIMITS.maxPackageBytes / (1024 * 1024))}MB total size limit.`,
      400,
    );
  }

  // Canonical package-discovery boundary: inventory every eligible document,
  // expand ZIP/RAR, then reuse the same storage + analysis pipeline.
  const { discoverTenderPackage, buildPackageProvenanceMeta, assertPackageInventoryComplete } =
    await import("@/domain/tender-package/discover-tender-package");
  const discovered = await discoverTenderPackage(input.files, {
    passwordsByFileName: input.passwordsByFileName,
  });
  const expandedFiles = discovered.files;

  const packageMeta = tenderPackageUploadSchema.parse({
    files: expandedFiles.map((f) => ({
      fileName: f.fileName,
      fileSize: f.fileSize,
      mimeType: f.mimeType,
    })),
    title: input.title,
    idempotencyKey: input.idempotencyKey,
  });

  // Single rate-limit check (avoid double wait on hot path)
  await uploadRateLimiter.check(`upload:${companyId}`);
  await analysisRateLimiter.check(`analysis:${companyId}`);

  if (!(await canAnalyze(companyId))) {
    const { getAnalysisBlockReason, analysisBlockMessage } = await import("@/services/usage");
    const reason = await getAnalysisBlockReason(companyId);
    throw new AppError(
      reason === "trial_expired" ? ErrorCode.TRIAL_EXPIRED : ErrorCode.TRIAL_EXHAUSTED,
      reason ? analysisBlockMessage(reason) : "Analysis is not available.",
      402,
    );
  }

  if (packageMeta.idempotencyKey) {
    const existing = await prisma.tender.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId,
          idempotencyKey: packageMeta.idempotencyKey,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return {
        tenderId: existing.id,
        reused: true as const,
        discoveredFileCount: 0,
        sourceUploadCount: input.files.length,
        packageStatus: "PACKAGE_READY" as const,
      };
    }
  }

  await consumeAnalysisCredit(companyId);

  const primaryName = packageMeta.files[0]!.fileName;
  const tender = await prisma.tender.create({
    data: {
      companyId,
      title:
        packageMeta.title ??
        (packageMeta.files.length === 1
          ? primaryName.replace(/\.[^.]+$/, "")
          : `Tender package (${discovered.discoveredFileCount} files)`),
      status: "DRAFT",
      analysisStatus: "UPLOADING",
      idempotencyKey: packageMeta.idempotencyKey,
    },
    select: { id: true },
  });

  // Parallel disk writes — then one DB createMany (discovered documents only)
  const storedDocs = await Promise.all(
    expandedFiles.map(async (file, i) => {
      const meta = packageMeta.files[i]!;
      const stored = await storageService.putObject({
        companyId,
        tenderId: tender.id,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        body: file.bytes,
      });
      const provenance = buildPackageProvenanceMeta(file, discovered.discoveredFileCount);
      return {
        tenderId: tender.id,
        companyId,
        fileName: meta.fileName,
        storageKey: stored.storageKey,
        mimeType: stored.detectedMimeType || meta.mimeType,
        fileSize: stored.byteLength,
        checksumSha256: stored.checksumSha256,
        processingStatus: "STORED" as const,
        extractionMeta: {
          packageProvenance: provenance,
          discoveryStatus: "STORED",
          intakeRecovery: file.recovery
            ? {
                recoveryClass: file.recovery.recoveryClass,
                recoveryResult: file.recovery.recoveryResult,
                extractionQuality: file.recovery.extractionQuality,
                adapterUsed: file.recovery.adapterUsed,
                ocrUsed: file.recovery.ocrUsed,
                ocrRequired: file.recovery.ocrRequired,
                ocrConfidence: file.recovery.ocrConfidence,
                forceOcr: file.recovery.forceOcr,
                originalSha256: file.recovery.originalSha256,
                recoveredSha256: file.recovery.recoveredSha256,
                warnings: file.recovery.warnings,
                userMessage: file.recovery.userMessage,
                attempts: file.recovery.attempts.map((a) => ({
                  method: a.method,
                  success: a.success,
                  detail: a.detail,
                  changedBytes: a.changedBytes,
                })),
                derived: file.recovery.derived,
              }
            : null,
        } as import("@prisma/client").Prisma.InputJsonValue,
      };
    }),
  );

  assertPackageInventoryComplete({
    discoveredFileCount: discovered.discoveredFileCount,
    persistedFileCount: storedDocs.length,
  });

  await prisma.tenderDocument.createMany({ data: storedDocs });

  // Persist canonical IntakeReport for Document Intelligence / decision gates.
  const { persistIntakeReport } = await import("@/domain/universal-intake/persist-intake-report");
  const intakeReportKey = await persistIntakeReport({
    companyId,
    tenderId: tender.id,
    report: discovered.intakeReport,
  });

  // Stamp intake report summary on every document meta (no buffers).
  const docs = await prisma.tenderDocument.findMany({
    where: { tenderId: tender.id },
    select: { id: true, extractionMeta: true },
  });
  await Promise.all(
    docs.map((d) => {
      const prior =
        d.extractionMeta && typeof d.extractionMeta === "object" && !Array.isArray(d.extractionMeta)
          ? (d.extractionMeta as Record<string, unknown>)
          : {};
      return prisma.tenderDocument.update({
        where: { id: d.id },
        data: {
          extractionMeta: {
            ...prior,
            intakeReportKey,
            intakeReportSummary: {
              packageId: discovered.intakeReport.packageId,
              status: discovered.intakeReport.status,
              uiState: discovered.intakeReport.uiState,
              packageCompleteness: discovered.intakeReport.packageCompleteness,
              documentReadiness: discovered.intakeReport.documentReadiness,
              mayProceedToScoring: discovered.intakeReport.mayProceedToScoring,
              userNotices: discovered.intakeReport.userNotices,
              unsupportedFileCount: discovered.intakeReport.unsupportedFileCount,
              corruptedFileCount: discovered.intakeReport.corruptedFileCount,
            },
          } as import("@prisma/client").Prisma.InputJsonValue,
        },
      });
    }),
  );

  await Promise.all([
    enqueueJob({
      companyId,
      tenderId: tender.id,
      type: "RUN_TENDER_ANALYSIS",
      payload: {
        tenderId: tender.id,
        intakeReportKey,
        intakeUiState: discovered.intakeReport.uiState,
      },
      idempotencyKey: `analysis:${tender.id}`,
    }),
    prisma.tender.update({
      where: { id: tender.id },
      data: {
        analysisStatus: "PROCESSING",
        analysisPhase: `INTAKE:${discovered.intakeReport.uiState}`,
      },
    }),
  ]);

  // Fire-and-forget analytics — do not block upload response
  void trackEvent({
    action: "TENDER_UPLOADED",
    companyId,
    userId: auth.user.id,
    metadata: {
      tenderId: tender.id,
      sourceUploadCount: discovered.sourceUploadCount,
      discoveredFileCount: discovered.discoveredFileCount,
      packageStatus: discovered.status,
      fileNames: packageMeta.files.map((f) => f.fileName),
      totalBytes: expandedFiles.reduce((n, f) => n + f.fileSize, 0),
    },
  }).catch(() => undefined);

  return {
    tenderId: tender.id,
    reused: false as const,
    discoveredFileCount: discovered.discoveredFileCount,
    sourceUploadCount: discovered.sourceUploadCount,
    packageStatus: discovered.status,
    intakeStatus: discovered.intake.status,
    intakeUserNotices: discovered.intake.userNotices,
    documentReadiness: discovered.intake.documentReadiness,
    packageCompleteness: discovered.intake.packageCompleteness,
    intakeUiState: discovered.intakeReport.uiState,
    intakeReport: {
      status: discovered.intakeReport.status,
      uiState: discovered.intakeReport.uiState,
      packageCompleteness: discovered.intakeReport.packageCompleteness,
      documentReadiness: discovered.intakeReport.documentReadiness,
      userNotices: discovered.intakeReport.userNotices,
      mayProceedToScoring: discovered.intakeReport.mayProceedToScoring,
      analysisIncompleteReason: discovered.intakeReport.analysisIncompleteReason,
      fileStates: discovered.intakeReport.files.map((f) => ({
        name: f.originalName,
        state: f.state,
        recoveryClass: f.recoveryClass,
        message: f.message,
      })),
    },
  };
}

export async function getTenderAnalysisStatus(tenderId: string) {
  const { companyId } = await requireCompanyId();
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    select: {
      companyId: true,
      analysisStatus: true,
      analysisError: true,
      decision: { select: { decision: true } },
    },
  });
  if (!tender) throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  assertSameCompany(tender.companyId, companyId);

  // Read optional phase via raw SQL (works even if Prisma client is stale).
  let analysisPhase: string | null = null;
  try {
    const rows = await prisma.$queryRaw<Array<{ analysisPhase: string | null }>>`
      SELECT "analysisPhase" FROM "Tender" WHERE id = ${tenderId} LIMIT 1
    `;
    analysisPhase = rows[0]?.analysisPhase ?? null;
  } catch {
    analysisPhase = null;
  }

  return {
    status: tender.analysisStatus,
    progress: progressForPhase(analysisPhase, tender.analysisStatus),
    phase: analysisPhase,
    message: messageForPhase(
      analysisPhase,
      tender.analysisStatus,
      tender.analysisError,
      tender.decision?.decision,
    ),
  };
}
