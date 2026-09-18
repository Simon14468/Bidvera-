/**
 * Load the ONE canonical analysis for a tender.
 *
 * Inputs: tenderId + companyId only.
 * Never accepts userId or role — those are for access gating elsewhere.
 */

import { isProfileSparse } from "@/domain/decision/company-fit";
import {
  assertCanonicalFitConsistency,
  syncFitBreakdownOverall,
} from "@/domain/decision/fit-consistency";
import {
  displayFitScore,
  isScoringBlocked,
} from "@/domain/decision/extraction-gate";
import {
  computeTenderReadiness,
  type TenderReadinessBreakdown,
} from "@/domain/decision/tender-readiness";
import { toRuleProfile } from "@/domain/decision/types";
import {
  buildBidScoreFromAnalysis,
  isBidScoreBreakdown,
} from "@/domain/bid-score";
import { isCompanyKnowledgeOnlyAnalysis } from "@/domain/company-knowledge";
import { isDecisionGuardianSnapshot } from "@/domain/decision-validation";
import {
  buildComplianceSummary,
  buildHistoricalSignals,
  buildTenderIntelligence,
  normalizeComplianceMatrix,
  type CanonicalTenderAnalysis,
  type TenderIntelligenceBreakdown,
} from "@/domain/tender-intelligence";
import { isStalePreFirewallSnapshot } from "@/domain/tender-intelligence/canonical-snapshot";
import { isStoredAnalysisCountsStale, readCanonicalDeadlineIso } from "@/domain/tender-requirements";
import type { CompanyTenderFitBreakdown } from "@/domain/decision/company-fit";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { cache } from "react";

function hydrateIntelligence(
  stored: TenderIntelligenceBreakdown | null,
  fallbackInput: Parameters<typeof buildTenderIntelligence>[0],
): TenderIntelligenceBreakdown {
  if (stored?.canonicalSnapshot && stored.complianceMatrix?.length) {
    const complianceMatrix = normalizeComplianceMatrix(stored.complianceMatrix);
    return {
      ...stored,
      complianceMatrix,
      complianceSummary: {
        ...(stored.complianceSummary ??
          buildComplianceSummary(
            complianceMatrix,
            stored.clarificationQuestions?.length ?? 0,
            stored.risks ?? [],
          )),
        totalRequirements: stored.canonicalSnapshot.counts.totalRequirements,
        verifiedRequirements: stored.canonicalSnapshot.counts.verifiedRequirements,
        needsVerification: stored.canonicalSnapshot.counts.needsVerification,
        confirmedGaps: stored.canonicalSnapshot.counts.confirmedGaps,
      },
      canonicalSnapshot: stored.canonicalSnapshot,
      learningSignal: stored.learningSignal ?? null,
    };
  }
  if (stored?.complianceMatrix?.length) {
    const complianceMatrix = normalizeComplianceMatrix(stored.complianceMatrix);
    const clarifications = stored.clarificationQuestions?.length ?? 0;
    return {
      ...stored,
      complianceMatrix,
      complianceSummary:
        stored.complianceSummary ??
        buildComplianceSummary(
          complianceMatrix,
          clarifications,
          stored.risks ?? [],
        ),
      learningSignal: stored.learningSignal ?? null,
    };
  }
  return buildTenderIntelligence(fallbackInput);
}

/**
 * Resolve persisted intelligence for canonical read without dropping a Guardian
 * release stamp or inventing COMPLETE for scoring-blocked packages.
 */
export function resolveIntelligenceForCanonicalRead(input: {
  scoringBlocked: boolean;
  companyKnowledgeOnly: boolean;
  storedAnalysisStale: boolean;
  stored: TenderIntelligenceBreakdown | null;
  buildFallback: () => TenderIntelligenceBreakdown;
  hydrate: (stored: TenderIntelligenceBreakdown) => TenderIntelligenceBreakdown;
}): TenderIntelligenceBreakdown {
  const { scoringBlocked, companyKnowledgeOnly, storedAnalysisStale, stored } =
    input;

  if (companyKnowledgeOnly && stored && !storedAnalysisStale) {
    return stored;
  }

  // Incomplete packages: never rebuild into COMPLETE (that falsely requires Guardian).
  if (scoringBlocked) {
    if (
      stored &&
      (stored.complianceStatus === "INCOMPLETE" ||
        stored.extractionGate?.status === "blocked")
    ) {
      return {
        ...stored,
        complianceStatus: "INCOMPLETE",
        risks: [],
      };
    }
    const rebuilt = input.buildFallback();
    return {
      ...rebuilt,
      complianceStatus: "INCOMPLETE",
      risks: [],
      extractionGate: stored?.extractionGate ?? rebuilt.extractionGate,
      keyBlockers: stored?.keyBlockers?.length
        ? stored.keyBlockers
        : rebuilt.keyBlockers,
      decisionGuardian: null,
    };
  }

  // Guardian-stamped COMPLETE release is immutable on read — never drop the snapshot.
  if (stored && isDecisionGuardianSnapshot(stored.decisionGuardian)) {
    return input.hydrate(stored);
  }

  if (storedAnalysisStale) {
    // Never resurrect semantic truth from raw requirement text on read.
    if (stored && (stored.canonicalSnapshot || stored.complianceMatrix?.length)) {
      return input.hydrate(stored);
    }
    return input.buildFallback();
  }

  return stored ? input.hydrate(stored) : input.buildFallback();
}

/**
 * Company-scoped read of the persisted tender analysis.
 * Same company → same analytical truth for every authorized viewer.
 * Request-level deduplication via React.cache — one DB read per render pass.
 */
export const getCanonicalTenderAnalysis = cache(loadCanonicalTenderAnalysis);

async function loadCanonicalTenderAnalysis(
  tenderId: string,
  companyId: string,
): Promise<CanonicalTenderAnalysis> {
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      decision: true,
      company: { include: { profile: true } },
      requirements: { orderBy: { sortOrder: "asc" } },
      risks: { orderBy: { sortOrder: "asc" } },
      missingDocs: { orderBy: { sortOrder: "asc" } },
      evidence: { orderBy: { createdAt: "asc" } },
      nextActions: { orderBy: { sortOrder: "asc" } },
      documents: {
        orderBy: { createdAt: "asc" },
        select: {
          fileName: true,
          processingStatus: true,
          documentKind: true,
          extractionMeta: true,
        },
      },
    },
  });

  if (!tender) {
    throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  }
  if (tender.companyId !== companyId) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "You do not have access to this resource.",
      403,
    );
  }
  if (!tender.decision) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Canonical analysis is available after processing completes.",
      400,
    );
  }

  const fitBreakdown =
    (tender.decision.fitBreakdown as CompanyTenderFitBreakdown | null) ?? null;

  const storedIntelligencePeek =
    (tender.decision.intelligenceBreakdown as TenderIntelligenceBreakdown | null) ??
    null;

  const companyKnowledgeOnly = isCompanyKnowledgeOnlyAnalysis(
    fitBreakdown,
    storedIntelligencePeek,
  );

  const scoringBlocked = isScoringBlocked(fitBreakdown) || companyKnowledgeOnly;

  const storedReadiness =
    (tender.decision.readinessBreakdown as TenderReadinessBreakdown | null) ??
    null;

  const readinessInput = {
    requirements: tender.requirements.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      evidence: r.evidence,
    })),
    missingDocuments: tender.missingDocs.map((d) => ({
      id: d.id,
      documentName: d.documentName,
      reason: d.reason,
      severity: d.severity,
    })),
    fit: fitBreakdown,
    profileHasAnyCapability: !isProfileSparse(
      toRuleProfile(tender.company.profile, tender.company.name),
    ),
  };

  /**
   * Recompute when persisted JSON counted missing documents as requirements
   * or when matrix/summary totals diverge from TenderRequirement rows.
   */
  const storedSnapshot = storedIntelligencePeek?.canonicalSnapshot ?? null;
  const stalePreFirewall = isStalePreFirewallSnapshot(storedSnapshot);

  const storedAnalysisStale =
    stalePreFirewall ||
    (storedSnapshot
      ? storedSnapshot.counts.totalRequirements !== tender.requirements.length
      : isStoredAnalysisCountsStale({
          requirementCount: tender.requirements.length,
          missingDocCount: tender.missingDocs.length,
          storedReadiness,
          storedIntelligence: storedIntelligencePeek,
        }));

  let extractedText = "";
  const guardianStamped = isDecisionGuardianSnapshot(
    storedIntelligencePeek?.decisionGuardian,
  );
  const needsExtractedText =
    !guardianStamped &&
    !storedSnapshot &&
    (storedAnalysisStale || !storedIntelligencePeek?.complianceMatrix?.length);
  if (needsExtractedText) {
    const docWithText = await prisma.tenderDocument.findFirst({
      where: { tenderId: tender.id },
      orderBy: { createdAt: "asc" },
      select: { extractedText: true },
    });
    extractedText = docWithText?.extractedText ?? "";
  }

  const intelligenceBuildInput = {
    tenderId: tender.id,
    documentName: tender.documents[0]?.fileName ?? null,
    tenderDeadline: tender.deadline,
    extractedText,
    requirements: tender.requirements.map((r) => {
      const frozen = storedSnapshot?.metadata.requirementProvenance?.find(
        (p) => p.requirementId === r.id,
      )?.tenderSource;
      return {
        id: r.id,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        sourcePage: r.sourcePage ?? frozen?.page ?? null,
        sourceSection: r.sourceSection ?? frozen?.section ?? null,
        evidence: r.evidence,
        sourceDocument: frozen?.documentName ?? null,
        evidenceText: frozen?.excerpt ?? r.evidence,
        sourceCell: frozen?.cell ?? null,
        columnHeader: frozen?.columnHeader ?? null,
        rowLabel: frozen?.rowLabel ?? null,
        versionLabel: frozen?.versionLabel ?? null,
        locator: frozen?.locator ?? null,
        sourceCompleteness: frozen?.completeness ?? null,
      };
    }),
    deadlineEvidence:
      storedSnapshot?.metadata.packageIdentity?.deadline.evidence ?? null,
    deadlineSourceDocument:
      storedSnapshot?.metadata.packageIdentity?.deadline.sources[0]?.fileName ??
      null,
    evidence: tender.evidence.map((e) => ({
      id: e.id,
      requirementId: e.requirementId,
      sourcePage: e.sourcePage,
      sourceSection: e.sourceSection,
      evidenceText: e.evidenceText,
      verificationStatus: e.verificationStatus,
    })),
    findings: [] as import("@/domain/decision/types").DeterministicFinding[],
    existingRisks: tender.risks.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      severity: r.severity,
      sourcePage: r.sourcePage,
      mitigation: r.mitigation,
    })),
    decision: tender.decision.decision,
    fitScore:
      displayFitScore({
        fitScore: tender.decision.fitScore,
        fitBreakdown,
      }) ?? 0,
  };

  const readiness: TenderReadinessBreakdown =
    scoringBlocked && storedReadiness && !storedAnalysisStale
      ? storedReadiness
      : !storedReadiness || storedAnalysisStale
        ? computeTenderReadiness(readinessInput)
        : storedReadiness;

  let intelligence = resolveIntelligenceForCanonicalRead({
    scoringBlocked,
    companyKnowledgeOnly,
    storedAnalysisStale,
    stored: storedIntelligencePeek,
    buildFallback: () =>
      buildTenderIntelligence({
        ...intelligenceBuildInput,
        readiness,
      }),
    hydrate: (stored) =>
      hydrateIntelligence(stored, {
        ...intelligenceBuildInput,
        readiness,
      }),
  });

  // Incomplete-package extraction notes are analysis blockers, not tender risks.
  if (scoringBlocked && intelligence.risks.length > 0) {
    intelligence = { ...intelligence, risks: [] };
  }

  if (
    storedAnalysisStale &&
    !scoringBlocked &&
    !companyKnowledgeOnly &&
    tender.requirements.length > 0
  ) {
    // Architectural lock: read path may recompute in-memory for display, but must NOT
    // silently mutate the Guardian-stamped COMPLETED analysis without a new release.
    // Persisting here created a second write path that bypassed assertFinalReleaseIntegrity.
  }

  // Use persisted learning signal for completed analysis; refresh only after stale rebuild.
  if (scoringBlocked) {
    intelligence.learningSignal = null;
  } else if (storedAnalysisStale) {
    try {
      const { buildFeaturesForTender, lookupSimilarCompanySignal } = await import(
        "@/services/learning"
      );
      const missingMandatory = tender.requirements.filter(
        (r) => r.mandatory && (r.status === "FAILED" || r.status === "MISSING"),
      ).length;
      const { features, featureKey } = buildFeaturesForTender({
        industry: tender.industry ?? tender.company.profile?.industry ?? null,
        country: tender.country ?? tender.company.profile?.country ?? null,
        companySize:
          tender.company.profile?.companySize ?? tender.company.companySize,
        employeeRange: tender.company.profile?.employeeRange ?? null,
        fitScore: tender.decision.fitScore,
        readinessScore: readiness.score,
        decision: tender.decision.decision,
        missingMandatoryCount: missingMandatory,
        estimatedValue: tender.estimatedValue,
      });
      const learningSignal = await lookupSimilarCompanySignal({
        features,
        featureKey,
        missingMandatoryCount: missingMandatory,
        hardNoBid: false,
        forcedReview: tender.decision.decision === "REVIEW",
        readinessMissing: readiness.counts?.missing ?? 0,
      });
      intelligence.learningSignal = learningSignal.detected ? learningSignal : null;
    } catch {
      intelligence.learningSignal = intelligence.learningSignal ?? null;
    }
  }
  // else: hydrateIntelligence already applied stored.learningSignal from persistence

  const storedBidScore = isBidScoreBreakdown(tender.decision.bidScoreBreakdown)
    ? tender.decision.bidScoreBreakdown
    : null;
  const bidScore =
    scoringBlocked && storedBidScore
      ? storedBidScore
      : storedBidScore ??
        buildBidScoreFromAnalysis({
          fitScore: displayFitScore({
            fitScore: tender.decision.fitScore,
            fitBreakdown,
          }),
          fitBreakdown,
          readiness,
          intelligence,
          estimatedValue: tender.estimatedValue,
          deadline: tender.deadline,
          decision: tender.decision.decision,
          asOf: tender.analyzedAt,
        });

  const canonicalFitScore = companyKnowledgeOnly
    ? null
    : displayFitScore({
        fitScore: tender.decision.fitScore,
        fitBreakdown,
      });
  const syncedFitBreakdown = syncFitBreakdownOverall(fitBreakdown, canonicalFitScore);
  if (!companyKnowledgeOnly && !scoringBlocked && canonicalFitScore != null) {
    assertCanonicalFitConsistency({
      fitScore: canonicalFitScore,
      fitBreakdown: syncedFitBreakdown,
      reasoning: tender.decision.reasoning,
      label: "canonical-analysis",
    });
  }

  // Incomplete package / blocked extraction: DB may store REVIEW as a placeholder enum.
  // Canonical recommendation must be null — never BID / REVIEW / NO_BID.
  if (
    stalePreFirewall &&
    !scoringBlocked &&
    !companyKnowledgeOnly &&
    !intelligence.keyBlockers?.some((b) => /re-analysis required/i.test(b))
  ) {
    intelligence = {
      ...intelligence,
      keyBlockers: [
        ...(intelligence.keyBlockers ?? []),
        "STI admission snapshot is stale or missing; re-analysis is required.",
      ],
    };
  }

  const canonicalDecision =
    companyKnowledgeOnly || scoringBlocked || stalePreFirewall
      ? null
      : tender.decision.decision;

  const packageFiles =
    storedSnapshot?.package.files ??
    tender.documents.map((d) => ({
      fileName: d.fileName,
      processingStatus: d.processingStatus,
      role: d.documentKind ?? null,
      error: null,
    }));
  const packageLabel =
    storedSnapshot?.package.label ??
    (packageFiles.length > 1
      ? packageFiles.map((f) => f.fileName).join(" + ")
      : packageFiles[0]?.fileName ?? null);

  const deadlineStatus =
    storedSnapshot?.metadata.deadlineStatus ??
    storedSnapshot?.metadata.packageIdentity?.deadline.status ??
    null;
  const snapshotDeadlineIso =
    deadlineStatus === "CONFLICT" || deadlineStatus === "INCOMPLETE"
      ? storedSnapshot?.metadata.deadlineIso ?? null
      : readCanonicalDeadlineIso({
          snapshotIso: storedSnapshot?.metadata.deadlineIso ?? null,
          persistedInstant: tender.deadline,
          timezone: storedSnapshot?.metadata.deadlineTimezone ?? tender.deadlineTimezone,
        });
  const snapshotDeadlineTz =
    deadlineStatus === "CONFLICT" || deadlineStatus === "INCOMPLETE"
      ? storedSnapshot?.metadata.deadlineTimezone ?? null
      : storedSnapshot?.metadata.deadlineTimezone ?? tender.deadlineTimezone;
  const projectedDeadline = projectCanonicalDeadline(
    snapshotDeadlineIso,
    snapshotDeadlineTz,
  );

  const projectedTitle = projectCanonicalTitle(
    storedSnapshot?.metadata.title ?? tender.title,
    packageLabel,
    scoringBlocked,
  );

  return {
    tenderId: tender.id,
    companyId: tender.companyId,
    title: projectedTitle,
    client: storedSnapshot?.metadata.client ?? tender.client,
    deadline: projectedDeadline.deadline,
    deadlineTimezone: projectedDeadline.deadlineTimezone,
    analyzedAt: tender.analyzedAt?.toISOString() ?? null,
    analysisStatus: tender.analysisStatus,
    documentName: packageLabel,
    outcome: tender.outcome ?? null,
    decision: canonicalDecision,
    fitScore: canonicalFitScore,
    confidence: tender.decision.confidence,
    reasoning: tender.decision.reasoning,
    isAiSuggested: tender.decision.isAiSuggested,
    companyKnowledgeOnly,
    fitBreakdown: syncedFitBreakdown,
    readiness,
    intelligence,
    bidScore,
    requirements: tender.requirements.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      sourcePage: r.sourcePage,
      sourceSection: r.sourceSection,
      evidence: r.evidence,
      sortOrder: r.sortOrder,
    })),
    evidence: tender.evidence.map((e) => ({
      id: e.id,
      requirementId: e.requirementId,
      sourcePage: e.sourcePage,
      sourceSection: e.sourceSection,
      evidenceText: e.evidenceText,
      verificationStatus: e.verificationStatus,
    })),
    // Incomplete-package extraction notes are analysis blockers, not tender risks.
    risks: scoringBlocked
      ? []
      : tender.risks.map((r) => ({
          id: r.id,
          category: r.category,
          description: r.description,
          severity: r.severity,
          sourcePage: r.sourcePage,
          mitigation: r.mitigation,
          sortOrder: r.sortOrder,
        })),
    missingDocuments: tender.missingDocs.map((d) => ({
      id: d.id,
      documentName: d.documentName,
      reason: d.reason,
      severity: d.severity,
      sortOrder: d.sortOrder,
    })),
    nextActions: tender.nextActions.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      priority: a.priority,
      completed: a.completed,
      sortOrder: a.sortOrder,
    })),
    packageFiles,
    canonicalRequirementCount:
      storedSnapshot?.counts.totalRequirements ?? tender.requirements.length,
    historicalSignals: buildHistoricalSignals(intelligence),
  };
}

/** Score-banner text must never replace the tender title. */
export function isFabricatedScoreTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = title.trim();
  return (
    /score\s*d['’]?\s*offre/i.test(t) ||
    /\b\d{1,3}\s*\/\s*100\b/.test(t) ||
    /^bid\s*score\b/i.test(t) ||
    /\b(very\s+low|low|medium|high|very\s+high)\s*$/i.test(t)
  );
}

function projectCanonicalTitle(
  title: string,
  documentName: string | null,
  scoringBlocked: boolean,
): string {
  if (!scoringBlocked || !isFabricatedScoreTitle(title)) return title;
  if (documentName?.trim()) {
    return documentName.replace(/\.[^.]+$/, "").trim() || title;
  }
  return "Tender package";
}

/**
 * Date-only deadlines must not invent wall-clock times (00:00 / 01:00) or a TZ.
 * Real local timestamps keep their ISO + timezone.
 */
export function projectCanonicalDeadline(
  deadlineIso: string | null,
  deadlineTimezone: string | null,
): { deadline: string | null; deadlineTimezone: string | null } {
  if (!deadlineIso) return { deadline: null, deadlineTimezone: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadlineIso)) {
    return { deadline: deadlineIso, deadlineTimezone: null };
  }
  // Midnight UTC is the historical date-only storage form — strip invented time/TZ.
  if (/T00:00:00(\.000)?Z$/i.test(deadlineIso)) {
    return { deadline: deadlineIso.slice(0, 10), deadlineTimezone: null };
  }
  return { deadline: deadlineIso, deadlineTimezone };
}
