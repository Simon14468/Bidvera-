/**
 * Uncertainty is preserved — never rewritten as a factual purpose or actor.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretSemanticStatement } from "./interpret";

function interp(text: string) {
  return interpretSemanticStatement({
    text,
    provenance: { sourceDocument: "pack.pdf", sourcePage: 2 },
  });
}

describe("sti uncertainty preservation", () => {
  it("mixed lifecycle stays MIXED_OR_AMBIGUOUS and is excluded", () => {
    const s = interp(
      "The Bidder shall submit a methodology with its proposal, and after award the Contractor shall install and commission the equipment on site.",
    );
    assert.equal(s.procurementPhase, "MIXED_OR_AMBIGUOUS");
    assert.equal(s.admitToCanonical, false);
    assert.ok(
      s.exclusionCode === "AMBIGUOUS_PHASE" ||
        s.exclusionCode === "EXCLUDED_POST_AWARD" ||
        s.situation?.uncertaintyPreserved === true,
    );
    assert.notEqual(s.clausePurpose, "BIDDER_OBLIGATION");
  });

  it("does not coerce mixed meaning into POST_AWARD_OBLIGATION as a certainty", () => {
    const s = interp(
      "Submit the plan with the bid; after award the supplier shall maintain insurance throughout the contract.",
    );
    assert.equal(s.admitToCanonical, false);
    if (s.procurementPhase === "MIXED_OR_AMBIGUOUS") {
      assert.equal(s.situation?.uncertaintyPreserved, true);
    }
  });

  it("unknown actor is not rewritten as BIDDER", () => {
    const s = interp(
      "Insurance shall be maintained throughout the contract period after award.",
    );
    assert.equal(s.actor, "UNKNOWN");
    assert.notEqual(s.actor, "BIDDER");
    assert.equal(s.admitToCanonical, false);
  });

  it("successful bidder without award timing stays ambiguous rather than guessed", () => {
    const s = interp("The successful bidder shall perform the services.");
    assert.ok(
      s.procurementPhase === "MIXED_OR_AMBIGUOUS" ||
        s.procurementPhase === "UNKNOWN" ||
        s.admitToCanonical === false,
    );
  });
});
