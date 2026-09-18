/**
 * Cooperative signal admission — lexical cues cannot admit alone.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretSemanticStatement } from "./interpret";
import { extractIndependentSignals } from "./semantic-signals";

function interp(text: string) {
  return interpretSemanticStatement({
    text,
    provenance: { sourceDocument: "pack.pdf", sourcePage: 1 },
  });
}

describe("sti signal cooperation", () => {
  it("shall/must alone never admits a heading or fragment", () => {
    const s = interp("Shall must required.");
    assert.equal(s.admitToCanonical, false);
  });

  it("filename-like packaging is lexical_weak and cannot admit alone", () => {
    const s = extractIndependentSignals({
      text: "Overview of the procurement process.",
      actor: "UNKNOWN",
      recipient: "UNKNOWN",
      documentRole: "INSTRUCTIONS_TO_BIDDERS",
      sectionRole: "BIDDER_INSTRUCTIONS",
      templateStatus: "NOT_TEMPLATE",
    });
    assert.equal(s.documentRole.evidenceClass, "lexical_weak");
    assert.equal(s.sectionRole.evidenceClass, "lexical_weak");
    assert.equal(s.documentRole.strength, "WEAK");
  });

  it("column title alone does not admit a table header", () => {
    const s = interpretSemanticStatement({
      text: "Mandatory | Description | Qty",
      provenance: { sourceDocument: "boq.xlsx", sourceCell: "A1" },
      context: {
        table: {
          isTableHeader: true,
          columnHeader: "Mandatory",
          rowLabel: null,
          unit: null,
          threshold: null,
          lotNumber: null,
          conditionInCell: null,
          sourceLocation: "A1",
        },
      },
    });
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.exclusionCode, "EXCLUDED_TABLE_HEADER");
  });

  it("grammar + bid-time + submit action cooperate to admit", () => {
    const s = interp("The Bidder shall submit ISO 27001 certification with the proposal.");
    assert.equal(s.admitToCanonical, true);
    assert.ok(s.situation);
    assert.ok(s.situation!.agreeingSignals >= 2);
    assert.ok(s.situation!.decisiveSources.includes("GRAMMAR"));
  });

  it("conflicting actor and execution temporal do not guess a bidder duty", () => {
    const s = interp(
      "The Contractor shall install and commission the equipment after delivery.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.notEqual(s.actor, "BIDDER");
  });
});
