/**
 * Bidvera Canonical Integrity Test 2 — full-chain regression.
 * Covers QA exclusion, provenance, conditional T-09, deadline 10:30, count parity, actions.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runDecisionEngine } from "@/domain/decision/engine";
import type { RuleCompanyProfile } from "@/domain/decision/types";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { finalizeTenderDecision } from "@/domain/decision/tender-decision-engine";
import {
  assertAnalysisReadyForCompletion,
  assertCanonicalDeadlineIntegrity,
  buildCanonicalRequirements,
  classifyRequirementSemanticKind,
  formatDeadlineWallClock,
  isNonRequirementText,
  isScoringSemanticKind,
} from "@/domain/tender-requirements";
import {
  assertActionPlanIntegrity,
  buildTenderActionPlan,
  isGenericVerificationText,
} from "@/domain/tender-action-plan";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { assertCanonicalRequirementInvariants } from "@/domain/tender-requirements/canonical-counts";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import {
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";

/** Representative text from Bidvera Canonical Integrity Test 2 PDF. */
export const TEST_2_FIXTURE = `
PUBLIC TENDER — BIDVERA CANONICAL INTEGRITY TEST 2
Reference: BID/TEST2/2026
Subject: Supply and maintenance of network security infrastructure.
Country: Morocco
Publication: 2 September 2026
Submission deadline: 15 October 2026 at 10:30 (Africa/Casablanca)
Estimated contract value: MAD 380,000 excluding VAT — Not a Tender Requirement

1. Mandatory Administrative Requirements
• T-01 The bidder must be legally registered and authorized to operate in Morocco.
• T-02 The bidder must submit valid tax-clearance and CNSS compliance certificates with the offer.

2. Technical Requirements
• T-03 The proposed firewall must support at least 2 Gbps throughput with active threat subscriptions.
• T-04 The wireless solution must provide Wi-Fi 6 access points with centralized management.
• T-05 The bidder must supply Category 6A cabling and certification test results for all links.

3. Performance and Warranty
• T-06 The bidder must provide a minimum 24-month warranty on supplied equipment.
• T-07 The bidder must provide on-site corrective support within 8 hours for critical incidents.

4. Commercial and Contractual Conditions
• T-08 Prices shall remain firm and non-revisable throughout the contract period.
• A performance guarantee equal to 10% of the contract value shall be provided by the successful bidder.
• Payment shall be made within 30 days of invoice acceptance.
• Late delivery shall incur penalties of 0.5% of the contract value per week, capped at 10%.

5. Conditional Requirement
• T-09 (conditional) If the bidder proposes equipment manufactured outside Morocco, the bidder must provide evidence of manufacturer authorization or an authorized distribution channel.

6. Evaluation Criteria — Not a Tender Requirement
Technical compliance: 45%
Price: 40%
These percentages describe evaluation only. They are not bidder requirements.

7. Verification Scenarios — Not a Tender Requirement
The following scenarios illustrate reviewer checks. They are not additional tender requirements.
• Scenario A: A reviewer checks whether tax certificates are current.

8. Tender Facts — Not a Tender Requirement
Publication date, submission deadline, and estimated contract value are tender facts only.

9. Quality-Control Note — Not a Tender Requirement
This section contains instructions to an analysis system and must not be interpreted as a bidder obligation.
`.trim();

const EXPECTED_CANONICAL_COUNT = 11;

const FORBIDDEN = [
  "Not a Tender Requirement",
  "describe evaluation only",
  "illustrate reviewer checks",
  "instructions to an analysis system",
  "Technical compliance: 45%",
  "estimated contract value",
  "Scenario A:",
  "tender facts only",
] as const;

const EXPECTED_REFS = [
  "T-01",
  "T-02",
  "T-03",
  "T-04",
  "T-05",
  "T-06",
  "T-07",
  "T-08",
  "T-09",
] as const;

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

function runTest2Pipeline() {
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
  }));

  const engine = runDecisionEngine({
    profile: PROFILE,
    requirements,
    estimatedValue: 380_000,
    tenderContext: {
      title: "Canonical Integrity Test 2",
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
    tenderId: "test-2",
    documentName: "Bidvera_Canonical_Integrity_Test_2.pdf",
    tenderDeadline: heuristic.deadlineIso ? new Date(heuristic.deadlineIso) : null,
    extractedText: TEST_2_FIXTURE,
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
    tenderId: "test-2",
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

  return {
    heuristic,
    canonical,
    engine,
    readiness,
    intelligence,
    finalized,
    actionPlan,
    requirements,
  };
}

describe("Test 2 — canonical integrity", () => {
  it("extracts exactly 11 bidder-stage canonical obligations with correct semantic kinds", () => {
    const { heuristic, canonical } = runTest2Pipeline();

    assert.equal(canonical.length, EXPECTED_CANONICAL_COUNT);

    // Bare successful-bidder performance guarantee without award-timed duty
    // is post-award / ambiguous — not bidder-stage canonical.
    assert.ok(
      !canonical.some((r) =>
        /performance guarantee[\s\S]*successful bidder|successful bidder[\s\S]*performance guarantee/i.test(
          r.requirement,
        ),
      ),
      "untimed successful-bidder performance guarantee must not enter bidder-stage canonical",
    );

    for (const snippet of FORBIDDEN) {
      assert.ok(
        !canonical.some((r) => r.requirement.toLowerCase().includes(snippet.toLowerCase())),
        `forbidden leaked: ${snippet}`,
      );
      assert.ok(
        !canonical.some((r) => isNonRequirementText(r.requirement)),
        "non-requirement in canonical set",
      );
    }

    for (const ref of EXPECTED_REFS) {
      const row = canonical.find((r) => r.id === ref || r.requirement.includes(ref));
      assert.ok(row, `missing ${ref}`);
    }

    const t09 = canonical.find((r) => r.id === "T-09" || r.requirement.includes("T-09"));
    assert.ok(t09);
    assert.equal(t09!.obligationStrength, "CONDITIONAL");
    assert.match(t09!.requirement, /if the bidder proposes equipment manufactured outside morocco/i);
    assert.equal(t09!.sourceSection, "5. Conditional Requirement");

    const commercial = canonical.filter((r) =>
      /firm|performance guarantee|payment|penalt/i.test(r.requirement),
    );
    assert.equal(commercial.length, 3, "commercial obligations must not be dropped");

    for (const row of canonical) {
      assert.ok(isScoringSemanticKind(row.semanticKind), row.semanticKind);
      assert.ok(
        !["QA_META", "REVIEWER_INSTRUCTION", "TEST_SCENARIO", "EVALUATION_CRITERION", "DEADLINE", "INFORMATIONAL_FACT"].includes(
          row.semanticKind,
        ),
      );
    }

    assert.ok(heuristic.deadlineIso);
    assert.equal(heuristic.deadlineTimezone, "Africa/Casablanca");
    assertCanonicalDeadlineIntegrity({
      deadlineIso: heuristic.deadlineIso,
      deadlineTimezone: heuristic.deadlineTimezone,
      expectedDateYmd: "2026-10-15",
      expectedLocalHour: 10,
      expectedLocalMinute: 30,
      sourceEvidence: heuristic.deadlineIso ? "Submission deadline: 15 October 2026 at 10:30" : null,
    });
    const wall = formatDeadlineWallClock(heuristic.deadlineIso!, "Africa/Casablanca");
    assert.equal(wall.hour, 10);
    assert.equal(wall.minute, 30);
    assert.notEqual(wall.hour, 1, "must not show 01:00 midnight-UTC bug");
  });

  it("count parity across decision, matrix, evidence, risk, actions", () => {
    const ctx = runTest2Pipeline();
    const { canonical, intelligence, readiness, actionPlan, engine, finalized } = ctx;

    assertCanonicalRequirementInvariants({
      canonicalRequirementCount: canonical.length,
      readiness,
      intelligence,
    });

    assertAnalysisReadyForCompletion({
      requirements: canonical,
      intelligence,
      resolvedRequirementIds: ctx.requirements.map((r) => r.id!),
      deadline: {
        deadlineIso: ctx.heuristic.deadlineIso,
        deadlineTimezone: ctx.heuristic.deadlineTimezone,
        expectedLocalHour: 10,
        expectedLocalMinute: 30,
        expectedDateYmd: "2026-10-15",
      },
      actionPlan,
      expectedProvenance: {
        "T-01": "Mandatory Administrative",
        "T-03": "Technical Requirements",
        "T-09": "Conditional Requirement",
      },
    });

    assertActionPlanIntegrity({
      canonicalRequirementCount: canonical.length,
      actionPlan,
      hardBlockerCount: intelligence.keyBlockers.length,
    });

    const perReq = actionPlan.items.filter((a) => a.linkedRequirementId && !a.simulationOnly);
    assert.equal(perReq.length, canonical.length);
    assert.equal(actionPlan.items.filter((a) => a.blocking).length, 0);

    const report: TenderReport = {
      tenderId: "test-2",
      companyId: "c1",
      title: "Test 2",
      client: "NPSA",
      deadline: ctx.heuristic.deadlineIso,
      deadlineTimezone: ctx.heuristic.deadlineTimezone,
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
    assert.ok(!actionPlan.items.some((a) => isGenericVerificationText(a.title)));
  });
});

describe("Test 2 — classifier regressions", () => {
  it("explicit Not a Tender Requirement marker rejected", () => {
    const text =
      "Publication date, submission deadline, and estimated contract value are tender facts only.";
    assert.ok(isNonRequirementText(text));
    assert.equal(classifyRequirementSemanticKind({ description: text }), "QA_META");
  });
});
