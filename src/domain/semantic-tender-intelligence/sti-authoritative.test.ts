/**
 * Semantic Tender Intelligence — authoritative interpretation matrix.
 * Covers actor / phase / template / conditionality / entry-gate cases.
 * Generic patterns only — no buyer-specific exceptions.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCanonicalSemanticCandidates,
  detectTemplateStatus,
  interpretSemanticStatement,
} from "@/domain/semantic-tender-intelligence";

function interp(
  text: string,
  ctx?: { documentRole?: string; sourceDocument?: string },
) {
  return interpretSemanticStatement({
    text,
    provenance: {
      sourceDocument: ctx?.sourceDocument ?? "pack.pdf",
      sourcePage: 1,
      sourceSection: null,
    },
    context: ctx?.documentRole
      ? { packageDocumentRole: ctx.documentRole }
      : undefined,
  });
}

describe("STI authoritative interpretation matrix", () => {
  it("A. Bidder requirement — admitted", () => {
    const s = interp(
      "The Bidder shall submit audited financial statements for the last three years.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.match(s.actor, /BIDDER|TENDERER/);
    assert.match(s.clauseRole, /BIDDER_REQUIREMENT|REQUIRED|ELIGIBILITY|FINANCIAL/);
    assert.equal(s.bidderRelevant, true);
  });

  it("B. Buyer obligation — never canonical", () => {
    const s = interp("UNOPS shall evaluate the bids in accordance with the ITB.");
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clauseRole, "BUYER_OBLIGATION");
    assert.equal(s.exclusionCode, "EXCLUDED_BUYER_OBLIGATION");
  });

  it("C. Contractor post-award obligation — excluded", () => {
    const s = interp(
      "The Contractor shall provide monthly reports during the contract period.",
      { documentRole: "SAMPLE_CONTRACT" },
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.actor, "CONTRACTOR");
    assert.match(
      String(s.exclusionCode),
      /EXCLUDED_POST_AWARD|NOT_BIDDER/,
    );
  });

  it("D. Bidder award-stage obligation — classified AWARD, may admit", () => {
    const s = interp(
      "The successful bidder shall provide performance security within 10 days of award.",
    );
    assert.equal(s.procurementPhase, "AWARD");
    assert.equal(s.clauseRole, "AWARD_STAGE_OBLIGATION");
    assert.equal(s.admitToCanonical, true);
  });

  it("E. Template placeholder — never canonical", () => {
    const s = interp(
      "The Contractor shall commence performance not later than [insert date].",
      { documentRole: "CONTRACT_FORM" },
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.templateStatus !== "NOT_TEMPLATE", true);
    assert.equal(s.exclusionCode, "EXCLUDED_TEMPLATE");
  });

  it("F. Template note — never canonical", () => {
    const s = interp("[Note to be deleted] Insert the delivery schedule here.");
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clauseRole, "TEMPLATE_INSTRUCTION");
    assert.equal(s.exclusionCode, "EXCLUDED_TEMPLATE");
  });

  it("G. Conditional requirement — condition preserved, admitted", () => {
    const s = interp(
      "If the bidder proposes subcontractors, the bidder shall submit their CVs with the proposal.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.conditional, true);
    assert.ok(s.conditionText);
    assert.equal(s.applicability, "CONDITIONAL");
  });

  it("H. Unresolved conditional — NEEDS_VERIFICATION, not forced canonical", () => {
    const s = interp(
      "If a clarification meeting is mandatory, the bidder shall attend the meeting.",
    );
    assert.equal(s.applicability, "NEEDS_VERIFICATION");
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.exclusionCode, "AMBIGUOUS_APPLICABILITY");
  });

  it("I. Bidder procedural clarification request — admissible as BIDDER_PROCEDURAL", () => {
    const s = interp("The Bidder may request clarification in writing before the deadline.");
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.clauseRole, "BIDDER_PROCEDURAL_REQUIREMENT");
  });

  it("I2. Buyer / e-sourcing procedural — excluded", () => {
    const s = interp("Click here to upload files via the electronic tendering system.");
    assert.equal(s.admitToCanonical, false);
    assert.match(s.clauseRole, /PROCEDURAL/);
  });

  it("J. Legal reservation — excluded", () => {
    const s = interp(
      "Nothing in this undertaking shall constitute or be deemed to constitute a waiver of any privileges and immunities.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clauseRole, "LEGAL_RESERVATION");
  });

  it("K. Heading — excluded", () => {
    const s = interp("3.2 Technical Specifications");
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clauseRole, "HEADING");
  });

  it("L. Informational fact — excluded", () => {
    const s = interp(
      "This tender concerns the supply of motor vehicles for project operations.",
    );
    assert.equal(s.admitToCanonical, false);
  });

  it("M. Q&A — excluded", () => {
    const s = interp(
      "Question 4: Is ISO required? Answer: Yes, the contracting authority confirms ISO is required.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clauseRole, "Q_AND_A");
  });

  it("N. Amendment metadata — excluded", () => {
    const s = interp("Addendum No. 2 amends Section II of the bidding documents.");
    assert.equal(s.admitToCanonical, false);
    assert.match(s.clauseRole, /AMENDMENT|REVISION/);
  });

  it("O. Table requirement cell — admitted", () => {
    const s = interp(
      "The bidder shall complete the quantity and unit price columns for each line item in Schedule A.",
    );
    assert.equal(s.admitToCanonical, true);
  });

  it("P. Table heading — excluded", () => {
    const s = interp("Item | Description | Qty | Unit | Amount");
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clauseRole, "HEADING");
  });

  it("Q. Multi-paragraph requirement boundary", () => {
    const s = interp(
      "Where the bidder relies on a parent company, the bidder shall submit a parent-company guarantee covering the full scope of the works together with evidence of the parent's financial capacity.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.boundaryComplete, true);
    assert.ok(s.conditional);
  });

  it("R. Continuation across fragmented OCR — incomplete excluded", () => {
    const s = interp("shall be");
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.boundaryComplete, false);
  });

  it("S. Mixed actor clause — buyer side wins exclusion", () => {
    const s = interp(
      "The Purchaser shall evaluate bids and the bidder shall await the award decision.",
    );
    // Dominant authority subject → buyer obligation path
    assert.equal(s.admitToCanonical, false);
  });

  it("T. Ambiguous actor — not forced canonical", () => {
    const s = interp("Insurance shall be maintained throughout the period of performance.");
    assert.equal(s.admitToCanonical, false);
    assert.match(
      String(s.exclusionCode),
      /AMBIGUOUS_ACTOR|AMBIGUOUS_PHASE|NOT_BIDDER|EXCLUDED_POST_AWARD|NOT_ADMITTED/,
    );
  });

  it("U. Ambiguous phase for contractor-like duty without bidder subject", () => {
    const s = interp(
      "Monthly progress reports shall be submitted to the Employer.",
      { documentRole: "SAMPLE_CONTRACT" },
    );
    assert.equal(s.admitToCanonical, false);
  });

  it("V. Required document — admitted", () => {
    const s = interp(
      "The tenderer shall submit a completed Form of Tender with the bid.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.match(s.clauseRole, /REQUIRED|BIDDER/);
  });

  it("W. Evaluation criterion — excluded from requirements", () => {
    const s = interp(
      "Technical proposals will be scored out of 70 points based on methodology and experience.",
    );
    assert.equal(s.admitToCanonical, false);
  });

  it("X. Metadata extraction is not a requirement", () => {
    const s = interp("Submission deadline: 15 May 2026 at 10:00 local time.");
    assert.equal(s.admitToCanonical, false);
    assert.match(s.clauseRole, /METADATA|INFORMATIONAL|HEADING|UNKNOWN/);
  });
});

describe("STI template structural detection", () => {
  it("detects insert placeholders and notes", () => {
    assert.notEqual(detectTemplateStatus("Start on [insert date]").status, "NOT_TEMPLATE");
    assert.equal(
      detectTemplateStatus("[Note to be deleted] Remove before issue.").status,
      "TEMPLATE_INSTRUCTION",
    );
  });
});

describe("STI regression patterns (generic IFI / multi-file packs)", () => {
  const cases: Array<{ label: string; text: string; admit: boolean }> = [
    {
      label: "UNOPS-style buyer",
      text: "The Purchaser shall open the bids at the time stated in the BDS.",
      admit: false,
    },
    {
      label: "UNOPS-style template",
      text: "The Contractor shall commence not later than [insert date].",
      admit: false,
    },
    {
      label: "UNOPS-style note",
      text: "[Note to be deleted] Drafting note for ITB Section IV.",
      admit: false,
    },
    {
      label: "Philippines schedule bidder",
      text: "The bidder shall comply with the technical specifications in Section II Schedule of Requirements.",
      admit: true,
    },
    {
      label: "Indonesia consultancy bidder",
      text: "The Consultant (bidder) shall submit a technical proposal covering the methodology.",
      admit: true,
    },
    {
      label: "AfDB cybersecurity bidder",
      text: "The bidder shall demonstrate ISO 27001 certification for the proposed SOC services.",
      admit: true,
    },
    {
      label: "Scottish authority",
      text: "The Authority shall notify suppliers of the outcome of the evaluation.",
      admit: false,
    },
    {
      label: "EIB financing institution",
      text: "The European Investment Bank shall not be responsible for the content of the tender dossier.",
      admit: false,
    },
    {
      label: "IGL multi-file bidder",
      text: "The tenderer shall submit three project references comparable in scope.",
      admit: true,
    },
    {
      label: "Kenya IP phones bidder",
      text: "The bidder shall supply IP phones conforming to the annexed technical sheet.",
      admit: true,
    },
    {
      label: "Kenya offline backup bidder",
      text: "The bidder shall provide offline backup storage with verified restore capability.",
      admit: true,
    },
    {
      label: "WHO SIDS buyer procedure",
      text: "WHO shall conduct the technical evaluation in accordance with the published criteria.",
      admit: false,
    },
    {
      label: "heading pollution",
      text: "4.1 Eligibility Requirements",
      admit: false,
    },
    {
      label: "post-award insurance",
      text: "The Contractor shall maintain insurance throughout the contract.",
      admit: false,
    },
  ];

  for (const c of cases) {
    it(`${c.label}`, () => {
      const s = interp(c.text);
      assert.equal(
        s.admitToCanonical,
        c.admit,
        `${c.label}: expected admit=${c.admit}, got ${s.admitToCanonical} (${s.exclusionReason})`,
      );
    });
  }

  it("canonical count is cleaner than raw shall-harvest", () => {
    const drafts = [
      "The Bidder shall submit audited accounts.",
      "The Purchaser shall open the bids.",
      "The Contractor shall maintain insurance throughout the contract.",
      "[insert date]",
      "[Note to be deleted]",
      "4.1 Eligibility",
      "Question: Is ISO required? Answer: The authority confirms yes.",
      "The bidder shall provide Cyber Essentials Plus if applicable.",
    ].map((description) => ({ description, sourceDocument: "pack.pdf" }));

    const { candidates, rejected } = buildCanonicalSemanticCandidates(drafts);
    assert.ok(candidates.length <= 3);
    assert.ok(rejected.length >= 5);
    assert.ok(candidates.every((c) => c.sourceDocument));
    assert.ok(
      candidates.every((c) =>
        /bidder|tenderer|supplier/i.test(c.fullRequirementText),
      ),
    );
  });
});
