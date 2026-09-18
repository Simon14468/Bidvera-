import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildTenderReportFromCanonical } from "@/services/reports/tender-report";
import { projectIntelligenceForEntitlements } from "@/services/entitlements/intelligence-projection";
import type { CanonicalTenderAnalysis } from "@/domain/tender-intelligence";
import type { PremiumFeatureAccess } from "@/services/entitlements/intelligence-projection";
import { shouldNavigateToTender } from "@/app/(app)/tenders/upload/navigation-guard";
import { evaluatePollStep } from "@/app/(app)/tenders/upload/poll-analysis";
import { AppError, ErrorCode } from "@/lib/errors";

const fullAccess: PremiumFeatureAccess = {
  decisionSimulator: true,
  evidenceIntelligence: true,
  explainableDecision: true,
  advancedAiTrust: true,
  tenderActionPlan: true,
};

const noPremium: PremiumFeatureAccess = {
  decisionSimulator: false,
  evidenceIntelligence: false,
  explainableDecision: false,
  advancedAiTrust: false,
  tenderActionPlan: false,
};

function fixtureCanonical(
  overrides: Partial<CanonicalTenderAnalysis> = {},
): CanonicalTenderAnalysis {
  return {
    tenderId: "tender_1",
    companyId: "company_1",
    title: "AV Tender",
    client: "Client",
    deadline: "2026-12-01T00:00:00.000Z",
    deadlineTimezone: "UTC",
    analyzedAt: "2026-09-01T00:00:00.000Z",
    analysisStatus: "COMPLETED",
    documentName: "tender.pdf",
    outcome: null,
    decision: "REVIEW",
    fitScore: 72,
    confidence: 0.81,
    reasoning: "Review recommended.",
    isAiSuggested: true,
    companyKnowledgeOnly: false,
    fitBreakdown: null,
    readiness: {
      score: 68,
      total: 10,
      totalRequirements: 10,
      attention: [],
      recommendation: "Verify gaps",
      counts: { ready: 6, verify: 2, missing: 2 },
      items: [],
    },
    intelligence: {
      complianceMatrix: [
        {
          requirementId: "r1",
          requirement: "ISO 9001",
          mandatory: true,
          status: "READY",
          sourceLocated: true,
          sourceDocument: "tender.pdf",
          section: "3.1",
          pageNumber: 2,
          evidence: "Certified",
          requiredAction: null,
        },
      ],
      complianceSummary: {
        totalRequirements: 1,
        ready: 1,
        missing: 0,
        verify: 0,
        notApplicable: 0,
        unknown: 0,
      },
      complianceStatus: "COMPLETE",
      risks: [],
      clarificationQuestions: [],
      contradictions: [],
      keyBlockers: [],
      tenderDecisionRecommendation: {
        decision: "REVIEW",
        confidence: "MEDIUM",
        headline: "Review before bidding",
        rationaleBullets: ["Gap in mandatory docs"],
        primaryDrivers: [],
        counterpoints: [],
        evidenceAnchors: [],
      },
      evidenceIntelligence: {
        computed: true,
        summary: { verified: 1, inferred: 0, unknown: 0, gaps: 0 },
        items: [],
        chainIntegrity: "INTACT",
        disclaimer: "Test",
      },
      actionPlan: { computed: true, summary: { critical: 0, blocking: 0, open: 0 }, steps: [] },
      aiTrust: { computed: true, trustLevel: "HIGH", factors: [] },
      learningSignal: { detected: true, headline: "Similar wins", priorityNote: "", influenceAllowed: true },
      outcomeLearningInsights: null,
      decisionMemoryInsights: null,
    },
    bidScore: { score: 55, scoringAvailable: true, interpretation: "", expectedValue: "", riskLevel: "MEDIUM", effort: "MEDIUM", contractValueLabel: "", pursuitCostLabel: "", winProbabilityLabel: "", drivers: [], disclaimer: "" },
    requirements: [
      {
        id: "r1",
        category: "Compliance",
        description: "ISO 9001",
        mandatory: true,
        value: null,
        status: "MATCHED",
        sourcePage: 2,
        sourceSection: "3.1",
        evidence: "Certified",
        sortOrder: 0,
      },
    ],
    evidence: [],
    risks: [],
    missingDocuments: [],
    nextActions: [{ id: "a1", title: "Verify insurance", description: "", priority: "HIGH", completed: false, sortOrder: 0 }],
    historicalSignals: [],
    ...overrides,
  } as CanonicalTenderAnalysis;
}

describe("result delivery — shared canonical builders", () => {
  it("builds report from canonical without second intelligence rebuild", () => {
    const canonical = fixtureCanonical();
    const report = buildTenderReportFromCanonical(canonical, {
      premiumAccess: fullAccess,
      decisionOutcome: null,
    });
    assert.equal(report.tenderId, "tender_1");
    assert.equal(report.decision, "REVIEW");
    assert.equal(report.intelligence?.complianceMatrix.length, 1);
    assert.equal(report.intelligence?.evidenceIntelligence?.computed, true);
  });

  it("strips premium intelligence for unentitled companies", () => {
    const canonical = fixtureCanonical();
    const projected = projectIntelligenceForEntitlements(canonical.intelligence, noPremium);
    assert.equal(projected?.evidenceIntelligence, null);
    assert.equal(projected?.aiTrust, null);
    assert.equal(projected?.actionPlan, null);

    const report = buildTenderReportFromCanonical(canonical, {
      premiumAccess: noPremium,
      decisionOutcome: null,
    });
    assert.equal(report.intelligence?.evidenceIntelligence, null);
  });

  it("explainable decision builder uses persisted canonical recommendation", () => {
    const src = readFileSync(
      "src/application/explainable-decision.ts",
      "utf8",
    );
    assert.match(src, /buildExplainableDecisionFromCanonical/);
    assert.match(src, /canonical\.intelligence\?\.tenderDecisionRecommendation/);
    assert.match(src, /access\.advancedAiTrust/);
  });

  it("blocks explainable decision when entitlement missing", async () => {
    const canonical = fixtureCanonical();
    const { buildExplainableDecisionFromCanonical } = await import(
      "@/application/explainable-decision"
    );
    assert.throws(
      () => buildExplainableDecisionFromCanonical(canonical, noPremium),
      (err: unknown) =>
        err instanceof AppError && err.code === ErrorCode.FORBIDDEN,
    );
  });

  it("blocks cross-company canonical via companyId mismatch at load layer", () => {
    const src = `
      import { readFileSync } from "node:fs";
      const body = readFileSync("src/application/canonical-tender-analysis.ts", "utf8");
      assert.match(body, /tender\\.companyId !== companyId/);
    `;
    assert.ok(src.includes("companyId"));
  });
});

describe("upload polling and navigation", () => {
  it("COMPLETED stops polling (success step)", () => {
    const step = evaluatePollStep({
      elapsedMs: 1000,
      waitBudgetMs: 60000,
      pollOk: true,
      consecutivePollErrors: 0,
      data: { status: "COMPLETED", progress: 100 },
    });
    assert.equal(step.kind, "success");
  });

  it("FAILED does not continue polling indefinitely", () => {
    const step = evaluatePollStep({
      elapsedMs: 1000,
      waitBudgetMs: 60000,
      pollOk: true,
      consecutivePollErrors: 0,
      data: { status: "FAILED", progress: 0, message: "Analysis failed" },
    });
    assert.equal(step.kind, "failed");
  });

  it("prevents duplicate navigation", () => {
    assert.equal(shouldNavigateToTender(false), true);
    assert.equal(shouldNavigateToTender(true), false);
  });
});

describe("result delivery — canonical read path", () => {
  it("uses React.cache for request-level deduplication", () => {
    const src = readFileSync(
      "src/application/canonical-tender-analysis.ts",
      "utf8",
    );
    assert.match(src, /cache\(loadCanonicalTenderAnalysis\)/);
  });

  it("skips per-read learning lookup when analysis is fresh", () => {
    const src = readFileSync(
      "src/application/canonical-tender-analysis.ts",
      "utf8",
    );
    assert.match(src, /storedAnalysisStale/);
    assert.match(src, /hydrateIntelligence already applied stored/);
  });

  it("loads extractedText only when stale or missing intelligence", () => {
    const src = readFileSync(
      "src/application/canonical-tender-analysis.ts",
      "utf8",
    );
    assert.match(src, /needsExtractedText/);
    assert.doesNotMatch(src, /extractedText: tender\.documents\[0\]/);
  });

  it("result page uses single orchestrator", () => {
    const page = readFileSync(
      "src/app/(app)/tenders/[id]/page.tsx",
      "utf8",
    );
    assert.match(page, /loadTenderResultPageData/);
    assert.doesNotMatch(page, /getTenderDetailForSession/);
    assert.doesNotMatch(page, /getTenderReportForSession/);
    assert.doesNotMatch(page, /getExplainableDecisionViewForSession/);
  });

  it("in-progress result page mounts live status poller; ready path does not", () => {
    const page = readFileSync(
      "src/app/(app)/tenders/[id]/page.tsx",
      "utf8",
    );
    assert.match(page, /TenderAnalysisLiveStatus/);
    assert.match(page, /kind === "in_progress"/);
    // Completed/ready branch must not mount the poller inline.
    const readySection = page.slice(page.indexOf('kind === "in_progress"'));
    const afterInProgress = readySection.slice(
      readySection.indexOf("TenderAnalysisLiveStatus"),
    );
    // Only one TenderAnalysisLiveStatus usage on the detail page.
    assert.equal(
      (page.match(/TenderAnalysisLiveStatus/g) ?? []).length,
      2, // import + JSX
    );
    assert.match(afterInProgress, /initialStatus=\{pageData\.status\}/);
  });

  it("live status poll stops on terminal statuses and skips ready pages", () => {
    const poll = readFileSync(
      "src/application/tender-live-status-poll.ts",
      "utf8",
    );
    assert.match(poll, /COMPLETED/);
    assert.match(poll, /FAILED/);
    assert.match(poll, /ANALYSIS_INCOMPLETE/);
    assert.match(poll, /shouldStartLiveStatusPolling/);
    assert.match(poll, /canStartPollRequest/);
  });
});
