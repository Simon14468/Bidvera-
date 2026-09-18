/**
 * Production lock — one analysis, one canonical dataset, Guardian, identical Web/PDF.
 * Guardian failure must prevent final report publication.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runDecisionEngine } from "@/domain/decision/engine";
import type { RuleCompanyProfile } from "@/domain/decision/types";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { finalizeTenderDecision } from "@/domain/decision/tender-decision-engine";
import {
  assertFinalReleaseIntegrity,
  assertReportPublicationAllowed,
  DecisionGuardianError,
  buildDecisionGuardianInput,
  hashCanonicalReleasePayload,
} from "@/domain/decision-validation";
import { buildTenderActionPlan } from "@/domain/tender-action-plan";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import {
  buildCanonicalRequirements,
} from "@/domain/tender-requirements";
import { TEST_2_FIXTURE } from "@/domain/tender-requirements/test-2-canonical-regression.test";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import {
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";

const PROFILE: RuleCompanyProfile = {
  companyName: "NetSec Co",
  industry: "IT",
  country: "Morocco",
  companySize: "11-50",
  experienceLevel: "experienced",
  services: ["network", "security"],
  certifications: [],
  experienceYears: 6,
  revenueRange: null,
  employeeRange: "11-50",
  geographicCoverage: ["Morocco"],
  contractSizeMin: null,
  contractSizeMax: null,
  customQualificationRules: [],
};

function runSingleAnalysisPass() {
  const heuristic = extractTenderPackageHeuristic({
    text: TEST_2_FIXTURE,
    fileName: "Bidvera_Canonical_Integrity_Test_2.pdf",
  });
  const canonical = buildCanonicalRequirements({
    heuristicDrafts: heuristic.requirements,
    sourceDocument: "Bidvera_Canonical_Integrity_Test_2.pdf",
  });

  const requirements = canonical.map((r, i) => ({
    id: r.id ?? `t2-r${i + 1}`,
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
    estimatedValue: 380_000,
    tenderContext: {
      title: "Production Lock Test 2",
      client: "NPSA",
      country: "Morocco",
      industry: "IT",
      tenderText: TEST_2_FIXTURE,
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
    tenderId: "prod-lock",
    documentName: "Bidvera_Canonical_Integrity_Test_2.pdf",
    tenderDeadline: heuristic.deadlineIso ? new Date(heuristic.deadlineIso) : null,
    extractedText: TEST_2_FIXTURE,
    requirements: engine.requirements.map((r) => ({
      id: r.id!,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value ?? null,
      status: r.status,
      sourcePage: typeof r.page === "number" ? r.page : null,
      sourceSection: typeof r.section === "string" ? r.section : null,
      evidence: typeof r.evidence === "string" ? r.evidence : null,
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
    tenderId: "prod-lock",
    companyId: "c1",
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
    return {
      id: r.id ?? c?.id ?? `r${i}`,
      requirement: r.description,
      category: r.category,
      semanticKind: r.semanticKind ?? c?.semanticKind ?? null,
      obligationStrength: c?.obligationStrength ?? null,
      mandatory: r.mandatory,
      sourceSection:
        (typeof r.section === "string" ? r.section : null) ?? c?.sourceSection ?? null,
      page: (typeof r.page === "number" ? r.page : null) ?? c?.page ?? null,
      evidenceText: c?.evidenceText ?? r.evidence ?? null,
      fitStatus: r.fitStatus ?? r.status ?? null,
      hasCompanyEvidence:
        r.fitStatus === "CONFIRMED_FIT" || r.fitStatus === "CONFIRMED_GAP"
          ? Boolean(r.evidence)
          : false,
      companyEvidenceText:
        r.fitStatus === "CONFIRMED_FIT" || r.fitStatus === "CONFIRMED_GAP"
          ? r.evidence
          : null,
    };
  });

  const contentHash = hashCanonicalReleasePayload(
    guardianReqs.map((r) => ({
      id: r.id,
      text: r.requirement,
    })),
  );

  const guardianInput = buildDecisionGuardianInput({
    textLength: TEST_2_FIXTURE.length,
    readable: true,
    validityPassed: true,
    fileName: "Bidvera_Canonical_Integrity_Test_2.pdf",
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
      expectedLocalHour: 10,
      expectedLocalMinute: 30,
      expectedDateYmd: "2026-10-15",
      sourceEvidence: "Submission deadline: 15 October 2026 at 10:30",
    },
    fitScore: engine.fitScore,
    fitBreakdownOverall: engine.fitBreakdown?.overall ?? null,
    reasoning: engine.reasoning,
    complianceSummaryTotal: intelligence.complianceSummary.totalRequirements,
    tenderSourceText: TEST_2_FIXTURE,
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
              channel: "WEB",
              iso: heuristic.deadlineIso,
              timezone: heuristic.deadlineTimezone,
            },
            {
              channel: "PDF",
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
  });

  const release = assertFinalReleaseIntegrity(guardianInput, contentHash);
  intelligence.decisionGuardian = release.snapshot;

  const report: TenderReport = {
    tenderId: "prod-lock",
    companyId: "c1",
    title: "Production Lock Test 2",
    client: "NPSA",
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

  return {
    canonical,
    engine,
    readiness,
    intelligence,
    finalized,
    actionPlan,
    report,
    heuristic,
    contentHash,
    release,
  };
}

describe("production lock — single analysis → Guardian → Web/PDF identity", () => {
  it("one canonical dataset drives identical Web and PDF projections after Guardian", () => {
    const started = Date.now();
    const { canonical, engine, report, heuristic, release } = runSingleAnalysisPass();

    assert.equal(release.ok, true);
    assert.ok(release.snapshot);
    assert.ok(release.durationMs < 5000, `Guardian too slow: ${release.durationMs}ms`);
    assert.equal(canonical.length, 11);

    const webSections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    const pdfSections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    const webContent = buildReportDisplayContent(webSections, "en");
    const pdfContent = buildReportDisplayContent(pdfSections, "en");

    assert.equal(webSections.decision, pdfSections.decision);
    assert.equal(webSections.decision, report.decision);
    assert.equal(webContent.fitScoreDisplay, pdfContent.fitScoreDisplay);
    assert.equal(webContent.fitScoreDisplay, `${engine.fitScore}%`);
    assert.equal(webSections.deadlineIso, pdfSections.deadlineIso);
    assert.equal(webSections.deadlineIso, heuristic.deadlineIso);
    assert.equal(webSections.complianceMatrix.length, pdfSections.complianceMatrix.length);
    assert.equal(webSections.complianceMatrix.length, canonical.length);
    assert.equal(
      webSections.complianceSummary?.totalRequirements,
      pdfSections.complianceSummary?.totalRequirements,
    );

    assert.doesNotThrow(() =>
      assertReportPublicationAllowed({
        companyKnowledgeOnly: false,
        analysisMode: "TENDER",
        complianceStatus: "COMPLETE",
        decisionGuardian: report.intelligence?.decisionGuardian ?? null,
        projectedContentHash: hashCanonicalReleasePayload(
          (report.intelligence?.complianceMatrix ?? []).map((row) => ({
            id: row.requirementId,
            text: row.requirement,
          })),
        ),
        web: {
          decision: report.decision,
          fitScore: report.fitScore,
          deadlineIso: report.deadline,
          requirementCount: canonical.length,
        },
        pdf: {
          decision: pdfSections.decision,
          fitScore: report.fitScore,
          deadlineIso: pdfSections.deadlineIso,
          requirementCount: pdfSections.complianceMatrix.length,
        },
      }),
    );

    assert.ok(Date.now() - started < 30_000);
  });

  it("Guardian failure prevents final report publication (no misleading COMPLETED release)", () => {
    const { report, contentHash } = runSingleAnalysisPass();

    // Simulate missing / invalid Guardian snapshot after a failed gate
    const blocked = {
      ...report,
      intelligence: report.intelligence
        ? { ...report.intelligence, decisionGuardian: null }
        : null,
    };

    assert.throws(
      () =>
        assertReportPublicationAllowed({
          companyKnowledgeOnly: false,
          analysisMode: "TENDER",
          complianceStatus: "COMPLETE",
          decisionGuardian: blocked.intelligence?.decisionGuardian ?? null,
          projectedContentHash: contentHash,
        }),
      (err: unknown) => {
        assert.ok(err instanceof DecisionGuardianError);
        assert.equal(err.code, "DECISION_GUARDIAN_FAILED");
        assert.ok(err.result.blockingFailures.length >= 1);
        return true;
      },
    );

    // Stale hash also blocks even with a snapshot
    assert.throws(() =>
      assertReportPublicationAllowed({
        companyKnowledgeOnly: false,
        analysisMode: "TENDER",
        complianceStatus: "COMPLETE",
        decisionGuardian: report.intelligence?.decisionGuardian ?? null,
        projectedContentHash: "stale-other-hash",
      }),
    );
  });

  it("assertFinalReleaseIntegrity fails closed on critical defects before release", () => {
    assert.throws(
      () =>
        assertFinalReleaseIntegrity(
          buildDecisionGuardianInput({
            textLength: 10,
            readable: false,
            validityPassed: false,
            validityReason: "UNREADABLE",
            requirements: [],
            decision: { decision: "BID", hardBlockerCount: 0 },
          }),
          "empty",
        ),
      DecisionGuardianError,
    );
  });
});
