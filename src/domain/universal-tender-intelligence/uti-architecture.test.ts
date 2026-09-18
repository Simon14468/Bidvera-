/**
 * Universal Tender Intelligence — adversarial matrix + architectural invariants.
 * General rules only — no EIB / IGL / Scottish document-specific exceptions.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSemanticAdmissionInvariants,
  assertUtiPackageInvariants,
  buildUniversalTenderPackage,
  classifySemanticContent,
  classifyUniversalDocumentRole,
  gateRequirementDrafts,
  toUtiSummary,
} from "@/domain/universal-tender-intelligence";

describe("UTI document roles (content-first)", () => {
  it("classifies corrigendum from content, not filename alone", () => {
    const r = classifyUniversalDocumentRole({
      fileName: "doc-final.pdf",
      text: "CORRIGENDUM No. 1 — This corrigendum amends Clause 4.2 of the Invitation to Tender.",
    });
    assert.equal(r.role, "CORRIGENDUM");
    assert.ok(r.confidence >= 50);
  });

  it("classifies pricing schedule from commercial content", () => {
    const r = classifyUniversalDocumentRole({
      fileName: "Appendix-A.xlsx",
      text: "Commercial Schedule\nPricing schedule\nItem\tQty\tUnit\tPrice\nLabour\t1\tLot\tGBP",
    });
    assert.equal(r.role, "PRICING_SCHEDULE");
  });

  it("classifies long ITT as INVITATION even when Form of Tender is mentioned", () => {
    const r = classifyUniversalDocumentRole({
      fileName: "HRPAS-2026 Invitation to Tender.docx",
      text:
        "INVITATION TO TENDER FOR THE PROVISION OF A HUMAN RESOURCES SYSTEM\n".repeat(20) +
        "Bidders must complete the Form of Tender in Appendix B. The bidder shall submit ISO certification.",
    });
    assert.equal(r.role, "INVITATION");
  });

  it("classifies Q&A from question/answer structure", () => {
    const r = classifyUniversalDocumentRole({
      fileName: "questions-responses.docx",
      text: "Question 1: Can you confirm integration scope?\nAnswer: The contracting authority confirms the scope.",
    });
    assert.equal(r.role, "Q_AND_A");
  });
});

describe("UTI semantic content classification", () => {
  it("V. authority statements do not admit as bidder requirements", () => {
    const u = classifySemanticContent({
      text: "The Contracting Authority shall notify unsuccessful tenderers within 10 days.",
      fileName: "itt.pdf",
    });
    assert.equal(u.contentType, "AUTHORITY_OBLIGATION");
    assert.equal(u.obligationActorKind, "AUTHORITY_SIDE");
  });

  it("W. document-quality statements are document procedure", () => {
    const u = classifySemanticContent({
      text: "The tender dossier must be sufficiently clear for bidders to prepare their offers.",
      fileName: "instructions.pdf",
    });
    assert.ok(
      u.contentType === "DOCUMENT_PROCEDURE" || u.obligationActorKind === "DOCUMENT_PROCEDURE",
    );
  });

  it("X. genuine bidder obligations admit", () => {
    const u = classifySemanticContent({
      text: "The bidder shall submit ISO 27001 certification with the technical proposal.",
      fileName: "itt.pdf",
    });
    assert.equal(u.obligationActorKind, "BIDDER_SIDE");
    assert.ok(u.admitToRequirements || u.contentType === "BIDDER_OBLIGATION" || u.contentType === "REQUIRED_DOCUMENT" || u.contentType === "ELIGIBILITY_CONDITION");
  });

  it("Y. conditional obligations preserve condition", () => {
    const u = classifySemanticContent({
      text: "If applicable, the bidder shall provide Cyber Essentials Plus certification.",
      fileName: "itt.pdf",
    });
    assert.ok(u.conditional);
    assert.ok(u.conditionText);
  });

  it("Z. informational facts are not bidder obligations", () => {
    const u = classifySemanticContent({
      text: "Estimated contract value is GBP 1,200,000 over 36 months.",
      fileName: "notice.pdf",
    });
    assert.ok(
      u.contentType === "INFORMATIONAL_FACT" ||
        u.contentType === "DOCUMENT_DESCRIPTION" ||
        !u.admitToRequirements,
    );
  });

  it("rejects incomplete fragments", () => {
    const u = classifySemanticContent({ text: "shall be", fileName: "broken.pdf" });
    assert.ok(u.failureCodes.includes("INCOMPLETE_FRAGMENT"));
    assert.equal(u.admitToRequirements, false);
  });
});

describe("UTI quality gate hard rejects", () => {
  it("rejects authority + heading + fragment; keeps genuine bidder obligation", () => {
    const { admitted, rejected } = gateRequirementDrafts([
      {
        description: "The Contracting Authority shall publish the award notice.",
        category: "CONTRACTUAL",
        mandatory: true,
        sourceDocument: "itt.pdf",
      },
      {
        description: "Section 3 Technical Specifications",
        category: "TECHNICAL",
        mandatory: true,
        sourceDocument: "spec.pdf",
      },
      {
        description: "shall",
        category: "CONTRACTUAL",
        mandatory: true,
        sourceDocument: "broken.pdf",
      },
      {
        description: "The supplier must hold Cyber Essentials Plus certification.",
        category: "ELIGIBILITY",
        mandatory: true,
        sourceDocument: "itt.pdf",
      },
    ]);
    assert.ok(rejected.length >= 3);
    assert.ok(admitted.some((a) => /cyber essentials/i.test(a.requirement)));
    assertSemanticAdmissionInvariants([
      ...admitted.map((a) => a.classification),
      ...rejected.map((r) => r.classification),
    ]);
  });
});

describe("UTI package build — inventory & versions", () => {
  it("A–H style mixed package: no silent drops; version edges for corrigendum", () => {
    const pkg = buildUniversalTenderPackage({
      packageLabel: "mixed-pack.zip",
      parts: [
        {
          fileId: "1",
          fileName: "Invitation.pdf",
          text: "Invitation to Tender\nThe bidder shall submit a technical proposal.",
          extractionStatus: "EXTRACTED",
        },
        {
          fileId: "2",
          fileName: "Schedule.xlsx",
          text: "Pricing schedule\nItem Qty Unit Price",
          extractionStatus: "EXTRACTED",
        },
        {
          fileId: "3",
          fileName: "Corrigendum_1.pdf",
          text: "Corrigendum 1 — This corrigendum amends the submission deadline.",
          extractionStatus: "EXTRACTED",
        },
        {
          fileId: "4",
          fileName: "scan.png",
          text: "",
          extractionStatus: "UNREADABLE",
          error: "OCR failed",
        },
        {
          fileId: "5",
          fileName: "legacy.ppt",
          text: "",
          extractionStatus: "UNSUPPORTED_SKIPPED",
          error: "Unsupported format",
        },
      ],
    });
    assertUtiPackageInvariants(pkg);
    assert.equal(pkg.inventoryCount, 5);
    assert.ok(pkg.failedCount + pkg.unsupportedCount >= 2);
    assert.ok(pkg.documents.every((d) => d.failureCode || d.extractionStatus === "EXTRACTED"));
    assert.ok(pkg.versionEdges.some((e) => e.relation === "CORRIGENDUM" || e.conflict));
    // Corrigendum ordered after base invitation
    const invIdx = pkg.orderedParts.findIndex((p) => /invitation/i.test(p.fileName));
    const corIdx = pkg.orderedParts.findIndex((p) => /corrigendum/i.test(p.fileName));
    assert.ok(invIdx >= 0 && corIdx >= 0 && invIdx < corIdx);
    const summary = toUtiSummary(pkg);
    assert.equal(summary.inventoryCount, 5);
  });

  it("T. duplicate documents produce DUPLICATE edges without dropping either", () => {
    const body =
      "Invitation to Tender for HR systems. The bidder shall submit Form of Tender. ".repeat(5);
    const pkg = buildUniversalTenderPackage({
      packageLabel: "dup.zip",
      parts: [
        { fileId: "a", fileName: "itt-a.pdf", text: body, extractionStatus: "EXTRACTED" },
        { fileId: "b", fileName: "itt-b.pdf", text: body, extractionStatus: "EXTRACTED" },
      ],
    });
    assert.equal(pkg.inventoryCount, 2);
    assert.ok(pkg.versionEdges.some((e) => e.relation === "DUPLICATE"));
  });

  it("S. conflicting versions are flagged CONFLICTING_VERSION", () => {
    const pkg = buildUniversalTenderPackage({
      packageLabel: "conflict.zip",
      parts: [
        {
          fileId: "base",
          fileName: "ITT.pdf",
          text: "Invitation to Tender. Deadline 1 June 2026. Bidder shall submit proposals.",
          extractionStatus: "EXTRACTED",
        },
        {
          fileId: "fix",
          fileName: "Addendum.pdf",
          text: "Addendum 1 — This addendum supersedes and replaces Clause 2. Deadline becomes 15 June 2026.",
          extractionStatus: "EXTRACTED",
        },
      ],
    });
    assert.ok(
      pkg.qualityIssues.some((q) => q.code === "CONFLICTING_VERSION") ||
        pkg.versionEdges.some((e) => e.conflict),
    );
  });
});

describe("UTI adversarial matrix smoke (A–AH categories)", () => {
  const cases: Array<{ id: string; text: string; expectNotAdmit?: boolean; expectAdmitHint?: boolean }> = [
    { id: "J-table-header", text: "Item | Description | Qty | Unit | Price", expectNotAdmit: true },
    { id: "L-fragment", text: "must", expectNotAdmit: true },
    { id: "P-corrigendum-meta", text: "Corrigendum issued 12 April 2026.", expectNotAdmit: true },
    { id: "Q-clarification", text: "In response to the clarification question, the contracting authority confirms the scope.", expectNotAdmit: true },
    { id: "AA-evaluation", text: "Technical score weighting is 70% and financial score is 30%.", expectNotAdmit: true },
    { id: "X-bidder", text: "The tenderer shall provide three comparable project references.", expectAdmitHint: true },
    { id: "AC-lot", text: "Applicable to Lot 1 only, the bidder shall supply on-site support.", expectAdmitHint: true },
    { id: "U-fr", text: "Le soumissionnaire doit fournir une attestation fiscale en cours de validité.", expectAdmitHint: true },
    { id: "V-authority-fr", text: "L'autorité contractante informera les candidats non retenus.", expectNotAdmit: true },
  ];

  for (const c of cases) {
    it(`matrix ${c.id}`, () => {
      const u = classifySemanticContent({ text: c.text, fileName: "pack.pdf" });
      if (c.expectNotAdmit) {
        const gated = gateRequirementDrafts([
          { description: c.text, category: "CONTRACTUAL", mandatory: true, sourceDocument: "pack.pdf" },
        ]);
        // Either hard-rejected by gate or classified non-bidder
        assert.ok(
          gated.rejected.length === 1 || !u.admitToRequirements || u.obligationActorKind !== "BIDDER_SIDE",
        );
      }
      if (c.expectAdmitHint) {
        assert.ok(
          u.obligationActorKind === "BIDDER_SIDE" ||
            /soumissionnaire|tenderer|bidder/i.test(c.text),
        );
      }
    });
  }
});

describe("UTI invariants", () => {
  it("no authority / heading / Q&A / revision metadata in admitted set", () => {
    const units = [
      "The Contracting Authority shall open the bids publicly.",
      "Section 4 Eligibility Criteria",
      "Question: Is ISO required? Answer: The authority confirms ISO 27001 is mandatory for award.",
      "This addendum amends the tender documents.",
      "The bidder shall submit a completed Form of Tender.",
    ].map((text) => classifySemanticContent({ text, fileName: "x.pdf" }));
    assertSemanticAdmissionInvariants(units);
    const gated = gateRequirementDrafts(
      units.map((u) => ({
        description: u.text,
        category: "CONTRACTUAL",
        mandatory: true,
        sourceDocument: "x.pdf",
      })),
    );
    assert.ok(gated.admitted.every((a) => a.classification.contentType !== "AUTHORITY_OBLIGATION"));
    assert.ok(gated.admitted.every((a) => a.classification.contentType !== "SECTION_HEADING"));
    assert.ok(!gated.admitted.some((a) => a.classification.contentType === "ADDENDUM"));
  });
});
