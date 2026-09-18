/**
 * Audiovisual tender intelligence regression — real-procurement patterns.
 * Proves non-requirements are filtered, obligations captured, fit is canonical.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertCanonicalFitConsistency } from "@/domain/decision/fit-consistency";
import { runDecisionEngine } from "@/domain/decision/engine";
import type { RuleCompanyProfile } from "@/domain/decision/types";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import {
  buildCanonicalRequirements,
  classifyRequirementCategory,
  isNonRequirementText,
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
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";

/** Representative AV tender excerpt (synthetic test doc + real obligation mix). */
export const AUDIOVISUAL_TENDER_FIXTURE = `
TENDER AUDiovisual Equipment
This document is synthetic — for testing only. Do not treat as official.

--- Page 1 ---
Table des matieres
Section 1 — Introduction

Closing date: 30 September 2026 at 17:00 (Africa/Casablanca)
Estimated contract value: 4.200.000,00 DH TTC

--- Page 3 ---
Section 2.1 Technical specifications
The bidder shall supply, install, configure and commission a complete audiovisual system
including projection equipment, display screens, sound reinforcement, microphones,
amplifiers, and control room integration for the auditorium.

--- Page 5 ---
Section 4.2 Warranty
The supplier must provide a minimum warranty period of 24 months on all installed AV equipment.

--- Page 6 ---
Administrative submission
Bidders must submit a provisional bond (caution provisoire) together with the tender dossier.
Attestation CNSS and tax clearance certificate are mandatory.

--- Page 7 ---
Eligibility
Minimum five (5) years of experience in public-sector audiovisual installation projects is required.

--- Page 8 ---
Evaluation criteria (informational weighting only)
Technical score: 70% · Financial offer: 30%
`.trim();

/** Expected canonical obligation count after semantic deduplication. */
const EXPECTED_CANONICAL_REQUIREMENT_COUNT = 5;

/** Oracle: must become requirements (source-grounded obligations). */
const EXPECTED_REQUIREMENT_SNIPPETS = [
  "audiovisual system",
  "warranty period of 24 months",
  "provisional bond",
  "Attestation CNSS",
  "five (5) years of experience",
] as const;

/** Oracle: must NOT become requirements (facts / noise). */
const REJECTED_AS_REQUIREMENTS = [
  "Closing date: 30 September 2026",
  "Submission / closing deadline referenced",
  "Estimated contract value",
  "This document is synthetic",
  "Table des matieres",
  "Technical score: 70%",
] as const;

describe("audiovisual tender — extraction audit", () => {
  it("captures genuine obligations and filters facts/noise", () => {
    const extracted = extractTenderPackageHeuristic({
      text: AUDIOVISUAL_TENDER_FIXTURE,
      fileName: "Tender_Audiovisual_Equipment.pdf",
    });

    assert.equal(extracted.deadlineIso != null, true, "deadline stored as tender fact");
    assert.ok(extracted.estimatedValue != null, "contract value stored as tender fact");

    const normalized = buildCanonicalRequirements({
      heuristicDrafts: extracted.requirements,
      sourceDocument: "Tender_Audiovisual_Equipment.pdf",
    });

    assert.equal(
      normalized.length,
      EXPECTED_CANONICAL_REQUIREMENT_COUNT,
      "canonical requirement count must match deduplicated obligations only",
    );

    const descriptions = normalized.map((r) => r.requirement.toLowerCase()).join("\n");

    for (const snippet of EXPECTED_REQUIREMENT_SNIPPETS) {
      assert.ok(
        descriptions.includes(snippet.toLowerCase()),
        `missing expected requirement containing: ${snippet}`,
      );
    }

    for (const rejected of REJECTED_AS_REQUIREMENTS) {
      assert.ok(
        !normalized.some((r) => r.requirement.toLowerCase().includes(rejected.toLowerCase())),
        `false positive requirement: ${rejected}`,
      );
    }

    assert.ok(
      !normalized.some((r) => isNonRequirementText(r.requirement) === false && /deadline referenced/i.test(r.requirement)),
    );

    console.log("\n--- Audiovisual extraction audit ---");
    console.log(`Extracted requirement count: ${normalized.length}`);
    console.log(`Deadline (fact): ${extracted.deadlineIso}`);
    console.log(`Estimated value (fact): ${extracted.estimatedValue}`);
    for (const r of normalized) {
      console.log(
        `[${r.category}] mandatory=${r.mandatory} | ${r.requirement.slice(0, 90)}… | doc=${r.sourceDocument ?? "—"} p${r.page ?? "?"}`,
      );
    }
  });

  it("classifies AV obligations correctly", () => {
    assert.equal(
      classifyRequirementCategory({
        description:
          "The bidder shall supply, install, configure and commission a complete audiovisual system including projection equipment.",
        mandatoryHint: true,
      }),
      "MANDATORY_TECHNICAL",
    );
    assert.equal(
      classifyRequirementCategory({
        description: "Minimum five (5) years of experience in public-sector audiovisual installation projects is required.",
      }),
      "MANDATORY_ELIGIBILITY",
    );
    assert.equal(
      classifyRequirementCategory({
        description: "Bidders will be evaluated against the published technical criteria in Annex B.",
      }),
      "EVALUATION",
    );
    assert.equal(
      classifyRequirementCategory({
        description: "Closing date: 30 September 2026 at 17:00",
      }),
      "INFORMATIONAL",
    );
  });

  it("merges sparse AI with heuristic without duplicates", () => {
    const merged = buildCanonicalRequirements({
      aiDrafts: [
        {
          category: "technical",
          description: "Supply audiovisual system including projection equipment",
          mandatory: true,
        },
      ],
      heuristicDrafts: extractTenderPackageHeuristic({
        text: AUDIOVISUAL_TENDER_FIXTURE,
        fileName: "Tender_Audiovisual_Equipment.pdf",
      }).requirements,
      sourceDocument: "Tender_Audiovisual_Equipment.pdf",
    });
    assert.equal(merged.length, EXPECTED_CANONICAL_REQUIREMENT_COUNT);
  });
});

describe("audiovisual tender — canonical consistency", () => {
  it("readiness/compliance counts align; fit is single canonical value", () => {
    const heuristic = extractTenderPackageHeuristic({
      text: AUDIOVISUAL_TENDER_FIXTURE,
      fileName: "Tender_Audiovisual_Equipment.pdf",
    });
    const normalized = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Tender_Audiovisual_Equipment.pdf",
    });

    const requirements = normalized.map((r, i) => ({
      id: `av-r${i + 1}`,
      category: r.category,
      description: r.requirement,
      mandatory: r.mandatory,
      value: r.value ?? null,
      status: "UNCERTAIN" as const,
      sourcePage: r.page ?? null,
      sourceSection: r.sourceSection ?? null,
      evidence: r.evidenceText ?? null,
    }));

    const profile: RuleCompanyProfile = {
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

    const engine = runDecisionEngine({
      profile,
      requirements,
      estimatedValue: heuristic.estimatedValue,
      tenderContext: {
        title: "Tender Audiovisual Equipment",
        client: null,
        country: "Morocco",
        industry: "AV",
        tenderText: AUDIOVISUAL_TENDER_FIXTURE.slice(0, 4000),
      },
      ai: { suggestedDecision: "REVIEW", fitScore: 52, confidence: "MEDIUM", reasoning: "Review AV scope." },
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
      missingDocuments: heuristic.missingDocuments.map((d, i) => ({
        id: `md-${i}`,
        documentName: d.documentName,
        reason: d.reason,
        severity: d.severity,
      })),
      profileHasAnyCapability: true,
    });

    const intelligence = buildTenderIntelligence({
      tenderId: "av-test",
      documentName: "Tender_Audiovisual_Equipment.pdf",
      tenderDeadline: heuristic.deadlineIso,
      extractedText: AUDIOVISUAL_TENDER_FIXTURE,
      requirements,
      evidence: [],
      readiness,
      findings: engine.findings,
      existingRisks: [],
      decision: engine.decision,
      fitScore: engine.fitScore,
    });

    const summarySnap = snapshotFromComplianceSummary(
      intelligence.complianceSummary,
      requirements.filter((r) => r.mandatory).length,
    );
    const readinessSnap = snapshotFromReadiness(readiness);
    const complianceSnap = snapshotFromComplianceSummary(
      intelligence.complianceSummary,
      requirements.filter((r) => r.mandatory).length,
    );

    assertRequirementCountConsistency({
      summary: summarySnap,
      readiness: readinessSnap,
      compliance: complianceSnap,
      canonicalRowCount: requirements.length,
    });

    const verifyLike =
      intelligence.complianceSummary.verify +
      intelligence.complianceSummary.missing +
      intelligence.complianceSummary.unknown;
    assert.ok(verifyLike >= 1);
    assert.equal(intelligence.complianceSummary.risks, 0);
    assert.equal(
      intelligence.risks.filter((r) => r.severity === "HIGH").length,
      0,
    );

    assert.equal(
      intelligence.complianceSummary.totalRequirements,
      requirements.length,
    );
    assert.equal(
      summarySnap.ready + summarySnap.missing + summarySnap.verify + summarySnap.notApplicable,
      summarySnap.totalRequirements,
    );
  });

  it("web and PDF display share identical fit and counts", () => {
    const heuristic = extractTenderPackageHeuristic({
      text: AUDIOVISUAL_TENDER_FIXTURE,
      fileName: "Tender_Audiovisual_Equipment.pdf",
    });
    const normalized = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Tender_Audiovisual_Equipment.pdf",
    });
    const requirements = normalized.map((r, i) => ({
      id: `av-r${i + 1}`,
      category: r.category,
      description: r.requirement,
      mandatory: r.mandatory,
      value: r.value ?? null,
      status: "UNCERTAIN" as const,
      sourcePage: r.page ?? null,
      sourceSection: r.sourceSection ?? null,
      evidence: null,
    }));

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
      missingDocuments: [],
      profileHasAnyCapability: true,
    });

    const intelligence = buildTenderIntelligence({
      tenderId: "av-report",
      documentName: "Tender_Audiovisual_Equipment.pdf",
      tenderDeadline: heuristic.deadlineIso,
      extractedText: "",
      requirements,
      evidence: [],
      readiness,
      findings: [],
      existingRisks: [],
      decision: "REVIEW",
      fitScore: 47,
    });

    const report: TenderReport = {
      tenderId: "av-report",
      companyId: "c1",
      title: "Tender Audiovisual Equipment",
      client: null,
      deadline: heuristic.deadlineIso,
      deadlineTimezone: "Africa/Casablanca",
      analyzedAt: "2026-09-01T10:00:00.000Z",
      decision: "REVIEW",
      fitScore: 47,
      confidence: "MEDIUM",
      reasoning: "Bidvera recommends CONDITIONAL GO — 47% company–tender fit (based on the information provided).",
      companyKnowledgeOnly: false,
      fitBreakdown: {
        overall: 47,
        scoringAvailable: true,
        dimensions: [],
        matches: [],
        gaps: [],
        unknowns: [],
        attention: [],
        recommendation: "Review before bid.",
      },
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
      missingDocuments: heuristic.missingDocuments.map((d, i) => ({
        id: `d${i}`,
        documentName: d.documentName,
        reason: d.reason,
        severity: d.severity,
      })),
      nextActions: [],
      decisionOutcome: null,
    };

    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    assertCanonicalReportIntegrity(sections);
    const content = buildReportDisplayContent(sections, "en");
    assert.equal(content.verificationChains.length, sections.verificationIntelligence?.chains.length ?? 0);
    assert.match(content.reasoning, /47%/);
  });
});
