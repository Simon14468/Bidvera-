import type { CompanyKnowledge } from "@/domain/company-knowledge";
import {
  COMPANY_ONLY_MESSAGE,
  HISTORICAL_CANDIDATE_HEADLINE,
  assertKnowledgeInvariants,
  buildCompanyKnowledgeOnlyAnalysis,
  extractCompanyKnowledgeHeuristic,
  isCompanyEvidenceKind,
  matchAllRequirementsWithEvidence,
  missingDocumentsFromKnowledge,
  risksFromRelevantLimitations,
} from "@/domain/company-knowledge";
import { buildCanonicalRequirements, toHeuristicDraft, assertCanonicalRequirementInvariants, assertAnalysisReadyForCompletion, deadlineIsoToPersistableDate } from "@/domain/tender-requirements";
import {
  buildPageContextFromExtractMeta,
  buildPipelineTrustSnapshot,
  sanitizeAiExtractionDrafts,
  sanitizeRequirementProvenance,
  scanTenderContentForInjection,
  assertPipelineTrustSnapshotIntegrity,
} from "@/domain/ai-trust";
import type { SimilarCompanyLearningSignal } from "@/domain/learning";
import { EMPTY_LEARNING_SIGNAL } from "@/domain/learning";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { isProfileSparse } from "@/domain/decision/company-fit";
import { runDecisionEngine } from "@/domain/decision/engine";
import { toRuleProfile } from "@/domain/decision/types";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { parseStoredKnowledge, persistCompanyKnowledge } from "@/services/company-knowledge";
import { aiService } from "@/services/ai";
import { extractDocumentText, assessExtractQuality } from "@/services/document/extract";
import { buildAuthoritativeCorpus, isSourceTruncated } from "@/domain/extraction-corpus";
import { notificationService } from "@/services/notifications";
import { logInfo, logError, trackEvent } from "@/services/observability";
import { storageService } from "@/services/storage";
import { recordUsage, refundAnalysisCredit } from "@/services/usage";
import type { AnalysisStatus, Prisma, RequirementMatchStatus, TenderRequirement } from "@prisma/client";
import { ANALYSIS_PHASE } from "@/services/tender-processing/analysis-phases";
import { AnalysisPhaseTimer } from "@/services/tender-processing/phase-timing";

/**
 * Persist analysis status / optional phase.
 * Never throws into the extract pipeline — failures are logged and retried safely.
 */
async function setAnalysisStatus(
  tenderId: string,
  analysisStatus: AnalysisStatus,
  extra?: Parameters<typeof prisma.tender.update>[0]["data"],
) {
  const phase =
    extra && typeof extra === "object" && "analysisPhase" in extra
      ? ((extra as { analysisPhase?: string | null }).analysisPhase ?? null)
      : undefined;

  const restExtra = { ...(extra as Record<string, unknown> | undefined) };
  if ("analysisPhase" in restExtra) {
    delete restExtra.analysisPhase;
  }

  try {
    await prisma.tender.update({
      where: { id: tenderId },
      data: {
        analysisStatus,
        ...(phase !== undefined ? { analysisPhase: phase } : {}),
        ...restExtra,
      } as Prisma.TenderUpdateInput,
    });
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("analysis.status_update_failed", {
      tenderId,
      analysisStatus,
      phase: phase ?? null,
      message: message.slice(0, 500),
    });
  }

  // Retry without analysisPhase (stale Prisma client) — still update core status.
  try {
    await prisma.tender.update({
      where: { id: tenderId },
      data: { analysisStatus, ...restExtra } as Prisma.TenderUpdateInput,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("analysis.status_update_retry_failed", {
      tenderId,
      analysisStatus,
      message: message.slice(0, 500),
    });
    // Do not throw — extraction / analysis must continue.
    return;
  }

  if (phase !== undefined) {
    try {
      await prisma.$executeRaw`
        UPDATE "Tender"
        SET "analysisPhase" = ${phase}
        WHERE id = ${tenderId}
      `;
    } catch (error) {
      logError("analysis.phase_raw_update_failed", {
        tenderId,
        phase,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function transitionAnalysisPhase(
  timer: AnalysisPhaseTimer,
  tenderId: string,
  analysisStatus: AnalysisStatus,
  phase: string,
  extra?: Parameters<typeof prisma.tender.update>[0]["data"],
) {
  await setAnalysisStatus(tenderId, analysisStatus, {
    ...(extra as Record<string, unknown> | undefined),
    analysisPhase: phase,
  });
  timer.markEntered(phase, analysisStatus);
}

function historicalSignalFromKnowledge(
  knowledge: CompanyKnowledge,
): SimilarCompanyLearningSignal | null {
  if (knowledge.historicalOutcomes.length === 0) return null;
  const won = knowledge.historicalOutcomes.filter((h) => h.outcome === "WON").length;
  const lost = knowledge.historicalOutcomes.filter((h) => h.outcome === "LOST").length;
  const noBid = knowledge.historicalOutcomes.filter((h) => h.outcome === "DID_NOT_BID").length;
  return {
    ...EMPTY_LEARNING_SIGNAL,
    detected: true,
    strength: "LOW",
    similarity: null,
    outcomeLean: "insufficient",
    headline: HISTORICAL_CANDIDATE_HEADLINE,
    detail: `Company-private historical records detected (${won} WON, ${lost} LOST, ${noBid} DID_NOT_BID). Lifecycle remains CANDIDATE until verification thresholds are met.`,
    priorityNote:
      "Current tender evidence and your company profile always take priority over historical patterns. Historical patterns never recommend BID over missing mandatory requirements.",
    validated: false,
    lifecycle: "CANDIDATE",
    influenceAllowed: false,
    suppressedReason:
      "Historical outcomes exist as CANDIDATE company records only — not a verified global pattern.",
    patternRef: null,
  };
}

/**
 * COMPANY PROFILE ONLY — knowledge ingest. Never runs the Tender Decision Engine.
 */
async function completeCompanyProfileOnlyAnalysis(input: {
  tenderId: string;
  companyId: string;
  documentId: string;
  fileName: string;
  knowledge: CompanyKnowledge;
  extractedText: string;
}): Promise<void> {
  const { tenderId, companyId, fileName, knowledge } = input;
  await persistCompanyKnowledge({ companyId, knowledge, mergeName: false });

  await prisma.$transaction([
    prisma.tenderRequirement.deleteMany({ where: { tenderId } }),
    prisma.tenderEvidence.deleteMany({ where: { tenderId } }),
    prisma.missingDocument.deleteMany({ where: { tenderId } }),
    prisma.tenderRisk.deleteMany({ where: { tenderId } }),
    prisma.nextAction.deleteMany({ where: { tenderId } }),
  ]);

  const title =
    knowledge.identity.companyName
      ? `${knowledge.identity.companyName} — Company knowledge`
      : `Company knowledge — ${fileName.replace(/\.[^.]+$/, "")}`;

  await prisma.tender.update({
    where: { id: tenderId },
    data: {
      title,
      client: knowledge.identity.companyName,
      country: knowledge.identity.country,
      industry: knowledge.identity.industry,
      estimatedValue: null,
      deadline: null,
    },
  });

  await prisma.nextAction.create({
    data: {
      tenderId,
      title: "Upload a tender / RFP to run Bidvera decision analysis",
      description: COMPANY_ONLY_MESSAGE,
      priority: 1,
      sortOrder: 0,
    },
  });

  // Strict bypass — no runDecisionEngine / fit dimensions / bid score formulas.
  const payload = buildCompanyKnowledgeOnlyAnalysis({ knowledge, fileName });
  // Attach company-private historical inventory as CANDIDATE signal only (not tender history).
  payload.intelligence.learningSignal = historicalSignalFromKnowledge(knowledge);

  // TenderDecision row is required for COMPLETED read paths; decision enum is a DB
  // placeholder only — canonical/UI expose decision=null for company-knowledge-only.
  await prisma.tenderDecision.upsert({
    where: { tenderId },
    create: {
      tenderId,
      companyId,
      decision: "REVIEW",
      fitScore: payload.fitScoreDb,
      confidence: payload.confidence,
      reasoning: payload.reasoning,
      fitBreakdown: payload.fitBreakdown as object,
      readinessBreakdown: payload.readiness as object,
      intelligenceBreakdown: payload.intelligence as object,
      bidScoreBreakdown: payload.bidScore as object,
      isAiSuggested: false,
    },
    update: {
      decision: "REVIEW",
      fitScore: payload.fitScoreDb,
      confidence: payload.confidence,
      reasoning: payload.reasoning,
      fitBreakdown: payload.fitBreakdown as object,
      readinessBreakdown: payload.readiness as object,
      intelligenceBreakdown: payload.intelligence as object,
      bidScoreBreakdown: payload.bidScore as object,
      isAiSuggested: false,
    },
  });

  await setAnalysisStatus(tenderId, "COMPLETED", {
    status: "ACTIVE",
    analyzedAt: new Date(),
    analysisError: null,
    analysisPhase: "COMPANY_KNOWLEDGE_ONLY",
  });

  const { emitWorkflowSmartAlert } = await import("@/services/smart-alerts");
  await emitWorkflowSmartAlert({
    companyId,
    tenderId,
    title: fileName || "Company profile",
    reason: "COMPANY_KNOWLEDGE_ONLY",
    message: COMPANY_ONLY_MESSAGE,
  });

  logInfo("analysis.company_profile_only", {
    tenderId,
    companyId,
    services: knowledge.services.length,
    projects: knowledge.projects.length,
    historical: knowledge.historicalOutcomes.length,
    decisionEngineBypassed: true,
  });
}

/**
 * Full tender processing pipeline (background job).
 * States: UPLOADING → PROCESSING → EXTRACTING → ANALYZING → COMPLETED | FAILED
 * Idempotent: COMPLETED + decision → skip.
 *
 * Pipeline:
 * PDF → Extraction → Document Classification → Structured Company Knowledge
 * → Normalization → Evidence Mapping → Tender Requirement Matching → …
 */
export async function processTenderAnalysis(tenderId: string): Promise<void> {
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      documents: { orderBy: { createdAt: "asc" } },
      company: { include: { profile: true } },
      decision: true,
    },
  });

  if (!tender) throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  if (tender.analysisStatus === "COMPLETED" && tender.decision) {
    const { isDecisionGuardianSnapshot } = await import(
      "@/domain/decision-validation"
    );
    const storedIntel = tender.decision.intelligenceBreakdown as {
      complianceStatus?: string | null;
      analysisMode?: string | null;
      decisionGuardian?: unknown;
    } | null;
    const storedFit = tender.decision.fitBreakdown as {
      scoringAvailable?: boolean;
    } | null;
    const scoringBlocked = storedFit?.scoringAvailable === false;
    const incompleteOrCompanyOnly =
      scoringBlocked ||
      storedIntel?.complianceStatus === "INCOMPLETE" ||
      storedIntel?.analysisMode === "COMPANY_KNOWLEDGE_ONLY";
    // Incomplete / company-only packages are releasable without a Guardian stamp.
    // Full COMPLETE analyses without a valid snapshot are not releasable — re-run.
    if (
      incompleteOrCompanyOnly ||
      isDecisionGuardianSnapshot(storedIntel?.decisionGuardian)
    ) {
      logInfo("analysis.idempotent_skip", { tenderId });
      return;
    }
    logInfo("analysis.reopen_missing_guardian", {
      tenderId,
      complianceStatus: storedIntel?.complianceStatus ?? null,
    });
  }

  // Terminal FAILED must stay terminal. Job retries / poll kicks must not
  // clear analysisError and re-enter PROCESSING → ANALYZING at 82%.
  if (tender.analysisStatus === "FAILED") {
    logInfo("analysis.idempotent_skip_failed", {
      tenderId,
      analysisError: tender.analysisError?.slice(0, 200) ?? null,
      analysisPhase: tender.analysisPhase ?? null,
    });
    return;
  }

  if (tender.documents.length === 0) {
    throw new AppError(ErrorCode.VALIDATION, "Tender has no document to analyze.", 400);
  }

  // —— Universal IntakeReport (authoritative file/package boundary) ——
  const { loadIntakeReport } = await import("@/domain/universal-intake/persist-intake-report");
  const { evaluateIntakeDecisionGate } = await import("@/domain/universal-intake/intake-report");
  const intakeReport = await loadIntakeReport(tender.companyId, tenderId);
  if (intakeReport) {
    logInfo("intake.report_loaded", {
      tenderId,
      status: intakeReport.status,
      uiState: intakeReport.uiState,
      packageCompleteness: intakeReport.packageCompleteness,
      documentReadiness: intakeReport.documentReadiness,
      mayProceedToScoring: intakeReport.mayProceedToScoring,
      fileCount: intakeReport.files.length,
    });
    const intakeGate = evaluateIntakeDecisionGate(intakeReport);
    if (!intakeGate.allowScoring && intakeGate.reason !== "INTAKE_PACKAGE_INCOMPLETE") {
      const { completeIncompleteRequirementsAnalysis } = await import(
        "@/services/tender-processing/incomplete"
      );
      await completeIncompleteRequirementsAnalysis({
        tenderId,
        companyId: tender.companyId,
        packageLabel: intakeReport.packageLabel,
        extractedText: "",
        deadlineUnknownReason: null,
        reason:
          intakeGate.reason === "INTAKE_BLOCKED" ? "INTAKE_BLOCKED" : "INTAKE_NO_READABLE_DOCS",
        message: intakeGate.message ?? intakeReport.analysisIncompleteReason ?? undefined,
      });
      await trackEvent({
        action: "ANALYSIS_COMPLETED",
        companyId: tender.companyId,
        metadata: {
          tenderId,
          intakeBlocked: true,
          intakeUiState: intakeReport.uiState,
        },
      });
      return;
    }
  }

  const analysisJob = await prisma.job.findFirst({
    where: {
      tenderId,
      type: "RUN_TENDER_ANALYSIS",
      status: { in: ["PENDING", "RUNNING"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const phaseTimer = new AnalysisPhaseTimer({
    tenderId,
    jobId: analysisJob?.id ?? null,
  });

  try {
    await trackEvent({
      action: "ANALYSIS_STARTED",
      companyId: tender.companyId,
      metadata: { tenderId },
    });

    await transitionAnalysisPhase(
      phaseTimer,
      tenderId,
      "PROCESSING",
      ANALYSIS_PHASE.READING_PDF,
      { analysisError: null },
    );

    await transitionAnalysisPhase(
      phaseTimer,
      tenderId,
      "EXTRACTING",
      ANALYSIS_PHASE.NATIVE_EXTRACT,
    );

    // —— Tender package: extract ALL discovered documents (bounded concurrency) ——
    const { discoveryIdFromExtractionMeta } = await import(
      "@/domain/universal-tender-intelligence"
    );
    const packageParts: Array<{
      documentId: string;
      /** Stable intake discovery identity when present (disc_*). */
      discoveryId: string | null;
      fileName: string;
      documentKind: string;
      text: string;
      method: string;
      pageCount: number | null;
      pages: Array<{ page: number }>;
      archiveFileName: string | null;
      archivePath: string | null;
      structure: import("@/domain/document-intelligence").NormalizedDocumentStructure | null;
      textTruncated: boolean;
      extractedCharCount: number;
    }> = [];
    const failedDocuments: Array<{
      documentId: string;
      discoveryId: string | null;
      fileName: string;
      reason: string;
      archiveFileName: string | null;
      archivePath: string | null;
    }> = [];

    const { UPLOAD_LIMITS } = await import("@/config/server");
    const { mapWithConcurrency } = await import("@/lib/concurrency");

    type ExtractOutcome =
      | { ok: true; part: (typeof packageParts)[number]; degradedMessage?: string }
      | {
          ok: false;
          documentId: string;
          discoveryId: string | null;
          fileName: string;
          reason: string;
          archiveFileName: string | null;
          archivePath: string | null;
        };

    const packageContext = {
      packageMemberCount: tender.documents.length,
      siblingFileNames: tender.documents.map((d) => d.fileName),
    };

    const extractOutcomes = await mapWithConcurrency(
      tender.documents,
      UPLOAD_LIMITS.extractConcurrency,
      async (document): Promise<ExtractOutcome> => {
        const priorMetaBase =
          document.extractionMeta &&
          typeof document.extractionMeta === "object" &&
          !Array.isArray(document.extractionMeta)
            ? (document.extractionMeta as Record<string, unknown>)
            : {};
        const discoveryId = discoveryIdFromExtractionMeta(document.extractionMeta);
        const provenance =
          priorMetaBase.packageProvenance &&
          typeof priorMetaBase.packageProvenance === "object" &&
          !Array.isArray(priorMetaBase.packageProvenance)
            ? (priorMetaBase.packageProvenance as Record<string, unknown>)
            : null;
        const archiveFileName =
          typeof provenance?.archiveFileName === "string" ? provenance.archiveFileName : null;
        const archivePath =
          typeof provenance?.archivePath === "string" ? provenance.archivePath : null;

        await prisma.tenderDocument.update({
          where: { id: document.id },
          data: { processingStatus: "PROCESSING" },
        });

        let extracted;
        try {
          const bytes = await storageService.getObject(document.storageKey);
          const priorMeta = priorMetaBase;
          const intakeRecovery =
            priorMeta.intakeRecovery &&
            typeof priorMeta.intakeRecovery === "object" &&
            !Array.isArray(priorMeta.intakeRecovery)
              ? (priorMeta.intakeRecovery as { forceOcr?: boolean })
              : null;
          extracted = await extractDocumentText({
            buffer: bytes,
            mimeType: document.mimeType,
            fileName: document.fileName,
            documentId: document.id,
            forceOcr: Boolean(intakeRecovery?.forceOcr),
            onProgress: async (phase) => {
              await setAnalysisStatus(tenderId, "EXTRACTING", {
                analysisPhase: phase,
              });
            },
          });
        } catch (extractError) {
          const reason =
            extractError instanceof Error
              ? extractError.message
              : "Document extraction failed.";
          const priorMeta = priorMetaBase;
          await prisma.tenderDocument.update({
            where: { id: document.id },
            data: {
              processingStatus: "FAILED",
              extractionMeta: {
                ...priorMeta,
                discoveryStatus: "FILE_EXTRACTION_FAILED",
                extractionError: reason,
              } as Prisma.InputJsonValue,
            },
          });
          return {
            ok: false,
            documentId: document.id,
            discoveryId,
            fileName: document.fileName,
            reason,
            archiveFileName,
            archivePath,
          };
        }

        const extractCheck = assessExtractQuality(extracted);
        if (extractCheck.quality === "empty" || extractCheck.quality === "low") {
          const reason =
            extractCheck.userMessage ?? "Document could not be analyzed.";
          await prisma.tenderDocument.update({
            where: { id: document.id },
            data: {
              processingStatus: "FAILED",
              extractionMeta: {
                ...priorMetaBase,
                discoveryStatus: "FILE_EXTRACTION_FAILED",
                extractionError: reason,
              } as Prisma.InputJsonValue,
            },
          });
          return {
            ok: false,
            documentId: document.id,
            discoveryId,
            fileName: document.fileName,
            reason,
            archiveFileName,
            archivePath,
          };
        }

        const extractedCharCount = extracted.text.length;
        const corpus = buildAuthoritativeCorpus({
          text: extracted.text,
          pageCount: extracted.pageCount,
          pages: extracted.pages,
        });
        const textTruncated = isSourceTruncated(corpus.completeness);
        const authoritativeText = extracted.text;
        const knowledgeDraft = extractCompanyKnowledgeHeuristic({
          text: authoritativeText,
          fileName: document.fileName,
          packageContext,
        });
        const documentKind = knowledgeDraft.documentKind;
        const priorMeta = priorMetaBase;

        await prisma.tenderDocument.update({
          where: { id: document.id },
          data: {
            extractedText: authoritativeText,
            pageCount: extracted.pageCount,
            processingStatus: "COMPLETED",
            documentKind,
            extractionMeta: {
              ...priorMeta,
              discoveryStatus: "EXTRACTED",
              method: extracted.method,
              usedOcrFallback: extracted.usedOcrFallback,
              nativeCharCount: extracted.nativeCharCount,
              pageCount: extracted.pageCount,
              adapterId: extracted.adapterId ?? null,
              formatId: extracted.formatId ?? null,
              documentQuality: extracted.documentQuality ?? null,
              structureSummary: extracted.structure
                ? {
                    version: extracted.structure.version,
                    pageCount: extracted.structure.pages.length,
                    sectionCount: extracted.structure.sections.length,
                    tableCount: extracted.structure.tables.length,
                    blockCount: extracted.structure.blocks.length,
                  }
                : null,
              pages: extracted.pages.map((p) => ({
                documentId: p.documentId ?? document.id,
                page: p.page,
                method: p.method,
                confidence: p.confidence,
                charCount: p.charCount,
              })),
              extractedCharCount,
              persistedCharCount: authoritativeText.length,
              corpusCompleteness: corpus.completeness,
              textTruncated,
            } as Prisma.InputJsonValue,
          },
        }).catch(async () => {
          await prisma.tenderDocument.update({
            where: { id: document.id },
            data: {
              extractedText: authoritativeText,
              pageCount: extracted.pageCount,
              processingStatus: "COMPLETED",
              documentKind,
            },
          });
        });

        return {
          ok: true,
          part: {
            documentId: document.id,
            discoveryId,
            fileName: document.fileName,
            documentKind,
            text: authoritativeText,
            method: extracted.method,
            pageCount: extracted.pageCount,
            pages: extracted.pages.map((p) => ({ page: p.page })),
            archiveFileName,
            archivePath,
            structure: extracted.structure ?? null,
            textTruncated,
            extractedCharCount,
          },
          degradedMessage:
            extractCheck.quality === "degraded" ? extractCheck.userMessage ?? undefined : undefined,
        };
      },
    );

    for (const outcome of extractOutcomes) {
      if (!outcome.ok) {
        failedDocuments.push({
          documentId: outcome.documentId,
          discoveryId: outcome.discoveryId,
          fileName: outcome.fileName,
          reason: outcome.reason,
          archiveFileName: outcome.archiveFileName,
          archivePath: outcome.archivePath,
        });
        await prisma.tenderRisk.create({
          data: {
            tenderId,
            severity: "HIGH",
            category: "document",
            description: `${outcome.fileName}: extraction failed — ${outcome.reason}`,
            sortOrder: failedDocuments.length,
          },
        });
        continue;
      }
      if (outcome.degradedMessage) {
        await prisma.tenderRisk.create({
          data: {
            tenderId,
            severity: "MEDIUM",
            category: "document",
            description: `${outcome.part.fileName}: ${outcome.degradedMessage}`,
            sortOrder: packageParts.length,
          },
        });
      }
      packageParts.push(outcome.part);
    }

    if (packageParts.length === 0) {
      const detail =
        failedDocuments.length > 0
          ? failedDocuments.map((f) => `${f.fileName}: ${f.reason}`).join(" | ")
          : "No readable documents in the tender package.";
      throw new AppError(
        ErrorCode.VALIDATION,
        `All documents in this tender package failed extraction. ${detail}`,
        400,
        { failedDocuments },
      );
    }

    if (failedDocuments.length > 0) {
      logInfo("extraction.partial_package", {
        tenderId,
        ok: packageParts.map((p) => p.fileName),
        failed: failedDocuments,
      });
    }

    await transitionAnalysisPhase(
      phaseTimer,
      tenderId,
      "EXTRACTING",
      ANALYSIS_PHASE.CLASSIFYING,
    );

    const tenderParts = packageParts.filter(
      (p) =>
        p.documentKind === "TENDER" ||
        p.documentKind === "UNKNOWN",
    );
    const companyParts = packageParts.filter((p) =>
      isCompanyEvidenceKind(
        p.documentKind as "COMPANY_PROFILE" | "SUPPORTING_EVIDENCE" | "HISTORICAL_OUTCOME",
      ),
    );

    // Company-only pack (no tender source) — exclusive company upload.
    // Classification must never shrink a multi-member tender package inventory.
    if (tenderParts.length === 0 && companyParts.length > 0 && companyParts.length === packageParts.length) {
      const primary = companyParts[0]!;
      const knowledgeDraft = extractCompanyKnowledgeHeuristic({
        text: primary.text,
        fileName: primary.fileName,
        packageContext: {
          packageMemberCount: tender.documents.length,
          siblingFileNames: tender.documents.map((d) => d.fileName),
        },
      });
      await completeCompanyProfileOnlyAnalysis({
        tenderId,
        companyId: tender.companyId,
        documentId: primary.documentId,
        fileName: primary.fileName,
        knowledge: knowledgeDraft,
        extractedText: primary.text,
      });
      await trackEvent({
        action: "ANALYSIS_COMPLETED",
        companyId: tender.companyId,
        metadata: { tenderId, documentKind: primary.documentKind, companyOnly: true },
      });
      return;
    }

    // Persist company knowledge only from exclusive company evidence members —
    // never from tender-pack members misclassified as COMPANY_PROFILE.
    const companyKnowledgeParts =
      tenderParts.length === 0
        ? companyParts
        : [];

    for (const part of companyKnowledgeParts) {
      const draft = extractCompanyKnowledgeHeuristic({
        text: part.text,
        fileName: part.fileName,
        packageContext: {
          packageMemberCount: tender.documents.length,
          siblingFileNames: tender.documents.map((d) => d.fileName),
        },
      });
      await persistCompanyKnowledge({
        companyId: tender.companyId,
        knowledge: draft,
      }).catch(() => undefined);
    }

    // Authoritative inventory = every extracted member + every failed member.
    // Classification/role is orthogonal to inventory membership (Intake SoT).
    const inventoryParts = packageParts;
    const analysisParts = inventoryParts;

    const {
      assembleTenderPackage,
      evaluatePackageScoringGate,
    } = await import("@/domain/tender-package");
    const assembly = assembleTenderPackage(
      inventoryParts.map((p) => ({
        documentId: p.documentId,
        fileName: p.fileName,
        documentKind: p.documentKind,
        text: p.text,
      })),
    );
    const packageLabel = assembly.packageLabel;
    const truncatedDocumentCount = analysisParts.filter((p) => p.textTruncated).length;
    const packageTextTruncated = truncatedDocumentCount > 0;
    const safePackageText = assembly.packageText;
    const primaryKind = analysisParts[0]?.documentKind ?? "TENDER";
    const primaryRole = assembly.parts[0]?.role ?? "OTHER";

    // Universal Tender Intelligence — inventory from full package, never TENDER|UNKNOWN filter.
    const {
      buildUniversalTenderPackage,
      toUtiSummary,
      assertUtiPackageInvariants,
      assertFinalPackageInventoryContract,
    } = await import("@/domain/universal-tender-intelligence");
    const { buildCanonicalSemanticCandidates } = await import(
      "@/domain/semantic-tender-intelligence"
    );
    const utiPackage = buildUniversalTenderPackage({
      packageLabel,
      parts: [
        ...inventoryParts.map((p) => ({
          // Prefer stable intake discovery identity; never invent a second ID from filename.
          fileId: p.discoveryId ?? p.documentId,
          fileName: p.fileName,
          originalFileName: p.fileName,
          documentKind: p.documentKind,
          text: p.text,
          pageCount: p.pages?.length ?? null,
          extractionMethod: null,
          extractionStatus: (p.text?.trim().length ?? 0) >= 40 ? "EXTRACTED" as const : "UNREADABLE" as const,
          archiveSource: (p.archiveFileName ? "zip" : "unknown") as "zip" | "unknown",
          archiveFileName: p.archiveFileName,
          archivePath: p.archivePath,
        })),
        ...failedDocuments.map((f) => ({
          fileId: f.discoveryId ?? f.documentId,
          fileName: f.fileName,
          originalFileName: f.fileName,
          documentKind: "UNKNOWN",
          text: "",
          pageCount: null,
          extractionMethod: null,
          extractionStatus: "FILE_EXTRACTION_FAILED" as const,
          archiveSource: (f.archiveFileName ? "zip" : "unknown") as "zip" | "unknown",
          archiveFileName: f.archiveFileName,
          archivePath: f.archivePath,
          error: f.reason,
        })),
      ],
    });
    assertUtiPackageInvariants(utiPackage);
    const utiSummary = toUtiSummary(utiPackage);
    logInfo("uti.package_built", {
      tenderId,
      inventoryCount: utiSummary.inventoryCount,
      extractedOkCount: utiSummary.extractedOkCount,
      failedCount: utiSummary.failedCount,
      roles: utiSummary.roles.map((r) => r.role),
      versionEdges: utiSummary.versionEdges,
      metadataConflicts: utiSummary.metadataConflicts,
      qualityIssueCodes: utiSummary.qualityIssueCodes,
      identitySource: "discoveryId_preferred",
    });

    const trustScan = scanTenderContentForInjection(safePackageText);
    const pageTrustContext = buildPageContextFromExtractMeta(
      analysisParts.flatMap((p) => p.pages ?? []),
    );
    logInfo("ai-trust.scan", {
      tenderId,
      companyId: tender.companyId,
      scannedCharCount: trustScan.scannedCharCount,
      overrideAttempts: trustScan.hasSystemOverrideAttempt,
      flaggedSegments: trustScan.segments.length,
      legitimateObligations: trustScan.legitimateObligationCount,
    });

    await transitionAnalysisPhase(
      phaseTimer,
      tenderId,
      "EXTRACTING",
      ANALYSIS_PHASE.UNDERSTANDING,
    );

    const { extractTenderPackageHeuristic, extractTenderPackageFromParts } = await import(
      "@/services/tender-extraction/requirements-heuristic"
    );
    const { formatPackageMetadataNote } = await import("@/domain/tender-package/package-metadata");
    const { formatPackageIdentityNote, identityRoleToStiString } = await import(
      "@/domain/package-identity"
    );
    // Prefer UTI version-aware ordering (base specs first; corrigenda/Q&A last).
    const extractionParts =
      utiPackage.orderedParts.length > 0
        ? utiPackage.orderedParts.map((p) => ({
            fileName: p.fileName,
            text: p.text,
            documentId: p.fileId,
            truncated: analysisParts.some(
              (a) =>
                (a.documentId === p.fileId || a.fileName === p.fileName) && a.textTruncated,
            ),
          }))
        : assembly.parts.map((p) => ({
            fileName: p.fileName,
            text: p.text,
            documentId: p.documentId,
            truncated: analysisParts.some(
              (a) =>
                (a.documentId === p.documentId || a.fileName === p.fileName) &&
                a.textTruncated,
            ),
          }));
    const heuristicPack =
      extractionParts.length > 0
        ? extractTenderPackageFromParts(extractionParts, packageLabel)
        : extractTenderPackageHeuristic({
            text: safePackageText,
            fileName: packageLabel,
          });
    const packageIdentity = heuristicPack.packageIdentity ?? null;
    const sourceCompletenessFor = (fileName: string | null | undefined) => {
      if (!fileName) return null;
      const doc = packageIdentity?.documents.find((d) => d.fileName === fileName);
      return doc?.completeness ?? null;
    };
    const packageMetadataNote = packageIdentity
      ? formatPackageIdentityNote(packageIdentity)
      : heuristicPack.packageMetadata
        ? formatPackageMetadataNote(heuristicPack.packageMetadata)
        : "";

    const { evaluateTenderDocumentValidity, analyzeDocumentStructure } = await import(
      "@/domain/tender-validity"
    );
    const documentStructure = analyzeDocumentStructure(safePackageText);
    const validity = evaluateTenderDocumentValidity({
      text: safePackageText,
      fileName: packageLabel,
      documentKinds: analysisParts.map((p) => p.documentKind),
      packageRoles: assembly.rolesPresent,
    });

    if (!validity.valid) {
      const { completeIncompleteRequirementsAnalysis } = await import(
        "@/services/tender-processing/incomplete"
      );
      const gateReason =
        validity.reason === "UNREADABLE"
          ? ("DOCUMENT_UNREADABLE" as const)
          : ("NOT_A_TENDER_DOCUMENT" as const);
      await completeIncompleteRequirementsAnalysis({
        tenderId,
        companyId: tender.companyId,
        packageLabel,
        extractedText: safePackageText,
        deadlineUnknownReason: null,
        reason: gateReason,
        message: validity.message,
        verifiedFacts: {
          title: heuristicPack.title ?? null,
          client: heuristicPack.client ?? null,
          factsNote: packageMetadataNote || null,
        },
        packageRoles: assembly.rolesPresent,
        missingDocumentTypes: assembly.missingDocumentTypes,
      });
      logInfo("document.validity.rejected", {
        tenderId,
        reason: validity.reason,
        confidence: validity.confidence,
        signals: validity.signals,
        sections: documentStructure.dominantSections,
      });
      await trackEvent({
        action: "ANALYSIS_COMPLETED",
        companyId: tender.companyId,
        metadata: {
          tenderId,
          incomplete: true,
          validityRejected: true,
          reason: validity.reason,
        },
      });
      return;
    }

    logInfo("document.validity.accepted", {
      tenderId,
      confidence: validity.confidence,
      signals: validity.signals,
      sections: documentStructure.dominantSections,
    });

    let extraction = await aiService.extractTenderFacts({
      textExcerpt: safePackageText,
      fileName: packageLabel,
      companyId: tender.companyId,
      tenderId,
    });
    extraction = {
      ...extraction,
      requirements: sanitizeAiExtractionDrafts(extraction.requirements, pageTrustContext),
    };

    // Package identity is authoritative for buyer/title/value/deadline.
    // Concatenated AI facts must not reconstruct or override those fields.
    if (packageIdentity) {
      extraction = {
        ...extraction,
        client:
          packageIdentity.buyer.status === "OK" ? packageIdentity.buyer.value : null,
        title:
          packageIdentity.title.status === "OK" ? packageIdentity.title.value : null,
        estimatedValue:
          packageIdentity.estimatedValue.status === "OK" && packageIdentity.estimatedValue.value
            ? Number(packageIdentity.estimatedValue.value)
            : packageIdentity.estimatedValue.status === "CONFLICT" ||
                packageIdentity.estimatedValue.status === "INCOMPLETE"
              ? null
              : extraction.estimatedValue,
        deadlineIso:
          packageIdentity.deadline.status === "OK"
            ? packageIdentity.deadline.deadlineIso
            : null,
        deadlineTimezone:
          packageIdentity.deadline.status === "OK"
            ? packageIdentity.deadline.deadlineTimezone
            : null,
        country:
          packageIdentity.country.status === "OK" ? packageIdentity.country.value : null,
      };
      if (packageIdentity.title.status === "CONFLICT" || packageIdentity.title.status === "INCOMPLETE") {
        extraction = { ...extraction, title: null };
      }
    } else {
      if (!extraction.deadlineIso && heuristicPack.deadlineIso) {
        extraction = {
          ...extraction,
          deadlineIso: heuristicPack.deadlineIso,
          deadlineTimezone: heuristicPack.deadlineTimezone,
        };
      }
      if (!extraction.client && heuristicPack.client) {
        extraction = { ...extraction, client: heuristicPack.client };
      }
      if (!extraction.title && heuristicPack.title) {
        extraction = { ...extraction, title: heuristicPack.title };
      }
      if (!extraction.estimatedValue && heuristicPack.estimatedValue) {
        extraction = { ...extraction, estimatedValue: heuristicPack.estimatedValue };
      }
      if (heuristicPack.packageMetadata?.buyer.status === "CONFLICT") {
        extraction = { ...extraction, client: null };
      }
      if (heuristicPack.packageMetadata?.title.status === "CONFLICT") {
        extraction = { ...extraction, title: null };
      }
      if (heuristicPack.packageMetadata?.deadlineIso.status === "CONFLICT") {
        extraction = { ...extraction, deadlineIso: null, deadlineTimezone: null };
      } else if (!heuristicPack.deadlineTimezone) {
        extraction = { ...extraction, deadlineTimezone: heuristicPack.deadlineTimezone };
      }
    }
    if (!packageIdentity && !extraction.country && heuristicPack.country) {
      extraction = { ...extraction, country: heuristicPack.country };
    }
    if (extraction.missingDocuments.length === 0 && heuristicPack.missingDocuments.length > 0) {
      extraction = { ...extraction, missingDocuments: heuristicPack.missingDocuments };
    }

    await recordUsage({
      companyId: tender.companyId,
      action: "AI_EXTRACTION",
      metadata: {
        tenderId,
        documentCount: analysisParts.length,
        documentKind: primaryKind,
        documentRoles: assembly.rolesPresent,
        packageCompleteness: assembly.completeness,
      },
    });

    const {
      buildSemanticDocumentUnits,
      harvestDraftsFromUnits,
      enrichDraftsFromUnits,
    } = await import("@/domain/document-intelligence");
    const semanticUnits = analysisParts.flatMap((p) => {
      const utiDoc = utiPackage.documents.find(
        (d) => d.fileId === p.discoveryId || d.fileId === p.documentId || d.originalFileName === p.fileName,
      );
      return buildSemanticDocumentUnits({
        structure: p.structure,
        documentId: p.documentId,
        fileName: p.fileName,
        packageDocumentRole: (() => {
          const idDoc = packageIdentity?.documents.find((d) => d.fileName === p.fileName);
          if (idDoc && idDoc.role !== "UNKNOWN") {
            return identityRoleToStiString(idDoc.role);
          }
          return utiDoc?.universalRole ?? utiDoc?.legacyRole ?? null;
        })(),
        fallbackText: p.text,
      });
    });
    const unitHarvest = harvestDraftsFromUnits(semanticUnits);

    const mergedDiscoveryDrafts = enrichDraftsFromUnits(
      [
        ...unitHarvest.map((u) => ({
          description: u.description,
          category: u.category,
          mandatory: u.mandatory,
          sourceDocument: u.sourceDocument ?? packageLabel,
          sourcePage: u.sourcePage,
          sourceSection: u.sourceSection,
          sourceCell: u.sourceCell,
          columnHeader: u.columnHeader,
          rowLabel: u.rowLabel,
          isTableHeader: u.isTableHeader,
          precedingText: u.precedingText,
          followingText: u.followingText,
          documentRole: u.documentRole,
          packageDocumentRole: u.packageDocumentRole,
          versionLabel: u.versionLabel,
          locator: u.locator,
          sourceCompleteness: sourceCompletenessFor(u.sourceDocument),
        })),
        ...heuristicPack.requirements.map((r) => {
          const part = assembly.parts.find(
            (p) =>
              p.fileName === r.sourceDocument ||
              (r.sourceDocument != null && p.fileName.includes(r.sourceDocument)) ||
              (r.sourceDocument != null && r.sourceDocument.includes(p.fileName)),
          );
          return {
            description: r.description,
            category: r.category,
            mandatory: r.mandatory,
            sourceDocument: r.sourceDocument ?? packageLabel,
            sourcePage: r.sourcePage ?? null,
            sourceSection: r.sourceSection ?? null,
            evidenceText: r.evidenceText ?? null,
            sourceCompleteness: sourceCompletenessFor(r.sourceDocument ?? part?.fileName),
            documentRole: (() => {
              const idDoc = packageIdentity?.documents.find(
                (d) => d.fileName === r.sourceDocument || d.fileName === part?.fileName,
              );
              if (idDoc && idDoc.role !== "UNKNOWN") {
                return identityRoleToStiString(idDoc.role);
              }
              return part?.role ?? null;
            })(),
            packageDocumentRole: (() => {
              const idDoc = packageIdentity?.documents.find(
                (d) => d.fileName === r.sourceDocument || d.fileName === part?.fileName,
              );
              if (idDoc && idDoc.role !== "UNKNOWN") {
                return identityRoleToStiString(idDoc.role);
              }
              return part?.role ?? null;
            })(),
          };
        }),
        ...extraction.requirements.map((r) => {
          const rawSource = (r as { sourceDocument?: string | null }).sourceDocument ?? null;
          const utiPart = utiPackage.documents.find(
            (d) =>
              d.originalFileName === rawSource ||
              d.fileId === (r as { documentId?: string }).documentId,
          );
          const part = assembly.parts.find(
            (p) =>
              p.fileName === rawSource ||
              (utiPart && p.fileName === utiPart.originalFileName),
          );
          return {
            description: r.description,
            category: r.category,
            mandatory: r.mandatory,
            sourceDocument: rawSource ?? part?.fileName ?? utiPart?.originalFileName ?? packageLabel,
            sourcePage: r.sourcePage ?? null,
            sourceSection: r.sourceSection ?? null,
            evidenceText: r.evidenceText ?? null,
            sourceCompleteness: sourceCompletenessFor(
              rawSource ?? part?.fileName ?? utiPart?.originalFileName,
            ),
            documentRole: (() => {
              const idDoc = packageIdentity?.documents.find(
                (d) =>
                  d.fileName === rawSource ||
                  d.fileName === part?.fileName ||
                  d.fileName === utiPart?.originalFileName,
              );
              if (idDoc && idDoc.role !== "UNKNOWN") {
                return identityRoleToStiString(idDoc.role);
              }
              return part?.role ?? utiPart?.legacyRole ?? null;
            })(),
            packageDocumentRole: (() => {
              const idDoc = packageIdentity?.documents.find(
                (d) =>
                  d.fileName === rawSource ||
                  d.fileName === part?.fileName ||
                  d.fileName === utiPart?.originalFileName,
              );
              if (idDoc && idDoc.role !== "UNKNOWN") {
                return identityRoleToStiString(idDoc.role);
              }
              return part?.role ?? utiPart?.universalRole ?? utiPart?.legacyRole ?? null;
            })(),
          };
        }),
      ],
      semanticUnits,
    );
    const semanticCandidates = buildCanonicalSemanticCandidates(mergedDiscoveryDrafts, {
      packageLabel,
    });
    if (semanticCandidates.rejected.length > 0) {
      logInfo("semantic.draft_gate", {
        tenderId,
        rejected: semanticCandidates.rejected.length,
        admitted: semanticCandidates.candidates.length,
        exclusionReasons: [
          ...new Set(
            semanticCandidates.rejected.map((r) => r.exclusionReason).filter(Boolean),
          ),
        ],
      });
    }

    const { StiApprovedRequirementBatch } = await import(
      "@/domain/semantic-tender-intelligence"
    );
    const stiApproved = StiApprovedRequirementBatch.fromAdmittedCandidates(
      semanticCandidates.candidates,
      packageLabel,
    );
    const { getLastCanonicalAdmissionAudit } = await import(
      "@/domain/tender-requirements"
    );
    const canonicalRequirements = buildCanonicalRequirements({
      stiApproved,
    });
    const admissionAudit = getLastCanonicalAdmissionAudit();

    const cleanedRequirements = canonicalRequirements.map((n) => {
      const d = toHeuristicDraft(n);
      const sanitized = sanitizeRequirementProvenance(
        {
          category: d.category,
          description: d.description,
          mandatory: d.mandatory,
          value: d.value ?? null,
          sourcePage: d.sourcePage ?? null,
          sourceSection: d.sourceSection ?? null,
          evidenceText: d.evidenceText ?? null,
          verificationStatus: d.verificationStatus ?? ("UNKNOWN" as const),
        },
        pageTrustContext,
      );
      // STI fields stay in-memory for matching / intelligence — DB columns are text-only.
      // Persistence of semantic truth is via canonical snapshot stiAdmission + requirement STI on canonicalRequirements.
      return {
        ...sanitized,
        semanticKind: n.semanticKind,
        obligationStrength: n.obligationStrength,
        sti: d.sti ?? null,
        stiActor: n.stiActor ?? null,
        stiProcurementPhase: n.stiProcurementPhase ?? null,
        stiClauseRole: n.stiClauseRole ?? null,
        stiClausePurpose: n.stiClausePurpose ?? null,
      };
    });

    logInfo("extraction.completed", {
      tenderId,
      companyId: tender.companyId,
      documentKind: primaryKind,
      documentRole: primaryRole,
      documents: analysisParts.length,
      roles: assembly.rolesPresent,
      packageCompleteness: assembly.completeness,
      rawExtractionCandidateCount: extraction.requirements.length,
      canonicalRequirementCount: cleanedRequirements.length,
      truncatedDocumentCount,
      packageTextTruncated,
    });

    const deadlineUnknownReason =
      extraction.deadlineIso
        ? null
        : heuristicPack.deadlineUnknownReason ??
          "No reliable deadline date was found in the tender package text.";

    const packageGate = evaluatePackageScoringGate({
      assembly,
      reliableRequirementCount: cleanedRequirements.length,
      canonicalRequirements: canonicalRequirements.map((r) => ({
        semanticKind: r.semanticKind,
        obligationStrength: r.obligationStrength,
        mandatory: r.mandatory,
        requirement: r.requirement,
        category: r.category,
      })),
      packageTextTruncated,
    });

    logInfo("package.scoring_gate", {
      tenderId,
      documentRole: primaryRole,
      roleCompleteness: assembly.completeness,
      gateReason: packageGate.reason,
      allowScoring: packageGate.allowScoring,
      canonicalRequirementCount: cleanedRequirements.length,
      missingDocumentTypes: packageGate.missingDocumentTypes,
    });

    if (!packageGate.allowScoring) {
      const { completeIncompleteRequirementsAnalysis } = await import(
        "@/services/tender-processing/incomplete"
      );
      const { mapPackageReasonToGateReason } = await import(
        "@/domain/decision/extraction-gate"
      );
      const gateReason = mapPackageReasonToGateReason(packageGate.reason);
      await completeIncompleteRequirementsAnalysis({
        tenderId,
        companyId: tender.companyId,
        packageLabel,
        extractedText: safePackageText,
        deadlineUnknownReason,
        reason: gateReason,
        message:
          (packageGate.message ?? "") +
          (intakeReport?.packageCompleteness === "INCOMPLETE"
            ? `\n\nUniversal Intake: package incomplete (${intakeReport.unsupportedFileCount} unsupported, ${intakeReport.corruptedFileCount} corrupted). Readable docs were analyzed for notice facts only.`
            : ""),
        verifiedFacts: {
          title: extraction.title || null,
          client: extraction.client ?? null,
          country: extraction.country ?? null,
          region: extraction.region ?? heuristicPack.region ?? null,
          industry: extraction.industry ?? heuristicPack.industry ?? null,
          deadlineIso: extraction.deadlineIso ?? null,
          deadlineTimezone:
            extraction.deadlineTimezone ?? heuristicPack.deadlineTimezone ?? null,
          estimatedValue: extraction.estimatedValue ?? null,
          guarantee: extraction.guarantee ?? heuristicPack.guarantee ?? null,
          reference: heuristicPack.reference ?? null,
          submissionMethod: heuristicPack.submissionMethod ?? null,
          factsNote: packageMetadataNote || null,
        },
        packageRoles: assembly.rolesPresent,
        // Only invent missing-doc blockers when the gate still reports them.
        missingDocumentTypes: packageGate.missingDocumentTypes,
        noticeRequirements:
          packageGate.reason === "ONLY_AVIS" ? cleanedRequirements : [],
      });
      // Surface explicit unsupported/corrupted intake members (never silent).
      if (intakeReport) {
        for (const f of intakeReport.files) {
          if (
            f.state === "UNSUPPORTED_SKIPPED" ||
            f.state === "REJECTED_UNSUPPORTED" ||
            f.recoveryClass === "UNSUPPORTED" ||
            f.state === "CORRUPTED" ||
            f.recoveryClass === "CORRUPTED_UNRECOVERABLE"
          ) {
            await prisma.missingDocument.create({
              data: {
                tenderId,
                documentName: f.originalName,
                reason:
                  f.message ??
                  (f.state === "CORRUPTED" || f.recoveryClass === "CORRUPTED_UNRECOVERABLE"
                    ? "Corrupted / unrecoverable at Universal Intake — not analyzed."
                    : "Unsupported format at Universal Intake — not silently ignored."),
                severity: "MEDIUM",
                sortOrder: 0,
              },
            }).catch(() => undefined);
          }
        }
      }
      await trackEvent({
        action: "ANALYSIS_COMPLETED",
        companyId: tender.companyId,
        metadata: {
          tenderId,
          incomplete: true,
          reason: packageGate.reason,
          roles: assembly.rolesPresent,
        },
      });
      return;
    }

    if (cleanedRequirements.length === 0) {
      const { completeIncompleteRequirementsAnalysis } = await import(
        "@/services/tender-processing/incomplete"
      );
      const { evaluateRequirementExtractionGate } = await import(
        "@/domain/decision/extraction-gate"
      );
      const gate = evaluateRequirementExtractionGate({
        reliableRequirementCount: 0,
        packageTextLength: safePackageText.trim().length,
      });
      await completeIncompleteRequirementsAnalysis({
        tenderId,
        companyId: tender.companyId,
        packageLabel,
        extractedText: safePackageText,
        deadlineUnknownReason,
        reason: gate.reason ?? "NO_RELIABLE_REQUIREMENTS",
        message: gate.message ?? undefined,
        verifiedFacts: {
          title: extraction.title || null,
          client: extraction.client ?? null,
          country: extraction.country ?? null,
          region: extraction.region ?? heuristicPack.region ?? null,
          industry: extraction.industry ?? heuristicPack.industry ?? null,
          deadlineIso: extraction.deadlineIso ?? null,
          deadlineTimezone:
            extraction.deadlineTimezone ?? heuristicPack.deadlineTimezone ?? null,
          estimatedValue: extraction.estimatedValue ?? null,
          guarantee: extraction.guarantee ?? heuristicPack.guarantee ?? null,
          reference: heuristicPack.reference ?? null,
          submissionMethod: heuristicPack.submissionMethod ?? null,
          factsNote: packageMetadataNote || null,
        },
        packageRoles: assembly.rolesPresent,
        missingDocumentTypes: assembly.missingDocumentTypes,
      });
      await trackEvent({
        action: "ANALYSIS_COMPLETED",
        companyId: tender.companyId,
        metadata: { tenderId, incomplete: true, reason: "no_requirements" },
      });
      return;
    }

    const deadline = extraction.deadlineIso
      ? deadlineIsoToPersistableDate(
          extraction.deadlineIso,
          extraction.deadlineTimezone ?? tender.deadlineTimezone,
        )
      : tender.deadline;

    const tenderEstimatedValue = extraction.estimatedValue ?? tender.estimatedValue;

    await prisma.tender.update({
      where: { id: tenderId },
      data: {
        title: extraction.title || tender.title,
        client: extraction.client ?? tender.client,
        country: extraction.country ?? tender.country,
        region: extraction.region ?? tender.region,
        industry: extraction.industry ?? tender.industry,
        deadline:
          deadline && !Number.isNaN(deadline.getTime()) ? deadline : tender.deadline,
        deadlineTimezone: extraction.deadlineTimezone ?? tender.deadlineTimezone,
        estimatedValue: tenderEstimatedValue,
        guarantee: extraction.guarantee ?? tender.guarantee,
      },
    });

    await prisma.$transaction([
      prisma.tenderRequirement.deleteMany({ where: { tenderId } }),
      prisma.tenderEvidence.deleteMany({ where: { tenderId } }),
      prisma.missingDocument.deleteMany({ where: { tenderId } }),
      prisma.tenderRisk.deleteMany({ where: { tenderId } }),
      prisma.nextAction.deleteMany({ where: { tenderId } }),
    ]);

    if (deadlineUnknownReason && !extraction.deadlineIso) {
      await prisma.tenderRisk.create({
        data: {
          tenderId,
          severity: "MEDIUM",
          category: "deadline",
          description: `Deadline: Unknown — Verify. ${deadlineUnknownReason}`,
          sortOrder: 0,
        },
      });
    }

    const evidenceFoundAudit: Array<{
      requirementId: string;
      evidenceId: string;
      sourcePage: number | null;
      documentId?: string | null;
    }> = [];

    type PersistedRequirement = TenderRequirement;
    let persistedRequirements: PersistedRequirement[] = await Promise.all(
      cleanedRequirements.map((req, i) =>
        prisma.tenderRequirement.create({
          data: {
            tenderId,
            category: req.category,
            description: req.description,
            mandatory: req.mandatory,
            value: req.value ?? null,
            status: "UNCERTAIN",
            sourcePage: req.sourcePage ?? null,
            sourceSection: req.sourceSection ?? null,
            evidence: req.evidenceText ?? null,
            sortOrder: i,
          },
        }),
      ),
    );

    const evidenceCreates = cleanedRequirements
      .map((req, i) => ({ req, created: persistedRequirements[i]! }))
      .filter(({ req }) => Boolean(req.evidenceText));

    if (evidenceCreates.length > 0) {
      const evidenceRows = await Promise.all(
        evidenceCreates.map(({ req, created }) =>
          prisma.tenderEvidence.create({
            data: {
              tenderId,
              requirementId: created.id,
              sourcePage: req.sourcePage ?? null,
              sourceSection: req.sourceSection ?? null,
              evidenceText: req.evidenceText!,
              verificationStatus: req.verificationStatus ?? "UNKNOWN",
            },
          }),
        ),
      );
      for (let i = 0; i < evidenceCreates.length; i++) {
        const { req, created } = evidenceCreates[i]!;
        evidenceFoundAudit.push({
          requirementId: created.id,
          evidenceId: evidenceRows[i]!.id,
          sourcePage: req.sourcePage ?? null,
        });
      }
    }

    if (extraction.missingDocuments.length > 0) {
      await prisma.missingDocument.createMany({
        data: extraction.missingDocuments.map((doc, i) => ({
          tenderId,
          documentName: doc.documentName,
          reason: doc.reason,
          severity: doc.severity,
          sortOrder: i,
        })),
      });
    }

    await transitionAnalysisPhase(
      phaseTimer,
      tenderId,
      "ANALYZING",
      ANALYSIS_PHASE.MATCHING,
    );

    const refreshedProfile =
      tender.company.profile ??
      (await prisma.companyProfile.findUnique({
        where: { companyId: tender.companyId },
      }));
    let knowledge = parseStoredKnowledge(refreshedProfile?.knowledgeJson);

    const safeExtractedText = safePackageText;
    const documentKind = primaryKind;
    const knowledgeDraft =
      companyKnowledgeParts[0] != null
        ? extractCompanyKnowledgeHeuristic({
            text: companyKnowledgeParts[0].text,
            fileName: companyKnowledgeParts[0].fileName,
            packageContext: {
              packageMemberCount: tender.documents.length,
              siblingFileNames: tender.documents.map((d) => d.fileName),
            },
          })
        : null;
    if (!knowledge && knowledgeDraft) knowledge = knowledgeDraft;

    // Knowledge-driven matching before decision engine
    let matchMetaById = new Map<
      string,
      {
        sourceDocument: string | null;
        page: number | "UNKNOWN" | null;
        section: string | null;
        rationale: string;
        evidenceConflict?: boolean;
      }
    >();

    if (knowledge && persistedRequirements.length > 0) {
      const canonicalByText = new Map(
        canonicalRequirements.map((c) => [
          c.requirement.replace(/\s+/g, " ").trim().toLowerCase(),
          c,
        ]),
      );
      const matches = matchAllRequirementsWithEvidence({
        requirements: persistedRequirements.map((r) => {
          const key = r.description.replace(/\s+/g, " ").trim().toLowerCase();
          const fromSti = canonicalByText.get(key);
          return {
            id: r.id,
            category: r.category,
            description: r.description,
            mandatory: r.mandatory,
            value: r.value,
            // Prefer STI-sealed kind — never re-interpret raw tender text into a new semantic truth.
            semanticKind:
              fromSti?.semanticKind ??
              ("UNKNOWN" as const),
            stiProcurementPhase: fromSti?.stiProcurementPhase ?? null,
            stiActor: fromSti?.stiActor ?? null,
            stiClauseRole: fromSti?.stiClauseRole ?? null,
          };
        }),
        knowledge,
      });
      const matchById = new Map(
        matches.filter((m) => m.requirementId).map((m) => [m.requirementId!, m]),
      );
      matchMetaById = new Map(
        [...matchById.entries()].map(([id, m]) => [
          id,
          {
            sourceDocument: m.sourceDocument,
            page: m.page,
            section: m.section,
            rationale: m.rationale,
            evidenceConflict: m.evidenceConflict ?? false,
          },
        ]),
      );
      const matchUpdates = persistedRequirements
        .filter((r) => matchById.has(r.id))
        .map((r) => {
          const m = matchById.get(r.id)!;
          return prisma.tenderRequirement.update({
            where: { id: r.id },
            data: {
              status: m.status as RequirementMatchStatus,
            },
          });
        });
      if (matchUpdates.length > 0) {
        await Promise.all(matchUpdates);
      }
      persistedRequirements = persistedRequirements.map((r) => {
        const m = matchById.get(r.id);
        if (!m) return r;
        return {
          ...r,
          status: m.status as RequirementMatchStatus,
        };
      });

      const inferredEvidenceCreates = matches.filter(
        (m) => m.requirementId && m.evidence && m.sourceDocument,
      );
      if (inferredEvidenceCreates.length > 0) {
        const inferredRows = await Promise.all(
          inferredEvidenceCreates.map((m) =>
            prisma.tenderEvidence.create({
              data: {
                tenderId,
                requirementId: m.requirementId!,
                sourcePage: typeof m.page === "number" ? m.page : null,
                sourceSection: m.section,
                evidenceText: m.evidence!,
                verificationStatus: "INFERRED",
              },
            }),
          ),
        );
        for (let i = 0; i < inferredEvidenceCreates.length; i++) {
          const m = inferredEvidenceCreates[i]!;
          evidenceFoundAudit.push({
            requirementId: m.requirementId!,
            evidenceId: inferredRows[i]!.id,
            sourcePage: typeof m.page === "number" ? m.page : null,
          });
        }
      }

      if (evidenceFoundAudit.length > 0) {
        const { auditEvidenceFoundBatch } = await import(
          "@/services/evidence-verification"
        );
        await auditEvidenceFoundBatch({
          companyId: tender.companyId,
          tenderId,
          items: evidenceFoundAudit,
        }).catch(() => undefined);
      }

      const tenderBlob = [
        extraction.title || tender.title,
        extraction.client ?? "",
        safeExtractedText,
        ...persistedRequirements.map((r) => `${r.category} ${r.description}`),
      ].join("\n");

      const limitationRisks = risksFromRelevantLimitations({
        knowledge,
        tenderText: tenderBlob,
        estimatedValue: tenderEstimatedValue,
      });
      if (limitationRisks.length > 0) {
        await prisma.tenderRisk.createMany({
          data: limitationRisks.map((risk, i) => ({
            tenderId,
            severity: risk.severity,
            category: risk.category,
            description: risk.description,
            sourcePage: risk.sourcePage,
            sortOrder: 50 + i,
          })),
        });
      }

      const missingFromKnowledge = missingDocumentsFromKnowledge({
        knowledge,
        tenderText: tenderBlob,
      });
      if (missingFromKnowledge.length > 0) {
        await prisma.missingDocument.createMany({
          data: missingFromKnowledge.map((doc, i) => ({
            tenderId,
            documentName: doc.documentName,
            reason: doc.reason,
            severity: doc.severity,
            sortOrder: 100 + i,
          })),
        });
      }
    }

    const requirementsAfterMatch = persistedRequirements;

    const profile = toRuleProfile(refreshedProfile ?? tender.company.profile, tender.company.name);
    const canonicalByTextForEngine = new Map(
      canonicalRequirements.map((c) => [
        c.requirement.replace(/\s+/g, " ").trim().toLowerCase(),
        c,
      ]),
    );
    const engineInputRequirements = requirementsAfterMatch.map((r) => {
      const m = matchMetaById.get(r.id);
      const fromSti = canonicalByTextForEngine.get(
        r.description.replace(/\s+/g, " ").trim().toLowerCase(),
      );
      return {
        id: r.id,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        evidence: r.evidence,
        // Prefer STI-sealed kind — never invent a second semantic interpretation from raw text.
        semanticKind: fromSti?.semanticKind ?? ("UNKNOWN" as const),
        sourceDocument: m?.sourceDocument ?? null,
        page: m?.page ?? r.sourcePage ?? null,
        section: m?.section ?? r.sourceSection ?? null,
        rationale: m?.rationale ?? null,
        evidenceConflict: m?.evidenceConflict ?? false,
      };
    });

    const tenderTextCorpus = [
      extraction.title || tender.title,
      extraction.client ?? tender.client ?? "",
      safeExtractedText,
      ...engineInputRequirements.map((r) => `${r.category} ${r.description}`),
    ].join("\n");

    const tenderContext = {
      title: extraction.title || tender.title,
      client: extraction.client ?? tender.client,
      country: extraction.country ?? tender.country,
      industry: extraction.industry ?? tender.industry,
      tenderText: tenderTextCorpus,
    };

    await transitionAnalysisPhase(
      phaseTimer,
      tenderId,
      "ANALYZING",
      ANALYSIS_PHASE.EVALUATING,
    );

    // Decision Engine outputs (GO / CONDITIONAL GO / NO-BID) are plan-gated.
    const { assertFeature } = await import("@/services/entitlements");
    await assertFeature(tender.companyId, "advanced_decision_engine");

    const preliminary = runDecisionEngine({
      profile,
      requirements: engineInputRequirements,
      estimatedValue: tenderEstimatedValue,
      tenderContext,
      ai: null,
    });

    const ai = await aiService.reasonAboutDecision({
      profile,
      requirements: preliminary.requirements,
      tenderMeta: {
        title: extraction.title || tender.title,
        client: extraction.client ?? tender.client,
        estimatedValue: tenderEstimatedValue,
        country: extraction.country ?? tender.country,
        industry: extraction.industry ?? tender.industry,
      },
      deterministicNotes: preliminary.findings.map((f) => f.description),
      companyFitSummary: preliminary.reasoning,
      companyId: tender.companyId,
      tenderId,
    });
    await recordUsage({
      companyId: tender.companyId,
      action: "AI_REASONING",
      metadata: { tenderId },
    });

    const decision = runDecisionEngine({
      profile,
      requirements: engineInputRequirements,
      estimatedValue: tenderEstimatedValue,
      tenderContext,
      ai: {
        suggestedDecision: ai.suggestedDecision,
        fitScore: ai.fitScore,
        confidence: ai.confidence,
        reasoning: ai.reasoning,
      },
    });

    const requirementStatusUpdates = decision.requirements
      .filter((req) => req.id)
      .map((req) =>
        prisma.tenderRequirement.update({
          where: { id: req.id! },
          data: { status: req.status },
        }),
      );
    if (requirementStatusUpdates.length > 0) {
      await Promise.all(requirementStatusUpdates);
    }

    if (decision.findings.length > 0) {
      await prisma.tenderRisk.createMany({
        data: decision.findings.map((finding, i) => ({
          tenderId,
          severity: finding.severity,
          category: finding.category,
          description: finding.description,
          sortOrder: i,
        })),
      });
    }

    if (ai.risks.length > 0) {
      const { sanitizeAiRiskSeverity } = await import("@/domain/risk/sanitize-ai-risk");
      await prisma.tenderRisk.createMany({
        data: ai.risks.map((risk, i) => ({
          tenderId,
          severity: sanitizeAiRiskSeverity(risk.severity, risk.description),
          category: risk.category,
          description: risk.description,
          sourcePage: risk.sourcePage ?? null,
          mitigation: risk.mitigation ?? null,
          sortOrder: 100 + i,
        })),
      });
    }

    const actions =
      ai.nextActions.length > 0
        ? ai.nextActions
        : [
            {
              title:
                decision.decision === "NO_BID"
                  ? "Record no-bid rationale for audit trail"
                  : decision.decision === "BID"
                    ? "Assign bid lead and draft response timeline"
                    : "Resolve uncertain requirements before committing effort",
              description: null as string | null,
              priority: 1,
            },
          ];

    if (actions.length > 0) {
      await prisma.nextAction.createMany({
        data: actions.map((action, i) => ({
          tenderId,
          title: action.title,
          description: action.description ?? null,
          priority: action.priority,
          sortOrder: i,
        })),
      });
    }

    const [missingDocRows, evidenceRows, riskRows, tenderDocs] = await Promise.all([
      prisma.missingDocument.findMany({
        where: { tenderId },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.tenderEvidence.findMany({
        where: { tenderId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.tenderRisk.findMany({
        where: { tenderId },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.tenderDocument.findMany({
        where: { tenderId },
        select: { id: true, fileName: true },
      }),
    ]);

    const readiness = computeTenderReadiness({
      requirements: decision.requirements,
      missingDocuments: missingDocRows.map((d) => ({
        id: d.id,
        documentName: d.documentName,
        reason: d.reason,
        severity: d.severity,
      })),
      fit: decision.fitBreakdown,
      profileHasAnyCapability: !isProfileSparse(profile),
    });

    await transitionAnalysisPhase(
      phaseTimer,
      tenderId,
      "ANALYZING",
      ANALYSIS_PHASE.BUILDING_INTELLIGENCE,
    );

    const docNameById = new Map(tenderDocs.map((d) => [d.id, d.fileName]));

    const intelligence = buildTenderIntelligence({
      tenderId,
      documentName: packageLabel,
      tenderDeadline:
        deadline && !Number.isNaN(deadline.getTime()) ? deadline : tender.deadline,
      extractedText: safeExtractedText,
      requirements: decision.requirements.map((r) => {
        const persisted = requirementsAfterMatch.find((x) => x.id === r.id);
        const canonical = canonicalRequirements.find(
          (c) =>
            c.requirement.replace(/\s+/g, " ").trim().toLowerCase() ===
            r.description.replace(/\s+/g, " ").trim().toLowerCase(),
        );
        return {
          id: r.id!,
          category: r.category,
          description: r.description,
          mandatory: r.mandatory,
          value: r.value,
          status: r.status,
          sourcePage: persisted?.sourcePage ?? canonical?.page ?? null,
          sourceSection: persisted?.sourceSection ?? canonical?.sourceSection ?? null,
          evidence: r.evidence ?? null,
          fitStatus: r.fitStatus ?? null,
          evidenceConflict: r.evidenceConflict ?? false,
          semanticKind: r.semanticKind ?? canonical?.semanticKind ?? null,
          // Decision/match sourceDocument is company evidence — never tender source.
          sourceDocument: canonical?.sourceDocument ?? null,
          evidenceText: canonical?.evidenceText ?? persisted?.evidence ?? null,
          sourceCell: canonical?.sourceCell ?? null,
          columnHeader: canonical?.columnHeader ?? null,
          rowLabel: canonical?.rowLabel ?? null,
          versionLabel: canonical?.versionLabel ?? null,
          locator: canonical?.locator ?? null,
          sourceCompleteness: canonical?.sourceCompleteness ?? null,
          fitProvenanceExcerpt: r.fitProvenance?.excerpt ?? null,
        };
      }),
      deadlineEvidence: packageIdentity?.deadline.evidence ?? heuristicPack.deadlineEvidence ?? null,
      deadlineSourceDocument:
        packageIdentity?.deadline.sources[0]?.fileName ?? null,
      evidence: evidenceRows.map((e) => ({
        id: e.id,
        requirementId: e.requirementId,
        sourcePage: e.sourcePage,
        sourceSection: e.sourceSection,
        evidenceText: e.evidenceText,
        verificationStatus: e.verificationStatus,
        teamTaskId: e.teamTaskId,
        documentId: e.documentId,
        documentName: e.documentId ? docNameById.get(e.documentId) ?? null : null,
        verificationReason: e.verificationReason,
        verifiedById: e.verifiedById,
        verifiedAt: e.verifiedAt,
      })),
      readiness,
      findings: decision.findings,
      existingRisks: riskRows.map((r) => ({
        id: r.id,
        category: r.category,
        description: r.description,
        severity: r.severity,
        sourcePage: r.sourcePage,
        mitigation: r.mitigation,
      })),
      decision: decision.decision,
      fitScore: decision.fitScore,
    });

    assertAnalysisReadyForCompletion({
      requirements: canonicalRequirements,
      intelligence,
    });

    assertCanonicalRequirementInvariants({
      canonicalRequirementCount: decision.requirements.length,
      readiness,
      intelligence,
    });

    const aiTrustSnapshot = buildPipelineTrustSnapshot({
      scan: trustScan,
      pageContext: pageTrustContext,
    });
    assertPipelineTrustSnapshotIntegrity(aiTrustSnapshot);
    intelligence.aiTrust = aiTrustSnapshot;
    intelligence.universalTenderIntelligence = utiSummary;

    const { buildFeaturesForTender, lookupSimilarCompanySignal } = await import(
      "@/services/learning"
    );
    const missingMandatory = decision.requirements.filter(
      (r) => r.mandatory && (r.status === "FAILED" || r.status === "MISSING"),
    ).length;
    const { features, featureKey } = buildFeaturesForTender({
      industry: extraction.industry ?? tender.industry ?? refreshedProfile?.industry ?? null,
      country: extraction.country ?? tender.country ?? refreshedProfile?.country ?? null,
      companySize: refreshedProfile?.companySize ?? tender.company.companySize,
      employeeRange: refreshedProfile?.employeeRange ?? null,
      fitScore: decision.fitScore,
      readinessScore: readiness.score,
      decision: decision.decision,
      missingMandatoryCount: missingMandatory,
      estimatedValue: tenderEstimatedValue,
    });
    const learningSignal = await lookupSimilarCompanySignal({
      features,
      featureKey,
      missingMandatoryCount: missingMandatory,
      hardNoBid: decision.findings.some((f) => f.forcesDecision === "NO_BID"),
      forcedReview:
        decision.decision === "REVIEW" ||
        decision.findings.some((f) => f.forcesDecision === "REVIEW"),
      readinessMissing: readiness.counts.missing,
    });

    // Prefer verified global signal; else surface company-private historical CANDIDATE signal
    if (learningSignal.detected) {
      intelligence.learningSignal = learningSignal;
    } else if (knowledge?.historicalOutcomes.length) {
      intelligence.learningSignal = historicalSignalFromKnowledge(knowledge);
    } else {
      intelligence.learningSignal = null;
    }

    if (intelligence.learningSignal?.detected) {
      const lines = [
        intelligence.decisionContext,
        "",
        "Historical intelligence (priority 5 — secondary only):",
        intelligence.learningSignal.headline,
        intelligence.learningSignal.priorityNote,
      ];
      if (
        !intelligence.learningSignal.influenceAllowed &&
        intelligence.learningSignal.suppressedReason
      ) {
        lines.push(intelligence.learningSignal.suppressedReason);
      }
      intelligence.decisionContext = lines.join("\n");
    }

    // Decision Memory: compare with prior company decisions (context only — never changes scores)
    const {
      findRelevantDecisionMemories,
      recordDecisionMemory,
    } = await import("@/services/decision-memory");
    const { findOutcomeLearningForAnalysis } = await import(
      "@/services/decision-outcome-learning"
    );
    const [memoryInsights, outcomeLearningInsights] = await Promise.all([
      findRelevantDecisionMemories({
        companyId: tender.companyId,
        currentFeatures: features,
        excludeTenderId: tenderId,
      }),
      findOutcomeLearningForAnalysis({
        companyId: tender.companyId,
        currentFeatures: features,
        excludeTenderId: tenderId,
      }),
    ]);
    intelligence.decisionMemoryInsights = memoryInsights;
    intelligence.outcomeLearningInsights = outcomeLearningInsights;

    if (memoryInsights.matches.length > 0) {
      const memLines = [
        intelligence.decisionContext,
        "",
        "Decision Memory (reference only — does not change Current Analysis):",
        ...memoryInsights.matches.slice(0, 3).map(
          (m) =>
            `• Historical Decision (${m.decisionLabel}): ${m.title} — ${m.relevanceReasons.slice(0, 2).join("; ")}`,
        ),
        memoryInsights.historicalNote,
      ];
      intelligence.decisionContext = memLines.join("\n");
    }

    // Seed team workflow tasks BEFORE finalize so critical open tasks
    // are visible to the Decision Engine on first analysis.
    try {
      const { seedTeamTasksFromAnalysis } = await import(
        "@/services/team-workflow"
      );
      await seedTeamTasksFromAnalysis({
        companyId: tender.companyId,
        tenderId,
        verificationChains: intelligence.verificationIntelligence?.chains,
      });
    } catch (error) {
      logInfo("team_workflow.seed_skipped", {
        tenderId,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    // Tender Decision Engine finalize: combine readiness/compliance/risks/deadline/Memory
    // into an explainable GO / CONDITIONAL GO / NO-BID — Memory never overrides evidence.
    const { finalizeTenderDecision } = await import(
      "@/domain/decision/tender-decision-engine"
    );
    const preFinalizeDecision = decision.decision;
    const { getTenderWorkflowSummary } = await import(
      "@/services/team-workflow"
    );
    const teamWorkflow = await getTenderWorkflowSummary({
      companyId: tender.companyId,
      tenderId,
    }).catch(() => null);
    const finalized = finalizeTenderDecision({
      engine: decision,
      aiParticipated: true,
      readiness: {
        score: readiness.score,
        counts: readiness.counts,
        attention: readiness.attention,
        recommendation: readiness.recommendation,
      },
      compliance: intelligence.complianceSummary,
      complianceMatrix: intelligence.complianceMatrix,
      keyBlockers: intelligence.keyBlockers,
      reviewItems: intelligence.reviewItems,
      decisionDrivers: intelligence.decisionDrivers,
      actionItems: intelligence.actionItems,
      structuredRiskTitles: intelligence.risks.map((r) => ({
        title: r.title,
        severity: r.severityCanonical ?? r.severity,
        evidenceState: r.evidenceState ?? null,
        fitStatus: r.fitStatus ?? null,
      })),
      deadline:
        deadline && !Number.isNaN(deadline.getTime())
          ? deadline
          : tender.deadline,
      asOf: new Date(),
      memoryInsights,
      teamWorkflow,
    });
    decision.decision = finalized.decision;
    decision.confidence = finalized.confidence;
    decision.reasoning = finalized.reasoning;
    intelligence.tenderDecisionRecommendation = finalized.recommendation;
    intelligence.decisionContext = [
      finalized.recommendation.summary,
      "",
      intelligence.decisionContext,
    ].join("\n");

    // Deadline timezone UNKNOWN (source did not state a zone) must not invent a
    // zone and must not release GO. Downgrade BID → REVIEW before Guardian.
    {
      const { isDeadlineTimezoneUnknown } = await import(
        "@/domain/tender-requirements/deadline-timezone"
      );
      const releaseTz =
        extraction.deadlineTimezone ??
        heuristicPack.deadlineTimezone ??
        tender.deadlineTimezone ??
        null;
      const releaseIso = extraction.deadlineIso ?? heuristicPack.deadlineIso ?? null;
      if (
        releaseIso &&
        isDeadlineTimezoneUnknown(releaseTz) &&
        decision.decision === "BID"
      ) {
        const { toTenderDecisionLabel } = await import(
          "@/domain/decision/labels"
        );
        decision.decision = "REVIEW";
        if (intelligence.tenderDecisionRecommendation) {
          intelligence.tenderDecisionRecommendation = {
            ...intelligence.tenderDecisionRecommendation,
            decision: "REVIEW",
            displayLabel: toTenderDecisionLabel("REVIEW"),
            summary:
              `${intelligence.tenderDecisionRecommendation.summary}\n\nDeadline timezone UNKNOWN (not stated in source) — CONDITIONAL GO; wall-clock preserved without inventing a timezone.`,
          };
        }
        logInfo("deadline.timezone_unknown_review", {
          tenderId,
          deadlineIso: releaseIso.slice(0, 32),
        });
      }
    }

    // If evidence refinement changed the enum, rebuild learning features for consistency
    let finalFeatureKey = featureKey;
    let finalFeatures = features;
    if (finalized.decision !== preFinalizeDecision) {
      const rebuilt = buildFeaturesForTender({
        industry: extraction.industry ?? tender.industry ?? refreshedProfile?.industry ?? null,
        country: extraction.country ?? tender.country ?? refreshedProfile?.country ?? null,
        companySize: refreshedProfile?.companySize ?? tender.company.companySize,
        employeeRange: refreshedProfile?.employeeRange ?? null,
        fitScore: decision.fitScore,
        readinessScore: readiness.score,
        decision: decision.decision,
        missingMandatoryCount: missingMandatory,
        estimatedValue: tenderEstimatedValue,
      });
      finalFeatures = rebuilt.features;
      finalFeatureKey = rebuilt.featureKey;
    }

    (intelligence as { analysisTrace?: unknown }).analysisTrace = {
      documentKind,
      decisionLabel: finalized.displayLabel,
      decisionHash: finalized.recommendation.contentHash,
      steps: [
        {
          field: "documentKind",
          finalValue: documentKind,
          rule: "classifyDocument",
          structuredInput: knowledgeDraft?.classificationSignals ?? analysisParts.map((p) => p.documentKind),
          sourceDocument: packageLabel,
          page: "UNKNOWN",
          section: null,
          originalExcerpt: null,
        },
        {
          field: "estimatedValue",
          finalValue: tenderEstimatedValue,
          rule: "tender_source_only",
          structuredInput: { extraction: extraction.estimatedValue, tender: tender.estimatedValue },
          sourceDocument: packageLabel,
          page: "UNKNOWN",
          section: null,
          originalExcerpt: null,
        },
        {
          field: "requirementsCount",
          finalValue: cleanedRequirements.length,
          rule: "extractTenderFacts",
          structuredInput: cleanedRequirements.map((r) => r.description),
          sourceDocument: packageLabel,
          page: "UNKNOWN",
          section: null,
          originalExcerpt: null,
        },
        {
          field: "tenderDecision",
          finalValue: finalized.displayLabel,
          rule: "tender_decision_engine",
          structuredInput: {
            decision: finalized.decision,
            contentHash: finalized.recommendation.contentHash,
            hardFailure: finalized.hardFailure,
            criticalBlockers: finalized.recommendation.criticalBlockers,
          },
          sourceDocument: packageLabel,
          page: "UNKNOWN",
          section: null,
          originalExcerpt: null,
        },
      ],
      invariantsChecked: assertKnowledgeInvariants({
        documentKind: documentKind as "TENDER" | "COMPANY_PROFILE" | "UNKNOWN" | "SUPPORTING_EVIDENCE" | "HISTORICAL_OUTCOME",
        knowledge,
        requirementsCount: cleanedRequirements.length,
      }).checked,
      generatedAt: new Date().toISOString(),
    };

    await prisma.tender.update({
      where: { id: tenderId },
      data: { learningFeatureKey: finalFeatureKey },
    });

    // Silence unused if learning path still uses original features for memory (already done)
    void finalFeatures;

    await transitionAnalysisPhase(
      phaseTimer,
      tenderId,
      "ANALYZING",
      ANALYSIS_PHASE.FINALIZING,
    );

    const { buildBidScoreFromAnalysis } = await import("@/domain/bid-score");
    const analyzedAt = new Date();
    const bidScore = buildBidScoreFromAnalysis({
      fitScore: decision.fitScore,
      fitBreakdown: decision.fitBreakdown,
      readiness,
      intelligence,
      estimatedValue: tenderEstimatedValue,
      deadline:
        deadline && !Number.isNaN(deadline.getTime()) ? deadline : tender.deadline,
      decision: decision.decision,
      asOf: analyzedAt,
    });

    const wasFirst = !(await prisma.tenderDecision.findFirst({
      where: { companyId: tender.companyId, NOT: { tenderId } },
      select: { id: true },
    }));

    // Capture prior analysis for Smart Alerts deltas (before overwrite)
    const priorDecisionRow = await prisma.tenderDecision.findUnique({
      where: { tenderId },
      select: {
        decision: true,
        fitScore: true,
        bidScoreBreakdown: true,
        intelligenceBreakdown: true,
      },
    });
    const { priorSnapshotFromStored } = await import("@/services/smart-alerts");
    const priorSnapshot = priorDecisionRow
      ? priorSnapshotFromStored(priorDecisionRow)
      : null;

    // Tender Action Plan — traceable actions from unresolved canonical state (not a second decision engine)
    try {
      const { hasFeature } = await import("@/services/entitlements");
      const actionPlanAllowed = await hasFeature(
        tender.companyId,
        "tender_action_plan",
      );
      if (!actionPlanAllowed) {
        logInfo("action_plan.build_skipped", {
          tenderId,
          reason: "entitlement_disabled",
        });
      } else {
      const { buildTenderActionPlan } = await import("@/domain/tender-action-plan");
      const teamTasksForPlan = await prisma.teamWorkflowTask.findMany({
        where: {
          companyId: tender.companyId,
          tenderId,
          status: { not: "CANCELLED" },
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          requirementId: true,
          riskId: true,
          missingDocId: true,
          department: true,
          deadline: true,
        },
      });
      const priorIntelligence = priorDecisionRow?.intelligenceBreakdown as
        | {
            actionPlan?: import("@/domain/tender-action-plan").TenderActionPlanBundle | null;
          }
        | null
        | undefined;
      intelligence.actionPlan = buildTenderActionPlan({
        tenderId,
        companyId: tender.companyId,
        tenderDeadline:
          deadline && !Number.isNaN(deadline.getTime()) ? deadline : tender.deadline,
        complianceMatrix: intelligence.complianceMatrix,
        evidenceIntelligence: intelligence.evidenceIntelligence,
        risks: intelligence.risks,
        keyBlockers: intelligence.keyBlockers,
        readiness,
        fitBreakdown: decision.fitBreakdown,
        recommendation: intelligence.tenderDecisionRecommendation,
        teamTasks: teamTasksForPlan.map(
          (t: (typeof teamTasksForPlan)[number]) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            requirementId: t.requirementId,
            riskId: t.riskId,
            missingDocId: t.missingDocId,
            department: t.department,
            deadline: t.deadline,
          }),
        ),
        previousPlan: priorIntelligence?.actionPlan ?? null,
        asOf: analyzedAt,
      });
      const { assertActionPlanIntegrity } = await import("@/domain/tender-action-plan");
      assertActionPlanIntegrity({
        canonicalRequirementCount: canonicalRequirements.length,
        actionPlan: intelligence.actionPlan,
        hardBlockerCount: intelligence.keyBlockers.length,
      });
      }
    } catch (error) {
      // Never leave a rejected action plan on the release payload — Guardian would
      // see stale/over-count actions and block COMPLETE incorrectly.
      intelligence.actionPlan = null;
      logInfo("action_plan.build_skipped", {
        tenderId,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    // Decision Validation Guardian — last structured gate before persist/COMPLETED.
    // Validates existing structured data only (no OCR / extraction / LLM re-run).
    {
      const {
        assertFinalReleaseIntegrity,
        buildDecisionGuardianInput,
        hashCanonicalReleasePayload,
        DecisionGuardianError,
        isDecisionGuardianSnapshot,
      } = await import("@/domain/decision-validation");
      const deadlineTz =
        extraction.deadlineTimezone ?? tender.deadlineTimezone ?? null;
      const deadlineIso = extraction.deadlineIso ?? heuristicPack.deadlineIso ?? null;
      const guardianReqs = decision.requirements.map((r, i) => {
        const canonical = canonicalRequirements[i];
        const fit = r.fitStatus ?? null;
        const companyEvidence =
          fit === "CONFIRMED_FIT" || fit === "CONFIRMED_GAP"
            ? r.evidence ?? null
            : null;
        return {
          id: r.id ?? canonical?.id ?? `req-${i + 1}`,
          requirement: r.description,
          description: r.description,
          category: r.category,
          semanticKind: r.semanticKind ?? canonical?.semanticKind ?? null,
          obligationStrength: canonical?.obligationStrength ?? null,
          mandatory: r.mandatory,
          sourceSection:
            (typeof r.section === "string" ? r.section : null) ??
            canonical?.sourceSection ??
            null,
          page:
            (typeof r.page === "number" ? r.page : null) ??
            canonical?.page ??
            null,
          evidenceText: canonical?.evidenceText ?? r.evidence ?? null,
          companyEvidenceText: companyEvidence,
          hasCompanyEvidence: Boolean(companyEvidence?.trim()),
          value: r.value ?? null,
          fitStatus: fit ?? r.status ?? null,
          status: r.status ?? null,
        };
      });
      const actionItems = intelligence.actionPlan?.items ?? [];
      // Release identity must match Web/PDF publication hash (compliance matrix).
      const contentHash = hashCanonicalReleasePayload(
        intelligence.complianceMatrix.map((row) => ({
          id: row.requirementId,
          text: row.requirement,
        })),
      );
      try {
        const guardianInput = buildDecisionGuardianInput({
            textLength: safePackageText.trim().length,
            readable: safePackageText.trim().length >= 80,
            validityPassed: true,
            fileName: packageLabel,
            requirements: guardianReqs,
            matrix: intelligence.complianceMatrix.map((row) => ({
              requirementId: row.requirementId,
            })),
            readinessItems: readiness.items.map((item) => ({ id: item.id })),
            actions: actionItems.map((a) => ({
              linkedRequirementId: a.linkedRequirementId,
              blocking: a.blocking,
              sourceType: a.sourceType,
              title: a.title,
              simulationOnly: a.simulationOnly,
            })),
            decision: {
              decision: decision.decision,
              hardFailure: Boolean(
                intelligence.tenderDecisionRecommendation?.hardFailure,
              ),
              hardBlockerCount: intelligence.keyBlockers.length,
              aiSuggestedDecision: ai.suggestedDecision ?? null,
              aiOverrodeCanonical: false,
            },
            deadline: {
              deadlineIso,
              deadlineTimezone: deadlineTz,
              expectedLocalHour: heuristicPack.deadlineLocalHour ?? null,
              expectedLocalMinute: heuristicPack.deadlineLocalMinute ?? null,
              // Human tender excerpt only — never `extracted:<ISO>` (regex false-positive
              // on T10:30:00 matching "30:00" and blocking Guardian release).
              sourceEvidence: heuristicPack.deadlineEvidence ?? null,
            },
            fitScore: decision.fitScore,
            fitBreakdownOverall: decision.fitBreakdown?.overall ?? null,
            reasoning: decision.reasoning,
            complianceSummaryTotal:
              intelligence.complianceSummary?.totalRequirements ?? null,
            requireDocumentValidity: true,
            tenderSourceText: safePackageText,
            risks: intelligence.risks.map((risk) => ({
              id: risk.id,
              requirementId: risk.requirementId ?? null,
              severity: risk.severityCanonical ?? risk.severity,
              fitStatus: risk.fitStatus ?? null,
              evidenceState: risk.evidenceState ?? null,
              title: risk.title,
            })),
            contradictions: null,
            derivedDeadline: deadlineIso
              ? {
                  canonicalIso: deadlineIso,
                  canonicalTimezone: deadlineTz,
                  representations: [
                    {
                      channel: "WEB" as const,
                      iso: deadlineIso,
                      timezone: deadlineTz,
                    },
                    {
                      channel: "PDF" as const,
                      iso: deadlineIso,
                      timezone: deadlineTz,
                    },
                  ],
                }
              : null,
            staleResult: {
              canonicalContentHash: contentHash,
              projectedContentHash: contentHash,
              analyzedAt: analyzedAt.toISOString(),
              projectedAnalyzedAt: analyzedAt.toISOString(),
            },
          });
        const guardianResult = assertFinalReleaseIntegrity(
          guardianInput,
          contentHash,
        );
        intelligence.decisionGuardian = guardianResult.snapshot;
        // Lifecycle lock: never persist COMPLETE without a valid release stamp.
        if (!isDecisionGuardianSnapshot(intelligence.decisionGuardian)) {
          throw new AppError(
            ErrorCode.INTERNAL,
            "Decision Guardian snapshot missing after final gate — analysis cannot complete.",
            500,
          );
        }
        logInfo("decision_guardian.passed", {
          tenderId,
          durationMs: guardianResult.durationMs,
          checksRun: guardianResult.checksRun.length,
          advisoryCount: guardianResult.advisoryFailures.length,
          contentHash,
        });
      } catch (err) {
        if (err instanceof DecisionGuardianError) {
          logError("decision_guardian.blocked", {
            tenderId,
            blocking: err.result.blockingFailures.map((f) => ({
              code: f.validationCode,
              item: f.affectedCanonicalItemId,
              explanation: f.explanation,
            })),
            durationMs: err.result.durationMs,
          });
        }
        throw err;
      }
    }

    {
      const { isDecisionGuardianSnapshot: hasGuardianStamp } = await import(
        "@/domain/decision-validation"
      );
      if (!hasGuardianStamp(intelligence.decisionGuardian)) {
        throw new AppError(
          ErrorCode.INTERNAL,
          "Decision Guardian snapshot required before persisting COMPLETE analysis.",
          500,
        );
      }
    }

    const { freezeCanonicalAnalysisSnapshot, STI_ADMISSION_SNAPSHOT_VERSION } =
      await import("@/domain/tender-intelligence/canonical-snapshot");
    const { freezeAndAssertAnalysisIntegrity } = await import(
      "@/domain/analysis-integrity"
    );
    const persistedDocs = await prisma.tenderDocument.findMany({
      where: { tenderId },
      select: { fileName: true, processingStatus: true, documentKind: true },
      orderBy: { createdAt: "asc" },
    });
    const requirementIds = decision.requirements
      .map((r) => r.id)
      .filter((id): id is string => Boolean(id));

    const { toContextualIntelligence } = await import(
      "@/domain/semantic-tender-intelligence/contextual-intelligence"
    );
    const contextualIntelligence = toContextualIntelligence(
      semanticCandidates.rejected,
      semanticCandidates.metadata,
      80,
    );

    const stiExclusions = [
      ...(admissionAudit?.stiFinalGateRejected ?? []).map((r) => ({
        exclusionCode: r.exclusionCode,
        exclusionReason: r.exclusionReason,
        actor: r.candidate.actor ?? null,
        lifecyclePhase: r.candidate.procurementPhase ?? null,
        purpose: r.candidate.clausePurpose ?? null,
        textSnippet: (r.candidate.fullRequirementText ?? "").slice(0, 160),
      })),
      ...(admissionAudit?.firewallRejected ?? []).map((r) => ({
        exclusionCode: r.exclusionCode,
        exclusionReason: r.exclusionReason,
        actor: r.actor,
        lifecyclePhase: r.lifecyclePhase,
        purpose: r.purpose,
        textSnippet: r.requirement,
      })),
    ].slice(0, 200);

    const canonicalSnapshot = freezeCanonicalAnalysisSnapshot({
      tenderId,
      packageLabel,
      // Snapshot inventory = persisted docs (Intake-stored). Never shrink to filtered subsets.
      discoveredFileCount: persistedDocs.length,
      files: persistedDocs.map((d) => ({
        fileName: d.fileName,
        processingStatus: d.processingStatus,
        role: (() => {
          const idDoc = packageIdentity?.documents.find((p) => p.fileName === d.fileName);
          if (idDoc && idDoc.role !== "UNKNOWN") {
            return identityRoleToStiString(idDoc.role);
          }
          return (
            assembly.parts.find((p) => p.fileName === d.fileName)?.role ??
            d.documentKind ??
            null
          );
        })(),
        error: d.processingStatus === "FAILED" ? "FILE_EXTRACTION_FAILED" : null,
      })),
      metadata: {
        title: extraction.title ?? tender.title,
        client: extraction.client ?? null,
        deadlineIso: extraction.deadlineIso ?? null,
        deadlineTimezone: extraction.deadlineTimezone ?? null,
        factsNote:
          [
            packageMetadataNote,
            truncatedDocumentCount > 0
              ? `TEXT_TRUNCATED:${truncatedDocumentCount} document(s) truncated by source/parser/OCR`
              : null,
            packageTextTruncated ? "PACKAGE_TEXT_TRUNCATED" : null,
          ]
            .filter(Boolean)
            .join(" | ") || null,
        metadataStatus:
          packageIdentity?.buyer.status ??
          heuristicPack.packageMetadata?.buyer.status ??
          null,
        textTruncated: packageTextTruncated,
        deadlineStatus: packageIdentity?.deadline.status ?? null,
        titleStatus: packageIdentity?.title.status ?? null,
        documentRoles: packageIdentity?.documents.map((doc) => ({
          fileName: doc.fileName,
          role: identityRoleToStiString(doc.role),
          completeness: doc.completeness,
          confidence: doc.confidence,
        })),
        packageIdentity: packageIdentity
          ? {
              version: packageIdentity.version,
              buyer: packageIdentity.buyer,
              title: packageIdentity.title,
              estimatedValue: packageIdentity.estimatedValue,
              reference: packageIdentity.reference,
              location: packageIdentity.location,
              country: packageIdentity.country,
              procurementType: packageIdentity.procurementType,
              deadline: packageIdentity.deadline,
              documents: packageIdentity.documents,
            }
          : null,
        requirementProvenance: intelligence.complianceMatrix.map((row) => ({
          requirementId: row.requirementId,
          tenderSource: row.tenderSource!,
        })).filter((row) => row.tenderSource),
      },
      requirementIds,
      summary: intelligence.complianceSummary,
      stiAdmission: {
        version: STI_ADMISSION_SNAPSHOT_VERSION,
        sealedAt: new Date().toISOString(),
        admittedCount:
          admissionAudit?.admittedCount ?? canonicalRequirements.length,
        finalGateRejectedCount: admissionAudit?.stiFinalGateRejected.length ?? 0,
        firewallRejectedCount: admissionAudit?.firewallRejected.length ?? 0,
        exclusions: stiExclusions,
        contextualIntelligence,
      },
    });
    const { integrity: analysisIntegrity } = freezeAndAssertAnalysisIntegrity({
      snapshot: canonicalSnapshot,
      canonicalRequirementCount: canonicalRequirements.length,
      requirementTexts: canonicalRequirements.map((r) => r.requirement),
      uniqueRequirementIds: requirementIds,
      matrix: intelligence.complianceMatrix,
      summary: intelligence.complianceSummary,
      readiness,
      actionPlan: intelligence.actionPlan ?? null,
      fitStatuses: decision.requirements.map((r) => ({
        fitStatus: r.fitStatus ?? null,
        companyEvidence:
          r.fitStatus === "CONFIRMED_GAP" || r.fitStatus === "CONFIRMED_FIT"
            ? r.evidence ?? r.fitProvenance?.excerpt ?? null
            : null,
      })),
      fitRows: decision.requirements.map((r, i) => {
        const canonical = canonicalRequirements[i];
        return {
          requirementId: r.id ?? canonical?.id ?? null,
          fitStatus: r.fitStatus ?? null,
          companyEvidence:
            r.fitStatus === "CONFIRMED_GAP" || r.fitStatus === "CONFIRMED_FIT"
              ? r.evidence ?? r.fitProvenance?.excerpt ?? null
              : null,
          tenderEvidence:
            canonical?.evidenceText ?? r.evidence ?? null,
          conditionText:
            canonical?.obligationStrength === "CONDITIONAL"
              ? canonical.sourceSection ?? canonical.requirement
              : null,
          lotLabel: canonical?.lotApplicability ?? null,
          obligationStrength: canonical?.obligationStrength ?? null,
          semanticKind:
            r.semanticKind ?? canonical?.semanticKind ?? null,
        };
      }),
      risks: (intelligence.risks ?? []).map((r) => ({
        id: r.id,
        requirementId: r.requirementId ?? null,
        linkedRequirementIds: r.linkedRequirementIds ?? null,
        title: r.title,
        underlyingKey: r.underlyingKey ?? null,
        evidenceState: r.evidenceState ?? null,
        fitStatus: r.fitStatus ?? null,
      })),
      actions: (intelligence.actionPlan?.items ?? []).map((a) => ({
        linkedRequirementId: a.linkedRequirementId ?? null,
        requirementText: a.requirementText ?? null,
        title: a.title,
      })),
      metadataStatus:
        packageIdentity?.buyer.status ??
        heuristicPack.packageMetadata?.buyer.status ??
        null,
      metadataFactsNote: packageMetadataNote || null,
    });
    intelligence.canonicalSnapshot = canonicalSnapshot;
    intelligence.analysisIntegrity = analysisIntegrity;
    intelligence.complianceSummary = {
      ...intelligence.complianceSummary,
      totalRequirements: canonicalSnapshot.counts.totalRequirements,
      verifiedRequirements: canonicalSnapshot.counts.verifiedRequirements,
      needsVerification: canonicalSnapshot.counts.needsVerification,
      confirmedGaps: canonicalSnapshot.counts.confirmedGaps,
    };

    const { certifyAnalysis, AnalysisCertificationError } = await import(
      "@/domain/tender-certification"
    );
    const utiProvenanceByFileId = new Map<string, string | null>(
      utiPackage.documents.map((d) => [
        d.fileId,
        d.archiveProvenance?.archivePath ?? null,
      ]),
    );
    const inventoryContract = assertFinalPackageInventoryContract({
      intakeReport,
      persistedDocumentCount: persistedDocs.length,
      utiInventoryCount: utiSummary.inventoryCount,
      snapshotDiscoveredCount: canonicalSnapshot.package.discoveredFileCount,
      utiFileIds: utiPackage.documents.map((d) => d.fileId),
      utiProvenanceByFileId,
      requireIdentityReconcile: true,
    });
    if (inventoryContract.legacyConflict?.hasConflict) {
      logInfo("intake.legacy_counter_conflict", {
        tenderId,
        message: inventoryContract.legacyConflict.message,
        identityProceedableCount:
          inventoryContract.legacyConflict.identityProceedableCount,
        legacySum: inventoryContract.legacyConflict.legacySum,
      });
    }
    if (inventoryContract.identityNamespace === "LEGACY_NAMESPACE_SKIP") {
      logInfo("intake.identity_namespace_legacy_skip", {
        tenderId,
        intakeStoredCount: inventoryContract.intakeStoredCount,
        utiInventoryCount: utiSummary.inventoryCount,
      });
    }
    if (!inventoryContract.ok) {
      throw new AppError(
        ErrorCode.INTERNAL,
        `Package inventory invariant violated: [${inventoryContract.code}] ${inventoryContract.message}`,
        500,
      );
    }
    const intakeStored = inventoryContract.intakeStoredCount;
    let tenderCertification;
    try {
      tenderCertification = certifyAnalysis({
        tenderId,
        packageLabel,
        snapshot: canonicalSnapshot,
        integrity: {
          version: analysisIntegrity.version,
          partitionValid: analysisIntegrity.partitionValid,
          counts: analysisIntegrity.counts,
          checksPassed: analysisIntegrity.checksPassed,
        },
        guardianOk: Boolean(
          intelligence.decisionGuardian &&
            (intelligence.decisionGuardian as { ok?: boolean }).ok === true,
        ),
        canonicalRequirements: decision.requirements.map((r, i) => {
          const c = canonicalRequirements[i];
          return {
            id: r.id ?? c?.id ?? null,
            requirement: c?.requirement ?? r.description,
            semanticKind: r.semanticKind ?? c?.semanticKind ?? null,
            obligationStrength: c?.obligationStrength ?? null,
            lotApplicability: c?.lotApplicability ?? null,
            sourceDocument: c?.sourceDocument ?? r.sourceDocument ?? null,
            sourceSection: c?.sourceSection ?? (typeof r.section === "string" ? r.section : null),
            page: c?.page ?? (typeof r.page === "number" ? r.page : null),
            evidenceText: c?.evidenceText ?? r.evidence ?? null,
          };
        }),
        fitRows: decision.requirements.map((r, i) => {
          const canonical = canonicalRequirements[i];
          return {
            requirementId: r.id ?? canonical?.id ?? null,
            fitStatus: r.fitStatus ?? null,
            companyEvidence:
              r.fitStatus === "CONFIRMED_GAP" || r.fitStatus === "CONFIRMED_FIT"
                ? r.evidence ?? r.fitProvenance?.excerpt ?? null
                : null,
            tenderEvidence: canonical?.evidenceText ?? r.evidence ?? null,
            conditionText:
              canonical?.obligationStrength === "CONDITIONAL"
                ? canonical.sourceSection ?? canonical.requirement
                : null,
            lotLabel: canonical?.lotApplicability ?? null,
            obligationStrength: canonical?.obligationStrength ?? null,
            semanticKind: r.semanticKind ?? canonical?.semanticKind ?? null,
          };
        }),
        risks: (intelligence.risks ?? []).map((r) => ({
          id: r.id,
          requirementId: r.requirementId ?? null,
          linkedRequirementIds: r.linkedRequirementIds ?? null,
          title: r.title,
          underlyingKey: r.underlyingKey ?? null,
          evidenceState: r.evidenceState ?? null,
          fitStatus: r.fitStatus ?? null,
          severity: r.severity ?? null,
        })),
        actions: (intelligence.actionPlan?.items ?? []).map((a) => ({
          linkedRequirementId: a.linkedRequirementId ?? null,
          requirementText: a.requirementText ?? null,
          title: a.title,
        })),
        matrixRequirementIds: intelligence.complianceMatrix.map((r) => r.requirementId),
        decisionRequirementIds: decision.requirements
          .map((r) => r.id)
          .filter((id): id is string => Boolean(id)),
        decisionLabel: decision.decision,
        utiSummary: intelligence.universalTenderIntelligence
          ? {
              inventoryCount:
                intelligence.universalTenderIntelligence.inventoryCount,
              extractedOkCount:
                intelligence.universalTenderIntelligence.extractedOkCount,
              failedCount: intelligence.universalTenderIntelligence.failedCount,
              versionEdges: intelligence.universalTenderIntelligence.versionEdges,
              metadataConflicts:
                intelligence.universalTenderIntelligence.metadataConflicts,
            }
          : null,
        intakeStoredCount: intakeStored,
      });
    } catch (err) {
      if (err instanceof AnalysisCertificationError) {
        intelligence.tenderCertification = err.result;
        logInfo("certification.failed", {
          tenderId,
          status: err.result.status,
          durationMs: err.result.durationMs,
          failureCodes: err.result.failures.map((f) => f.code),
          checksExecuted: err.result.checksExecuted,
        });
        throw new AppError(
          ErrorCode.INTERNAL,
          `Tender certification failed: ${err.message}`,
          500,
        );
      }
      throw err;
    }
    intelligence.tenderCertification = tenderCertification;
    logInfo("certification.passed", {
      tenderId,
      status: tenderCertification.status,
      durationMs: tenderCertification.durationMs,
      packageReadability: tenderCertification.packageReadability,
      checksPassed: tenderCertification.checksPassed.length,
      warningCount: tenderCertification.warnings.length,
    });

    await prisma.tenderDecision.upsert({
      where: { tenderId },
      create: {
        tenderId,
        companyId: tender.companyId,
        decision: decision.decision,
        fitScore: decision.fitScore,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        fitBreakdown: decision.fitBreakdown as object,
        readinessBreakdown: readiness as object,
        intelligenceBreakdown: intelligence as object,
        bidScoreBreakdown: bidScore as object,
        isAiSuggested: true,
      },
      update: {
        decision: decision.decision,
        fitScore: decision.fitScore,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        fitBreakdown: decision.fitBreakdown as object,
        readinessBreakdown: readiness as object,
        intelligenceBreakdown: intelligence as object,
        bidScoreBreakdown: bidScore as object,
        isAiSuggested: true,
      },
    });

    // Persist Decision Memory snapshot (idempotent; never invents data)
    try {
      const reqSnap = {
        totalRequirements: intelligence.complianceSummary.totalRequirements,
        ready: intelligence.complianceSummary.ready,
        missing: intelligence.complianceSummary.missing,
        verify: intelligence.complianceSummary.verify,
        lines: intelligence.complianceMatrix
          .slice(0, 40)
          .map((r) => r.requirement)
          .filter(Boolean),
      };
      await recordDecisionMemory({
        companyId: tender.companyId,
        tenderId,
        title: extraction.title || tender.title,
        client: extraction.client ?? tender.client ?? null,
        country: extraction.country ?? tender.country ?? null,
        industry: extraction.industry ?? tender.industry ?? null,
        decision: decision.decision,
        fitScore: decision.fitScore,
        readinessScore: readiness.score,
        bidScore: bidScore.scoringAvailable ? bidScore.score : null,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        requirementsSnapshot: reqSnap,
        risksSnapshot: intelligence.risks.map((r) => ({
          id: r.id,
          title: r.title,
          severity: r.severity,
        })),
        scoresSnapshot: {
          fitScore: decision.fitScore,
          readinessScore: readiness.score,
          bidScore: bidScore.scoringAvailable ? bidScore.score : null,
          confidence: decision.confidence,
        },
        features,
        featureKey,
        analyzedAt: new Date(),
      });
    } catch {
      /* Memory persistence must not fail the analysis pipeline */
    }

    await transitionAnalysisPhase(
      phaseTimer,
      tenderId,
      "COMPLETED",
      ANALYSIS_PHASE.COMPLETE,
      {
        status: "ACTIVE",
        analyzedAt: new Date(),
        analysisError: null,
      },
    );
    phaseTimer.finish();

    await trackEvent({
      action: "DECISION_GENERATED",
      companyId: tender.companyId,
      metadata: {
        tenderId,
        decision: decision.decision,
        fitScore: decision.fitScore,
        confidence: decision.confidence,
      },
    });
    if (wasFirst) {
      await trackEvent({
        action: "FIRST_DECISION",
        companyId: tender.companyId,
        metadata: { tenderId, decision: decision.decision },
      });
    }
    await trackEvent({
      action: "ANALYSIS_COMPLETED",
      companyId: tender.companyId,
      metadata: { tenderId, decision: decision.decision, documentKind },
    });

    const missingCount = await prisma.missingDocument.count({
      where: { tenderId, status: "OPEN" },
    });

    const { emitPostAnalysisSmartAlerts } = await import("@/services/smart-alerts");
    const topMemory = memoryInsights.matches[0] ?? null;
    await emitPostAnalysisSmartAlerts({
      companyId: tender.companyId,
      tenderId,
      title: extraction.title || tender.title,
      decision: decision.decision,
      fitScore: decision.fitScore,
      bidScore: bidScore.scoringAvailable ? bidScore.score : null,
      scoringAvailable: bidScore.scoringAvailable !== false,
      hasHighOrCriticalRisk: decision.findings.some(
        (f) => f.severity === "HIGH" || f.severity === "CRITICAL",
      ),
      missingDocumentCount: missingCount,
      compliance: {
        totalRequirements: intelligence.complianceSummary.totalRequirements,
        ready: intelligence.complianceSummary.ready,
        missing: intelligence.complianceSummary.missing,
        verify: intelligence.complianceSummary.verify,
      },
      decisionMemoryMatchIds: memoryInsights.matches.map((m) => m.memoryId),
      decisionMemoryTopTitle: topMemory?.title ?? null,
      decisionMemoryTopLabel: topMemory?.decisionLabel ?? null,
      prior: priorSnapshot,
      actionPlan: intelligence.actionPlan?.computed
        ? {
            openCritical: intelligence.actionPlan.summary.critical,
            openBlocking: intelligence.actionPlan.summary.blocking,
            deadlineDays: intelligence.actionPlan.deadlineUrgency.daysRemaining,
          }
        : null,
    });

    if (deadline && !Number.isNaN(deadline.getTime())) {
      await notificationService.scheduleDeadlineAlerts({
        companyId: tender.companyId,
        tenderId,
        deadline,
        title: extraction.title || tender.title,
        timezone: tender.deadlineTimezone,
      });
    }

    // Team tasks already seeded before finalize (idempotent no-op here if unchanged)

    logInfo("analysis.completed", {
      tenderId,
      companyId: tender.companyId,
      decision: decision.decision,
      documentKind,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    const isValidation =
      error instanceof AppError && error.code === ErrorCode.VALIDATION;
    const isSystemFailure =
      !(error instanceof AppError) ||
      error.code === ErrorCode.UPSTREAM ||
      error.code === ErrorCode.INTERNAL;

    if (isSystemFailure && !isValidation) {
      await refundAnalysisCredit(tender.companyId, tenderId, "system_error").catch(
        () => undefined,
      );
    }

    await setAnalysisStatus(tenderId, "FAILED", {
      analysisError: message.slice(0, 500),
    });
    // Guardian / post-extraction release blocks must not wipe per-file extract
    // status (COMPLETED vs FAILED). Only mark files FAILED when the pipeline
    // itself could not finish extraction for the package.
    const { DecisionGuardianError } = await import(
      "@/domain/decision-validation"
    );
    const preservePerFileStatus = error instanceof DecisionGuardianError;
    if (!preservePerFileStatus) {
      await prisma.tenderDocument.updateMany({
        where: { tenderId },
        data: { processingStatus: "FAILED" },
      });
    }
    await trackEvent({
      action: "ANALYSIS_STARTED",
      companyId: tender.companyId,
      metadata: {
        tenderId,
        failed: true,
        validation: isValidation,
        guardianBlocked: preservePerFileStatus,
        message: message.slice(0, 200),
      },
    }).catch(() => undefined);
    logInfo("analysis.failed", {
      tenderId,
      companyId: tender.companyId,
      message: message.slice(0, 200),
      preservePerFileStatus,
    });
    throw error;
  }
}
