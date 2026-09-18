/**
 * Adversarial lifecycle / bidder-obligation boundary tests.
 * Universal — no tender-specific names, acronyms-as-rules, or hardcoded phrases
 * beyond generic procurement patterns (any institutional acronym as buyer subject).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretSemanticStatement } from "./interpret";
import { StiApprovedRequirementBatch } from "./sti-seal";
import { buildCanonicalSemanticCandidates } from "./candidates";
import type { SemanticProvenance } from "./types";

const prov: SemanticProvenance = {
  sourceDocument: "pack.pdf",
  sourcePage: 1,
  sourceSection: null,
  sourceCell: null,
  versionLabel: null,
  locator: null,
};

function interp(text: string, ctx?: { documentRole?: string; sectionLabel?: string }) {
  return interpretSemanticStatement({
    text,
    provenance: prov,
    context: ctx
      ? {
          packageDocumentRole: ctx.documentRole ?? null,
          sectionLabel: ctx.sectionLabel ?? null,
        }
      : null,
  });
}

describe("STI lifecycle / bidder obligation boundary", () => {
  it("buyer shall/must/may — institutional acronym subject never admits", () => {
    const samples = [
      "ABCD shall promptly respond to an unsuccessful Offeror who requests a debriefing.",
      "ABCD shall proceed to preliminary examination of the proposals.",
      "ABCD may debrief unsuccessful offerors upon request.",
      "ABCD will not issue formal answers to questions received after the deadline.",
    ];
    for (const text of samples) {
      const s = interp(text);
      assert.equal(s.admitToCanonical, false, text);
      assert.match(
        s.clausePurpose,
        /BUYER_OBLIGATION|PROCEDURAL_RULE|EVALUATION/,
        text,
      );
      assert.match(s.actor, /AUTHORITY|BUYER|PROCURING|EVALUATOR/);
    }
  });

  it("buyer + bidder mentioned in same paragraph — grammatical actor controls", () => {
    const s = interp(
      "The Purchaser shall evaluate the technical proposals and may request clarifications from the Bidder.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(s.clausePurpose, /BUYER_OBLIGATION|PROCEDURAL_RULE|EVALUATION/);
    assert.match(s.actor, /BUYER|AUTHORITY|PROCURING|EVALUATOR/);
  });

  it("bidder procedural obligations remain admissible when bidder is actor", () => {
    const s = interp("Offerors shall notify the Purchaser of any ambiguities in the tender documents.");
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.clausePurpose, "BIDDER_PROCEDURAL");
    assert.equal(s.clauseRole, "BIDDER_PROCEDURAL_REQUIREMENT");
  });

  it("post-award contractor obligations excluded", () => {
    const s = interp("After award, the Contractor shall submit monthly reports.");
    assert.equal(s.admitToCanonical, false);
    assert.match(s.clausePurpose, /POST_AWARD/);
  });

  it("pre-award commitment to post-award capability remains bidder requirement", () => {
    const s = interp(
      "The Bidder shall demonstrate its proposed reporting methodology in the Technical Proposal.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.match(s.actor, /BIDDER|OFFEROR|TENDERER/);
    assert.notEqual(s.clausePurpose, "POST_AWARD_OBLIGATION");
  });

  it("contract forms do not auto-admit contractor performance clauses", () => {
    const s = interp("The Contractor shall maintain insurance throughout the contract period.", {
      documentRole: "CONTRACT_FORM",
    });
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.clausePurpose), /POST_AWARD/);
  });

  it("returnable form submission requirements remain valid", () => {
    const s = interp("The Bidder shall provide three project references in Form X.", {
      documentRole: "RETURNABLE_BIDDING_FORMS",
    });
    assert.equal(s.admitToCanonical, true);
  });

  it("template placeholders and insert-here drafting notes excluded", () => {
    assert.equal(interp("[MAIL, COURIER AND/OR FAX]").admitToCanonical, false);
    assert.equal(interp("Insert bidder name here.").admitToCanonical, false);
    assert.match(
      String(interp("Insert bidder name here.").clausePurpose),
      /TEMPLATE|UNKNOWN|FORM/,
    );
  });

  it("evaluation committee actions excluded", () => {
    const s = interp("The Evaluation Committee shall score each technical proposal.");
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "BUYER_OBLIGATION");
  });

  it("performance after award vs bid security at submission", () => {
    const post = interp(
      "The Supplier shall commence performance within 30 days after contract signature.",
    );
    assert.equal(post.admitToCanonical, false);
    assert.match(String(post.procurementPhase), /POST_AWARD|CONTRACT_PERFORMANCE|CONTRACT_EXECUTION|DELIVERY_IMPLEMENTATION/);

    const bidSec = interp(
      "The Bidder shall provide bid security with the proposal.",
    );
    assert.equal(bidSec.admitToCanonical, true);
  });

  it("passive contractor voice does not become bidder requirement", () => {
    const s = interp(
      "Insurance shall be maintained by the Contractor throughout the contract period.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.actor, "CONTRACTOR");
  });

  it("conditional bidder clause preserves conditionality", () => {
    const s = interp(
      "If the Bidder proposes subcontractors, it shall submit their CVs with the Technical Proposal.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.ok(s.conditionality.conditionText || s.obligationStrength === "CONDITIONAL");
  });

  it("final seal rejects buyer contamination batch", () => {
    const { candidates, rejected } = buildCanonicalSemanticCandidates([
      {
        description:
          "WXYZ shall promptly respond to an unsuccessful Offeror who requests a debriefing.",
        sourceDocument: "itb.pdf",
      },
      {
        description: "The Bidder shall submit a signed Form of Tender with the proposal.",
        sourceDocument: "itb.pdf",
      },
    ]);
    assert.equal(candidates.length, 1);
    assert.ok(rejected.some((r) => r.clausePurpose === "BUYER_OBLIGATION"));
    const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(candidates, "pack");
    assert.equal(sealed.size, 1);
  });
});
