/**
 * Bidvera_Stress_Test_Tender_2026 — canonical boundary + action plan integrity regression.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runDecisionEngine } from "@/domain/decision/engine";
import type { RuleCompanyProfile } from "@/domain/decision/types";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { finalizeTenderDecision } from "@/domain/decision/tender-decision-engine";
import {
  assertAnalysisReadyForCompletion,
  buildCanonicalRequirements,
  classifyRequirementSemanticKind,
  deriveObligationStrength,
  isNonRequirementText,
  isRealBidderObligation,
  obligationFingerprint,
  isScoringSemanticKind,
} from "@/domain/tender-requirements";
import {
  assertActionPlanIntegrity,
  buildTenderActionPlan,
  collapsePrimaryActionsPerRequirement,
  isGenericVerificationText,
} from "@/domain/tender-action-plan";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import {
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";

/** Representative text from Bidvera_Stress_Test_Tender_2026.pdf */
export const STRESS_TEST_FIXTURE = `
2. Mandatory Administrative and Eligibility Requirements
• R-01 The bidder must be legally registered and authorized to perform the contracted activities.
• R-02 The bidder must provide a valid tax-clearance certificate and a valid social-security compliance certificate at the time of submission.
• R-03 The bidder must submit a signed tender declaration using the form included in this tender dossier.
• R-04 The bidder must provide a provisional bid security of MAD 12,000.
• R-05 The bidder must demonstrate at least 3 completed comparable projects during the last 5 years, with documentary references.
3. Technical Requirements
• R-06 The proposed firewall must support at least 1 Gbps stateful throughput and include active security subscriptions for the first 12 months.
• R-07 The wireless solution must provide Wi-Fi 6 access points with centralized management and support a minimum of 120 concurrent clients per access point.
• R-08 The access-control system must support at least 16 controlled doors, RFID credentials, event logging and a central administration console.
• R-09 The bidder must supply and install Category 6A structured cabling and provide certification test results for all installed links.
• R-10 The bidder must provide a minimum 24-month warranty covering supplied hardware and installation workmanship.
• R-11 The bidder must provide on-site corrective support within 24 hours after a covered critical incident is reported.
• R-12 The bidder must submit a detailed implementation schedule and commissioning plan before contract award.
4. Commercial and Contractual Conditions
• Prices shall remain firm and non-revisable throughout the contract.
• A performance guarantee equal to 10% of the contract value shall be provided by the successful bidder.
6. Evaluation Criteria
• Technical compliance: 40%
• Price: 35%
These percentages describe evaluation only. They are not bidder requirements and must not become separate compliance requirements.
8. Verification Scenarios — For Tender Review Only
The following scenarios illustrate reviewer checks. They are not additional tender requirements and must not be extracted as bidder obligations.
• Scenario A: A reviewer checks whether the bidder has three comparable projects within the five-year period.
10. Conditional Requirement
• R-13 (conditional) If the bidder proposes equipment manufactured outside Morocco, the bidder must provide evidence of manufacturer authorization or an authorized distribution channel.
12. Tender Facts — Not Requirements
• The estimated contract value is MAD 420,000 excluding VAT.
13. Quality-Control Test Note
This section intentionally contains instructions to an analysis system and must not be interpreted as a bidder obligation.
`.trim();

const FORBIDDEN = [
  "Mandatory Administrative and Eligibility Requirements",
  "These percentages describe evaluation only",
  "illustrate reviewer checks",
  "instructions to an analysis system",
  "Technical compliance: 40%",
  "estimated contract value is MAD 420,000",
  "Scenario A:",
] as const;

const PROFILE: RuleCompanyProfile = {
  companyName: "NetCo",
  industry: "IT",
  country: "Morocco",
  companySize: "11-50",
  experienceLevel: "experienced",
  services: ["network", "security"],
  certifications: [],
  experienceYears: 5,
  revenueRange: null,
  employeeRange: "11-50",
  geographicCoverage: ["Morocco"],
  contractSizeMin: null,
  contractSizeMax: null,
  customQualificationRules: [],
};

function runStressPipeline() {
  const heuristic = extractTenderPackageHeuristic({
    text: STRESS_TEST_FIXTURE,
    fileName: "Bidvera_Stress_Test_Tender_2026.pdf",
  });
  const canonical = buildCanonicalRequirements({
    heuristicDrafts: heuristic.requirements,
    sourceDocument: "Bidvera_Stress_Test_Tender_2026.pdf",
  });

  const requirements = canonical.map((r, i) => ({
    id: `st-r${i + 1}`,
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
    profile: PROFILE,
    requirements,
    estimatedValue: 420_000,
    tenderContext: {
      title: "Stress Test",
      client: "NABC",
      country: "Morocco",
      industry: "IT",
      tenderText: STRESS_TEST_FIXTURE,
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
    tenderId: "stress-test",
    documentName: "Bidvera_Stress_Test_Tender_2026.pdf",
    tenderDeadline: null,
    extractedText: STRESS_TEST_FIXTURE,
    requirements: engine.requirements.map((r) => ({
      id: r.id!,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      sourcePage: r.page ?? null,
      sourceSection: r.section ?? null,
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
    tenderId: "stress-test",
    companyId: "c1",
    tenderDeadline: null,
    complianceMatrix: intelligence.complianceMatrix,
    evidenceIntelligence: intelligence.evidenceIntelligence ?? null,
    risks: intelligence.risks,
    keyBlockers: intelligence.keyBlockers,
    readiness: { attention: readiness.attention, items: readiness.items },
    fitBreakdown: engine.fitBreakdown,
    recommendation: finalized.recommendation,
    teamTasks: [],
  });

  return { heuristic, canonical, engine, readiness, intelligence, finalized, actionPlan };
}

describe("stress test — canonical boundary", () => {
  it("excludes headings, evaluation notes, reviewer scenarios, and QA meta", () => {
    const { canonical } = runStressPipeline();
    assert.ok(canonical.length >= 14 && canonical.length <= 16);
    for (const snippet of FORBIDDEN) {
      assert.ok(
        !canonical.some((r) => r.requirement.includes(snippet)),
        `forbidden leak: ${snippet}`,
      );
    }
  });

  it("preserves R-01..R-13 semantics including conditional R-13", () => {
    const { canonical } = runStressPipeline();
    const r13 = canonical.find((r) => /R-13|\(conditional\)/i.test(r.requirement));
    assert.ok(r13, "R-13 present");
    assert.equal(r13!.obligationStrength, "CONDITIONAL");
    assert.equal(r13!.mandatory, false);

    const bond = canonical.filter((r) => /provisional bid security|MAD 12,000/i.test(r.requirement));
    assert.equal(bond.length, 1);
    assert.equal(bond[0]!.semanticKind, "GUARANTEE_SECURITY_REQUIREMENT");

    const firm = canonical.find((r) => /prices shall remain firm/i.test(r.requirement));
    assert.ok(firm);
    assert.equal(firm!.semanticKind, "FINANCIAL_COMMERCIAL_CONDITION");

    // Untimed successful-bidder performance guarantee is post-award / ambiguous —
    // not bidder-stage canonical (award-timed security remains admissible elsewhere).
    assert.ok(
      !canonical.some((r) => /performance guarantee equal to 10%/i.test(r.requirement)),
      "untimed successful-bidder performance guarantee must not enter bidder-stage canonical",
    );
  });

  it("semantic dedupe — bid security and experience appear once", () => {
    const { canonical } = runStressPipeline();
    const fps = canonical.map((r) => obligationFingerprint(r.requirement, r.category));
    assert.equal(new Set(fps).size, fps.length);
  });
});

describe("stress test — action plan integrity", () => {
  it("one primary action per canonical item — no verification explosion", () => {
    const { canonical, actionPlan, intelligence } = runStressPipeline();

    assertActionPlanIntegrity({
      canonicalRequirementCount: canonical.length,
      actionPlan,
      hardBlockerCount: intelligence.keyBlockers.length,
    });

    const perReq = actionPlan.items.filter((a) => a.linkedRequirementId && !a.simulationOnly);
    const reqIds = new Set(perReq.map((a) => a.linkedRequirementId));
    assert.equal(reqIds.size, perReq.length, "duplicate actions per requirement");
    assert.equal(perReq.length, canonical.length);

    assert.equal(
      actionPlan.items.filter((a) => a.blocking).length,
      0,
      "verification-only stress test must not produce blocking actions",
    );

    assert.ok(
      !actionPlan.items.some((a) => isGenericVerificationText(a.title)),
      "generic verification boilerplate must not appear as action titles",
    );
  });

  it("web report counts align with canonical requirements", () => {
    const { canonical, engine, readiness, intelligence, finalized } = runStressPipeline();
    assertAnalysisReadyForCompletion({ requirements: canonical, intelligence });

    const report: TenderReport = {
      tenderId: "stress-test",
      companyId: "c1",
      title: "Stress Test",
      client: "NABC",
      deadline: null,
      deadlineTimezone: null,
      analyzedAt: new Date().toISOString(),
      decision: finalized.decision,
      fitScore: engine.fitScore,
      confidence: engine.confidence,
      reasoning: finalized.reasoning,
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

    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    assert.equal(sections.complianceMatrix.length, canonical.length);
    assert.equal(sections.complianceSummary?.totalRequirements, canonical.length);
    const content = buildReportDisplayContent(sections, "en");
    assert.equal(content.fitScoreDisplay, `${engine.fitScore}%`);
    assert.equal(intelligence.keyBlockers.length, 0);
    assert.ok((intelligence.reviewItems?.length ?? 0) >= 1);
  });
});

describe("canonical boundary — semantic classifier regressions", () => {
  it("heading false positive rejected", () => {
    const text = "2. Mandatory Administrative and Eligibility Requirements";
    assert.ok(isNonRequirementText(text));
    assert.equal(normalizeKind(text), "INFORMATIONAL_FACT");
    assert.equal(normalizeRequirementsCount(text), 0);
  });

  it("evaluation-note false positive rejected", () => {
    const text =
      "These percentages describe evaluation only. They are not bidder requirements and must not become separate compliance requirements.";
    assert.ok(isNonRequirementText(text));
    assert.equal(normalizeKind(text), "QA_META");
    assert.equal(normalizeRequirementsCount(text), 0);
  });

  it("reviewer-scenario false positive rejected", () => {
    const text =
      "The following scenarios illustrate reviewer checks. They are not additional tender requirements and must not be extracted as bidder obligations.";
    assert.ok(isNonRequirementText(text));
    assert.equal(normalizeKind(text), "QA_META");
  });

  it("QA meta instruction rejected", () => {
    const text =
      "This section intentionally contains instructions to an analysis system and must not be interpreted as a bidder obligation.";
    assert.ok(isNonRequirementText(text));
    assert.equal(normalizeKind(text), "QA_META");
  });

  it("NEEDS_VERIFICATION classification does not imply hard blocker language", () => {
    assert.ok(isGenericVerificationText("Verification required — confirm against company records and tender wording."));
  });
});

function normalizeKind(text: string) {
  return classifyRequirementSemanticKind({ description: text });
}

function normalizeRequirementsCount(text: string) {
  if (isNonRequirementText(text) || !isRealBidderObligation(text)) return 0;
  const kind = classifyRequirementSemanticKind({ description: text });
  return isScoringSemanticKind(kind) ? 1 : 0;
}

describe("action deduplication unit", () => {
  it("collapsePrimaryActionsPerRequirement keeps one action per requirement", () => {
    const items = [
      {
        id: "a1",
        title: "Provide evidence: R-01",
        description: "x",
        category: "EVIDENCE" as const,
        priority: "HIGH" as const,
        sourceType: "MISSING_EVIDENCE" as const,
        sourceId: "r1:MISSING_EVIDENCE",
        linkedRequirementId: "r1",
        requirementText: "R-01 The bidder shall provide evidence.",
        linkedEvidenceId: null,
        linkedRiskId: null,
        linkedTeamTaskId: null,
        ownerLabel: null,
        dueDate: null,
        status: "OPEN" as const,
        blocking: false,
        expectedOutcome: "x",
        verificationRequired: true,
        whyNeeded: "x",
        sourceTrace: "x",
        afterCompletion: "x",
        simulationOnly: false,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
      {
        id: "a2",
        title: "Verification required — confirm against company records and tender wording.",
        description: "dup",
        category: "READINESS" as const,
        priority: "HIGH" as const,
        sourceType: "READINESS_BLOCKER" as const,
        sourceId: "req:r1",
        linkedRequirementId: "r1",
        requirementText: "R-01 The bidder shall provide evidence.",
        linkedEvidenceId: null,
        linkedRiskId: null,
        linkedTeamTaskId: null,
        ownerLabel: null,
        dueDate: null,
        status: "OPEN" as const,
        blocking: true,
        expectedOutcome: "x",
        verificationRequired: true,
        whyNeeded: "x",
        sourceTrace: "x",
        afterCompletion: "x",
        simulationOnly: false,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ];
    const collapsed = collapsePrimaryActionsPerRequirement(items);
    assert.equal(collapsed.filter((i) => i.linkedRequirementId === "r1").length, 1);
    assert.equal(collapsed[0]!.blocking, false);
  });

  it("conditional requirement keeps CONDITIONAL strength", () => {
    const text =
      "• R-13 (conditional) If the bidder proposes equipment manufactured outside Morocco, the bidder must provide evidence of manufacturer authorization.";
    assert.equal(deriveObligationStrength(text, "REQUIRED_DOCUMENT"), "CONDITIONAL");
  });
});
