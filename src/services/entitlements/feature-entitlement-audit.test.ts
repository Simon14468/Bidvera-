import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type { TenderIntelligenceBreakdown } from "@/domain/tender-intelligence";
import {
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import {
  projectIntelligenceForEntitlements,
} from "@/services/entitlements/intelligence-projection";
import type { TenderReport } from "@/services/reports/types";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function intelFixture(): TenderIntelligenceBreakdown {
  return {
    complianceMatrix: [],
    complianceSummary: {
      totalRequirements: 0,
      ready: 0,
      missing: 0,
      verify: 0,
      notApplicable: 0,
      unknown: 0,
      sources: 0,
      risks: 0,
      requiredActions: 0,
      clarifications: 0,
    },
    complianceStatus: "INCOMPLETE",
    risks: [],
    contradictions: [],
    clarificationQuestions: [],
    keyBlockers: [],
    learningSignal: null,
    outcomeLearningInsights: null,
    decisionMemoryInsights: null,
    tenderDecisionRecommendation: null,
    decisionContext: "",
    evidenceIntelligence: { computed: true, summary: {}, rows: [] } as never,
    verificationIntelligence: { summary: { total: 0 } } as never,
    actionPlan: { computed: true, items: [], summary: {} } as never,
    aiTrust: { stage: "EXTRACTION", anomalies: [] } as never,
  };
}

test("projectIntelligenceForEntitlements strips premium blobs when disabled", () => {
  const projected = projectIntelligenceForEntitlements(intelFixture(), {
    evidenceIntelligence: false,
    advancedAiTrust: false,
    tenderActionPlan: false,
  });
  assert.equal(projected?.evidenceIntelligence, null);
  assert.equal(projected?.verificationIntelligence, null);
  assert.equal(projected?.actionPlan, null);
  assert.equal(projected?.aiTrust, null);
});

test("projectIntelligenceForEntitlements preserves fields when entitled", () => {
  const source = intelFixture();
  const projected = projectIntelligenceForEntitlements(source, {
    evidenceIntelligence: true,
    advancedAiTrust: true,
    tenderActionPlan: true,
  });
  assert.ok(projected?.evidenceIntelligence);
  assert.ok(projected?.actionPlan);
  assert.ok(projected?.aiTrust);
});

test("deriveCanonicalReportSections denies premium sections by default", () => {
  const report = {
    companyId: "c1",
    companyKnowledgeOnly: false,
    decision: "REVIEW",
    evidence: [],
    missingDocuments: [],
    nextActions: [],
    intelligence: intelFixture(),
  } as unknown as TenderReport;
  const sections = deriveCanonicalReportSections(report);
  assert.equal(sections.explainableDecision, null);
  assert.equal(sections.actionPlan, null);
  assert.equal(sections.verificationIntelligence, null);
});

test("deriveCanonicalReportSections allows action plan with explicit access", () => {
  const report = {
    companyId: "c1",
    companyKnowledgeOnly: false,
    decision: "REVIEW",
    evidence: [],
    missingDocuments: [],
    nextActions: [],
    intelligence: intelFixture(),
  } as unknown as TenderReport;
  const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
  assert.ok(sections.actionPlan?.computed);
  assert.equal(sections.verificationIntelligence?.summary.total, 0);
});

test("tender detail loader projects intelligence before serialization", () => {
  const detail = readSrc("src/application/tender-detail-from-canonical.ts");
  const resultPage = readSrc("src/application/tender-result-page.ts");
  assert.match(detail, /projectIntelligenceForEntitlements/);
  assert.match(resultPage, /getPremiumFeatureAccess/);
  assert.match(resultPage, /buildTenderReportFromCanonical/);
});

test("report payload projects intelligence before return", () => {
  const src = readSrc("src/services/reports/tender-report.ts");
  assert.match(src, /projectIntelligenceForEntitlements/);
  assert.match(src, /evidenceIntelligence/);
});

test("shared report page resolves live feature access", () => {
  const src = readSrc("src/app/share/report/[token]/page.tsx");
  assert.match(src, /getReportFeatureAccess/);
  assert.match(src, /featureAccess=\{featureAccess\}/);
});

test("explainable decision gates evidence_intelligence separately", () => {
  const src = readSrc("src/application/explainable-decision.ts");
  assert.match(src, /evidence_intelligence/);
  assert.match(src, /access\.evidenceIntelligence/);
});

test("decision simulator does not persist simulation results", () => {
  const src = readSrc("src/application/decision-simulator.ts");
  assert.doesNotMatch(src, /prisma\.\w+\.(update|create|upsert|delete)/);
  assert.match(src, /never mutates DB|simulateTenderDecision/);
});

test("tender action plan has no client completion mutation path", () => {
  const invariants = readSrc("src/domain/tender-action-plan/invariants.ts");
  assert.match(invariants, /clientCompletionTrusted:\s*false/);
  const app = readSrc("src/application/tender-action-plan.ts");
  assert.doesNotMatch(app, /prisma\.\w+\.(update|create|upsert|delete)/);
});
