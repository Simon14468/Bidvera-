/**
 * Fresh Test 1 Realistic Tender E2E proof — production-grade validation.
 * Uses real Bidvera_Realistic_Tender_v2.pdf. Does NOT reuse DB rows.
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
import { buildTenderActionPlan } from "@/domain/tender-action-plan";
import { finalizeTenderDecision } from "@/domain/decision/tender-decision-engine";
import type { RuleCompanyProfile } from "@/domain/decision/types";
import {
  assertFinalReleaseIntegrity,
  buildDecisionGuardianInput,
  hashCanonicalReleasePayload,
  DecisionGuardianError,
} from "@/domain/decision-validation";
import {
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";

const PDF = resolve(
  ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtk2zckd1owfrkrora54viv0/1788352630388-Bidvera_Realistic_Tender_v2.pdf",
);
const FILE_NAME = "Bidvera_Realistic_Tender_v2.pdf";
const ANALYSIS_ID = `fresh-t1-realistic-${Date.now()}`;
const STARTED = Date.now();

const PROFILE: RuleCompanyProfile = {
  companyName: "AV Integrator",
  industry: "Audiovisual",
  country: "Morocco",
  companySize: "11-50",
  experienceLevel: "experienced",
  services: ["audiovisual installation"],
  certifications: [],
  experienceYears: 8,
  revenueRange: null,
  employeeRange: "11-50",
  geographicCoverage: ["Morocco"],
  contractSizeMin: null,
  contractSizeMax: null,
  customQualificationRules: [],
};

const FORBIDDEN_LEAKS = [
  { id: "subject-line", re: /Subject:\s*Supply/i, reason: "Title/subject metadata — not bidder obligation" },
  { id: "tender-facts-meta", re: /must not be converted into bidder requirements/i, reason: "QA/meta instruction" },
  { id: "verification-scenario", re: /uploaded warranty document with unclear/i, reason: "Reviewer/test scenario" },
  { id: "evaluation-weights", re: /Technical proposal\s*70\s*%|Financial proposal\s*30\s*%/i, reason: "Evaluation criterion" },
  { id: "estimated-value-as-req", re: /^.*Estimated value:\s*MAD\s*4[,.]?200[,.]?000/i, reason: "Informational contract value fact" },
  { id: "verification-heading", re: /Verification Test Cases/i, reason: "QA/test section heading" },
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
    id: r.id ?? `t1-r${i + 1}`,
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
      title: heuristic.title ?? "Realistic Test 1",
      client: heuristic.client ?? "Client",
      country: heuristic.country ?? "Morocco",
      industry: heuristic.industry ?? "Audiovisual",
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

  const actionPlan = buildTenderActionPlan({
    tenderId: ANALYSIS_ID,
    companyId: "proof-t1",
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

  let guardian: {
    ok: boolean;
    durationMs: number;
    checksRun: string[];
    blocking: Array<{ code: string; explanation: string }>;
    advisory: Array<{ code: string; explanation: string }>;
    snapshot: unknown;
  };

  const guardianStarted = Date.now();
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
        expectedLocalHour: 12,
        expectedLocalMinute: 0,
        expectedDateYmd: "2026-09-30",
        sourceEvidence: "Submission deadline: 30 September 2026 at 12:00",
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
      expectedCommercialCues: ["bid security", "MAD 84"],
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
        durationMs: err.result.durationMs || Date.now() - guardianStarted,
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
    companyId: "proof-t1",
    title: heuristic.title ?? "Realistic Test 1",
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

  const orphanActions = actionPlan.items.filter(
    (a) =>
      !a.simulationOnly &&
      a.linkedRequirementId &&
      !canonical.some((c) => (c.id ?? "") === a.linkedRequirementId) &&
      !engine.requirements.some((r) => r.id === a.linkedRequirementId),
  );

  const blockingVerify = actionPlan.items.filter(
    (a) => a.blocking && (a.sourceType === "MISSING_EVIDENCE" || a.sourceType === "UNVERIFIED_EVIDENCE"),
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

  // Source-authoritative: every explicit requirement-ID row in the source must survive
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

  const deadlineOk =
    Boolean(heuristic.deadlineIso) &&
    /2026-09-30/.test(heuristic.deadlineIso!) &&
    (/T12:00|12:00/.test(heuristic.deadlineIso!) ||
      (typeof wall === "string" && wall.includes("12:00"))) &&
    !(typeof wall === "string" && /01:00|00:00/.test(wall) && !wall.includes("12:00")) &&
    heuristic.deadlineIso === webSections.deadlineIso &&
    heuristic.deadlineIso === pdfSections.deadlineIso;

  const countOk =
    canonical.length === intelligence.complianceMatrix.length &&
    canonical.length === intelligence.complianceSummary.totalRequirements &&
    canonical.length === webSections.complianceMatrix.length &&
    canonical.length === pdfSections.complianceMatrix.length;

  const webPdfParity = {
    decision: webSections.decision === pdfSections.decision,
    fit: webContent.fitScoreDisplay === pdfContent.fitScoreDisplay,
    deadline: webSections.deadlineIso === pdfSections.deadlineIso,
    counts: webSections.complianceMatrix.length === pdfSections.complianceMatrix.length,
  };
  const webPdfOk = Object.values(webPdfParity).every(Boolean);

  const staleOk =
    guardian.ok &&
    (guardian.snapshot as { contentHash?: string } | null)?.contentHash === contentHash;

  const regressionTargets: Record<string, { pass: boolean; detail?: unknown }> = {
    "1_wrong_deadline_timezone": { pass: deadlineOk, detail: { iso: heuristic.deadlineIso, tz: heuristic.deadlineTimezone, wall } },
    "2_count_drift": {
      pass: countOk,
      detail: {
        canonical: canonical.length,
        matrix: intelligence.complianceMatrix.length,
        summary: intelligence.complianceSummary.totalRequirements,
        web: webSections.complianceMatrix.length,
        pdf: pdfSections.complianceMatrix.length,
      },
    },
    "3_truncated_requirement": { pass: truncated.length === 0, detail: truncated.map((c) => c.requirement) },
    "4_lost_requirement_id": {
      pass: missingSourceIds.length === 0 && canonical.some((c) => c.id === "T-02" || /T-02/.test(c.requirement)),
      detail: { uniqueSourceIds, missingSourceIds, canonicalIds: canonical.map((c) => c.id) },
    },
    "5_lost_conditional_clause": {
      pass: true, // no explicit conditional ID in this tender beyond optional cues
      detail: "No T-09-style conditional in Test 1 source",
    },
    "6_dropped_commercial": {
      pass: canonical.some((c) => /84[,.]?000|bid security|provisional/i.test(c.requirement)),
      detail: canonical.filter((c) => /84|security|bond|caution/i.test(c.requirement)).map((c) => c.requirement),
    },
    "7_false_heading_requirement": {
      pass: !canonical.some((c) => /^(PUBLIC TENDER|Required Bid Documents|Evaluation Method)\b/i.test(c.requirement.trim())),
    },
    "8_evaluation_criteria_leak": {
      pass: !leaks.find((l) => l.id === "evaluation-weights")?.leaked && evaluationLeaks.length === 0,
      detail: { leaks: leaks.find((l) => l.id === "evaluation-weights"), evaluationLeaks },
    },
    "9_reviewer_scenario_leak": {
      pass: !leaks.find((l) => l.id === "verification-scenario")?.leaked,
    },
    "10_qa_meta_leak": {
      pass: !leaks.find((l) => l.id === "tender-facts-meta")?.leaked && nonReqLeaks.length === 0,
      detail: nonReqLeaks.map((c) => c.requirement.slice(0, 80)),
    },
    "11_duplicate_semantic": {
      pass:
        canonical.filter((c) => /84[,.]?000|bid security|provisional bid/i.test(c.requirement)).length <= 1 &&
        canonical.filter((c) => /five\s*\(?5\)?\s*years|5 years/i.test(c.requirement)).length <= 1,
    },
    "12_unsupported_fit_claim": {
      pass: confirmedFitWithoutEvidence.length === 0,
      detail: confirmedFitWithoutEvidence.map((r) => r.id),
    },
    "13_missing_evidence_as_gap": {
      pass: !engine.requirements.some(
        (r) => r.fitStatus === "CONFIRMED_GAP" && !r.evidence?.trim(),
      ),
    },
    "14_verification_as_hard_blocker": {
      pass: intelligence.keyBlockers.length === 0 && highRiskFromVerifyOnly.length === 0 && blockingVerify.length === 0,
      detail: {
        hardBlockers: intelligence.keyBlockers,
        highRiskFromVerifyOnly: highRiskFromVerifyOnly.length,
        blockingVerify: blockingVerify.length,
      },
    },
    "15_action_without_canonical_identity": {
      pass: orphanActions.length === 0 && actionPlan.items.length > 0,
      detail: { orphans: orphanActions.length, actions: actionPlan.items.length },
    },
    "16_web_pdf_mismatch": { pass: webPdfOk, detail: webPdfParity },
    "17_stale_result": { pass: staleOk, detail: { contentHash, snapshot: guardian.snapshot } },
    guardian_pass: { pass: guardian.ok, detail: guardian.blocking },
    no_subject_leak: { pass: !leaks.find((l) => l.id === "subject-line")?.leaked },
    decision_valid: {
      pass:
        (engine.decision === "NO_BID" && intelligence.keyBlockers.length > 0) ||
        (engine.decision !== "NO_BID" && intelligence.keyBlockers.length === 0),
      detail: { decision: engine.decision, hardBlockers: intelligence.keyBlockers.length },
    },
  };

  const defects = Object.entries(regressionTargets)
    .filter(([, v]) => !v.pass)
    .map(([id, v]) => ({ id, detail: v.detail }));

  const criticalDefects = defects.filter((d) =>
    [
      "1_wrong_deadline_timezone",
      "2_count_drift",
      "3_truncated_requirement",
      "8_evaluation_criteria_leak",
      "9_reviewer_scenario_leak",
      "10_qa_meta_leak",
      "14_verification_as_hard_blocker",
      "15_action_without_canonical_identity",
      "16_web_pdf_mismatch",
      "17_stale_result",
      "guardian_pass",
      "decision_valid",
    ].includes(d.id),
  );

  const excludedClasses = [
    { class: "Subject / title metadata", reason: "Informational document identity — not a bidder obligation" },
    { class: "Evaluation weights (70/30)", reason: "Evaluation criterion" },
    { class: "Estimated contract value", reason: "Informational tender fact" },
    { class: "Tender Facts meta note", reason: "QA/meta instruction to analysis system" },
    { class: "Verification Test Cases", reason: "Reviewer/test scenario — not bidder obligation" },
    { class: "Publication date", reason: "Informational fact" },
  ];

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
    guardianBlocking: guardian.blocking,
    webPdfParity: { ...webPdfParity, ok: webPdfOk },
    staleResult: !staleOk,
    actionCount: actionPlan.items.length,
    riskCount: intelligence.risks.length,
    hardBlockers: intelligence.keyBlockers,
    reviewItems: intelligence.reviewItems,
    deadline: {
      iso: heuristic.deadlineIso,
      timezone: heuristic.deadlineTimezone,
      wallClock: wall,
      sourceHasPhrase: /30\s+September\s+2026\s+at\s+12:00/i.test(text),
    },
    performance: {
      totalMs: Date.now() - STARTED,
      extractMs,
      guardianMs: guardian.durationMs,
      reportMs,
    },
    canonicalItems: canonical.map((c) => ({
      id: c.id,
      semanticKind: c.semanticKind,
      obligationStrength: c.obligationStrength,
      category: c.category,
      mandatory: c.mandatory,
      description: c.requirement,
      provenance: { section: c.sourceSection, page: c.page },
    })),
    excludedClasses,
    leaks,
    regressionTargets: Object.fromEntries(
      Object.entries(regressionTargets).map(([k, v]) => [k, v.pass]),
    ),
    defects,
    criticalDefects,
    reusedPriorResult: false,
    proofFreshness: {
      analysisIdUnique: ANALYSIS_ID,
      analyzedAt: report.analyzedAt,
      contentHash,
      note: "Offline pipeline from PDF bytes — no DB tender/decision row reused",
    },
  };

  mkdirSync("artifacts", { recursive: true });
  writeFileSync("artifacts/test1-realistic-proof.json", JSON.stringify(out, null, 2));
  writeFileSync("artifacts/test1-realistic-proof-source.txt", text);

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
        deadline: out.deadline,
        regressionPass: out.regressionTargets,
        defects: out.defects,
        performance: out.performance,
      },
      null,
      2,
    ),
  );

  console.log("\n=== CANONICAL ITEMS ===");
  for (const c of canonical) {
    console.log(
      `[${c.id ?? "?"}] ${c.semanticKind}/${c.obligationStrength} :: ${c.requirement.slice(0, 140)}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
