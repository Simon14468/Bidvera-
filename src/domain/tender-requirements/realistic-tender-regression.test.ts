/**
 * Bidvera_Realistic_Tender_v2 — end-to-end canonical consistency regression.
 * Proves non-requirements stay excluded, dedupe works, and Web/PDF fit agree.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertCanonicalFitConsistency } from "@/domain/decision/fit-consistency";
import { runDecisionEngine } from "@/domain/decision/engine";
import type { RuleCompanyProfile } from "@/domain/decision/types";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import {
  assertAnalysisReadyForCompletion,
  buildCanonicalRequirements,
  isNonRequirementText,
  obligationFingerprint,
} from "@/domain/tender-requirements";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { assertRequirementCountConsistency } from "@/domain/tender-intelligence/requirement-count-consistency";
import { snapshotFromComplianceSummary, snapshotFromReadiness } from "@/domain/tender-intelligence/requirement-count-consistency";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import {
  assertCanonicalReportIntegrity,
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import { finalizeTenderDecision } from "@/domain/decision/tender-decision-engine";
import {
  buildExplainableDecision,
  assertExplainableDecisionIntegrity,
} from "@/domain/explainable-decision";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";

/** Text extracted from Bidvera_Realistic_Tender_v2.pdf (synthetic QA tender). */
export const REALISTIC_TENDER_FIXTURE = `
PUBLIC TENDER — BIDVERA REALISTIC TEST
Reference: AV/2026/042
Subject: Supply, installation, configuration and maintenance of an audiovisual system.
Publication: 02 September 2026 Submission deadline: 30 September 2026 at 12:00
Estimated value: MAD 4,200,000 excluding applicable taxes
2. Mandatory Technical Requirements
T-02 All supplied equipment must be new, unused and current production models at delivery.
3. Eligibility and Administrative Conditions
Bidders must submit a current tax clearance certificate and valid CNSS compliance certificate.
The bidder must demonstrate at least five (5) years of relevant experience delivering audiovisual systems to public-sector organizations.
The bid shall include a provisional bid security of MAD 84,000. The original document must be included in the bid dossier in the required form.
4. Required Bid Documents
Provisional bid security — MAD 84,000 Mandatory
Evidence of 5 years public-sector AV experience Mandatory
Technical proposal and equipment schedule Mandatory
5. Evaluation Method
Technical proposal 70%
Financial proposal 30%
8. Tender Facts — Not Requirements
Publication date, submission deadline, estimated contract value, evaluation weights and expected contract duration are tender facts. They must not be converted into bidder requirements unless another clause explicitly creates an obligation.
9. Verification Test Cases
B. An uploaded warranty document with unclear validity or scope must remain unverified until evidence is sufficient.
`.trim();

const FORBIDDEN_SNIPPETS = [
  "Subject: Supply",
  "tender facts. They must not be converted",
  "uploaded warranty document with unclear",
  "Technical proposal 70%",
  "Estimated value: MAD 4,200,000",
  "Verification Test Cases",
] as const;

const PROFILE: RuleCompanyProfile = {
  companyName: "AV Integrator",
  industry: "Audiovisual",
  country: "Morocco",
  companySize: "11-50",
  experienceLevel: "experienced",
  services: ["audiovisual installation"],
  certifications: [],
  experienceYears: 8,
  revenueRange: null,
  employeeRange: "11-50",
  geographicCoverage: ["Morocco"],
  contractSizeMin: null,
  contractSizeMax: null,
  customQualificationRules: [],
};

describe("realistic tender — canonical requirements", () => {
  it("excludes subject, tender facts, and verification scenarios", () => {
    const heuristic = extractTenderPackageHeuristic({
      text: REALISTIC_TENDER_FIXTURE,
      fileName: "Bidvera_Realistic_Tender_v2.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Bidvera_Realistic_Tender_v2.pdf",
    });

    assert.ok(canonical.length >= 4 && canonical.length <= 6);
    assert.ok(canonical.every((r) => !isNonRequirementText(r.requirement)));

    for (const snippet of FORBIDDEN_SNIPPETS) {
      assert.ok(
        !canonical.some((r) => r.requirement.toLowerCase().includes(snippet.toLowerCase())),
        `forbidden requirement leaked: ${snippet}`,
      );
    }
  });

  it("dedupes bid security and 5-year experience to one row each", () => {
    const heuristic = extractTenderPackageHeuristic({
      text: REALISTIC_TENDER_FIXTURE,
      fileName: "Bidvera_Realistic_Tender_v2.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Bidvera_Realistic_Tender_v2.pdf",
    });

    const bondRows = canonical.filter((r) =>
      /provisional|bid security|caution|84,000|84000/i.test(r.requirement),
    );
    assert.equal(bondRows.length, 1, "bid security must be one canonical requirement");
    assert.match(
      obligationFingerprint(bondRows[0]!.requirement, bondRows[0]!.category),
      /^provisional-bond-mad84,000/,
    );

    const expRows = canonical.filter((r) => /experience|5\s*years/i.test(r.requirement));
    assert.equal(expRows.length, 1, "experience must be one canonical requirement");
    assert.match(
      obligationFingerprint(expRows[0]!.requirement, expRows[0]!.category),
      /^experience-5y/,
    );
  });
});

describe("realistic tender — fit, decision, and report projection", () => {
  it("single fit value across engine, intelligence, web, and PDF paths", () => {
    const heuristic = extractTenderPackageHeuristic({
      text: REALISTIC_TENDER_FIXTURE,
      fileName: "Bidvera_Realistic_Tender_v2.pdf",
    });
    const normalized = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Bidvera_Realistic_Tender_v2.pdf",
    });

    const requirements = normalized.map((r, i) => ({
      id: `rt-r${i + 1}`,
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
      estimatedValue: heuristic.estimatedValue,
      tenderContext: {
        title: "Bidvera Realistic Test",
        client: "Metropolitan Conference & Events Authority",
        country: "Morocco",
        industry: "Audiovisual",
        tenderText: REALISTIC_TENDER_FIXTURE,
      },
      ai: { suggestedDecision: "REVIEW", fitScore: 52, confidence: "MEDIUM", reasoning: "AI advisory only." },
    });

    assert.equal(engine.fitScore, engine.fitBreakdown.overall);
    assertCanonicalFitConsistency({
      fitScore: engine.fitScore,
      fitBreakdown: engine.fitBreakdown,
      reasoning: engine.reasoning,
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
      tenderId: "realistic-test",
      documentName: "Bidvera_Realistic_Tender_v2.pdf",
      tenderDeadline: heuristic.deadlineIso ? new Date(heuristic.deadlineIso) : null,
      extractedText: REALISTIC_TENDER_FIXTURE,
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

    assertAnalysisReadyForCompletion({
      requirements: normalized,
      intelligence,
    });

    const summarySnap = snapshotFromComplianceSummary(
      intelligence.complianceSummary,
      requirements.filter((r) => r.mandatory).length,
    );
    const readinessSnap = snapshotFromReadiness(readiness);
    assertRequirementCountConsistency({
      summary: summarySnap,
      readiness: readinessSnap,
      compliance: summarySnap,
      canonicalRowCount: normalized.length,
    });

    const report: TenderReport = {
      tenderId: "realistic-test",
      companyId: "c1",
      title: "Bidvera Realistic Test",
      client: "Metropolitan Conference & Events Authority",
      deadline: heuristic.deadlineIso,
      deadlineTimezone: "Africa/Casablanca",
      analyzedAt: "2026-09-02T10:00:00.000Z",
      decision: engine.decision,
      fitScore: engine.fitScore,
      confidence: engine.confidence,
      reasoning: engine.reasoning,
      companyKnowledgeOnly: false,
      fitBreakdown: engine.fitBreakdown,
      readiness,
      intelligence,
      complianceSummary: intelligence.complianceSummary,
      bidScore: null,
      historicalSignals: [],
      matched: [],
      failed: [],
      uncertain: requirements,
      criticalRisks: [],
      evidence: [],
      missingDocuments: [],
      nextActions: [],
      decisionOutcome: null,
    };

    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    assertCanonicalReportIntegrity(sections);
    const content = buildReportDisplayContent(sections, "en");

    assert.equal(sections.fitScoreDisplay, `${engine.fitScore}%`);
    assert.equal(content.fitScoreDisplay, sections.fitScoreDisplay);
    assert.equal(content.fitOverallDisplay, `${engine.fitScore}%`);
    assert.match(engine.reasoning, new RegExp(`${engine.fitScore}%\\s+company–tender fit`, "i"));

    // —— Decision severity: verification ≠ hard blockers ——
    assert.equal(intelligence.keyBlockers.length, 0, "no hard compliance blockers");
    assert.ok(
      (intelligence.reviewItems?.length ?? 0) >= 1,
      "mandatory verification surfaced as review items",
    );
    assert.ok(
      intelligence.reviewItems!.some((r) =>
        /mandatory requirements? require verification/i.test(r),
      ),
      "verify count phrased as review, not blocker",
    );
    assert.ok(
      !intelligence.keyBlockers.some((b) => /verification|verify/i.test(b)),
    );

    const requirementsDim = engine.fitBreakdown.dimensions.find(
      (d) => d.key === "requirements",
    );
    assert.ok(requirementsDim?.score != null, "requirements dimension present");
    assert.ok(content.fitRequirementsNote, "report distinguishes overall fit vs requirements");
    assert.match(content.fitRequirementsNote!, /Overall company–tender fit/i);
    assert.match(content.fitRequirementsNote!, /Requirements score/i);

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
      reviewItems: intelligence.reviewItems,
      decisionDrivers: intelligence.decisionDrivers,
      actionItems: intelligence.actionItems,
      structuredRiskTitles: intelligence.risks.map((r) => ({
        title: r.title,
        severity: r.severityCanonical ?? r.severity,
        evidenceState: r.evidenceState ?? null,
        fitStatus: r.fitStatus ?? null,
      })),
    });

    assert.equal(
      finalized.recommendation.criticalBlockers.length,
      intelligence.keyBlockers.length,
    );
    assert.ok(finalized.recommendation.reviewItems.length >= 1);

    intelligence.tenderDecisionRecommendation = finalized.recommendation;
    report.intelligence = intelligence;
    report.decision = finalized.decision;

    const explanation = buildExplainableDecision({
      recommendation: finalized.recommendation,
      complianceMatrix: intelligence.complianceMatrix,
      risks: intelligence.risks,
      readiness,
    });
    assertExplainableDecisionIntegrity(explanation);

    assert.equal(
      explanation.executiveSummary.hardBlockerCount,
      intelligence.keyBlockers.length,
    );
    assert.ok(explanation.executiveSummary.reviewItemCount >= 1);
    assert.ok(
      !/decision blocker/i.test(explanation.executiveSummary.whyHeadline),
      `must not inflate verification as decision blockers: ${explanation.executiveSummary.whyHeadline}`,
    );

    const sectionsWithExplain = deriveCanonicalReportSections(
      report,
      FULL_REPORT_FEATURE_ACCESS,
    );
    const webExplainContent = buildReportDisplayContent(sectionsWithExplain, "en");
    const pdfExplainContent = buildReportDisplayContent(sectionsWithExplain, "fr");

    assert.deepEqual(
      webExplainContent.explainableWhyHeadline,
      sectionsWithExplain.explainableDecision?.executiveSummary.whyHeadline ?? null,
    );
    assert.deepEqual(
      webExplainContent.explainableBlockerLines.length,
      explanation.items.filter((i) => i.category === "BLOCKER").length,
    );
    assert.deepEqual(
      webExplainContent.explainableWhyHeadline,
      pdfExplainContent.explainableWhyHeadline,
    );
    assert.deepEqual(
      webExplainContent.explainableBlockerLines,
      pdfExplainContent.explainableBlockerLines,
    );
  });
});
