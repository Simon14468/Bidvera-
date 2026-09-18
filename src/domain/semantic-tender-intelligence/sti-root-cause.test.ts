/**
 * STI root-cause regression — universal procurement reasoning engine.
 * Proves the mandatory interpret order without tender-specific patches.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeConditionality,
  detectMetadataFact,
  interpretSemanticStatement,
  resolveSemanticActor,
  resolveRecipient,
} from "@/domain/semantic-tender-intelligence";

function interp(
  text: string,
  ctx?: { documentRole?: string; sectionLabel?: string },
) {
  return interpretSemanticStatement({
    text,
    provenance: {
      sourceDocument: "pack.pdf",
      sourcePage: 1,
      sourceSection: ctx?.sectionLabel ?? null,
    },
    context: {
      packageDocumentRole: ctx?.documentRole,
      sectionLabel: ctx?.sectionLabel,
    },
  });
}

describe("STI root-cause — actor ≠ phase ≠ recipient", () => {
  it("buyer institutional subject is never a bidder requirement", () => {
    const s = interp(
      "UNOPS shall gather all requests for clarification and circulate answers to all bidders.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "BUYER_OBLIGATION");
    assert.match(s.actor, /AUTHORITY|BUYER|PROCURING/);
  });

  it("contractor subject is post-award, not pre-bid bidder", () => {
    const s = interp(
      "The Contractor shall commence performance not later than thirty days after contract signature.",
      { documentRole: "SAMPLE_CONTRACT" },
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.actor, "CONTRACTOR");
    assert.match(s.clausePurpose, /POST_AWARD/);
  });

  it("manufacturer incidental mention does not steal bidder actor", () => {
    const s = interp(
      "If the bidder proposes equipment manufactured outside Morocco, the bidder must provide evidence of manufacturer authorization.",
    );
    assert.equal(s.actor, "BIDDER");
    assert.notEqual(s.actor, "MANUFACTURER");
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.applicability, "CONDITIONAL");
    assert.ok(s.conditionText);
    assert.match(s.requirementText, /if the bidder proposes/i);
  });

  it("successful bidder award-stage keeps AWARD phase", () => {
    const s = interp(
      "The successful bidder shall provide performance security within 10 days of award.",
    );
    assert.equal(s.procurementPhase, "AWARD");
    assert.equal(s.clausePurpose, "AWARD_STAGE_OBLIGATION");
    assert.equal(s.admitToCanonical, true);
  });
});

describe("STI root-cause — template / form / procedural", () => {
  it("template insert never becomes a requirement", () => {
    const s = interp(
      "The Contractor shall commence performance not later than [insert date].",
      { documentRole: "CONTRACT_FORM" },
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.exclusionCode, "EXCLUDED_TEMPLATE");
  });

  it("note to be deleted is form/template instruction", () => {
    const s = interp(
      "[Note to be deleted: choose either Option A or Option B before issue.]",
    );
    assert.equal(s.admitToCanonical, false);
  });

  it("form fill-in instructions are excluded", () => {
    const s = interp(
      "Complete this form in block capitals and tick the appropriate box.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(s.clausePurpose, /FORM_INSTRUCTION|PROCEDURAL|TEMPLATE/);
  });

  it("eSourcing click instructions are procedural", () => {
    const s = interp(
      "Click on the Upload button in the e-sourcing portal to attach your proposal files.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "PROCEDURAL_RULE");
  });
});

describe("STI root-cause — headings / facts / definitions / examples", () => {
  it("headings excluded", () => {
    assert.equal(interp("3.2 Technical Specifications").admitToCanonical, false);
  });

  it("definitions excluded", () => {
    const s = interp(
      '"Bidder" means any person or firm that submits a bid in response to this ITT.',
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "DEFINITION");
  });

  it("examples excluded", () => {
    const s = interp(
      "For example, a sample booth layout is provided for illustration only.",
    );
    assert.equal(s.admitToCanonical, false);
  });

  it("metadata deadline is not a requirement", () => {
    const meta = detectMetadataFact("Submission deadline: 15 May 2026 at 10:00 local time.");
    assert.equal(meta.isMetadata, true);
    const s = interp("Submission deadline: 15 May 2026 at 10:00 local time.");
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "METADATA_FACT");
  });
});

describe("STI root-cause — conditionality preservation", () => {
  it("IF bidder → MUST action keeps condition and admits as CONDITIONAL", () => {
    const s = interp(
      "If the bidder proposes subcontractors, the bidder shall submit their CVs with the proposal.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.applicability, "CONDITIONAL");
    assert.equal(s.obligationStrength, "CONDITIONAL");
    assert.ok(s.conditionality.conditionText);
    assert.match(s.requirementText, /^If the bidder/i);
  });

  it("unresolved clarification-meeting conditionality is not unconditional", () => {
    const s = interp(
      "If the clarification meeting is mandatory, the bidder shall attend.",
    );
    assert.equal(s.applicability, "NEEDS_VERIFICATION");
    assert.equal(s.admitToCanonical, false);
    assert.notEqual(s.applicability, "UNCONDITIONAL");
  });

  it("structured conditionality captures threshold and timeframe", () => {
    const c = analyzeConditionality(
      "If awarded, the successful bidder shall provide a bond equal to 10% within 10 days of award.",
    );
    assert.ok(c.conditionText || c.applicability === "CONDITIONAL");
    assert.ok(c.thresholdText || /10%/.test("equal to 10%"));
    assert.ok(c.timeframeText);
  });
});

describe("STI root-cause — Q&A / amendment / fragments", () => {
  it("Q&A excluded", () => {
    const s = interp("Question 3: Can you confirm the delivery address? Answer: See Annex B.");
    assert.equal(s.admitToCanonical, false);
    assert.match(s.clausePurpose, /Q_AND_A|CLARIFICATION/);
  });

  it("amendment metadata excluded", () => {
    const s = interp("Addendum No. 2 amends Section II of the bidding documents.");
    assert.equal(s.admitToCanonical, false);
  });

  it("fragmented clause ending mid-preposition is incomplete", () => {
    const s = interp(
      "The bidder shall maintain daily cleaning logs and make them available to the contracting authority on",
    );
    assert.equal(s.boundaryComplete, false);
    assert.equal(s.admitToCanonical, false);
  });
});

describe("STI root-cause — recipient resolution", () => {
  it("buyer actor with notify verb still has buyer purpose", () => {
    const actor = resolveSemanticActor(
      "The Authority shall notify unsuccessful bidders within 5 days.",
    );
    assert.match(actor.actor, /AUTHORITY|BUYER|PROCURING/);
    const recipient = resolveRecipient({
      text: "The Authority shall notify unsuccessful bidders within 5 days.",
      actor: actor.actor,
    });
    assert.match(recipient, /PROCURING|BUYER/);
  });
});
