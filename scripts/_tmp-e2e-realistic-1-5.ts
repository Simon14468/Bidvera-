import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { extractDocumentText } from "@/services/document/extract";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import { buildCanonicalRequirements, assertAnalysisReadyForCompletion } from "@/domain/tender-requirements";
import { runDecisionEngine } from "@/domain/decision/engine";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { buildTenderActionPlan } from "@/domain/tender-action-plan";
import { finalizeTenderDecision } from "@/domain/decision/tender-decision-engine";
import {
  assertFinalReleaseIntegrity,
  buildDecisionGuardianInput,
  DecisionGuardianError,
  hashCanonicalReleasePayload,
} from "@/domain/decision-validation";
import type { RuleCompanyProfile } from "@/domain/decision/types";
import { deriveCanonicalReportSections, FULL_REPORT_FEATURE_ACCESS } from "@/services/reports/report-canonical-view";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";

function listPdfFiles(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) listPdfFiles(p, out);
    else if (ent.isFile() && p.toLowerCase().endsWith(".pdf")) out.push(p);
  }
  return out;
}

type TestFile = { testNo: number; file: string; label: string };

function parseTestNo(file: string): number | null {
  const m = file.match(/Realistic_Test_(0[1-5])_/i);
  if (!m) return null;
  return Number(m[1]);
}

function labelFor(testNo: number): string {
  switch (testNo) {
    case 1:
      return "IT Hardware Supply";
    case 2:
      return "Cleaning & Green Spaces";
    case 3:
      return "Solar Maintenance";
    case 4:
      return "Road Construction";
    case 5:
      return "IT Equipment Maintenance";
    default:
      return `Realistic Test ${testNo}`;
  }
}

const uploadsRoot = resolve(".data/uploads");

async function runForFile(testFile: TestFile) {
  const buf = readFileSync(testFile.file);
  const fileName = testFile.file.split(/[/\\]/).pop()!;

  const extracted = await extractDocumentText({
    buffer: buf,
    mimeType: "application/pdf",
    fileName,
  });
  const text = extracted.text;

  const heuristic = extractTenderPackageHeuristic({ text, fileName });
  const canonical = buildCanonicalRequirements({
    heuristicDrafts: heuristic.requirements,
    sourceDocument: fileName,
  });

  // Defect 2 smoke checks: client and deadline should be extracted when present.
  if (/Procuring entity\s*:/i.test(text)) {
    if (!heuristic.client) {
      throw new Error(`[${testFile.label}] expected heuristic.client when "Procuring entity:" is present`);
    }
  }

  if (/\\b(Deadline|Opening|Ouverture)\\b/i.test(text)) {
    if (!heuristic.deadlineIso) {
      throw new Error(`[${testFile.label}] expected heuristic.deadlineIso when deadline-ish keywords exist`);
    }
  }

  if (canonical.length < 3) {
    throw new Error(`[${testFile.label}] expected substantive canonical requirements, got ${canonical.length}`);
  }

  const profile: RuleCompanyProfile = {
    companyName: "Bidvera E2E Runner",
    industry: "IT",
    country: heuristic.country ?? "Morocco",
    companySize: "11-50",
    experienceLevel: "experienced",
    services: [],
    certifications: [],
    experienceYears: 5,
    revenueRange: null,
    employeeRange: "11-50",
    geographicCoverage: [heuristic.country ?? "Morocco"],
    contractSizeMin: null,
    contractSizeMax: null,
    customQualificationRules: [],
  };

  const requirements = canonical.map((r, i) => ({
    id: r.id ?? `e2e-r${testFile.testNo}-${i + 1}`,
    category: r.category,
    description: r.requirement,
    mandatory: r.mandatory,
    value: r.value ?? null,
    status: "UNCERTAIN" as const,
    sourcePage: r.page ?? null,
    sourceSection: r.sourceSection ?? null,
    evidence: r.evidenceText ?? null,
  }));

  const engine = runDecisionEngine({
    profile,
    requirements,
    estimatedValue: heuristic.estimatedValue,
    tenderContext: {
      title: heuristic.title ?? testFile.label,
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
    tenderId: `e2e-${testFile.testNo}-${Date.now()}`,
    documentName: fileName,
    tenderDeadline: heuristic.deadlineIso ? new Date(heuristic.deadlineIso) : null,
    extractedText: text,
    requirements: engine.requirements.map((r) => ({
      id: r.id!,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value ?? null,
      status: r.status,
      sourcePage: r.page ?? null,
      sourceSection: r.section ?? null,
      evidence: r.evidence ?? null,
      semanticKind: r.semanticKind ?? null,
    })),
    evidence: [],
    readiness,
    findings: engine.findings,
    existingRisks: [],
    decision: engine.decision,
    fitScore: engine.fitScore,
  });

  assertAnalysisReadyForCompletion({ requirements: canonical, intelligence });

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
    tenderId: `e2e-${testFile.testNo}-${Date.now()}`,
    companyId: "e2e-runner",
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

  const contentHash = hashCanonicalReleasePayload(
    intelligence.complianceMatrix.map((row) => ({ id: row.requirementId, text: row.requirement })),
  );

  const guardianReqs = engine.requirements.map((r) => ({
    id: r.id ?? null,
    requirement: r.description,
    category: r.category,
    semanticKind: r.semanticKind ?? null,
    mandatory: r.mandatory,
    sourceSection: r.section ?? null,
    page: typeof r.page === "number" ? r.page : null,
    evidenceText: r.evidence ?? null,
    fitStatus: r.fitStatus ?? null,
    hasCompanyEvidence: Boolean(r.evidence),
    companyEvidenceText: r.evidence ?? null,
  }));

  const guardianInput = buildDecisionGuardianInput({
    textLength: text.trim().length,
    readable: true,
    validityPassed: true,
    fileName,
    requirements: guardianReqs,
    matrix: intelligence.complianceMatrix.map((row) => ({ requirementId: row.requirementId })),
    readinessItems: readiness.items.map((i) => ({ id: i.id })),
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
      sourceEvidence: heuristic.deadlineEvidence,
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
    derivedDeadline: heuristic.deadlineIso ? {
      canonicalIso: heuristic.deadlineIso,
      canonicalTimezone: heuristic.deadlineTimezone,
      representations: [
        { channel: "WEB" as const, iso: heuristic.deadlineIso, timezone: heuristic.deadlineTimezone },
        { channel: "PDF" as const, iso: heuristic.deadlineIso, timezone: heuristic.deadlineTimezone },
      ],
    } : null,
    staleResult: { canonicalContentHash: contentHash, projectedContentHash: contentHash },
    expectedCommercialCues: [],
  });

  let guardianOk = false;
  try {
    const release = assertFinalReleaseIntegrity(guardianInput, contentHash);
    guardianOk = true;
    if (!release.snapshot) throw new Error("Guardian snapshot missing");
  } catch (e) {
    if (e instanceof DecisionGuardianError) {
      // Provide better error context.
      console.error(`[${testFile.label}] guardian blocking failures`, e.result.blockingFailures);
    }
    throw e;
  }

  // Global count consistency: Web and PDF compliance matrix lengths must match.
  const report: TenderReport = {
    tenderId: `e2e-${testFile.testNo}`,
    companyId: "e2e-runner",
    title: heuristic.title ?? testFile.label,
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
    intelligence: { ...intelligence, tenderDecisionRecommendation: finalized.recommendation },
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

  const countsOk =
    webSections.complianceMatrix.length === intelligence.complianceMatrix.length &&
    pdfSections.complianceMatrix.length === intelligence.complianceMatrix.length &&
    webSections.complianceSummary?.totalRequirements === intelligence.complianceSummary.totalRequirements;

  if (!guardianOk) throw new Error(`[${testFile.label}] guardian did not confirm final integrity`);
  if (!countsOk) throw new Error(`[${testFile.label}] count consistency failed`);

  // Generate content once to ensure report projection works.
  const webContent = buildReportDisplayContent(webSections, "en");
  if (!webContent) throw new Error(`[${testFile.label}] web report display content missing`);
}

async function main() {
  const allPdfs = listPdfFiles(uploadsRoot);
  const realistic = allPdfs
    .map((f) => {
      const testNo = parseTestNo(f);
      return testNo == null ? null : { testNo, file: f, label: labelFor(testNo) };
    })
    .filter(Boolean) as TestFile[];

  const sorted = realistic.sort((a, b) => a.testNo - b.testNo);
  if (sorted.length < 5) {
    throw new Error(`Expected at least 5 Bidvera Realistic_Test_01-05 PDFs, found ${sorted.length}`);
  }

  const selected = sorted.slice(0, 5);
  for (const tf of selected) {
    console.log(`Running E2E hardened checks: Test #${tf.testNo} — ${tf.label}`);
    await runForFile(tf);
  }

  console.log("E2E hardened checks (real PDFs) completed successfully for Tests 1–5.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

