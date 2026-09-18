/**
 * Real PDF E2E — Bidvera Realistic Test #5 (IT Equipment Maintenance).
 * Proves conditional-obligation context fix reaches a valid final Guardian state.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { extractDocumentText } from "@/services/document/extract";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import {
  assertAnalysisReadyForCompletion,
  buildCanonicalRequirements,
  hasConditionalTriggerContext,
} from "@/domain/tender-requirements";
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

const PDF = resolve(
  ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtlhmhta0zo6rkz4aajx242y/1788437690823-Bidvera_Realistic_Test_05_IT_Equipment_Maintenance_2026.pdf",
);
const FILE_NAME = "Bidvera_Realistic_Test_05_IT_Equipment_Maintenance_2026.pdf";
const ANALYSIS_ID = `fresh-t5-it-maint-${Date.now()}`;

const PROFILE: RuleCompanyProfile = {
  companyName: "Atlas Digital Solutions",
  industry: "IT Services",
  country: "Morocco",
  companySize: "11-50",
  experienceLevel: "experienced",
  services: ["IT maintenance", "hardware support", "managed services"],
  certifications: ["ISO 9001", "ISO 27001"],
  experienceYears: 8,
  revenueRange: null,
  employeeRange: "11-50",
  geographicCoverage: ["Morocco"],
  contractSizeMin: null,
  contractSizeMax: null,
  customQualificationRules: [],
};

async function main() {
  const buf = readFileSync(PDF);
  const sourceFileHash = createHash("sha256").update(buf).digest("hex");

  const extracted = await extractDocumentText({
    buffer: buf,
    mimeType: "application/pdf",
    fileName: FILE_NAME,
  });
  const text = extracted.text;
  if (text.trim().length < 200) {
    throw new Error(`Test #5 PDF text too short (${text.length} chars)`);
  }

  const heuristic = extractTenderPackageHeuristic({ text, fileName: FILE_NAME });
  const canonical = buildCanonicalRequirements({
    heuristicDrafts: heuristic.requirements,
    sourceDocument: FILE_NAME,
  });

  if (canonical.length < 3) {
    throw new Error(`Expected substantive canonical set, got ${canonical.length}`);
  }

  // No invented CONDITIONAL without trigger context
  for (const req of canonical) {
    if (req.obligationStrength === "CONDITIONAL") {
      if (!hasConditionalTriggerContext(req.requirement)) {
        throw new Error(
          `CONDITIONAL without trigger survived normalize: "${req.requirement.slice(0, 100)}"`,
        );
      }
      if (req.mandatory) {
        throw new Error(`CONDITIONAL marked mandatory: "${req.requirement.slice(0, 80)}"`);
      }
    }
  }

  const requirements = canonical.map((r, i) => ({
    id: r.id ?? `t5-r${i + 1}`,
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
      title: heuristic.title ?? "IT Equipment Maintenance Test 5",
      client: heuristic.client ?? "Client",
      country: heuristic.country ?? "Morocco",
      industry: "IT Services",
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
    tenderId: ANALYSIS_ID,
    companyId: "proof-c1",
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
    intelligence.complianceMatrix.map((row) => ({
      id: row.requirementId,
      text: row.requirement,
    })),
  );

  let guardianOk = false;
  let guardianError: string | null = null;
  let blocking: Array<{ code: string; explanation: string }> = [];
  let durationMs = 0;
  let checksRun: string[] = [];

  try {
    const guardianInput = buildDecisionGuardianInput({
      textLength: text.trim().length,
      readable: true,
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
        sourceEvidence: heuristic.deadlineIso,
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
      staleResult: {
        canonicalContentHash: contentHash,
        projectedContentHash: contentHash,
      },
    });

    const release = assertFinalReleaseIntegrity(guardianInput, contentHash);
    intelligence.decisionGuardian = release.snapshot;
    guardianOk = true;
    durationMs = release.durationMs;
    checksRun = release.checksRun;
  } catch (err) {
    if (err instanceof DecisionGuardianError) {
      guardianOk = false;
      guardianError = err.message;
      durationMs = err.result.durationMs;
      checksRun = err.result.checksRun;
      blocking = err.result.blockingFailures.map((f) => ({
        code: f.validationCode,
        explanation: f.explanation,
      }));
    } else {
      throw err;
    }
  }

  const conditionLost = blocking.filter(
    (b) =>
      b.code === "REQUIREMENT_CONDITION_LOST" ||
      /lost trigger context/i.test(b.explanation),
  );

  const validFinalState =
    guardianOk &&
    conditionLost.length === 0 &&
    Boolean(intelligence.decisionGuardian) &&
    ["BID", "REVIEW", "NO_BID"].includes(engine.decision) &&
    canonical.length === intelligence.complianceSummary.totalRequirements;

  const artifact = {
    analysisId: ANALYSIS_ID,
    fileName: FILE_NAME,
    sourceFileHash,
    textLength: text.length,
    canonicalCount: canonical.length,
    conditionalCount: canonical.filter((r) => r.obligationStrength === "CONDITIONAL").length,
    decision: engine.decision,
    displayLabel: finalized.recommendation?.displayLabel ?? null,
    fitScore: engine.fitScore,
    guardianOk,
    guardianError,
    durationMs,
    checksRun,
    blocking,
    conditionLost,
    validFinalState,
    sampleRequirements: canonical.slice(0, 8).map((r) => ({
      strength: r.obligationStrength,
      mandatory: r.mandatory,
      text: r.requirement.slice(0, 120),
    })),
  };

  mkdirSync(resolve(".data/artifacts"), { recursive: true });
  const outPath = resolve(`.data/artifacts/e2e-test5-conditional-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify(artifact, null, 2));

  console.log(JSON.stringify(artifact, null, 2));
  console.log(`\nWrote ${outPath}`);

  if (!validFinalState) {
    process.exitCode = 1;
    console.error("\nFAIL — Test #5 did not reach a valid final analysis state");
  } else {
    console.log("\nPASS — Test #5 reached valid final Guardian state");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
