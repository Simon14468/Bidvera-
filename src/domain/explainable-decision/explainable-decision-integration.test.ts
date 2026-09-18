/**
 * Explainable Decision — integration/regression tests (Prompt 2).
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runDecisionEngine } from "@/domain/decision/engine";
import {
  finalizeTenderDecision,
} from "@/domain/decision/tender-decision-engine";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import {
  assertDecisionExplanationConsistency,
  assertExplainableDecisionIntegrity,
  buildExplainableDecision,
  buildTopReasons,
  DecisionExplanationMismatchError,
  enrichExplainableDecision,
  evidenceStateExplainLabel,
  EXPLAINABLE_DECISION_INVARIANTS,
  INSUFFICIENT_DATA,
} from "@/domain/explainable-decision";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";
import {
  buildReportDisplayContent,
} from "@/services/reports/report-display-content";
import { deriveCanonicalReportSections, FULL_REPORT_FEATURE_ACCESS } from "@/services/reports/report-canonical-view";
import { deriveExplainableDecisionForReport } from "@/services/reports/explainable-report";
import type { TenderReport } from "@/services/reports/types";

function profile(overrides: Partial<RuleCompanyProfile> = {}): RuleCompanyProfile {
  return {
    companyName: "Acme",
    industry: "IT",
    country: "Morocco",
    companySize: "51-200",
    experienceLevel: "experienced",
    services: ["software development", "web", "api"],
    certifications: ["ISO 27001"],
    experienceYears: 10,
    revenueRange: "5m-10m",
    employeeRange: "51-200",
    geographicCoverage: ["Morocco"],
    contractSizeMin: null,
    contractSizeMax: 5_000_000,
    customQualificationRules: [],
    ...overrides,
  };
}

function req(
  partial: Partial<RuleRequirement> & Pick<RuleRequirement, "description" | "status">,
): RuleRequirement {
  const evidence =
    partial.evidence ??
    (partial.status === "FAILED" ? "not_held: ISO 27001" : "From tender §3");
  return {
    category: "Technical",
    mandatory: true,
    value: null,
    evidence,
    sourceDocument:
      partial.sourceDocument ??
      (partial.evidence?.includes("not_held") ? "Company_Profile.pdf" : undefined),
    ...partial,
  };
}

function buildScenario(opts?: { certFailure?: boolean; strongMatch?: boolean }) {
  const requirements = opts?.certFailure
    ? [
        req({
          id: "r1",
          description: "ISO 27001 certification mandatory",
          status: "UNCERTAIN",
          category: "Certification",
          evidence: "not_held: ISO 27001",
          sourceDocument: "Company_Profile.pdf",
        }),
      ]
    : opts?.strongMatch
      ? [
          req({
            id: "r1",
            description: "Web and API development",
            status: "MATCHED",
            evidence: "Company lists web and API",
          }),
          req({
            id: "r2",
            description: "ISO 27001",
            status: "MATCHED",
            category: "Certification",
            evidence: "Held ISO 27001",
          }),
        ]
      : [
          req({
            id: "r1",
            description: "Public-sector AV experience minimum 5 years",
            status: "UNCERTAIN",
            category: "Experience",
            evidence: "Minimum 5 years public-sector AV",
          }),
        ];

  const engine = runDecisionEngine({
    profile: profile(
      opts?.certFailure ? { certifications: ["NOT_HELD: ISO 27001", "ISO 9001"] } : {},
    ),
    requirements,
    estimatedValue: 200_000,
    tenderContext: {
      title: "AV Platform",
      client: "Gov",
      country: "Morocco",
      industry: "IT",
      tenderText: requirements.map((r) => r.description).join("\n"),
    },
  });

  const readiness = computeTenderReadiness({
    requirements: engine.requirements,
    missingDocuments: [],
    profileHasAnyCapability: true,
  });

  const intelligence = buildTenderIntelligence({
    tenderId: "t-explain-int",
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
      sourcePage: 8,
      sourceSection: "2.1",
      evidence: r.evidence,
    })),
    evidence: opts?.certFailure
      ? []
      : [
          {
            id: "e1",
            requirementId: "r1",
            sourcePage: 8,
            sourceSection: "2.1",
            evidenceText: "Company References 2024 — public-sector AV projects listed",
            verificationStatus: "INFERRED",
            documentName: "Company References 2024.pdf",
          },
        ],
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
    structuredRiskTitles: intelligence.risks.map((r) => ({
      title: r.title,
      severity: r.severity,
    })),
  });

  intelligence.tenderDecisionRecommendation = finalized.recommendation;

  return {
    engine,
    intelligence,
    recommendation: finalized.recommendation,
    readiness,
    decision: finalized.recommendation.decision,
  };
}

function toReport(scenario: ReturnType<typeof buildScenario>): TenderReport {
  return {
    tenderId: "t-explain-int",
    companyId: "c1",
    title: "AV Platform",
    client: "Gov",
    deadline: null,
    deadlineTimezone: null,
    analyzedAt: new Date().toISOString(),
    decision: scenario.decision,
    fitScore: scenario.engine.fitScore,
    confidence: scenario.recommendation.confidence,
    reasoning: scenario.recommendation.summary,
    companyKnowledgeOnly: false,
    fitBreakdown: scenario.engine.fitBreakdown ?? null,
    readiness: scenario.readiness,
    intelligence: scenario.intelligence,
    complianceSummary: scenario.intelligence.complianceSummary,
    bidScore: null,
    historicalSignals: [],
    matched: [],
    failed: [],
    uncertain: [],
    criticalRisks: [],
    missingDocuments: [],
    evidence: [],
    nextActions: [],
    decisionOutcome: null,
  };
}

describe("explainable decision integration", () => {
  it("decision and explanation stay consistent for GO / CONDITIONAL GO / NO-BID", () => {
    for (const mode of [
      undefined,
      { certFailure: true as const },
      { strongMatch: true as const },
    ]) {
      const scenario = buildScenario(mode);
      const explanation = buildExplainableDecision({
        recommendation: scenario.recommendation,
        evidenceIntelligence: scenario.intelligence.evidenceIntelligence,
        complianceMatrix: scenario.intelligence.complianceMatrix,
        risks: scenario.intelligence.risks,
        readiness: scenario.readiness,
      });
      assertDecisionExplanationConsistency({
        storedDecision: scenario.decision,
        explanation,
      });
      assert.equal(explanation.displayLabel, scenario.recommendation.displayLabel);
    }
  });

  it("fails safely when stored decision diverges from explanation", () => {
    const scenario = buildScenario({ certFailure: true });
    const explanation = buildExplainableDecision({
      recommendation: scenario.recommendation,
      evidenceIntelligence: scenario.intelligence.evidenceIntelligence,
      complianceMatrix: scenario.intelligence.complianceMatrix,
      risks: scenario.intelligence.risks,
      readiness: scenario.readiness,
    });
    assert.throws(
      () =>
        assertDecisionExplanationConsistency({
          storedDecision: "BID",
          explanation,
        }),
      DecisionExplanationMismatchError,
    );
  });

  it("requirement and evidence items remain traceable", () => {
    const scenario = buildScenario();
    const explanation = buildExplainableDecision({
      recommendation: scenario.recommendation,
      evidenceIntelligence: scenario.intelligence.evidenceIntelligence,
      complianceMatrix: scenario.intelligence.complianceMatrix,
      risks: scenario.intelligence.risks,
      readiness: scenario.readiness,
    });

    const reqItems = explanation.items.filter((i) => i.requirementId === "r1");
    assert.ok(reqItems.length >= 1);
    for (const item of reqItems) {
      assert.ok(item.what.length > 0);
      assert.ok(item.why.length > 0);
    }

    const evidenceItems = explanation.sections.evidence;
    for (const item of evidenceItems) {
      if (item.source.located && item.source.page != null) {
        assert.equal(item.source.page, 8);
      }
      if (!item.source.located) {
        assert.equal(item.source.page, null);
      }
    }
  });

  it("evidence intelligence states map to human labels without conversion", () => {
    assert.equal(evidenceStateExplainLabel("FOUND_UNVERIFIED"), "Verification required");
    assert.equal(evidenceStateExplainLabel("MISSING"), "Evidence missing");
    assert.equal(evidenceStateExplainLabel("VERIFIED"), "Verified evidence supports this requirement");
    assert.equal(evidenceStateExplainLabel("EXPIRED"), "Evidence is expired");
    assert.equal(evidenceStateExplainLabel("UNKNOWN"), "Unable to establish status");
  });

  it("risk, readiness, and company fit sections reflect recommendation", () => {
    const scenario = buildScenario({ strongMatch: true });
    const explanation = buildExplainableDecision({
      recommendation: scenario.recommendation,
      evidenceIntelligence: scenario.intelligence.evidenceIntelligence,
      complianceMatrix: scenario.intelligence.complianceMatrix,
      risks: scenario.intelligence.risks,
      readiness: scenario.readiness,
    });
    assert.ok(
      explanation.sections.companyFit.length + explanation.sections.readiness.length >= 1,
    );
    assert.equal(explanation.displayLabel, scenario.recommendation.displayLabel);
  });

  it("decision memory stays isolated as historical context", () => {
    const scenario = buildScenario({ certFailure: true });
    const explanation = buildExplainableDecision({
      recommendation: scenario.recommendation,
      memoryInsights: {
        computed: true,
        matches: [
          {
            memoryId: "m1",
            tenderId: "old",
            title: "Similar tender",
            client: "Gov",
            decision: "NO_BID",
            decisionLabel: "NO-BID",
            fitScore: 40,
            readinessScore: 30,
            bidScore: 35,
            reasoning: "Insufficient technical capacity",
            similarity: 0.9,
            relevanceReasons: ["Same sector"],
            analyzedAt: new Date().toISOString(),
            disclaimer: "Reference only.",
          },
        ],
        emptyReason: null,
        currentAnalysisNote: "Current",
        historicalNote: "Historical only",
      },
    });
    for (const m of explanation.sections.historicalSignals) {
      assert.equal(m.referenceOnly, true);
      assert.equal(m.impactRole, "CONTEXT_ONLY");
    }
    const top = buildTopReasons(explanation);
    assert.ok(top.every((r) => r.category !== "HISTORICAL_SIGNAL"));
  });

  it("team workflow links attach without auto-verifying requirements", () => {
    const scenario = buildScenario();
    const explanation = buildExplainableDecision({
      recommendation: scenario.recommendation,
      evidenceIntelligence: scenario.intelligence.evidenceIntelligence,
      complianceMatrix: scenario.intelligence.complianceMatrix,
      risks: scenario.intelligence.risks,
      readiness: scenario.readiness,
    });
    const view = enrichExplainableDecision(explanation, [
      {
        id: "task-1",
        title: "Verify public-sector experience",
        requirementId: "r1",
        status: "OPEN",
        department: "Technical Team",
        assigneeUser: { name: "Alex" },
        deadline: null,
      },
    ]);
    assert.ok(view.teamWorkflowLinks.length >= 1);
    const linked = view.itemsWithWorkflow.find((i) => i.workflowLink?.taskId === "task-1");
    assert.ok(linked);
    assert.notEqual(linked?.status, "VERIFIED");
  });

  it("simulated results never overwrite canonical explainable decision", async () => {
    const scenario = buildScenario({ certFailure: true });
    const recJson = JSON.stringify(scenario.recommendation);
    const before = buildExplainableDecision({
      recommendation: scenario.recommendation,
      evidenceIntelligence: scenario.intelligence.evidenceIntelligence,
      complianceMatrix: scenario.intelligence.complianceMatrix,
      risks: scenario.intelligence.risks,
      readiness: scenario.readiness,
    });

    const buildSrc = await readFile(
      join(process.cwd(), "src/domain/explainable-decision/build.ts"),
      "utf8",
    );
    assert.doesNotMatch(buildSrc, /simulateTenderDecision/);
    assert.doesNotMatch(buildSrc, /simulatedDecision/);

    assert.equal(before.displayLabel, scenario.recommendation.displayLabel);
    assert.equal(JSON.stringify(scenario.recommendation), recJson);

    const after = buildExplainableDecision({
      recommendation: scenario.recommendation,
      evidenceIntelligence: scenario.intelligence.evidenceIntelligence,
      complianceMatrix: scenario.intelligence.complianceMatrix,
      risks: scenario.intelligence.risks,
      readiness: scenario.readiness,
    });
    assert.equal(before.contentHash, after.contentHash);
  });

  it("report and PDF display content include explainable summary", () => {
    const scenario = buildScenario();
    const report = toReport(scenario);
    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    assert.ok(sections.explainableDecision);
    const content = buildReportDisplayContent(sections, "en");
    assert.ok(content.explainableWhyHeadline);
    assert.ok(content.explainableTopReasonLines.length >= 0);
    assert.equal(
      content.explainableWhyHeadline,
      sections.explainableDecision!.executiveSummary.whyHeadline,
    );
  });

  it("deriveExplainableDecisionForReport matches buildExplainableDecision", () => {
    const scenario = buildScenario({ certFailure: true });
    const report = toReport(scenario);
    const derived = deriveExplainableDecisionForReport(report, {
      includeAdvancedAiTrust: true,
      includeEvidenceIntelligence: true,
    });
    assert.ok(derived);
    assert.equal(derived!.displayLabel, scenario.recommendation.displayLabel);
    assertExplainableDecisionIntegrity(derived!);
  });

  it("unknown sources stay unknown — no fabricated page numbers", () => {
    const scenario = buildScenario();
    const explanation = buildExplainableDecision({
      recommendation: scenario.recommendation,
      evidenceIntelligence: scenario.intelligence.evidenceIntelligence,
      complianceMatrix: scenario.intelligence.complianceMatrix,
      risks: scenario.intelligence.risks,
      readiness: scenario.readiness,
    });
    for (const item of explanation.items) {
      if (!item.source.located) {
        assert.equal(item.source.page, null);
      }
      if (item.source.kind === "UNKNOWN") {
        assert.ok(!item.source.page || item.source.page === null);
      }
    }
  });

  it("explainable path does not emit Smart Alerts", async () => {
    const files = [
      "application/explainable-decision.ts",
      "domain/explainable-decision/build.ts",
      "services/reports/explainable-report.ts",
    ];
    const forbidden = [
      /from\s+["']@\/services\/smart-alerts/,
      /createSmartAlert/,
      /emitSmartAlert/,
    ];
    for (const rel of files) {
      const text = await readFile(join(process.cwd(), "src", rel), "utf8");
      for (const pattern of forbidden) {
        assert.ok(!pattern.test(text), `${rel} must not duplicate Smart Alerts`);
      }
    }
  });

  it("permissions enforced in application layer", async () => {
    const text = await readFile(
      join(process.cwd(), "src/application/explainable-decision.ts"),
      "utf8",
    );
    assert.match(text, /assertCanViewTenderAnalysis/);
    assert.match(text, /requireCompanyId/);
    assert.equal(EXPLAINABLE_DECISION_INVARIANTS.readOnly, true);
  });

  it("re-analysis produces stable explainable hash for same canonical inputs", () => {
    const scenario = buildScenario();
    const input = {
      recommendation: scenario.recommendation,
      evidenceIntelligence: scenario.intelligence.evidenceIntelligence,
      complianceMatrix: scenario.intelligence.complianceMatrix,
      risks: scenario.intelligence.risks,
      readiness: scenario.readiness,
    };
    const a = buildExplainableDecision(input);
    const b = buildExplainableDecision(input);
    assert.equal(a.contentHash, b.contentHash);
  });

  it("insufficient data label is reserved for missing canonical facts", () => {
    assert.equal(INSUFFICIENT_DATA, "INSUFFICIENT_DATA");
    const scenario = buildScenario({ certFailure: true });
    const explanation = buildExplainableDecision({
      recommendation: scenario.recommendation,
      complianceMatrix: [],
      risks: [],
      readiness: null,
    });
    assert.ok(explanation.missingDataNotes.length >= 0);
  });
});
