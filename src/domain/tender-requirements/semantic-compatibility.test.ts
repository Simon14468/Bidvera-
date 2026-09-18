/**
 * Canonical semanticKind × category × obligationStrength compatibility — SoT regressions.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertAnalysisReadyForCompletion,
  isSemanticKindAlignedWithCategory,
  isSemanticTripleCompatible,
  mergeNormalizedRequirements,
  normalizeRequirements,
  reconcileMergedSemanticTriple,
  resolveCompatibleCategory,
} from "@/domain/tender-requirements";
import type { NormalizedRequirement } from "@/domain/tender-requirements";
import { certifyAnalysis } from "@/domain/tender-certification";
import type { CertifyAnalysisInput } from "@/domain/tender-certification";

function req(partial: Partial<NormalizedRequirement> & Pick<NormalizedRequirement, "requirement">): NormalizedRequirement {
  return {
    category: "MANDATORY_ADMINISTRATIVE",
    semanticKind: "REQUIRED_DOCUMENT",
    obligationStrength: "MANDATORY",
    title: partial.requirement.slice(0, 40),
    mandatory: true,
    confidence: "MEDIUM",
    ...partial,
  };
}

describe("semantic kind × category compatibility SoT", () => {
  it("REQUIRED_DOCUMENT + MANDATORY + TECHNICAL is valid", () => {
    assert.equal(
      isSemanticKindAlignedWithCategory("REQUIRED_DOCUMENT", "MANDATORY_TECHNICAL"),
      true,
    );
    assert.equal(
      isSemanticTripleCompatible({
        semanticKind: "REQUIRED_DOCUMENT",
        category: "MANDATORY_TECHNICAL",
        obligationStrength: "MANDATORY",
      }),
      true,
    );
  });

  it("REQUIRED_DOCUMENT + MANDATORY + ADMINISTRATIVE is valid", () => {
    assert.equal(
      isSemanticTripleCompatible({
        semanticKind: "REQUIRED_DOCUMENT",
        category: "MANDATORY_ADMINISTRATIVE",
        obligationStrength: "MANDATORY",
      }),
      true,
    );
  });

  it("REQUIRED_DOCUMENT + MANDATORY + FINANCIAL/ELIGIBILITY domain is valid", () => {
    assert.equal(
      isSemanticTripleCompatible({
        semanticKind: "REQUIRED_DOCUMENT",
        category: "MANDATORY_ELIGIBILITY",
        obligationStrength: "MANDATORY",
      }),
      true,
    );
  });

  it("REQUIRED_DOCUMENT + CONDITIONAL + ELIGIBILITY is valid", () => {
    assert.equal(
      isSemanticTripleCompatible({
        semanticKind: "REQUIRED_DOCUMENT",
        category: "MANDATORY_ELIGIBILITY",
        obligationStrength: "CONDITIONAL",
      }),
      true,
    );
  });

  it("PERFORMANCE_OBLIGATION + MANDATORY + TECHNICAL is valid", () => {
    assert.equal(
      isSemanticTripleCompatible({
        semanticKind: "PERFORMANCE_OBLIGATION",
        category: "MANDATORY_TECHNICAL",
        obligationStrength: "MANDATORY",
      }),
      true,
    );
  });

  it("FINANCIAL_COMMERCIAL_CONDITION + MANDATORY + FINANCIAL domain is valid", () => {
    assert.equal(
      isSemanticTripleCompatible({
        semanticKind: "FINANCIAL_COMMERCIAL_CONDITION",
        category: "MANDATORY_ELIGIBILITY",
        obligationStrength: "MANDATORY",
      }),
      true,
    );
  });

  it("invalid semantic/category combinations are rejected", () => {
    assert.equal(
      isSemanticKindAlignedWithCategory("TECHNICAL_REQUIREMENT", "EVALUATION"),
      false,
    );
    assert.equal(
      isSemanticKindAlignedWithCategory("ELIGIBILITY_REQUIREMENT", "MANDATORY_TECHNICAL"),
      false,
    );
    assert.equal(
      isSemanticTripleCompatible({
        semanticKind: "REQUIRED_DOCUMENT",
        category: "EVALUATION",
        obligationStrength: "MANDATORY",
      }),
      false,
    );
  });

  it("normalize preserves REQUIRED_DOCUMENT with technical domain from draft", () => {
    const out = normalizeRequirements([
      {
        category: "technical",
        description:
          "The bidder must submit the technical brochure and equipment datasheet for the proposed solution.",
        mandatory: true,
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.semanticKind, "REQUIRED_DOCUMENT");
    assert.equal(out[0]!.category, "MANDATORY_TECHNICAL");
    assert.equal(out[0]!.obligationStrength, "MANDATORY");
  });

  it("normalize preserves REQUIRED_DOCUMENT with administrative domain", () => {
    const out = normalizeRequirements([
      {
        category: "administrative",
        description:
          "The bidder must submit a valid certificate of incorporation and tax clearance certificate.",
        mandatory: true,
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.semanticKind, "REQUIRED_DOCUMENT");
    assert.equal(out[0]!.category, "MANDATORY_ADMINISTRATIVE");
  });

  it("headings / facts / procedure still rejected from canonical set", () => {
    assert.equal(
      normalizeRequirements([
        { category: "technical", description: "TECHNICAL SPECIFICATIONS", mandatory: true },
      ]).length,
      0,
    );
    assert.equal(
      normalizeRequirements([
        {
          category: "info",
          description: "Estimated contract value is EUR 1,200,000 for informational purposes only.",
          mandatory: false,
        },
      ]).length,
      0,
    );
    assert.equal(
      normalizeRequirements([
        {
          category: "admin",
          description: "Clarification questions may be submitted to the procuring entity before the deadline.",
          mandatory: false,
        },
      ]).length,
      0,
    );
  });

  it("merge reconcile keeps REQUIRED_DOCUMENT + TECHNICAL compatible", () => {
    const reconciled = reconcileMergedSemanticTriple({
      semanticKind: "REQUIRED_DOCUMENT",
      category: "MANDATORY_TECHNICAL",
      obligationStrength: "MANDATORY",
    });
    assert.equal(reconciled.semanticKind, "REQUIRED_DOCUMENT");
    assert.equal(reconciled.category, "MANDATORY_TECHNICAL");
    assert.equal(
      isSemanticTripleCompatible(reconciled),
      true,
    );

    // Same obligation text under diverging kind/category still merges to a compatible triple
    // when fingerprints collide (same category key in fingerprint path).
    const merged = mergeNormalizedRequirements([
      req({
        requirement: "Bidder shall submit CNSS attestation with the tender dossier.",
        semanticKind: "REQUIRED_DOCUMENT",
        category: "MANDATORY_ADMINISTRATIVE",
        obligationStrength: "MANDATORY",
      }),
      req({
        requirement: "Bidder shall submit CNSS attestation with the tender dossier.",
        semanticKind: "ADMINISTRATIVE_REQUIREMENT",
        category: "MANDATORY_TECHNICAL",
        obligationStrength: "MANDATORY",
      }),
    ]);
    assert.equal(merged.length, 1);
    assert.equal(
      isSemanticTripleCompatible({
        semanticKind: merged[0]!.semanticKind,
        category: merged[0]!.category,
        obligationStrength: merged[0]!.obligationStrength,
      }),
      true,
    );
  });

  it("final-consistency does not abort on REQUIRED_DOCUMENT + MANDATORY_TECHNICAL", () => {
    const requirements = [
      req({
        id: "r-tech-doc",
        requirement:
          "The bidder must submit manufacturers technical specifications and datasheets for offered equipment.",
        semanticKind: "REQUIRED_DOCUMENT",
        category: "MANDATORY_TECHNICAL",
        obligationStrength: "MANDATORY",
        evidenceText:
          "The bidder must submit manufacturers technical specifications and datasheets for offered equipment.",
        page: 4,
        sourceDocument: "tech.pdf",
      }),
    ];
    assert.doesNotThrow(() =>
      assertAnalysisReadyForCompletion({
        requirements,
        intelligence: {
          complianceMatrix: [
            {
              id: "m1",
              requirementId: "r-tech-doc",
              requirement: requirements[0]!.requirement,
              requirementType: "MANDATORY_TECHNICAL",
              mandatory: true,
              priority: "HIGH",
              status: "VERIFY",
              companyFit: null,
              sourceDocument: "tech.pdf",
              pageNumber: 4,
              section: null,
              evidence: null,
              tenderSource: null,
              companyEvidence: null,
              companyEvidenceMessage: null,
              notes: null,
              sourceBasis: "TENDER",
              sourceLocated: true,
              evidenceId: null,
            },
          ],
          complianceSummary: {
            totalRequirements: 1,
            ready: 0,
            missing: 0,
            verify: 1,
            notApplicable: 0,
            unknown: 0,
            sources: 0,
            risks: 0,
            requiredActions: 0,
            clarifications: 0,
          },
          risks: [],
          missingDocuments: [],
          nextActions: [],
        } as never,
      }),
    );
  });

  it("reconcileMergedSemanticTriple recovers incompatible pairs", () => {
    const fixed = reconcileMergedSemanticTriple({
      semanticKind: "REQUIRED_DOCUMENT",
      category: "EVALUATION",
      obligationStrength: "MANDATORY",
    });
    assert.equal(fixed.semanticKind, "REQUIRED_DOCUMENT");
    assert.equal(isSemanticKindAlignedWithCategory(fixed.semanticKind, fixed.category), true);
  });

  it("resolveCompatibleCategory maps FINANCIAL domain for documents", () => {
    const cat = resolveCompatibleCategory({
      semanticKind: "REQUIRED_DOCUMENT",
      preferredCategory: "FINANCIAL",
      obligationStrength: "MANDATORY",
    });
    assert.equal(cat, "MANDATORY_ELIGIBILITY");
  });

  it("certification does not fail on valid cross-dimension combinations", () => {
    const base: CertifyAnalysisInput = {
      tenderId: "t-compat",
      packageLabel: "pack",
      snapshot: {
        version: "canonical-analysis-snapshot/v1",
        frozenAt: new Date().toISOString(),
        tenderId: "t-compat",
        package: {
          discoveredFileCount: 1,
          label: "pack",
          files: [
            {
              fileName: "itt.pdf",
              processingStatus: "COMPLETED",
              role: "ITT",
              error: null,
            },
          ],
        },
        metadata: {
          title: "Test",
          client: "Client",
          deadlineIso: null,
          deadlineTimezone: null,
          factsNote: null,
          metadataStatus: "OK",
        },
        requirementIds: ["r1", "r2"],
        counts: {
          totalRequirements: 2,
          verifiedRequirements: 0,
          needsVerification: 2,
          confirmedGaps: 0,
          notApplicable: 0,
        },
      },
      integrity: {
        version: "analysis-integrity/v1",
        partitionValid: true,
        counts: {
          totalRequirements: 2,
          verified: 0,
          needsVerification: 2,
          confirmedGaps: 0,
          notApplicable: 0,
        },
        checksPassed: ["count_partition"],
      },
      guardianOk: true,
      canonicalRequirements: [
        {
          id: "r1",
          requirement: "Bidder must submit technical datasheet for each offered product model.",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          sourceDocument: "itt.pdf",
          sourceSection: "Technical submissions",
          evidenceText: "Bidder must submit technical datasheet for each offered product model.",
        },
        {
          id: "r2",
          requirement: "Bidder must submit audited financial statements for the last three years.",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          sourceDocument: "itt.pdf",
          sourceSection: "Financial documents",
          evidenceText: "Bidder must submit audited financial statements for the last three years.",
        },
      ],
      fitRows: [
        {
          requirementId: "r1",
          fitStatus: "NEEDS_VERIFICATION",
          companyEvidence: null,
          obligationStrength: "MANDATORY",
          semanticKind: "REQUIRED_DOCUMENT",
        },
        {
          requirementId: "r2",
          fitStatus: "NEEDS_VERIFICATION",
          companyEvidence: null,
          obligationStrength: "MANDATORY",
          semanticKind: "REQUIRED_DOCUMENT",
        },
      ],
      risks: [],
      actions: [],
      matrixRequirementIds: ["r1", "r2"],
      decisionRequirementIds: ["r1", "r2"],
      decisionLabel: "REVIEW",
    };
    const result = certifyAnalysis(base);
    assert.ok(result.status === "CERTIFIED" || result.status === "CERTIFIED_WITH_WARNINGS");
    assert.equal(result.failures.length, 0);
  });
});
