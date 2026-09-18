/**
 * Regression: every report section must derive requirement counts from the
 * same canonical TenderRequirement set — never inflate with MissingDocuments.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import {
  buildComplianceSummary,
  buildTenderIntelligence,
} from "@/domain/tender-intelligence";
import {
  assertRequirementCountConsistency,
  snapshotFromComplianceSummary,
  snapshotFromReadiness,
} from "@/domain/tender-intelligence/requirement-count-consistency";
import type { RuleRequirement } from "@/domain/decision/types";

function req(
  partial: Partial<RuleRequirement> & { id: string; description: string },
): RuleRequirement {
  return {
    category: "TECHNICAL",
    mandatory: true,
    value: null,
    status: "UNCERTAIN",
    evidence: null,
    ...partial,
  };
}

describe("report requirement-count consistency", () => {
  it("readiness total/counts match compliance when missing documents exist", () => {
    const requirements = [
      req({ id: "r1", description: "Provide audiovisual equipment installation plan with milestones." }),
      req({ id: "r2", description: "Deliver warranty coverage for installed AV systems.", status: "FAILED" }),
      req({
        id: "r3",
        description: "Optional training workshop for operators.",
        mandatory: false,
        status: "UNCERTAIN",
      }),
    ];

    const readiness = computeTenderReadiness({
      requirements,
      missingDocuments: [
        {
          id: "d1",
          documentName: "Attestation CNSS",
          reason: "Required administrative document",
          severity: "HIGH",
        },
        {
          id: "d2",
          documentName: "Bank guarantee",
          reason: "Financial guarantee referenced",
          severity: "MEDIUM",
        },
        {
          id: "d3",
          documentName: "Catalogue technique",
          reason: "Technical brochure",
          severity: "LOW",
        },
      ],
      profileHasAnyCapability: true,
    });

    const intelligence = buildTenderIntelligence({
      tenderId: "t-consistency",
      documentName: "AVIS+CPS",
      tenderDeadline: null,
      extractedText: "sample package text",
      requirements: requirements.map((r) => ({
        id: r.id!,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        sourcePage: null,
        sourceSection: null,
        evidence: r.evidence ?? null,
      })),
      evidence: [],
      readiness,
      findings: [],
      existingRisks: [],
      decision: "REVIEW",
      fitScore: 50,
    });

    // BEFORE this fix: readiness.total was 6 (3 reqs + 3 docs)
    assert.equal(readiness.total, 3);
    assert.equal(readiness.totalRequirements, 3);
    assert.equal(intelligence.complianceSummary.totalRequirements, 3);
    assert.equal(intelligence.complianceMatrix.length, 3);

    // Document gaps must not inflate VERIFY on readiness vs matrix
    assert.equal(readiness.counts.verify, intelligence.complianceSummary.verify);
    assert.equal(readiness.counts.missing, intelligence.complianceSummary.missing);
    assert.equal(readiness.counts.ready, intelligence.complianceSummary.ready);

    // Score still factors document gaps (formula preserved): 3 reqs + 3 docs identifiable
    // r1 VERIFY 0.45, r2 MISSING 0, r3 VERIFY 0.45, d1-d3 VERIFY 0.45 each
    // sum = 0.45*5 = 2.25, /6 = 0.375 → 38%
    assert.equal(readiness.score, 38);

    // Items list is requirements-only
    assert.equal(readiness.items.length, 3);
    assert.ok(readiness.items.every((i) => i.category !== "document"));

    const mandatory = intelligence.complianceMatrix.filter((r) => r.mandatory).length;
    assert.equal(mandatory, 2);

    const summary = snapshotFromComplianceSummary(
      intelligence.complianceSummary,
      mandatory,
    );
    const readinessSnap = snapshotFromReadiness(readiness);
    const complianceSnap = snapshotFromComplianceSummary(
      buildComplianceSummary(intelligence.complianceMatrix, 0),
      mandatory,
    );

    assertRequirementCountConsistency({
      summary,
      readiness: readinessSnap,
      compliance: complianceSnap,
      canonicalRowCount: requirements.length,
    });
  });

  it("fails the consistency contract when totals diverge (guard)", () => {
    assert.throws(
      () =>
        assertRequirementCountConsistency({
          summary: {
            totalRequirements: 25,
            ready: 0,
            missing: 4,
            verify: 21,
            unknown: 0,
            notApplicable: 0,
            mandatory: 24,
          },
          readiness: {
            totalRequirements: 28,
            ready: 0,
            missing: 4,
            verify: 24,
            unknown: 0,
            notApplicable: 0,
            mandatory: 24,
          },
          compliance: {
            totalRequirements: 25,
            ready: 0,
            missing: 4,
            verify: 21,
            unknown: 0,
            notApplicable: 0,
            mandatory: 24,
          },
        }),
      /Requirement total mismatch/,
    );
  });

  it("empty requirements stay consistent with zero totals", () => {
    const readiness = computeTenderReadiness({
      requirements: [],
      missingDocuments: [
        {
          id: "d1",
          documentName: "Only a document gap",
          reason: "Referenced",
          severity: "HIGH",
        },
      ],
      profileHasAnyCapability: true,
    });
    assert.equal(readiness.total, 0);
    assert.equal(readiness.counts.verify, 0);
    // Score still reflects the document gap alone
    assert.equal(readiness.score, 45);
  });

  it("avis-style single-requirement package stays 1:1 with matrix", () => {
    const requirements = [
      req({
        id: "avis-1",
        description: "Submit sealed quotation before the published deadline.",
      }),
    ];
    const readiness = computeTenderReadiness({
      requirements,
      missingDocuments: [
        { id: "d1", documentName: "Form A", reason: "Admin form", severity: "HIGH" },
        { id: "d2", documentName: "Form B", reason: "Admin form", severity: "MEDIUM" },
      ],
      profileHasAnyCapability: true,
    });
    const intelligence = buildTenderIntelligence({
      tenderId: "t-avis",
      documentName: "AVIS",
      tenderDeadline: null,
      extractedText: "avis only",
      requirements: requirements.map((r) => ({
        id: r.id!,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        sourcePage: null,
        sourceSection: null,
        evidence: r.evidence ?? null,
      })),
      evidence: [],
      readiness,
      findings: [],
      existingRisks: [],
      decision: "REVIEW",
      fitScore: 40,
    });

    assert.equal(readiness.total, 1);
    assert.equal(intelligence.complianceSummary.totalRequirements, 1);
    assertRequirementCountConsistency({
      summary: snapshotFromComplianceSummary(intelligence.complianceSummary, 1),
      readiness: snapshotFromReadiness(readiness),
      compliance: snapshotFromComplianceSummary(intelligence.complianceSummary, 1),
      canonicalRowCount: 1,
    });
  });
});
