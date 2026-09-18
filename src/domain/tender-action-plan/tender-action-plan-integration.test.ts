/**
 * Tender Action Plan — integration with tender intelligence pipeline.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runDecisionEngine } from "@/domain/decision/engine";
import { finalizeTenderDecision } from "@/domain/decision/tender-decision-engine";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";
import { buildTenderActionPlan } from "@/domain/tender-action-plan";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { EMPTY_DECISION_MEMORY_INSIGHTS } from "@/domain/decision-memory";

function profile(): RuleCompanyProfile {
  return {
    companyName: "Acme AV",
    industry: "AV",
    country: "Morocco",
    companySize: "51-200",
    experienceLevel: "experienced",
    services: ["audiovisual", "integration"],
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

function buildFullScenario() {
  const requirements = [
    req({
      id: "r-av",
      description: "Minimum 5 years public-sector AV experience",
      status: "UNCERTAIN",
      category: "Experience",
    }),
  ];

  const engine = runDecisionEngine({
    profile: profile(),
    requirements,
    estimatedValue: 500_000,
    tenderContext: {
      title: "AV Equipment Tender",
      client: "Public Agency",
      country: "Morocco",
      industry: "AV",
      tenderText: requirements.map((r) => r.description).join("\n"),
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
    tenderId: "t-int-action",
    documentName: "Tender_Audiovisual_Equipment.pdf",
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
      evidence: r.evidence,
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
    structuredRiskTitles: intelligence.risks.map((r) => ({
      title: r.title,
      severity: r.severity,
    })),
    deadline: new Date("2026-09-20T12:00:00.000Z"),
    asOf: new Date("2026-09-01T12:00:00.000Z"),
    memoryInsights: EMPTY_DECISION_MEMORY_INSIGHTS,
    teamWorkflow: null,
  });

  intelligence.tenderDecisionRecommendation = finalized.recommendation;

  const actionPlan = buildTenderActionPlan({
    tenderId: "t-int-action",
    companyId: "c-int",
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
        deadline: new Date("2026-09-15T12:00:00.000Z"),
      },
    ],
    asOf: new Date("2026-09-01T12:00:00.000Z"),
  });

  return { intelligence, actionPlan, finalized, engine };
}

describe("tender action plan integration", () => {
  it("builds plan from full intelligence pipeline output", () => {
    const { actionPlan } = buildFullScenario();
    assert.ok(actionPlan.computed);
    assert.ok(actionPlan.items.length > 0);
    assert.ok(actionPlan.contentHash.length >= 8);

    const reqAction = actionPlan.items.find((i) => i.linkedRequirementId === "r-av");
    assert.ok(reqAction);
    assert.ok(reqAction!.whyNeeded.length > 0);
    assert.ok(reqAction!.sourceTrace.length > 0);
  });

  it("permission contract: plan items always have sourceId", () => {
    const { actionPlan } = buildFullScenario();
    for (const item of actionPlan.items) {
      assert.ok(item.sourceId.trim());
      assert.ok(item.sourceType);
      assert.equal(item.simulationOnly, false);
    }
  });

  it("re-analysis with resolved evidence cancels stale actions", () => {
    const { actionPlan, intelligence } = buildFullScenario();
    const resolvedPlan = buildTenderActionPlan({
      tenderId: "t-int-action",
      companyId: "c-int",
      tenderDeadline: new Date("2026-09-20T12:00:00.000Z"),
      complianceMatrix: intelligence.complianceMatrix.map((r) =>
        r.requirementId === "r-av"
          ? { ...r, status: "READY" as const, requiredAction: null }
          : r,
      ),
      evidenceIntelligence: intelligence.evidenceIntelligence,
      risks: [],
      keyBlockers: [],
      readiness: { attention: [], items: [] },
      fitBreakdown: null,
      recommendation: intelligence.tenderDecisionRecommendation,
      teamTasks: [],
      previousPlan: actionPlan,
      asOf: new Date("2026-09-02T12:00:00.000Z"),
    });

    assert.ok(
      resolvedPlan.items.some((i) => i.status === "CANCELLED") ||
        resolvedPlan.items.length < actionPlan.items.length,
    );
  });

  it("simulator hints stay isolated from real actions", () => {
    const { intelligence, finalized } = buildFullScenario();
    const withSim = buildTenderActionPlan({
      tenderId: "t-int-action",
      companyId: "c-int",
      tenderDeadline: new Date("2026-09-20T12:00:00.000Z"),
      complianceMatrix: intelligence.complianceMatrix,
      evidenceIntelligence: intelligence.evidenceIntelligence,
      risks: intelligence.risks,
      keyBlockers: intelligence.keyBlockers,
      readiness: { attention: [], items: [] },
      fitBreakdown: null,
      recommendation: intelligence.tenderDecisionRecommendation,
      teamTasks: [],
      simulationHints: [
        {
          id: "path-1",
          label: "If AV experience is verified",
          currentDecisionLabel: finalized.displayLabel,
          projectedDecisionLabel: "GO",
          requirementId: "r-av",
        },
      ],
    });

    const real = withSim.items.filter((i) => !i.simulationOnly);
    const sim = withSim.items.filter((i) => i.simulationOnly);
    assert.ok(real.length > 0);
    assert.equal(sim.length, 1);
    assert.notEqual(finalized.decision, "BID");
  });
});
