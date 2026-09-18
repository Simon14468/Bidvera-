/**
 * Executive summary view — canonical consistency and blocker visibility.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import {
  assertCanonicalReportIntegrity,
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import {
  EXECUTIVE_SUMMARY_LIMITS,
  assertExecutiveSummaryConsistency,
  buildExecutiveSummaryFromReport,
  buildExecutiveSummaryView,
} from "@/services/reports/executive-summary-view";
import type { TenderReport } from "@/services/reports/types";

function fixtureReport(): TenderReport {
  const requirements = [
    {
      id: "r1",
      category: "TECHNICAL",
      description: "Provide audiovisual equipment installation plan with milestones.",
      mandatory: true,
      value: null as string | null,
      status: "UNCERTAIN" as const,
      sourcePage: 3,
      sourceSection: "2.1",
      evidence: "installation plan excerpt",
    },
    {
      id: "r2",
      category: "TECHNICAL",
      description: "Deliver warranty coverage for installed AV systems.",
      mandatory: true,
      value: null,
      status: "FAILED" as const,
      sourcePage: 5,
      sourceSection: "4.2",
      evidence: null,
    },
    {
      id: "r3",
      category: "PREFERRED",
      description: "Optional training workshop for operators.",
      mandatory: false,
      value: null,
      status: "MATCHED" as const,
      sourcePage: 8,
      sourceSection: null,
      evidence: "training offered",
    },
  ];

  const readiness = computeTenderReadiness({
    requirements: requirements.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      evidence: r.evidence,
    })),
    missingDocuments: [
      {
        id: "d1",
        documentName: "Attestation CNSS",
        reason: "Required administrative document",
        severity: "HIGH",
      },
    ],
    profileHasAnyCapability: true,
  });

  const intelligence = buildTenderIntelligence({
    tenderId: "t-exec",
    documentName: "AVIS+CPS",
    tenderDeadline: null,
    extractedText: "sample package",
    requirements,
    evidence: [],
    readiness,
    findings: [],
    existingRisks: [],
    decision: "REVIEW",
    fitScore: 62,
  });

  return {
    tenderId: "t-exec",
    companyId: "c1",
    title: "AV acquisition package",
    client: "Ministère Test",
    deadline: "2026-09-15T12:00:00.000Z",
    deadlineTimezone: "Africa/Casablanca",
    analyzedAt: "2026-08-31T13:12:00.000Z",
    decision: "REVIEW",
    fitScore: 62,
    confidence: "MEDIUM",
    reasoning:
      "Mandatory warranty evidence is missing. Verify installation plan completeness before committing bid effort.",
    companyKnowledgeOnly: false,
    fitBreakdown: {
      overall: 62,
      scoringAvailable: true,
      recommendation: "Proceed with verification.",
      attention: [],
      matches: [],
      gaps: [],
      unknowns: [],
      dimensions: [
        {
          key: "service",
          label: "Capability",
          score: 70,
          status: "scored",
          note: "From profile",
          basis: "confirmed_from_profile",
        },
      ],
    },
    readiness,
    intelligence,
    complianceSummary: intelligence.complianceSummary,
    bidScore: null,
    historicalSignals: [],
    matched: [],
    failed: [],
    uncertain: [],
    criticalRisks: [],
    missingDocuments: [
      {
        id: "d1",
        documentName: "Attestation CNSS",
        reason: "Required administrative document",
        severity: "HIGH",
      },
    ],
    evidence: [],
    nextActions: [
      { id: "a1", title: "Verify warranty coverage", description: null, priority: 1 },
      { id: "a2", title: "Confirm CNSS attestation", description: null, priority: 2 },
      { id: "a3", title: "Review installation plan", description: null, priority: 3 },
      { id: "a4", title: "Should not appear in summary", description: null, priority: 4 },
    ],
    decisionOutcome: null,
  };
}

describe("executive summary view", () => {
  it("displays canonical REVIEW decision as CONDITIONAL GO", () => {
    const report = fixtureReport();
    const summary = buildExecutiveSummaryFromReport(report, "en");
    assert.equal(summary.decision, "REVIEW");
    assert.equal(summary.decisionLabel, "CONDITIONAL GO");
    assert.equal(summary.fitScoreDisplay, "62%");
    assert.equal(summary.confidenceDisplay, "MEDIUM");
  });

  it("summary reasons and actions come from canonical analysis", () => {
    const report = fixtureReport();
    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    assertCanonicalReportIntegrity(sections);
    const content = buildReportDisplayContent(sections, "en");
    const summary = buildExecutiveSummaryView(sections, content, {
      keyBlockers: report.intelligence!.keyBlockers,
    });

    assertExecutiveSummaryConsistency(sections, summary, "en");
    assert.ok(summary.topReasons.length <= EXECUTIVE_SUMMARY_LIMITS.maxReasons);
    assert.equal(summary.nextActions.length, EXECUTIVE_SUMMARY_LIMITS.maxActions);
    assert.ok(summary.nextActions[0]!.startsWith("Verify warranty coverage"));
    assert.ok(!summary.nextActions.some((a) => a.includes("Should not appear")));
  });

  it("surfaces critical blockers — mandatory gaps and missing documents", () => {
    const report = fixtureReport();
    const summary = buildExecutiveSummaryFromReport(report, "en");
    const combined = [...summary.criticalAlerts, ...summary.topReasons].join(" ");
    assert.ok(
      combined.includes("warranty") ||
        combined.includes("Warranty") ||
        combined.includes("Attestation CNSS") ||
        summary.criticalAlerts.some((a) => a.includes("Mandatory gap")),
    );
    assert.ok(
      summary.criticalAlerts.some((a) => a.includes("Attestation CNSS")) ||
        summary.criticalAlerts.some((a) => a.includes("Missing document")),
    );
  });

  it("includes expired deadline in critical alerts", () => {
    const report = fixtureReport();
    report.deadline = "2020-01-01T00:00:00.000Z";
    const summary = buildExecutiveSummaryFromReport(report, "en");
    assert.ok(
      summary.criticalAlerts.some((a) => a.toLowerCase().includes("deadline")),
    );
  });

  it("includes professional decision disclaimer", () => {
    const report = fixtureReport();
    const summary = buildExecutiveSummaryFromReport(report, "en");
    assert.match(summary.disclaimer, /evidence-based recommendation/i);
    assert.match(summary.disclaimer, /final decision remains with your company/i);
  });

  it("short explanation is concise — not the full reasoning paragraph repeated", () => {
    const report = fixtureReport();
    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    const content = buildReportDisplayContent(sections, "en");
    const summary = buildExecutiveSummaryView(sections, content, {
      keyBlockers: report.intelligence!.keyBlockers,
    });
    assert.ok(
      summary.shortExplanation.length <=
        EXECUTIVE_SUMMARY_LIMITS.shortExplanationMax + 5,
    );
    assert.notEqual(summary.shortExplanation, sections.reasoning);
  });

  it("detailed canonical sections remain complete alongside summary", () => {
    const report = fixtureReport();
    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    const summary = buildExecutiveSummaryFromReport(report, "en");
    assert.equal(sections.complianceMatrix.length, 3);
    assert.equal(sections.nextActions.length, 4);
    assert.equal(summary.decision, sections.decision);
    assert.equal(summary.fitScoreDisplay, sections.fitScoreDisplay);
  });
});
