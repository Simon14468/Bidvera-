/**
 * Decision severity — regression tests for blocker vs review vs driver semantics.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDecisionSeverityConsistency,
  buildDecisionSeverityView,
} from "@/domain/decision/decision-severity";
import {
  buildTenderDecisionRecommendation,
  finalizeTenderDecision,
} from "@/domain/decision/tender-decision-engine";
import { runDecisionEngine } from "@/domain/decision/engine";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";
import {
  buildExplainableDecision,
  assertExplainableDecisionIntegrity,
} from "@/domain/explainable-decision";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import {
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import { deriveExplainableDecisionForReport } from "@/services/reports/explainable-report";
import type { ComplianceRow } from "@/domain/tender-intelligence";
import type { TenderReport } from "@/services/reports/types";

function complianceRow(
  partial: Partial<ComplianceRow> & Pick<ComplianceRow, "requirementId" | "status">,
): ComplianceRow {
  return {
    id: partial.id ?? partial.requirementId,
    requirement: partial.requirement ?? "Requirement",
    requirementType: "Technical",
    mandatory: partial.mandatory ?? true,
    priority: "HIGH",
    companyFit: null,
    sourceDocument: "tender.pdf",
    pageNumber: 1,
    section: "§1",
    evidence: "From tender",
    tenderSource: null,
    companyEvidence: null,
    companyEvidenceMessage: null,
    notes: null,
    risk: null,
    requiredAction: null,
    sourceBasis: "DIRECT_SOURCE",
    sourceLocated: true,
    evidenceId: null,
    ...partial,
  };
}

function profile(overrides: Partial<RuleCompanyProfile> = {}): RuleCompanyProfile {
  return {
    companyName: "Test Co",
    industry: "IT",
    country: "Morocco",
    companySize: "11-50",
    experienceLevel: "experienced",
    services: ["software"],
    certifications: [],
    experienceYears: 5,
    revenueRange: null,
    employeeRange: "11-50",
    geographicCoverage: ["Morocco"],
    contractSizeMin: null,
    contractSizeMax: 1_000_000,
    customQualificationRules: [],
    ...overrides,
  };
}

function req(
  partial: Partial<RuleRequirement> & Pick<RuleRequirement, "description" | "status">,
): RuleRequirement {
  return {
    category: "Technical",
    mandatory: true,
    value: null,
    evidence: partial.evidence ?? "From tender",
    ...partial,
  };
}

describe("buildDecisionSeverityView", () => {
  it("classifies VERIFY mandatory rows as review items, not hard blockers", () => {
    const matrix = [
      complianceRow({ requirementId: "r1", status: "VERIFY" }),
      complianceRow({ requirementId: "r2", status: "VERIFY" }),
      complianceRow({ requirementId: "r3", status: "VERIFY" }),
      complianceRow({ requirementId: "r4", status: "VERIFY" }),
      complianceRow({ requirementId: "r5", status: "VERIFY" }),
    ];
    const view = buildDecisionSeverityView({
      hardBlockers: [],
      complianceMatrix: matrix,
    });
    assertDecisionSeverityConsistency(view);
    assert.equal(view.hardBlockers.length, 0);
    assert.ok(
      view.reviewItems.some((r) => /5 mandatory requirements require verification/i.test(r)),
    );
    assert.ok(!view.hardBlockers.some((b) => /verification/i.test(b)));
  });

  it("does not promote team tasks or contract size to hard blockers", () => {
    const view = buildDecisionSeverityView({
      hardBlockers: [],
      complianceMatrix: [],
      findings: [
        {
          code: "CONTRACT_SIZE_HIGH",
          severity: "HIGH",
          category: "Commercial",
          description: "Estimated contract value exceeds preferred company maximum.",
          forcesDecision: "REVIEW",
        },
      ],
      teamWorkflow: {
        titles: ["Obtain CNSS certificate from finance team"],
        note: "1 open team task — reference only.",
      },
    });
    assertDecisionSeverityConsistency(view);
    assert.equal(view.hardBlockers.length, 0);
    assert.ok(view.decisionDrivers.some((d) => /contract value/i.test(d)));
    assert.ok(view.actionItems.some((a) => /CNSS/i.test(a)));
    assert.ok(!view.hardBlockers.some((b) => /CNSS|contract value/i.test(b)));
  });

  it("treats verification-only findings as review items", () => {
    const view = buildDecisionSeverityView({
      hardBlockers: [],
      complianceMatrix: [],
      findings: [
        {
          code: "CERT_UNKNOWN",
          severity: "HIGH",
          category: "Certification",
          description: "Certification status unknown — verification required.",
          forcesDecision: "NO_BID",
          requirementIndex: 0,
        },
        {
          code: "EXPERIENCE_UNKNOWN",
          severity: "MEDIUM",
          category: "Experience",
          description: "Experience evidence insufficient — verification required.",
          forcesDecision: "NO_BID",
          requirementIndex: 1,
        },
      ],
    });
    assertDecisionSeverityConsistency(view);
    assert.equal(view.hardBlockers.length, 0);
    assert.equal(view.reviewItems.length, 2);
  });

  it("promotes confirmed missing mandatory rows to hard blockers only", () => {
    const view = buildDecisionSeverityView({
      hardBlockers: [],
      complianceMatrix: [
        complianceRow({ requirementId: "r1", status: "MISSING" }),
      ],
    });
    assertDecisionSeverityConsistency(view);
    assert.equal(view.hardBlockers.length, 1);
    assert.match(view.hardBlockers[0]!, /mandatory requirement.*missing/i);
  });
});

describe("report projection — blocker counts match canonical severity", () => {
  it("web and PDF display content use identical blocker and review semantics", () => {
    const requirements = [
      req({ id: "r1", description: "ISO 27001", status: "UNCERTAIN", evidence: "Unknown" }),
      req({ id: "r2", description: "5 years experience", status: "UNCERTAIN" }),
      req({ id: "r3", description: "Bid security MAD 84,000", status: "UNCERTAIN" }),
      req({ id: "r4", description: "New equipment only", status: "UNCERTAIN" }),
      req({ id: "r5", description: "Tax clearance", status: "UNCERTAIN" }),
    ];

    const engine = runDecisionEngine({
      profile: profile({ contractSizeMax: 1_000_000 }),
      requirements,
      estimatedValue: 4_200_000,
      tenderContext: {
        title: "AV Tender",
        client: "Public Authority",
        country: "Morocco",
        industry: "Audiovisual",
        tenderText: requirements.map((r) => r.description).join("\n"),
      },
    });

    const matrix: ComplianceRow[] = requirements.map((r, i) =>
      complianceRow({
        requirementId: r.id!,
        requirement: r.description,
        status: "VERIFY",
        id: `cm-${i + 1}`,
      }),
    );

    const severity = buildDecisionSeverityView({
      hardBlockers: engine.hardBlockers ?? [],
      complianceMatrix: matrix,
      findings: engine.findings,
      teamWorkflow: {
        titles: ["Collect bid security documentation"],
        note: "Open team task — does not block decision.",
      },
    });
    assertDecisionSeverityConsistency(severity);

    const finalized = finalizeTenderDecision({
      engine,
      aiParticipated: false,
      complianceMatrix: matrix,
      keyBlockers: severity.hardBlockers,
      reviewItems: severity.reviewItems,
      decisionDrivers: severity.decisionDrivers,
      actionItems: severity.actionItems,
      teamWorkflow: {
        openCriticalCount: 0,
        openCount: 1,
        titles: ["Collect bid security documentation"],
        note: "1 open team task — reference only.",
      },
    });

    assert.equal(finalized.recommendation.criticalBlockers.length, severity.hardBlockers.length);
    assert.ok(finalized.recommendation.reviewItems.length >= severity.reviewItems.length);

    const explanation = buildExplainableDecision({
      recommendation: finalized.recommendation,
      complianceMatrix: matrix,
    });
    assertExplainableDecisionIntegrity(explanation);

    const reportBlockers = explanation.items.filter((i) => i.category === "BLOCKER");
    const reportReviews = explanation.items.filter((i) => i.category === "REVIEW_ITEM");

    assert.equal(reportBlockers.length, finalized.recommendation.criticalBlockers.length);
    assert.ok(reportReviews.length >= finalized.recommendation.reviewItems.length);

    assert.ok(
      !/decision blocker/i.test(explanation.executiveSummary.whyHeadline),
      `headline must not say 'decision blocker': ${explanation.executiveSummary.whyHeadline}`,
    );
    if (severity.hardBlockers.length === 0 && severity.reviewItems.length > 0) {
      assert.match(
        explanation.executiveSummary.whyHeadline,
        /require verification/i,
      );
    }

    const report: TenderReport = {
      tenderId: "t1",
      companyId: "c1",
      title: "AV Tender",
      client: "Public Authority",
      deadline: null,
      deadlineTimezone: null,
      analyzedAt: new Date().toISOString(),
      decision: finalized.decision,
      fitScore: finalized.fitScore,
      confidence: finalized.confidence,
      reasoning: finalized.reasoning,
      companyKnowledgeOnly: false,
      fitBreakdown: finalized.fitBreakdown,
      readiness: null,
      intelligence: {
        complianceStatus: "COMPLETE",
        analysisMode: "TENDER",
        complianceMatrix: matrix,
        complianceSummary: {
          totalRequirements: 5,
          ready: 0,
          missing: 0,
          verify: 5,
          notApplicable: 0,
          unknown: 0,
          sources: 5,
          risks: 0,
          requiredActions: 0,
          clarifications: 0,
        },
        risks: [],
        contradictions: [],
        clarificationQuestions: [],
        keyBlockers: severity.hardBlockers,
        reviewItems: severity.reviewItems,
        decisionDrivers: severity.decisionDrivers,
        actionItems: severity.actionItems,
        decisionContext: "",
        learningSignal: null,
        tenderDecisionRecommendation: finalized.recommendation,
      },
      complianceSummary: {
        totalRequirements: 5,
        ready: 0,
        missing: 0,
        verify: 5,
        notApplicable: 0,
        unknown: 0,
        sources: 5,
        risks: 0,
        requiredActions: 0,
        clarifications: 0,
      },
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
    const webContent = buildReportDisplayContent(sections, "en");
    const pdfExplanation = deriveExplainableDecisionForReport(report);
    assert.ok(pdfExplanation);
    const pdfContent = buildReportDisplayContent(
      { ...sections, explainableDecision: pdfExplanation },
      "en",
    );

    assert.equal(
      webContent.explainableBlockerLines.length,
      severity.hardBlockers.length === 0 ? 0 : severity.hardBlockers.length,
    );
    assert.deepEqual(
      webContent.explainableWhyHeadline,
      pdfContent.explainableWhyHeadline,
    );
    assert.deepEqual(
      webContent.explainableBlockerLines,
      pdfContent.explainableBlockerLines,
    );
  });

  it("missing evidence without contradictory proof stays out of criticalBlockers", () => {
    const engine = runDecisionEngine({
      profile: profile(),
      requirements: [
        req({
          id: "r1",
          description: "Tax clearance certificate",
          status: "UNCERTAIN",
          evidence: null,
        }),
      ],
      estimatedValue: null,
    });

    const rec = buildTenderDecisionRecommendation({
      engine,
      aiParticipated: false,
      reviewItems: ["1 mandatory requirement requires verification."],
    });

    assert.equal(rec.criticalBlockers.length, 0);
    assert.ok(rec.reviewItems.length > 0);
    for (const review of rec.reviewItems) {
      assert.ok(!rec.criticalBlockers.includes(review));
    }
  });
});
