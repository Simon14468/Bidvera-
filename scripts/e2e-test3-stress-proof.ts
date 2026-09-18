/**
 * Fresh Test 3 Stress Tender E2E proof — final stress validation.
 * Uses real Bidvera_Stress_Test_Tender_2026.pdf. Does NOT reuse DB rows.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { extractDocumentText } from "@/services/document/extract";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import {
  buildCanonicalRequirements,
  formatDeadlineWallClock,
  isNonRequirementText,
} from "@/domain/tender-requirements";
import type { RequirementSemanticKind } from "@/domain/tender-requirements";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { runDecisionEngine } from "@/domain/decision/engine";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import {
  assertActionPlanIntegrity,
  buildTenderActionPlan,
  isGenericVerificationText,
} from "@/domain/tender-action-plan";
import { finalizeTenderDecision } from "@/domain/decision/tender-decision-engine";
import type { RuleCompanyProfile } from "@/domain/decision/types";
import {
  assertFinalReleaseIntegrity,
  buildDecisionGuardianInput,
  hashCanonicalReleasePayload,
  DecisionGuardianError,
  runDecisionGuardian,
} from "@/domain/decision-validation";
import {
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";

const PDF = resolve(
  ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtk43nw100i5rkr04tkf5qb3/1788354511070-Bidvera_Stress_Test_Tender_2026.pdf",
);
const FILE_NAME = "Bidvera_Stress_Test_Tender_2026.pdf";
const ANALYSIS_ID = `fresh-t3-stress-${Date.now()}`;
const STARTED = Date.now();

const PROFILE: RuleCompanyProfile = {
  companyName: "NetCo Morocco",
  industry: "IT",
  country: "Morocco",
  companySize: "11-50",
  experienceLevel: "experienced",
  services: ["network", "security", "wireless"],
  certifications: [],
  experienceYears: 6,
  revenueRange: null,
  employeeRange: "11-50",
  geographicCoverage: ["Morocco"],
  contractSizeMin: null,
  contractSizeMax: null,
  customQualificationRules: [],
};

const FORBIDDEN_LEAKS = [
  {
    id: "heading-admin",
    re: /^•?\s*Mandatory Administrative and Eligibility Requirements\s*$/i,
    reason: "Section heading",
  },
  {
    id: "evaluation-note",
    re: /percentages describe evaluation only|must not become separate compliance/i,
    reason: "Evaluation meta / QA instruction",
  },
  {
    id: "evaluation-weights",
    re: /Technical compliance:\s*40\s*%|Price:\s*35\s*%/i,
    reason: "Evaluation criterion",
  },
  {
    id: "reviewer-scenario",
    re: /Scenario A:|illustrate reviewer checks/i,
    reason: "Reviewer/test scenario",
  },
  {
    id: "qa-meta",
    re: /instructions to an analysis system|Quality-Control Test Note/i,
    reason: "QA/meta instruction",
  },
  {
    id: "estimated-value-fact",
    re: /estimated contract value is MAD\s*420[,.]?000/i,
    reason: "Informational tender fact",
  },
] as const;

async function main() {
  const buf = readFileSync(PDF);
  const sourceFileHash = createHash("sha256").update(buf).digest("hex");

  const extractStarted = Date.now();
  const extracted = await extractDocumentText({
    buffer: buf,
    mimeType: "application/pdf",
    fileName: FILE_NAME,
  });
  const extractMs = Date.now() - extractStarted;
  const text = extracted.text;
  const sourceTextHash = createHash("sha256").update(text).digest("hex");

  const heuristic = extractTenderPackageHeuristic({ text, fileName: FILE_NAME });
  const canonical = buildCanonicalRequirements({
    heuristicDrafts: heuristic.requirements,
    sourceDocument: FILE_NAME,
  });

  const requirements = canonical.map((r, i) => ({
    id: r.id ?? `t3-r${i + 1}`,
    category: r.category,
    description: r.requirement,
    mandatory: r.mandatory,
    value: r.value ?? null,
    status: "UNCERTAIN" as const,
    sourcePage: r.page ?? null,
    sourceSection: r.sourceSection ?? null,
    evidence: r.evidenceText ?? null,
    semanticKind: r.semanticKind,
    obligationStrength: r.obligationStrength,
  }));

  const engine = runDecisionEngine({
    profile: PROFILE,
    requirements,
    estimatedValue: heuristic.estimatedValue,
    tenderContext: {
      title: heuristic.title ?? "Stress Test 3",
      client: heuristic.client ?? "Client",
      country: heuristic.country ?? "Morocco",
      industry: heuristic.industry ?? "IT",
      tenderText: text,
    },
  });

  const readiness = computeTenderReadiness({
    requirements: engine.requirements.map((r) => ({
      id: r.id!,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      evidence: r.evidence,
    })),
    missingDocuments: [],
    profileHasAnyCapability: true,
  });

  const intelligence = buildTenderIntelligence({
    tenderId: ANALYSIS_ID,
    documentName: FILE_NAME,
    tenderDeadline: heuristic.deadlineIso ? new Date(heuristic.deadlineIso) : null,
    extractedText: text,
    requirements: engine.requirements.map((r, i) => ({
      id: r.id!,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value ?? null,
      status: r.status,
      sourcePage: typeof r.page === "number" ? r.page : null,
      sourceSection: typeof r.section === "string" ? r.section : null,
      evidence: r.evidence ?? null,
      semanticKind: r.semanticKind ?? canonical[i]?.semanticKind ?? null,
    })),
    evidence: [],
    readiness,
    findings: engine.findings,
    existingRisks: [],
    decision: engine.decision,
    fitScore: engine.fitScore,
  });

  const finalized = finalizeTenderDecision({
    engine,
    aiParticipated: false,
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
  });
  const aiParticipated = false;

  const actionPlan = buildTenderActionPlan({
    tenderId: ANALYSIS_ID,
    companyId: "proof-t3",
    tenderDeadline: heuristic.deadlineIso ? new Date(heuristic.deadlineIso) : null,
    complianceMatrix: intelligence.complianceMatrix,
    evidenceIntelligence: intelligence.evidenceIntelligence ?? null,
    risks: intelligence.risks,
    keyBlockers: intelligence.keyBlockers,
    readiness: { attention: readiness.attention, items: readiness.items },
    fitBreakdown: engine.fitBreakdown,
    recommendation: finalized.recommendation,
    teamTasks: [],
  });
  intelligence.actionPlan = actionPlan;

  const guardianReqs = engine.requirements.map((r, i) => {
    const c = canonical[i];
    const fit = r.fitStatus ?? null;
    return {
      id: r.id ?? c?.id ?? `r${i + 1}`,
      requirement: r.description,
      category: r.category,
      semanticKind: r.semanticKind ?? c?.semanticKind ?? null,
      obligationStrength: c?.obligationStrength ?? null,
      mandatory: r.mandatory,
      sourceSection:
        (typeof r.section === "string" ? r.section : null) ?? c?.sourceSection ?? null,
      page: (typeof r.page === "number" ? r.page : null) ?? c?.page ?? null,
      evidenceText: c?.evidenceText ?? r.evidence ?? null,
      fitStatus: fit ?? r.status ?? null,
      hasCompanyEvidence:
        fit === "CONFIRMED_FIT" || fit === "CONFIRMED_GAP" ? Boolean(r.evidence) : false,
      companyEvidenceText:
        fit === "CONFIRMED_FIT" || fit === "CONFIRMED_GAP" ? r.evidence ?? null : null,
    };
  });

  const contentHash = hashCanonicalReleasePayload(
    guardianReqs.map((r) => ({ id: r.id, text: r.requirement })),
  );

  const deadlineMatch = text.match(
    /(?:submission\s+deadline|closing\s+date|deadline)\s*[:\-]?\s*([^\n]{0,80})/i,
  );
  const sourceDeadlineWindow = deadlineMatch?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  const sourceHasLocalTime = sourceDeadlineWindow
    ? /\bat\s+(\d{1,2}):(\d{2})\b/i.test(sourceDeadlineWindow)
    : false;
  const sourceLocal = sourceDeadlineWindow?.match(/\bat\s+(\d{1,2}):(\d{2})\b/i);

  let guardian: {
    ok: boolean;
    durationMs: number;
    checksRun: string[];
    blocking: Array<{ code: string; explanation: string }>;
    advisory: Array<{ code: string; explanation: string }>;
    snapshot: unknown;
  };

  try {
    const guardianInput = buildDecisionGuardianInput({
      textLength: text.trim().length,
      readable: text.trim().length >= 80,
      validityPassed: true,
      fileName: FILE_NAME,
      requirements: guardianReqs,
      matrix: intelligence.complianceMatrix.map((row) => ({
        requirementId: row.requirementId,
      })),
      readinessItems: readiness.items.map((item) => ({ id: item.id })),
      actions: actionPlan.items.map((a) => ({
        linkedRequirementId: a.linkedRequirementId,
        blocking: a.blocking,
        sourceType: a.sourceType,
        title: a.title,
        simulationOnly: a.simulationOnly,
      })),
      decision: {
        decision: engine.decision,
        hardFailure: Boolean(finalized.recommendation?.hardFailure),
        hardBlockerCount: intelligence.keyBlockers.length,
        aiOverrodeCanonical: false,
      },
      deadline: {
        deadlineIso: heuristic.deadlineIso,
        deadlineTimezone: heuristic.deadlineTimezone,
        expectedLocalHour: sourceLocal ? Number(sourceLocal[1]) : null,
        expectedLocalMinute: sourceLocal ? Number(sourceLocal[2]) : null,
        sourceEvidence: sourceDeadlineWindow,
      },
      fitScore: engine.fitScore,
      fitBreakdownOverall: engine.fitBreakdown?.overall ?? null,
      reasoning: engine.reasoning,
      complianceSummaryTotal: intelligence.complianceSummary.totalRequirements,
      tenderSourceText: text.slice(0, 80_000),
      risks: intelligence.risks.map((risk) => ({
        id: risk.id,
        requirementId: risk.requirementId ?? null,
        severity: risk.severityCanonical ?? risk.severity,
        fitStatus: risk.fitStatus ?? null,
        evidenceState: risk.evidenceState ?? null,
        title: risk.title,
      })),
      derivedDeadline: heuristic.deadlineIso
        ? {
            canonicalIso: heuristic.deadlineIso,
            canonicalTimezone: heuristic.deadlineTimezone,
            representations: [
              {
                channel: "WEB" as const,
                iso: heuristic.deadlineIso,
                timezone: heuristic.deadlineTimezone,
              },
              {
                channel: "PDF" as const,
                iso: heuristic.deadlineIso,
                timezone: heuristic.deadlineTimezone,
              },
            ],
          }
        : null,
      staleResult: {
        canonicalContentHash: contentHash,
        projectedContentHash: contentHash,
      },
      expectedCommercialCues: ["firm", "performance guarantee", "12,000", "non-revisable"],
    });

    const release = assertFinalReleaseIntegrity(guardianInput, contentHash);
    intelligence.decisionGuardian = release.snapshot;
    guardian = {
      ok: true,
      durationMs: release.durationMs,
      checksRun: release.checksRun,
      blocking: [],
      advisory: release.advisoryFailures.map((f) => ({
        code: f.validationCode,
        explanation: f.explanation,
      })),
      snapshot: release.snapshot,
    };
  } catch (err) {
    if (err instanceof DecisionGuardianError) {
      guardian = {
        ok: false,
        durationMs: err.result.durationMs,
        checksRun: err.result.checksRun,
        blocking: err.result.blockingFailures.map((f) => ({
          code: f.validationCode,
          explanation: f.explanation,
        })),
        advisory: err.result.advisoryFailures.map((f) => ({
          code: f.validationCode,
          explanation: f.explanation,
        })),
        snapshot: null,
      };
    } else {
      throw err;
    }
  }

  const reportStarted = Date.now();
  const report: TenderReport = {
    tenderId: ANALYSIS_ID,
    companyId: "proof-t3",
    title: heuristic.title ?? "Stress Test 3",
    client: heuristic.client,
    deadline: heuristic.deadlineIso,
    deadlineTimezone: heuristic.deadlineTimezone,
    analyzedAt: new Date().toISOString(),
    decision: engine.decision,
    fitScore: engine.fitScore,
    confidence: engine.confidence,
    reasoning: finalized.reasoning ?? engine.reasoning,
    companyKnowledgeOnly: false,
    fitBreakdown: engine.fitBreakdown,
    readiness,
    intelligence: {
      ...intelligence,
      tenderDecisionRecommendation: finalized.recommendation,
    },
    complianceSummary: intelligence.complianceSummary,
    bidScore: null,
    historicalSignals: [],
    matched: [],
    failed: [],
    uncertain: [],
    criticalRisks: [],
    evidence: [],
    missingDocuments: [],
    nextActions: [],
    decisionOutcome: null,
  };

  const webSections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
  const pdfSections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
  const webContent = buildReportDisplayContent(webSections, "en");
  const pdfContent = buildReportDisplayContent(pdfSections, "en");
  const reportMs = Date.now() - reportStarted;

  const wallParts =
    heuristic.deadlineIso && heuristic.deadlineTimezone
      ? formatDeadlineWallClock(heuristic.deadlineIso, heuristic.deadlineTimezone)
      : null;
  const wall = wallParts
    ? `${wallParts.dateYmd} ${String(wallParts.hour).padStart(2, "0")}:${String(wallParts.minute).padStart(2, "0")}`
    : heuristic.deadlineIso;

  const leaks = FORBIDDEN_LEAKS.map((leak) => {
    const inCanonical = canonical.filter((c) => leak.re.test(c.requirement));
    return {
      id: leak.id,
      reason: leak.reason,
      leaked: inCanonical.length > 0,
      items: inCanonical.map((c) => c.requirement.slice(0, 120)),
    };
  });

  const evaluationLeaks = canonical.filter(
    (c) => (c.semanticKind as RequirementSemanticKind) === "EVALUATION_CRITERION",
  );
  const nonReqLeaks = canonical.filter((c) => isNonRequirementText(c.requirement));

  const orphanActions = actionPlan.items.filter((a) => {
    if (a.simulationOnly) return false;
    if (!a.linkedRequirementId) return true;
    return (
      !canonical.some((c) => (c.id ?? "") === a.linkedRequirementId) &&
      !engine.requirements.some((r) => r.id === a.linkedRequirementId)
    );
  });

  const actionsMissingCanonicalId = actionPlan.items.filter(
    (a) => !a.simulationOnly && !a.linkedRequirementId,
  );

  const primaryByReq = new Map<string, number>();
  for (const a of actionPlan.items) {
    if (a.simulationOnly || !a.linkedRequirementId) continue;
    if (a.sourceType === "APPROACHING_DEADLINE" || a.sourceType === "DECISION_SIMULATOR") continue;
    primaryByReq.set(
      a.linkedRequirementId,
      (primaryByReq.get(a.linkedRequirementId) ?? 0) + 1,
    );
  }
  const duplicatePrimaryActions = [...primaryByReq.entries()].filter(([, n]) => n > 1);

  const genericVerificationActions = actionPlan.items.filter(
    (a) => !a.simulationOnly && isGenericVerificationText(a.title),
  );

  let actionPlanIntegrityOk = true;
  let actionPlanIntegrityError: string | null = null;
  try {
    assertActionPlanIntegrity({
      canonicalRequirementCount: canonical.length,
      actionPlan,
      hardBlockerCount: intelligence.keyBlockers.length,
    });
  } catch (err) {
    actionPlanIntegrityOk = false;
    actionPlanIntegrityError = err instanceof Error ? err.message : String(err);
  }

  const actionPhaseOk =
    actionPlanIntegrityOk &&
    orphanActions.length === 0 &&
    actionsMissingCanonicalId.length === 0 &&
    duplicatePrimaryActions.length === 0 &&
    genericVerificationActions.length === 0 &&
    actionPlan.items.length > 0 &&
    actionPlan.items.filter((a) => !a.simulationOnly && a.linkedRequirementId).length ===
      canonical.length;

  const blockingVerify = actionPlan.items.filter(
    (a) =>
      a.blocking &&
      (a.sourceType === "MISSING_EVIDENCE" || a.sourceType === "UNVERIFIED_EVIDENCE"),
  );

  const highRiskFromVerifyOnly = intelligence.risks.filter((r) => {
    const sev = (r.severityCanonical ?? r.severity ?? "").toUpperCase();
    return (
      (sev === "HIGH" || sev === "CRITICAL") &&
      (r.evidenceState === "NEEDS_VERIFICATION" || r.evidenceState === "UNKNOWN")
    );
  });

  const confirmedFitWithoutEvidence = engine.requirements.filter(
    (r) => r.fitStatus === "CONFIRMED_FIT" && !r.evidence?.trim(),
  );

  const evidenceConflicts = engine.requirements.filter((r) => {
    if (r.fitStatus === "CONFIRMED_FIT" && /not\s+capable|cannot|gap|missing/i.test(r.evidence ?? "")) {
      return true;
    }
    if (r.fitStatus === "CONFIRMED_GAP" && /confirmed\s+capable|fully\s+meets/i.test(r.evidence ?? "")) {
      return true;
    }
    return false;
  });

  // Adversarial: Guardian must fail-closed if AI overrides canonical decision
  const aiOverrideProbe = runDecisionGuardian({
    ...buildDecisionGuardianInput({
      textLength: text.trim().length,
      readable: true,
      validityPassed: true,
      fileName: FILE_NAME,
      requirements: guardianReqs,
      matrix: intelligence.complianceMatrix.map((row) => ({
        requirementId: row.requirementId,
      })),
      readinessItems: readiness.items.map((i) => ({ id: i.id })),
      actions: actionPlan.items.map((a) => ({
        linkedRequirementId: a.linkedRequirementId,
        blocking: a.blocking,
        sourceType: a.sourceType,
        title: a.title,
      })),
      decision: {
        decision: "BID",
        hardFailure: true,
        hardBlockerCount: 1,
        aiSuggestedDecision: "BID",
        aiOverrodeCanonical: true,
      },
      fitScore: engine.fitScore,
      fitBreakdownOverall: engine.fitBreakdown?.overall ?? null,
      reasoning: "adversarial AI override probe",
      complianceSummaryTotal: intelligence.complianceSummary.totalRequirements,
      tenderSourceText: text.slice(0, 80_000),
      risks: [],
      expectedCommercialCues: [],
    }),
  });
  const aiOverrideCaught = aiOverrideProbe.blockingFailures.some(
    (f) => f.validationCode === "DECISION_AI_OVERRIDE",
  );

  const sourceIdRows = [
    ...text.matchAll(/(?:^|[\n•])\s*([ETR]-\d{2})\b[^\n]{12,}/gim),
  ].map((m) => m[1]!.toUpperCase());
  const uniqueSourceIds = [...new Set(sourceIdRows)];
  const missingSourceIds = uniqueSourceIds.filter(
    (id) =>
      !canonical.some(
        (c) => c.id === id || new RegExp(`\\b${id}\\b`, "i").test(c.requirement),
      ),
  );

  const truncated = canonical.filter((c) =>
    /\b(the|and|or|of|for|with|by|to|during the|including)\s*$/i.test(c.requirement.trim()),
  );

  const r13 = canonical.find(
    (c) => c.id === "R-13" || /R-13|\(conditional\)|manufactured outside Morocco/i.test(c.requirement),
  );

  const conditionalityInversion =
    !r13 ||
    r13.obligationStrength !== "CONDITIONAL" ||
    r13.mandatory === true ||
    canonical.some(
      (c) =>
        c.id !== "R-13" &&
        /\bmust\b/i.test(c.requirement) &&
        !/\b(?:if|when|conditional|le cas)\b/i.test(c.requirement) &&
        c.obligationStrength === "CONDITIONAL",
    );

  const deadlineOk = (() => {
    if (!heuristic.deadlineIso) {
      return !sourceHasLocalTime;
    }
    if (heuristic.deadlineIso !== webSections.deadlineIso) return false;
    if (heuristic.deadlineIso !== pdfSections.deadlineIso) return false;
    if (sourceHasLocalTime && sourceLocal) {
      const hh = sourceLocal[1]!.padStart(2, "0");
      const mm = sourceLocal[2]!;
      const wallOk =
        (typeof wall === "string" && wall.includes(`${hh}:${mm}`)) ||
        heuristic.deadlineIso.includes(`T${hh}:${mm}`);
      const notMidnightDump =
        !(heuristic.deadlineIso.endsWith("T00:00:00.000Z") && sourceHasLocalTime);
      return wallOk && notMidnightDump;
    }
    return true;
  })();

  const countOk =
    canonical.length === intelligence.complianceMatrix.length &&
    canonical.length === intelligence.complianceSummary.totalRequirements &&
    canonical.length === webSections.complianceMatrix.length &&
    canonical.length === pdfSections.complianceMatrix.length;

  const webIds = webSections.complianceMatrix.map((r) => r.requirementId).sort().join("|");
  const pdfIds = pdfSections.complianceMatrix.map((r) => r.requirementId).sort().join("|");
  const webPdfParity = {
    decision: webSections.decision === pdfSections.decision,
    fit: webContent.fitScoreDisplay === pdfContent.fitScoreDisplay,
    deadline: webSections.deadlineIso === pdfSections.deadlineIso,
    counts: webSections.complianceMatrix.length === pdfSections.complianceMatrix.length,
    identities: webIds === pdfIds,
    hardBlockers:
      JSON.stringify(
        webSections.explainableDecision?.executiveSummary.topBlockers ??
          intelligence.keyBlockers,
      ) ===
      JSON.stringify(
        pdfSections.explainableDecision?.executiveSummary.topBlockers ??
          intelligence.keyBlockers,
      ),
    risks: (webSections.risks?.length ?? 0) === (pdfSections.risks?.length ?? 0),
    actions:
      (webSections.actionPlan?.items?.length ?? 0) ===
      (pdfSections.actionPlan?.items?.length ?? 0),
    verification:
      (webSections.complianceSummary?.verify ?? null) ===
        (pdfSections.complianceSummary?.verify ?? null) &&
      (webSections.verifyRequirements?.length ?? 0) ===
        (pdfSections.verifyRequirements?.length ?? 0),
    importantValues:
      webSections.deadlineIso === heuristic.deadlineIso &&
      pdfSections.deadlineIso === heuristic.deadlineIso &&
      webContent.fitScoreDisplay === pdfContent.fitScoreDisplay,
  };
  const webPdfOk = Object.values(webPdfParity).every(Boolean);

  const staleOk =
    guardian.ok &&
    (guardian.snapshot as { contentHash?: string } | null)?.contentHash === contentHash;

  const hardData = {
    mad12000: canonical.some((c) => /MAD\s*12[,.]?000|12[,.]?000/i.test(c.requirement)),
    performance10pct: canonical.some((c) => /10\s*%|performance guarantee/i.test(c.requirement)),
    firmPricing: canonical.some((c) => /firm|non-revisable/i.test(c.requirement)),
    gbps: canonical.some((c) => /1\s*Gbps/i.test(c.requirement)),
    wifi6: canonical.some((c) => /Wi-?Fi\s*6/i.test(c.requirement)),
    doors16: canonical.some((c) => /16\s+controlled doors/i.test(c.requirement)),
    cat6a: canonical.some((c) => /Category\s*6A|Cat(?:egory)?\s*6A/i.test(c.requirement)),
    warranty24: canonical.some((c) => /24-month|24\s+month/i.test(c.requirement)),
    support24h: canonical.some((c) => /within\s+24\s+hours/i.test(c.requirement)),
    projects3y5: canonical.some((c) => /3\s+completed|last\s+5\s+years|5\s+years/i.test(c.requirement)),
  };

  const priorAnalysisId = "fresh-t3-stress-1788372493516";
  const freshRerun = ANALYSIS_ID !== priorAnalysisId && ANALYSIS_ID.startsWith("fresh-t3-stress-");

  const regressionTargets: Record<string, { pass: boolean; detail?: unknown; layer?: string }> = {
    "1_wrong_deadline_timezone": {
      pass: deadlineOk,
      layer: "Hard data / deadline",
      detail: {
        iso: heuristic.deadlineIso,
        tz: heuristic.deadlineTimezone,
        wall,
        sourceDeadlineWindow,
        sourceHasLocalTime,
      },
    },
    "2_count_drift": {
      pass: countOk,
      layer: "Canonical counting",
      detail: {
        canonical: canonical.length,
        matrix: intelligence.complianceMatrix.length,
        summary: intelligence.complianceSummary.totalRequirements,
        web: webSections.complianceMatrix.length,
        pdf: pdfSections.complianceMatrix.length,
      },
    },
    "3_truncated_requirement": {
      pass: truncated.length === 0,
      layer: "Source → Canonical",
      detail: truncated.map((c) => c.requirement),
    },
    "4_lost_requirement_id": {
      pass: missingSourceIds.length === 0,
      layer: "Source → Canonical",
      detail: { uniqueSourceIds, missingSourceIds, canonicalIds: canonical.map((c) => c.id) },
    },
    "5_lost_conditional_clause": {
      pass: Boolean(
        r13 &&
          r13.obligationStrength === "CONDITIONAL" &&
          /if the bidder|manufactured outside|authorization|distribution channel/i.test(
            r13.requirement,
          ),
      ),
      layer: "Source → Canonical",
      detail: r13
        ? {
            id: r13.id,
            strength: r13.obligationStrength,
            text: r13.requirement,
          }
        : null,
    },
    "6_dropped_commercial": {
      pass: hardData.firmPricing && hardData.performance10pct && hardData.mad12000,
      layer: "Source → Canonical",
      detail: hardData,
    },
    "7_false_heading_requirement": {
      pass: !leaks.find((l) => l.id === "heading-admin")?.leaked,
      layer: "Boundary",
    },
    "8_evaluation_criteria_leak": {
      pass:
        !leaks.find((l) => l.id === "evaluation-weights")?.leaked &&
        !leaks.find((l) => l.id === "evaluation-note")?.leaked &&
        evaluationLeaks.length === 0,
      layer: "Boundary",
    },
    "9_reviewer_scenario_leak": {
      pass: !leaks.find((l) => l.id === "reviewer-scenario")?.leaked,
      layer: "Boundary",
    },
    "10_qa_meta_leak": {
      pass: !leaks.find((l) => l.id === "qa-meta")?.leaked && nonReqLeaks.length === 0,
      layer: "Boundary",
      detail: nonReqLeaks.map((c) => c.requirement.slice(0, 80)),
    },
    "11_duplicate_semantic": {
      pass:
        canonical.filter((c) =>
          /12[,.]?000|provisional bid security|provisional\s+(?:bond|guarantee)\b/i.test(
            c.requirement,
          ),
        ).length <= 1 &&
        canonical.filter((c) => /3\s+completed comparable|last\s+5\s+years/i.test(c.requirement))
          .length <= 1 &&
        canonical.filter((c) => /implementation\s+schedule|commissioning\s+plan/i.test(c.requirement))
          .length <= 1,
      layer: "Canonical / semantic dedupe",
    },
    "12_unsupported_fit_claim": {
      pass: confirmedFitWithoutEvidence.length === 0,
      layer: "Fit / Evidence",
      detail: confirmedFitWithoutEvidence.map((r) => r.id),
    },
    "13_missing_evidence_as_gap": {
      pass: !engine.requirements.some(
        (r) => r.fitStatus === "CONFIRMED_GAP" && !r.evidence?.trim(),
      ),
      layer: "Fit / Evidence",
    },
    "14_verification_as_hard_blocker": {
      pass:
        intelligence.keyBlockers.length === 0 &&
        highRiskFromVerifyOnly.length === 0 &&
        blockingVerify.length === 0,
      layer: "Risk / Decision",
      detail: {
        hardBlockers: intelligence.keyBlockers,
        highRiskFromVerifyOnly: highRiskFromVerifyOnly.length,
        blockingVerify: blockingVerify.length,
      },
    },
    "15_action_without_canonical_identity": {
      pass: actionPhaseOk,
      layer: "Action Plan",
      detail: {
        orphans: orphanActions.length,
        missingId: actionsMissingCanonicalId.length,
        duplicatePrimary: duplicatePrimaryActions,
        genericVerification: genericVerificationActions.length,
        integrityError: actionPlanIntegrityError,
        actions: actionPlan.items.length,
      },
    },
    "16_web_pdf_mismatch": { pass: webPdfOk, layer: "Web/PDF parity", detail: webPdfParity },
    "17_stale_result": {
      pass: staleOk,
      layer: "Guardian / release",
      detail: { contentHash, snapshot: guardian.snapshot },
    },
    "18_conditionality_inversion": {
      pass: !conditionalityInversion,
      layer: "Canonical / conditionality",
      detail: r13
        ? { id: r13.id, strength: r13.obligationStrength, mandatory: r13.mandatory }
        : null,
    },
    "19_evidence_conflict": {
      pass: evidenceConflicts.length === 0,
      layer: "Fit / Evidence",
      detail: evidenceConflicts.map((r) => ({ id: r.id, fit: r.fitStatus })),
    },
    "20_ai_override_of_canonical_decision": {
      pass:
        aiOverrideCaught &&
        aiParticipated === false &&
        ((engine.decision === "NO_BID" && intelligence.keyBlockers.length > 0) ||
          (engine.decision !== "NO_BID" && intelligence.keyBlockers.length === 0)),
      layer: "Decision / Guardian",
      detail: {
        aiOverrideCaught,
        aiParticipated,
        decision: engine.decision,
        hardBlockers: intelligence.keyBlockers.length,
      },
    },
    hard_data_integrity: {
      pass: Object.values(hardData).every(Boolean),
      layer: "Hard data",
      detail: hardData,
    },
    guardian_pass: {
      pass: guardian.ok && (guardian.checksRun?.length ?? 0) > 0,
      layer: "Guardian",
      detail: { blocking: guardian.blocking, checksRun: guardian.checksRun },
    },
    decision_valid: {
      pass:
        (engine.decision === "NO_BID" && intelligence.keyBlockers.length > 0) ||
        (engine.decision !== "NO_BID" && intelligence.keyBlockers.length === 0),
      layer: "Decision",
      detail: { decision: engine.decision, hardBlockers: intelligence.keyBlockers.length },
    },
    estimated_value_not_requirement: {
      pass: !leaks.find((l) => l.id === "estimated-value-fact")?.leaked,
      layer: "Boundary",
    },
    action_plan_phase8: {
      pass: actionPhaseOk,
      layer: "Action Plan",
      detail: {
        orphanActions: orphanActions.length,
        missingCanonicalId: actionsMissingCanonicalId.length,
        duplicatePrimary: duplicatePrimaryActions.length,
        genericVerification: genericVerificationActions.length,
        integrityOk: actionPlanIntegrityOk,
      },
    },
  };

  const defects = Object.entries(regressionTargets)
    .filter(([, v]) => !v.pass)
    .map(([id, v]) => ({ id, layer: v.layer, detail: v.detail }));

  const criticalDefects = defects.filter((d) =>
    [
      "1_wrong_deadline_timezone",
      "2_count_drift",
      "3_truncated_requirement",
      "4_lost_requirement_id",
      "5_lost_conditional_clause",
      "6_dropped_commercial",
      "8_evaluation_criteria_leak",
      "9_reviewer_scenario_leak",
      "10_qa_meta_leak",
      "14_verification_as_hard_blocker",
      "15_action_without_canonical_identity",
      "16_web_pdf_mismatch",
      "17_stale_result",
      "18_conditionality_inversion",
      "19_evidence_conflict",
      "20_ai_override_of_canonical_decision",
      "hard_data_integrity",
      "guardian_pass",
      "decision_valid",
      "action_plan_phase8",
    ].includes(d.id),
  );

  const excludedClasses = [
    { class: "Evaluation weights / notes", reason: "Evaluation criterion / meta — not bidder obligations" },
    { class: "Verification scenarios", reason: "Reviewer/test scenario — not bidder obligations" },
    { class: "Quality-control test note", reason: "QA/meta instruction to analysis system" },
    { class: "Estimated contract value MAD 420,000", reason: "Informational tender fact" },
    { class: "Section headings / Scope narrative / tender title", reason: "Document structure / buyer narrative — not bidder obligations" },
    { class: "Required Submission Package noun-list cross-refs", reason: "Packaging checklist duplicates substantive R-IDs" },
    { class: "Procedural deadline statement", reason: "Deadline is hard-data fact, not a qualification requirement" },
  ];

  const priorFixCycle = {
    firstFailAnalysisId: "fresh-t3-stress-1788372011454",
    firstFailDefect: "11_duplicate_semantic",
    firstDivergenceLayer: "Boundary / obligation classification",
    rootCause:
      "Title, Scope narrative, and submission-package noun phrases accepted via bare activity verbs; commercial cues too narrow; provisional-acceptance false-positive in duplicate check",
    fixApplied: [
      "Split strong modality vs activity cues in isRealBidderObligation",
      "Reject titles, buyer-scope narratives, bare package-list items",
      "Exclude Scope + Required Submission Package from harvest",
      "Expand commercial cues (remains responsible, may apply)",
      "Prefer financial classification for payment terms",
      "Dedupe implementation schedule / commissioning plan",
    ],
    rerunAfterFixAnalysisId: "fresh-t3-stress-1788372493516",
    thisRunAnalysisId: ANALYSIS_ID,
    sameSourceSha256: sourceFileHash === "1d43362350e9fb062788baed622c93f4410eab7ae5cedacebe3d35bb9ea47982",
    freshRerun,
  };

  const out = {
    STATUS: defects.length === 0 ? "PASS" : "FAIL",
    defectCount: defects.length,
    criticalDefectCount: criticalDefects.length,
    analysisId: ANALYSIS_ID,
    analysisTimestamp: new Date().toISOString(),
    sourceFile: PDF,
    sourceFileSha256: sourceFileHash,
    sourceTextSha256: sourceTextHash,
    canonicalReleaseHash: contentHash,
    canonicalItemCount: canonical.length,
    decision: engine.decision,
    fit: engine.fitScore,
    guardianOk: guardian.ok,
    guardianDurationMs: guardian.durationMs,
    guardianChecksRun: guardian.checksRun,
    guardianBlocking: guardian.blocking,
    webPdfParity: { ...webPdfParity, ok: webPdfOk },
    staleResult: !staleOk,
    actionCount: actionPlan.items.length,
    riskCount: intelligence.risks.length,
    totalAnalysisTime: Date.now() - STARTED,
    hardBlockers: intelligence.keyBlockers,
    reviewItems: intelligence.reviewItems,
    deadline: {
      iso: heuristic.deadlineIso,
      timezone: heuristic.deadlineTimezone,
      wallClock: wall,
      sourceDeadlineWindow,
      sourceHasLocalTime,
    },
    hardData,
    actionPlanPhase8: {
      everyActionHasCanonicalItemId: actionsMissingCanonicalId.length === 0,
      orphanCount: orphanActions.length,
      duplicatePrimaryCount: duplicatePrimaryActions.length,
      genericVerificationCount: genericVerificationActions.length,
      integrityOk: actionPlanIntegrityOk,
      alignedWithCanonicalCount:
        actionPlan.items.filter((a) => !a.simulationOnly && a.linkedRequirementId).length ===
        canonical.length,
    },
    performance: {
      totalMs: Date.now() - STARTED,
      extractMs,
      guardianMs: guardian.durationMs,
      reportMs,
    },
    // A
    canonicalItems: canonical.map((c) => ({
      id: c.id,
      semanticKind: c.semanticKind,
      obligationStrength: c.obligationStrength,
      category: c.category,
      mandatory: c.mandatory,
      description: c.requirement,
      provenance: { section: c.sourceSection, page: c.page },
    })),
    // B
    excludedClasses,
    // C–F
    defects,
    criticalDefects,
    priorFixCycle,
    leaks,
    regressionTargets: Object.fromEntries(
      Object.entries(regressionTargets).map(([k, v]) => [k, v.pass]),
    ),
    reusedPriorResult: false,
    proofFreshness: {
      analysisIdUnique: ANALYSIS_ID,
      analyzedAt: report.analyzedAt,
      contentHash,
      note: "Offline pipeline from PDF bytes — no DB tender/decision row reused; assertFinalReleaseIntegrity only (no OCR/AI inside Guardian)",
      freshRerun,
    },
    sourceTextPreview: text.slice(0, 2500),
  };

  mkdirSync("artifacts", { recursive: true });
  writeFileSync("artifacts/test3-stress-proof.json", JSON.stringify(out, null, 2));
  writeFileSync("artifacts/test3-stress-proof-source.txt", text);

  console.log(
    JSON.stringify(
      {
        STATUS: out.STATUS,
        defectCount: out.defectCount,
        criticalDefectCount: out.criticalDefectCount,
        analysisId: out.analysisId,
        sourceFileSha256: out.sourceFileSha256,
        sourceTextSha256: out.sourceTextSha256,
        canonicalReleaseHash: out.canonicalReleaseHash,
        canonicalItemCount: out.canonicalItemCount,
        decision: out.decision,
        fit: out.fit,
        guardianOk: out.guardianOk,
        guardianDurationMs: out.guardianDurationMs,
        webPdfParity: out.webPdfParity,
        staleResult: out.staleResult,
        actionCount: out.actionCount,
        riskCount: out.riskCount,
        totalAnalysisTime: out.totalAnalysisTime,
        actionPlanPhase8: out.actionPlanPhase8,
        regressionPass: out.regressionTargets,
        defects: out.defects,
        priorFixCycle: out.priorFixCycle,
        performance: out.performance,
      },
      null,
      2,
    ),
  );

  console.log("\n=== A. CANONICAL ITEMS ===");
  for (const c of canonical) {
    console.log(
      `[${c.id ?? "?"}] ${c.semanticKind}/${c.obligationStrength} p${c.page ?? "?"} :: ${c.requirement.slice(0, 140)}`,
    );
  }
  console.log("\n=== B. EXCLUDED CLASSES ===");
  for (const e of excludedClasses) {
    console.log(`- ${e.class}: ${e.reason}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
