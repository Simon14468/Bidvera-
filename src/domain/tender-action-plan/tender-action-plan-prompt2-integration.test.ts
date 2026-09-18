/**
 * Tender Action Plan — full chain integration (Prompt 2).
 * Action → Team → Evidence → Verification → Decision → Explainable → Alerts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runDecisionEngine } from "@/domain/decision/engine";
import { finalizeTenderDecision } from "@/domain/decision/tender-decision-engine";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { buildExplainableDecision } from "@/domain/explainable-decision";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";
import {
  buildPostAnalysisAlertCandidates,
  type CurrentAnalysisSnapshot,
} from "@/domain/smart-alerts";
import { buildTenderActionPlan } from "@/domain/tender-action-plan";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import {
  buildReportDisplayContent,
  assertPdfCanonicalConsistency,
} from "@/services/reports/report-display-content";
import { deriveCanonicalReportSections, FULL_REPORT_FEATURE_ACCESS } from "@/services/reports/report-canonical-view";
import {
  buildExecutiveSummaryView,
  assertExecutiveSummaryConsistency,
} from "@/services/reports/executive-summary-view";
import type { TenderReport } from "@/services/reports/types";
import { EMPTY_DECISION_MEMORY_INSIGHTS } from "@/domain/decision-memory";

function profile(): RuleCompanyProfile {
  return {
    companyName: "Acme AV",
    industry: "AV",
    country: "Morocco",
    companySize: "51-200",
    experienceLevel: "some",
    services: ["audiovisual"],
    certifications: [],
    experienceYears: 3,
    revenueRange: "1m-5m",
    employeeRange: "51-200",
    geographicCoverage: ["Morocco"],
    contractSizeMin: null,
    contractSizeMax: 2_000_000,
    customQualificationRules: [],
  };
}

function req(
  partial: Partial<RuleRequirement> & Pick<RuleRequirement, "description" | "status">,
): RuleRequirement {
  return {
    category: "Experience",
    mandatory: true,
    value: null,
    evidence: "Tender §3",
    ...partial,
  };
}

function buildReportFixture(actionPlan: ReturnType<typeof buildTenderActionPlan>): TenderReport {
  const requirements = [
    req({
      id: "r-av",
      description: "Minimum 5 years public-sector AV experience",
      status: "UNCERTAIN",
    }),
  ];
  const engine = runDecisionEngine({
    profile: profile(),
    requirements,
    estimatedValue: 500_000,
    tenderContext: {
      title: "AV Tender",
      client: "Agency",
      country: "Morocco",
      industry: "AV",
      tenderText: requirements[0]!.description,
    },
  });
  const readiness = computeTenderReadiness({
    requirements: requirements.map((r) => ({
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
    tenderId: "t-chain",
    documentName: "RFP.pdf",
    tenderDeadline: new Date("2026-09-20T12:00:00.000Z"),
    extractedText: "",
    requirements: requirements.map((r) => ({
      id: r.id!,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      sourcePage: 8,
      sourceSection: "Eligibility",
      evidence: r.evidence ?? null,
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
    structuredRiskTitles: [],
    deadline: new Date("2026-09-20T12:00:00.000Z"),
    asOf: new Date("2026-09-01T12:00:00.000Z"),
    memoryInsights: EMPTY_DECISION_MEMORY_INSIGHTS,
    teamWorkflow: null,
  });
  intelligence.tenderDecisionRecommendation = finalized.recommendation;
  intelligence.actionPlan = actionPlan;

  return {
    tenderId: "t-chain",
    companyId: "c1",
    title: "AV Tender",
    client: "Agency",
    deadline: "2026-09-20T12:00:00.000Z",
    deadlineTimezone: null,
    analyzedAt: "2026-09-01T12:00:00.000Z",
    decision: engine.decision,
    fitScore: engine.fitScore,
    confidence: engine.confidence,
    reasoning: engine.reasoning,
    fitBreakdown: engine.fitBreakdown,
    readiness,
    intelligence,
    bidScore: null,
    complianceSummary: intelligence.complianceSummary,
    evidence: [],
    criticalRisks: [],
    missingDocuments: [],
    nextActions: [],
    matched: [],
    failed: [],
    uncertain: [],
    historicalSignals: [],
    decisionOutcome: null,
    companyKnowledgeOnly: false,
  };
}

describe("action plan full chain integration", () => {
  it("generates actions from requirement gaps through intelligence pipeline", () => {
    const chainResult = (() => {
      const requirements = [
        req({
          id: "r-av",
          description: "Minimum 5 years public-sector AV experience",
          status: "UNCERTAIN",
        }),
      ];
      const engine = runDecisionEngine({
        profile: profile(),
        requirements,
        estimatedValue: 500_000,
        tenderContext: {
          title: "AV",
          client: null,
          country: "Morocco",
          industry: "AV",
          tenderText: "AV experience",
        },
      });
      const readiness = computeTenderReadiness({
        requirements: requirements.map((r) => ({
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
        tenderId: "t1",
        documentName: "RFP.pdf",
        tenderDeadline: new Date("2026-09-20T12:00:00.000Z"),
        extractedText: "",
        requirements: requirements.map((r) => ({
          id: r.id!,
          category: r.category,
          description: r.description,
          mandatory: r.mandatory,
          value: r.value,
          status: r.status,
          sourcePage: 8,
          sourceSection: null,
          evidence: r.evidence ?? null,
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
        structuredRiskTitles: [],
        deadline: new Date("2026-09-20T12:00:00.000Z"),
        asOf: new Date("2026-09-01T12:00:00.000Z"),
        memoryInsights: EMPTY_DECISION_MEMORY_INSIGHTS,
        teamWorkflow: null,
      });
      intelligence.tenderDecisionRecommendation = finalized.recommendation;
      const actionPlan = buildTenderActionPlan({
        tenderId: "t1",
        companyId: "c1",
        tenderDeadline: new Date("2026-09-20T12:00:00.000Z"),
        complianceMatrix: intelligence.complianceMatrix,
        evidenceIntelligence: intelligence.evidenceIntelligence,
        risks: intelligence.risks,
        keyBlockers: intelligence.keyBlockers,
        readiness,
        fitBreakdown: engine.fitBreakdown,
        recommendation: intelligence.tenderDecisionRecommendation,
        teamTasks: [
          {
            id: "tw-1",
            title: "Verify public-sector AV experience",
            status: "PENDING",
            priority: "HIGH",
            requirementId: "r-av",
            riskId: null,
            missingDocId: null,
            department: "TECHNICAL",
            deadline: null,
          },
        ],
        asOf: new Date("2026-09-01T12:00:00.000Z"),
      });
      return { intelligence, actionPlan, finalized };
    })();
    const { actionPlan } = chainResult;

    assert.ok(actionPlan.items.length > 0);
    const linked = actionPlan.items.find((i) => i.linkedTeamTaskId === "tw-1");
    assert.ok(linked);
    assert.ok(linked!.afterCompletion.includes("Decision Engine"));
  });

  it("explainable decision and action plan stay consistent — no direct GO override", () => {
    const requirements = [
      req({ id: "r1", description: "ISO 27001", status: "FAILED", category: "Cert" }),
    ];
    const engine = runDecisionEngine({ profile: profile(), requirements, estimatedValue: 100_000 });
    const readiness = computeTenderReadiness({
      requirements: requirements.map((r) => ({
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
      tenderId: "t2",
      documentName: "RFP.pdf",
      tenderDeadline: null,
      extractedText: "",
      requirements: requirements.map((r) => ({
        id: r.id!,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        sourcePage: null,
        sourceSection: null,
        evidence: r.evidence ?? null,
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
      structuredRiskTitles: [],
      deadline: null,
      asOf: new Date(),
      memoryInsights: EMPTY_DECISION_MEMORY_INSIGHTS,
      teamWorkflow: null,
    });
    intelligence.tenderDecisionRecommendation = finalized.recommendation;
    const actionPlan = buildTenderActionPlan({
      tenderId: "t2",
      companyId: "c1",
      tenderDeadline: null,
      complianceMatrix: intelligence.complianceMatrix,
      evidenceIntelligence: intelligence.evidenceIntelligence,
      risks: intelligence.risks,
      keyBlockers: intelligence.keyBlockers,
      readiness,
      fitBreakdown: engine.fitBreakdown,
      recommendation: intelligence.tenderDecisionRecommendation,
      teamTasks: [],
    });
    const explainable = buildExplainableDecision({
      recommendation: finalized.recommendation,
      complianceMatrix: intelligence.complianceMatrix,
      risks: intelligence.risks,
      readiness,
      evidenceIntelligence: intelligence.evidenceIntelligence,
      aiTrust: null,
    });
    assert.ok(explainable.computed);
    assert.ok(actionPlan.items.length > 0);
    for (const item of actionPlan.items) {
      assert.ok(!item.title.toLowerCase().includes("mark as go"));
      assert.ok(!item.title.toLowerCase().includes("force verification"));
    }
  });

  it("smart alerts include action plan critical blockers without duplication of decision alert", () => {
    const current: CurrentAnalysisSnapshot = {
      companyId: "c1",
      tenderId: "t1",
      title: "AV Tender",
      decision: "REVIEW",
      fitScore: 55,
      bidScore: 50,
      scoringAvailable: true,
      hasHighOrCriticalRisk: false,
      missingDocumentCount: 0,
      compliance: { totalRequirements: 5, ready: 2, missing: 2, verify: 1 },
      decisionMemoryMatchIds: [],
      decisionMemoryTopTitle: null,
      decisionMemoryTopLabel: null,
      actionPlanOpenCritical: 2,
      actionPlanOpenBlocking: 3,
      actionPlanDeadlineDays: 5,
    };
    const alerts = buildPostAnalysisAlertCandidates(current, null);
    assert.ok(alerts.some((a) => a.type === "DECISION_GENERATED"));
    assert.ok(alerts.some((a) => a.title === "Critical actions required"));
    assert.ok(alerts.some((a) => a.type === "DEADLINE_APPROACHING"));
    const keys = alerts.map((a) => a.dedupeKey);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("PDF/report uses action plan lines and avoids empty-only sections", () => {
    const actionPlan = buildTenderActionPlan({
      tenderId: "t-chain",
      companyId: "c1",
      tenderDeadline: new Date("2026-09-20T12:00:00.000Z"),
      complianceMatrix: [
        {
          id: "r-av",
          requirementId: "r-av",
          requirement: "AV experience",
          requirementType: "Experience",
          mandatory: true,
          priority: "HIGH",
          status: "VERIFY",
          companyFit: null,
          sourceDocument: "RFP.pdf",
          pageNumber: 8,
          section: null,
          evidence: null,
          tenderSource: null,
          companyEvidence: null,
          companyEvidenceMessage: null,
          notes: null,
          sourceBasis: "DIRECT_SOURCE",
          sourceLocated: true,
          evidenceId: null,
          risk: null,
          requiredAction: "Verify AV experience.",
        },
      ],
      evidenceIntelligence: null,
      risks: [],
      keyBlockers: ["Experience not verified"],
      readiness: { attention: [], items: [] },
      fitBreakdown: null,
      recommendation: null,
      teamTasks: [],
      asOf: new Date("2026-09-01T12:00:00.000Z"),
    });
    const report = buildReportFixture(actionPlan);
    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    const content = buildReportDisplayContent(sections);
    assert.ok(content.actionPlanLines.length > 0);
    assert.ok(
      content.actionPlanDeadlineLine != null &&
        (content.actionPlanDeadlineLine.includes("2026-09-20") ||
          content.actionPlanDeadlineLine.includes("Deadline")),
    );
    assertPdfCanonicalConsistency(report, sections, content);

    const exec = buildExecutiveSummaryView(sections, content, {
      actionPlan,
      keyBlockers: report.intelligence?.keyBlockers,
    });
    assertExecutiveSummaryConsistency(sections, exec, undefined, actionPlan);
    assert.ok(exec.nextActions.length > 0);
  });

  it("simulation items stay isolated from real action plan in report content", () => {
    const actionPlan = buildTenderActionPlan({
      tenderId: "t-sim",
      companyId: "c1",
      tenderDeadline: null,
      complianceMatrix: [],
      evidenceIntelligence: null,
      risks: [],
      keyBlockers: ["Gap"],
      readiness: { attention: [], items: [] },
      fitBreakdown: null,
      recommendation: null,
      teamTasks: [],
      simulationHints: [
        {
          id: "s1",
          label: "If certification verified",
          currentDecisionLabel: "CONDITIONAL GO",
          projectedDecisionLabel: "GO",
        },
      ],
    });
    const realInReport = actionPlan.items.filter((i) => !i.simulationOnly);
    const simInPlan = actionPlan.items.filter((i) => i.simulationOnly);
    assert.ok(realInReport.length > 0);
    assert.equal(simInPlan.length, 1);
    const report = buildReportFixture(actionPlan);
    const content = buildReportDisplayContent(deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS));
    assert.ok(!content.actionPlanLines.some((l) => l.includes("[SIMULATION]")));
  });
});
