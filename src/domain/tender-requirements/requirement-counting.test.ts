/**
 * Adversarial regression — canonical requirement counting invariants.
 * Proves ONE deduplicated requirement set drives all downstream totals.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { runDecisionEngine } from "@/domain/decision/engine";
import type { RuleCompanyProfile } from "@/domain/decision/types";
import {
  assertCanonicalRequirementInvariants,
  buildCanonicalRequirements,
  isStoredAnalysisCountsStale,
  normalizeRequirements,
  obligationFingerprint,
} from "@/domain/tender-requirements";
import { AUDIOVISUAL_TENDER_FIXTURE } from "@/domain/tender-requirements/audiovisual-regression.test";
import {
  buildComplianceSummary,
  buildTenderIntelligence,
} from "@/domain/tender-intelligence";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";

const ADVERSARIAL_PACK = `
Section 1 — Introduction
Table des matieres

Closing date: 15 March 2027 at 12:00
Estimated contract value: 2.500.000,00 MAD TTC
Evaluation criteria: Technical 60% · Price 40%

Section 2 — Obligations
Provide a valid tax clearance certificate before award.
Tax clearance certificate must be submitted with the bid dossier.
The bidder shall supply and install a complete audiovisual system for the auditorium.
Minimum three (3) years of relevant experience is required.
`.trim();

describe("canonical counting — semantic deduplication", () => {
  it("merges paraphrased tax clearance obligations into one requirement", () => {
    const merged = normalizeRequirements([
      {
        category: "administrative",
        description: "Provide a valid tax clearance certificate before award.",
        mandatory: true,
        sourcePage: 2,
      },
      {
        category: "documentation",
        description: "Tax clearance certificate must be submitted with the bid dossier.",
        mandatory: true,
        sourcePage: 4,
      },
    ]);
    assert.equal(merged.length, 1);
    assert.match(
      obligationFingerprint(merged[0]!.requirement, merged[0]!.category),
      /^tax-clearance(?:\||$)/,
    );
    assert.ok((merged[0]!.sourcePages?.length ?? 0) >= 2);
  });

  it("adversarial pack excludes facts and dedupes obligations", () => {
    const heuristic = extractTenderPackageHeuristic({
      text: ADVERSARIAL_PACK,
      fileName: "Adversarial.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Adversarial.pdf",
    });

    const descriptions = canonical.map((r) => r.requirement.toLowerCase()).join("\n");
    assert.ok(!descriptions.includes("closing date"));
    assert.ok(!descriptions.includes("estimated contract value"));
    assert.ok(!descriptions.includes("evaluation criteria"));
    assert.ok(!descriptions.includes("table des matieres"));

    assert.equal(
      canonical.filter((r) => /tax\s+clearance|clearance\s+certificate/i.test(r.requirement))
        .length,
      1,
      "tax clearance variants must dedupe to one obligation",
    );
    assert.equal(
      canonical.filter((r) => /audiovisual/i.test(r.requirement)).length,
      1,
    );
    assert.equal(
      canonical.filter((r) => /experience|years/i.test(r.requirement)).length,
      1,
    );
    assert.equal(canonical.length, 3);
  });
});

describe("canonical counting — missing documents never inflate requirement totals", () => {
  it("requirement exists once; missing document does not add to total", () => {
    const requirements = [
      {
        id: "r1",
        category: "MANDATORY_ADMINISTRATIVE",
        description: "Attestation CNSS and tax clearance certificate are mandatory.",
        mandatory: true,
        value: null,
        status: "UNCERTAIN" as const,
        evidence: null,
      },
    ];

    const readiness = computeTenderReadiness({
      requirements,
      missingDocuments: [
        {
          id: "d1",
          documentName: "Attestation CNSS",
          reason: "Referenced in tender",
          severity: "HIGH",
        },
        {
          id: "d2",
          documentName: "tax clearance",
          reason: "Referenced in tender",
          severity: "HIGH",
        },
      ],
      profileHasAnyCapability: true,
    });

    assert.equal(readiness.total, 1);
    assert.equal(readiness.totalRequirements, 1);
    assert.equal(readiness.items.length, 1);
    assert.ok(readiness.items.every((i) => i.category !== "document"));
    assert.notEqual(readiness.total, 1 + 2);
  });

  it("detects legacy stored totals that counted missing documents", () => {
    assert.equal(
      isStoredAnalysisCountsStale({
        requirementCount: 5,
        missingDocCount: 3,
        storedReadiness: {
          score: 40,
          total: 8,
          totalRequirements: 8,
          counts: { ready: 0, missing: 0, verify: 8, unknown: 0, notApplicable: 0 },
          items: new Array(8).fill(null).map((_, i) => ({
            id: `i${i}`,
            requirement: "x",
            category: i < 5 ? "TECH" : "document",
            status: "VERIFY" as const,
            priority: "HIGH" as const,
            reason: "r",
            source: "s",
            mandatory: true,
          })),
          attention: [],
          recommendation: "",
          disclaimer: "",
        },
        storedIntelligence: null,
      }),
      true,
    );
  });

  it("detects matrix length divergence from canonical requirements", () => {
    assert.equal(
      isStoredAnalysisCountsStale({
        requirementCount: 5,
        missingDocCount: 0,
        storedReadiness: {
          score: 45,
          total: 5,
          counts: { ready: 0, missing: 0, verify: 5, unknown: 0, notApplicable: 0 },
          items: new Array(5).fill(null).map((_, i) => ({
            id: `i${i}`,
            requirement: "x",
            category: "TECH",
            status: "VERIFY" as const,
            priority: "HIGH" as const,
            reason: "r",
            source: "s",
            mandatory: true,
          })),
          attention: [],
          recommendation: "",
          disclaimer: "",
        },
        storedIntelligence: {
          complianceMatrix: new Array(7).fill({ requirementId: "x" }),
          complianceSummary: { totalRequirements: 7 },
        } as import("@/domain/tender-intelligence").TenderIntelligenceBreakdown,
      }),
      true,
    );
  });
});

describe("canonical counting — full pipeline invariants", () => {
  it("audiovisual tender: one canonical count across readiness, compliance, matrix", () => {
    const heuristic = extractTenderPackageHeuristic({
      text: AUDIOVISUAL_TENDER_FIXTURE,
      fileName: "Tender_Audiovisual_Equipment.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Tender_Audiovisual_Equipment.pdf",
    });

    assert.ok(
      heuristic.requirements.length > canonical.length,
      "raw heuristic drafts must exceed canonical after dedupe",
    );

    const requirements = canonical.map((r, i) => ({
      id: `av-${i + 1}`,
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
      companyName: "AV Co",
      industry: "AV",
      country: "Morocco",
      companySize: "11-50",
      experienceLevel: "experienced",
      services: ["audiovisual"],
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
        title: "AV",
        client: null,
        country: "Morocco",
        industry: "AV",
        tenderText: AUDIOVISUAL_TENDER_FIXTURE.slice(0, 3000),
      },
      ai: { suggestedDecision: "REVIEW", fitScore: 50, confidence: "MEDIUM", reasoning: "Review" },
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
      tenderId: "av-count",
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

    const canonicalCount = canonical.length;
    assert.equal(canonicalCount, 5);

    assertCanonicalRequirementInvariants({
      canonicalRequirementCount: canonicalCount,
      readiness,
      intelligence,
    });

    console.log("\n--- Audiovisual counting audit ---");
    console.log(`Raw heuristic drafts: ${heuristic.requirements.length}`);
    console.log(`Canonical requirements: ${canonicalCount}`);
    console.log(`Missing documents (separate): ${heuristic.missingDocuments.length}`);
    console.log(`Readiness total: ${readiness.total}`);
    console.log(`Compliance total: ${intelligence.complianceSummary.totalRequirements}`);
    console.log(`Matrix rows: ${intelligence.complianceMatrix.length}`);
  });

  it("multiple extraction sources for one obligation preserve provenance without duplicate count", () => {
    const canonical = buildCanonicalRequirements({
      aiDrafts: [
        {
          category: "technical",
          description: "Supply audiovisual system including projection equipment",
          mandatory: true,
          sourcePage: 3,
        },
      ],
      heuristicDrafts: [
        {
          category: "technical",
          description:
            "The bidder shall supply, install, configure and commission a complete audiovisual system including projection equipment.",
          mandatory: true,
          sourcePage: 5,
        },
      ],
      sourceDocument: "Tender.pdf",
    });
    assert.equal(canonical.length, 1);
    assert.ok((canonical[0]!.sourcePages?.length ?? 0) >= 1);

    const readiness = computeTenderReadiness({
      requirements: canonical.map((r, i) => ({
        id: `r${i}`,
        category: r.category,
        description: r.requirement,
        mandatory: r.mandatory,
        value: r.value ?? null,
        status: "UNCERTAIN",
        evidence: r.evidenceText,
      })),
      missingDocuments: [],
      profileHasAnyCapability: true,
    });

    const intelligence = buildTenderIntelligence({
      tenderId: "t1",
      documentName: "Tender.pdf",
      tenderDeadline: null,
      extractedText: "",
      requirements: canonical.map((r, i) => ({
        id: `r${i}`,
        category: r.category,
        description: r.requirement,
        mandatory: r.mandatory,
        value: r.value ?? null,
        status: "UNCERTAIN" as const,
        sourcePage: r.page ?? null,
        sourceSection: r.sourceSection ?? null,
        evidence: r.evidenceText ?? null,
      })),
      evidence: [],
      readiness,
      findings: [],
      existingRisks: [],
      decision: "REVIEW",
      fitScore: 50,
    });

    assertCanonicalRequirementInvariants({
      canonicalRequirementCount: 1,
      readiness,
      intelligence,
    });
    assert.equal(
      buildComplianceSummary(intelligence.complianceMatrix, 0, intelligence.risks)
        .totalRequirements,
      1,
    );
  });
});
