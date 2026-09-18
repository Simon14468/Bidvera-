/**
 * Incomplete tender package must never surface as CONDITIONAL GO / BID / NO-BID.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isFabricatedScoreTitle,
  projectCanonicalDeadline,
} from "@/application/canonical-tender-analysis";
import { buildExtractionBlockedAnalysis } from "@/domain/decision/extraction-gate";
import { deriveCanonicalReportSections } from "@/services/reports/report-canonical-view";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";

describe("incomplete package canonical state", () => {
  it("blocked analysis has no fabricated tender risks", () => {
    const blocked = buildExtractionBlockedAnalysis({
      reason: "PACKAGE_INCOMPLETE",
    });
    assert.equal(blocked.fitBreakdown.scoringAvailable, false);
    assert.equal(blocked.intelligence.risks.length, 0);
    assert.ok(blocked.intelligence.keyBlockers.length >= 1);
  });

  it("report projection nulls decision and scores for scoring-blocked package", () => {
    const blocked = buildExtractionBlockedAnalysis({
      reason: "CPS_MISSING",
      message: "CPS missing from package",
    });
    const report: TenderReport = {
      tenderId: "t1",
      companyId: "c1",
      title: "Notice only",
      client: null,
      deadline: "2026-10-06",
      deadlineTimezone: null,
      analyzedAt: new Date().toISOString(),
      decision: "REVIEW", // DB placeholder
      fitScore: 0,
      confidence: "LOW",
      reasoning: blocked.reasoning,
      companyKnowledgeOnly: false,
      fitBreakdown: blocked.fitBreakdown,
      readiness: blocked.readiness,
      intelligence: blocked.intelligence,
      bidScore: blocked.bidScore,
      complianceSummary: blocked.intelligence.complianceSummary,
      historicalSignals: [],
      matched: [],
      failed: [],
      uncertain: [],
      criticalRisks: [],
      evidence: [],
      missingDocuments: [
        {
          id: "m1",
          documentName: "CPS",
          reason: "missing",
          severity: "MEDIUM",
        },
        {
          id: "m2",
          documentName: "TECHNICAL_SPECIFICATION",
          reason: "missing",
          severity: "MEDIUM",
        },
      ],
      nextActions: [],
      decisionOutcome: null,
    };

    const sections = deriveCanonicalReportSections(report);
    assert.equal(sections.decision, null);
    assert.equal(sections.fitScoreDisplay, "Not available");
    assert.equal(sections.bidScoreDisplay, "Not available");
    assert.equal(sections.complianceMatrix.length, 0);
    assert.equal(sections.missingDocuments.length, 2);

    const content = buildReportDisplayContent(sections, "en");
    assert.equal(content.decisionLabel, "ANALYSIS INCOMPLETE");
    assert.equal(content.fitScoreDisplay, "Not available");
  });

  it("rejects fabricated score titles", () => {
    assert.equal(isFabricatedScoreTitle("SCORE D’OFFRE 21/100 — Very"), true);
    assert.equal(isFabricatedScoreTitle("Municipal AV System Upgrade"), false);
  });

  it("strips invented midnight time and timezone from date-only deadlines", () => {
    const projected = projectCanonicalDeadline(
      "2026-10-06T00:00:00.000Z",
      "Africa/Casablanca",
    );
    assert.equal(projected.deadline, "2026-10-06");
    assert.equal(projected.deadlineTimezone, null);
  });

  it("keeps real local timestamps with timezone", () => {
    const projected = projectCanonicalDeadline(
      "2026-10-06T10:30:00+01:00",
      "Africa/Casablanca",
    );
    assert.equal(projected.deadline, "2026-10-06T10:30:00+01:00");
    assert.equal(projected.deadlineTimezone, "Africa/Casablanca");
  });
});
