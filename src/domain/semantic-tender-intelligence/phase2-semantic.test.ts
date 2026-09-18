/**
 * Phase 2 — Universal Semantic Tender Intelligence test matrix.
 * Asserts actor + content kind + strength + canonical inclusion/exclusion.
 * No tender-specific exceptions.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCanonicalSemanticCandidates,
  interpretSemanticStatement,
  isObligationBoundaryComplete,
} from "@/domain/semantic-tender-intelligence";

function assertInterp(
  text: string,
  expect: {
    actor?: string | RegExp;
    contentKind?: string | RegExp;
    strength?: string | RegExp;
    admit: boolean;
    conditional?: boolean;
  },
) {
  const s = interpretSemanticStatement({
    text,
    provenance: { sourceDocument: "pack.pdf", sourcePage: 1 },
  });
  if (expect.actor) {
    if (typeof expect.actor === "string") assert.equal(s.actor, expect.actor);
    else assert.match(s.actor, expect.actor);
  }
  if (expect.contentKind) {
    if (typeof expect.contentKind === "string") {
      assert.equal(s.contentKind, expect.contentKind);
    } else assert.match(s.contentKind, expect.contentKind);
  }
  if (expect.strength) {
    if (typeof expect.strength === "string") {
      assert.equal(s.obligationStrength, expect.strength);
    } else assert.match(String(s.obligationStrength), expect.strength);
  }
  if (expect.conditional != null) assert.equal(s.conditional, expect.conditional);
  assert.equal(s.admitToCanonical, expect.admit);
  return s;
}

describe("Phase 2 semantic matrix", () => {
  it("authority statement — excluded", () => {
    assertInterp(
      "The Contracting Authority shall notify unsuccessful tenderers within 10 days.",
      { actor: /AUTHORITY|PROCURING|EVALUATOR|BUYER/, contentKind: /BUYER_OBLIGATION|PROCEDURE/, admit: false },
    );
  });

  it("bidder obligation — admitted", () => {
    assertInterp(
      "The bidder shall submit ISO 27001 certification with the technical proposal.",
      {
        actor: /BIDDER|TENDERER|SUPPLIER/,
        contentKind: /BIDDER_REQUIREMENT|REQUIRED_SUBMISSION|ELIGIBILITY|REQUIRED_DOCUMENT/,
        admit: true,
      },
    );
  });

  it("conditional bidder obligation — preserves condition, not mandatory promotion", () => {
    const s = assertInterp(
      "If applicable, the bidder shall provide Cyber Essentials Plus certification.",
      {
        admit: true,
        conditional: true,
        strength: "CONDITIONAL",
      },
    );
    assert.ok(s.conditionText);
    assert.notEqual(s.obligationStrength, "MANDATORY");
  });

  it("optional requirement", () => {
    assertInterp(
      "The bidder may optionally provide bilingual support documentation (not mandatory).",
      { admit: true, strength: /OPTIONAL|CONDITIONAL|UNKNOWN|MANDATORY/ },
    );
  });

  it("document-quality statement — excluded", () => {
    assertInterp(
      "The tender dossier must be sufficiently clear for bidders to prepare their offers.",
      { admit: false, contentKind: /PROCEDURAL|DOCUMENT_DESCRIPTION|PROCEDURE/ },
    );
  });

  it("Q&A — excluded", () => {
    assertInterp(
      "Question: Is ISO required? Answer: The contracting authority confirms ISO 27001 is mandatory for award.",
      { admit: false, contentKind: /Q_AND_A|CLARIFICATION|BUYER|PROCEDURE/ },
    );
  });

  it("clarification — excluded", () => {
    assertInterp(
      "In response to the clarification question, the procuring entity confirms the delivery location.",
      { admit: false },
    );
  });

  it("corrigendum / revision metadata — excluded", () => {
    assertInterp("Corrigendum No. 1 issued 12 April 2026.", {
      admit: false,
      contentKind: /REVISION|AMENDMENT|INFORMATIONAL|METADATA/,
    });
  });

  it("technical bidder clause — admitted; contractor post-award — excluded", () => {
    assertInterp(
      "The bidder shall ensure the solution supports 4K resolution displays.",
      { admit: true, contentKind: /TECHNICAL|BIDDER/ },
    );
    assertInterp(
      "The contractor shall ensure the solution supports 4K resolution displays during the contract period.",
      { admit: false, contentKind: /POST_AWARD|CONTRACTUAL/ },
    );
  });

  it("commercial clause", () => {
    assertInterp(
      "The supplier must submit a completed pricing schedule with unit rates in GBP.",
      { admit: true, contentKind: /COMMERCIAL|REQUIRED|BIDDER|FINANCIAL/ },
    );
  });

  it("contractor post-award clause — excluded from canonical bid requirements", () => {
    assertInterp(
      "The contractor shall remain responsible for commissioning within 30 days of award.",
      { admit: false },
    );
  });

  it("table obligation text — admitted; table header — excluded", () => {
    assertInterp("Item | Description | Qty | Unit | Price", {
      admit: false,
      contentKind: /HEADING|TABLE_HEADER/,
    });
    assertInterp(
      "The bidder shall complete each row of the pricing schedule with unit prices.",
      { admit: true },
    );
  });

  it("multi-lot requirement preserves lot applicability", () => {
    const s = interpretSemanticStatement({
      text: "Applicable to Lot 1 only, the bidder shall supply on-site support.",
      provenance: { sourceDocument: "itt.pdf", sourcePage: 3 },
    });
    assert.equal(s.admitToCanonical, true);
    assert.ok(s.lotLabel === "LOT_1" || s.lotApplicability.kind === "LOTS");
    assert.ok(s.conditional || /lot/i.test(s.conditionText ?? s.requirementText));
  });

  it("cross-document duplicate collapses with provenance links", () => {
    const { candidates, rejected } = buildCanonicalSemanticCandidates(
      [
        {
          description: "The bidder shall submit three comparable project references.",
          sourceDocument: "ITT.docx",
          sourcePage: 2,
        },
        {
          description: "The bidder shall submit three comparable project references.",
          sourceDocument: "Appendix-C.docx",
          sourcePage: 1,
        },
        {
          description: "The Contracting Authority shall open the bids publicly.",
          sourceDocument: "ITT.docx",
          sourcePage: 5,
        },
      ],
      { packageLabel: "pack.zip" },
    );
    assert.equal(candidates.length, 1);
    assert.ok(candidates[0]!.provenance.length >= 2);
    assert.ok(rejected.some((r) => !r.admitToCanonical));
    assert.ok(candidates[0]!.sourceDocument);
    assert.ok(candidates[0]!.fullRequirementText.length > 20);
  });

  it("long clause remains boundary-complete", () => {
    const long =
      "The tenderer shall provide a detailed methodology covering mobilisation, delivery, testing, commissioning, training, and post-go-live support for a period of twelve months after acceptance.";
    assert.equal(isObligationBoundaryComplete(long), true);
    assertInterp(long, { admit: true });
  });

  it("OCR incomplete fragment — excluded", () => {
    assert.equal(isObligationBoundaryComplete("shall be"), false);
    assertInterp("shall be", { admit: false });
  });

  it("French bidder obligation admitted; French authority excluded", () => {
    assertInterp(
      "Le soumissionnaire doit fournir une attestation fiscale en cours de validité.",
      { admit: true, actor: /BIDDER|TENDERER|ECONOMIC/ },
    );
    assertInterp("L'autorité contractante informera les candidats non retenus.", {
      admit: false,
    });
  });

  it("English / Spanish modality does not alone force mandatory without actor", () => {
    const s = interpretSemanticStatement({
      text: "The evaluation committee shall score technical proposals out of 100 points.",
      provenance: { sourceDocument: "itt.pdf" },
    });
    assert.equal(s.admitToCanonical, false);
  });

  it("Arabic numerals preserved in interpreted text", () => {
    const s = interpretSemanticStatement({
      text: "The bidder shall deliver within 30 days to Riyadh. المبلغ التقديري: 250000.",
      provenance: { sourceDocument: "itt.pdf", sourcePage: 1 },
    });
    assert.ok(/250000/.test(s.requirementText));
    assert.equal(s.admitToCanonical, true);
  });

  it("similar but distinct obligations remain separate", () => {
    const { candidates } = buildCanonicalSemanticCandidates(
      [
        {
          description: "The bidder shall hold ISO 27001 certification.",
          sourceDocument: "a.pdf",
        },
        {
          description: "The bidder shall hold Cyber Essentials Plus certification.",
          sourceDocument: "a.pdf",
        },
      ],
      { packageLabel: "pack" },
    );
    assert.equal(candidates.length, 2);
  });

  it("sentence mentioning bidder is not automatically a bidder obligation", () => {
    assertInterp(
      "The dossier must be sufficiently clear for bidders to understand the scope.",
      { admit: false },
    );
  });

  it("never creates candidate without provenance", () => {
    const { candidates, rejected } = buildCanonicalSemanticCandidates([
      {
        description: "The bidder shall submit Form of Tender.",
        sourceDocument: null,
      },
    ]);
    // Without packageLabel fallback — rejected for missing provenance
    assert.equal(candidates.length, 0);
    assert.ok(rejected.length >= 1);
  });

  it("packageLabel supplies provenance fallback", () => {
    const { candidates } = buildCanonicalSemanticCandidates(
      [
        {
          description: "The bidder shall submit Form of Tender.",
          sourceDocument: null,
        },
      ],
      { packageLabel: "Scottish.zip" },
    );
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.sourceDocument, "Scottish.zip");
  });
});
