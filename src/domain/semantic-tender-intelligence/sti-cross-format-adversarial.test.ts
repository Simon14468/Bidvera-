/**
 * Adversarial + cross-format unseen procurement patterns.
 * Same semantic clause must receive the same interpretation regardless of
 * file wrapper, layout label, or document combination.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretSemanticStatement } from "./interpret";
import { buildCanonicalSemanticCandidates } from "./candidates";
import { StiApprovedRequirementBatch } from "./sti-seal";
import { buildCanonicalRequirements } from "@/domain/tender-requirements/canonical-extraction";

const FORMATS = [
  "itb.pdf",
  "itb.docx",
  "schedule.xlsx",
  "boq.csv",
  "brief.pptx",
  "notes.txt",
  "scan.ocr.pdf",
  "archive-member.pdf",
];

function interp(
  text: string,
  fileName: string,
  extra?: { documentRole?: string; sectionLabel?: string; columnHeader?: string },
) {
  return interpretSemanticStatement({
    text,
    provenance: {
      sourceDocument: fileName,
      sourcePage: 1,
      sourceSection: extra?.sectionLabel ?? null,
      sourceCell: extra?.columnHeader ?? null,
    },
    context: {
      packageDocumentRole: extra?.documentRole ?? null,
      sectionLabel: extra?.sectionLabel ?? null,
      table: extra?.columnHeader
        ? {
            isTableHeader: false,
            columnHeader: extra.columnHeader,
            rowLabel: null,
            unit: null,
            threshold: null,
            lotNumber: null,
            conditionInCell: null,
            sourceLocation: extra.columnHeader,
          }
        : null,
    },
  });
}

describe("cross-format semantic invariance", () => {
  it("same clause interprets identically across wrappers and layouts", () => {
    const clause = "The Bidder shall submit a signed Form of Tender with the proposal.";
    const layouts = [
      { documentRole: "INSTRUCTIONS_TO_BIDDERS", sectionLabel: "Submission" },
      { documentRole: "TECHNICAL_SPECIFICATION", sectionLabel: "Technical Requirements" },
      { documentRole: "FINANCIAL_FORMS", sectionLabel: "Price Schedule" },
      { documentRole: "ANNEX", sectionLabel: "Appendix B" },
      { columnHeader: "Requirement" },
    ];
    const baseline = interp(clause, "itb.pdf");
    for (const file of FORMATS) {
      const s = interp(clause, file);
      assert.equal(s.admitToCanonical, baseline.admitToCanonical, file);
      assert.equal(s.actor, baseline.actor, file);
      assert.equal(s.procurementPhase, baseline.procurementPhase, file);
      assert.equal(s.clausePurpose, baseline.clausePurpose, file);
    }
    for (const layout of layouts) {
      const s = interp(clause, "itb.pdf", layout);
      assert.equal(s.admitToCanonical, baseline.admitToCanonical, JSON.stringify(layout));
      assert.equal(s.actor, baseline.actor, JSON.stringify(layout));
    }
  });

  it("post-award execution stays excluded across formats", () => {
    const clause = "The Supplier shall install and commission the equipment after delivery.";
    for (const file of FORMATS) {
      const s = interp(clause, file, { documentRole: "TECHNICAL_SPECIFICATION" });
      assert.equal(s.admitToCanonical, false, file);
      assert.equal(s.clausePurpose, "POST_AWARD_OBLIGATION", file);
    }
  });
});

describe("adversarial unseen procurement patterns", () => {
  it("morphology / language-adjacent bidder duty still admits", () => {
    const samples = [
      "The tenderer shall lodge the bid security together with its offer.",
      "The economic operator shall furnish evidence of turnover with the tender.",
      "The offeror shall attach three references as part of the proposal.",
    ];
    for (const text of samples) {
      const s = interp(text, "dossier.pdf");
      assert.equal(s.admitToCanonical, true, text);
      assert.match(s.actor, /BIDDER|TENDERER|OFFEROR|ECONOMIC_OPERATOR/);
    }
  });

  it("unseen buyer acronym subject never admits", () => {
    const s = interp(
      "ZQTM shall circulate answers to all offerors after the clarification deadline.",
      "itb.docx",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(s.clausePurpose, /BUYER_OBLIGATION|PROCEDURAL_RULE|EVALUATION/);
  });

  it("passive performer voice is not a bidder requirement", () => {
    const s = interp(
      "Monthly progress reports shall be submitted by the Contractor during implementation.",
      "contract.pdf",
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.actor, "CONTRACTOR");
  });

  it("table header tokens never admit regardless of worksheet name", () => {
    const header = interp("Description\tQty\tUnit\tMandatory", "boq.xlsx", {
      documentRole: "SCHEDULE_OF_REQUIREMENTS",
      columnHeader: "Requirement",
    });
    assert.equal(header.admitToCanonical, false);
  });

  it("clarification Q/A shape remains excluded while neighboring restated duties can admit", () => {
    const qa = interp("Question 4: delivery period? Answer: within 60 days after award.", "qa.pdf", {
      documentRole: "Q_AND_A",
    });
    assert.equal(qa.admitToCanonical, false);
    const restated = interp(
      "The Bidder shall submit the price schedule with its bid.",
      "qa.pdf",
      { documentRole: "Q_AND_A" },
    );
    assert.equal(restated.admitToCanonical, true);
  });
});

describe("multi-document package + conflicting sources", () => {
  it("keeps bidder duties, drops execution/buyer/qa, merges identity across files", () => {
    const { candidates, rejected } = buildCanonicalSemanticCandidates(
      [
        {
          description: "Section 2 — Required Documents",
          sourceDocument: "01_ITB.pdf",
          packageDocumentRole: "INSTRUCTIONS_TO_BIDDERS",
        },
        {
          description: "The Bidder shall submit Form of Tender with the proposal.",
          sourceDocument: "01_ITB.pdf",
          packageDocumentRole: "INSTRUCTIONS_TO_BIDDERS",
        },
        {
          description: "The Bidder shall submit Form of Tender with the proposal.",
          sourceDocument: "05_Forms.docx",
          packageDocumentRole: "RETURNABLE_BIDDING_FORMS",
        },
        {
          description: "The Contractor shall mobilize within 14 days after contract signature.",
          sourceDocument: "07_GCC.pdf",
          packageDocumentRole: "TERMS_AND_CONDITIONS",
        },
        {
          description: "The Purchaser shall open the financial envelopes after technical evaluation.",
          sourceDocument: "01_ITB.pdf",
          packageDocumentRole: "INSTRUCTIONS_TO_BIDDERS",
        },
        {
          description: "Question: bond amount? Answer: 2 percent of the offer.",
          sourceDocument: "09_QA.txt",
          packageDocumentRole: "Q_AND_A",
        },
        {
          description:
            "This addendum supersedes Clause 8. Conflicting versions shall be reviewed.",
          sourceDocument: "10_Addendum.pdf",
          packageDocumentRole: "AMENDMENT",
        },
      ],
      { packageLabel: "unseen-pack.zip" },
    );

    const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(
      candidates,
      "unseen-pack.zip",
    );
    const canonical = buildCanonicalRequirements({ stiApproved: sealed });

    assert.ok(canonical.length >= 1);
    assert.ok(canonical.some((r) => /form of tender/i.test(r.requirement)));
    assert.ok(!canonical.some((r) => /mobilize within 14 days/i.test(r.requirement)));
    assert.ok(!canonical.some((r) => /Purchaser shall open/i.test(r.requirement)));
    assert.ok(!canonical.some((r) => /Question:/i.test(r.requirement)));
    assert.ok(
      rejected.some(
        (r) =>
          r.clausePurpose === "POST_AWARD_OBLIGATION" ||
          r.clausePurpose === "BUYER_OBLIGATION" ||
          r.clausePurpose === "Q_AND_A" ||
          r.clausePurpose === "AMENDMENT" ||
          r.clausePurpose === "HEADING",
      ),
    );

    const formHits = canonical.filter((r) => /form of tender/i.test(r.requirement));
    assert.equal(formHits.length, 1);
    assert.ok((formHits[0]!.sourceDocuments?.length ?? 1) >= 1);
  });
});
