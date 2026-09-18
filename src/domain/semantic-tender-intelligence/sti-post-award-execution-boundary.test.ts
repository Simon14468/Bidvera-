/**
 * Pre-award vs post-award / contract-execution boundary invariants.
 * Generic procurement patterns only — no tender-specific rules.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretSemanticStatement } from "./interpret";
import type { SemanticProvenance } from "./types";

const prov: SemanticProvenance = {
  sourceDocument: "pack.pdf",
  sourcePage: 1,
  sourceSection: null,
  sourceCell: null,
  versionLabel: null,
  locator: null,
};

function interp(text: string) {
  return interpretSemanticStatement({ text, provenance: prov, context: null });
}

describe("STI post-award execution vs pre-award bidder commitment", () => {
  it("supplier install/commission after delivery — excluded", () => {
    const s = interp(
      "The Supplier shall install and commission the equipment after delivery.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.actor, "SUPPLIER");
    assert.match(
      String(s.procurementPhase),
      /POST_AWARD|CONTRACT_EXECUTION|DELIVERY|DELIVERY_IMPLEMENTATION|INSTALLATION_IMPLEMENTATION|CONTRACT_PERFORMANCE/,
    );
    assert.equal(s.clausePurpose, "POST_AWARD_OBLIGATION");
    assert.ok(s.exclusionCode);
  });

  it("contractor training after installation — excluded", () => {
    const s = interp(
      "The Contractor shall provide training after installation of the equipment.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.clausePurpose), /POST_AWARD/);
  });

  it("warranty / defective replacement execution — excluded", () => {
    const s = interp(
      "The Supplier shall replace defective goods under the warranty during the warranty period.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.clausePurpose), /POST_AWARD/);
  });

  it("delivery/installation reports after award — excluded", () => {
    const s = interp(
      "The Supplier shall submit delivery and installation reports after delivery.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.clausePurpose), /POST_AWARD/);
  });

  it("successful bidder performance security after receipt of contract — excluded", () => {
    const s = interp(
      "The successful bidder shall furnish performance security after receipt of the contract.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(
      String(s.procurementPhase),
      /POST_AWARD|CONTRACT_EXECUTION|DELIVERY_IMPLEMENTATION/,
    );
    assert.notEqual(s.clausePurpose, "AWARD_STAGE_OBLIGATION");
  });

  it("successful bidder award-timed performance security — may admit as award-stage", () => {
    const s = interp(
      "The successful bidder shall provide performance security within 10 days of award.",
    );
    assert.equal(s.procurementPhase, "AWARD");
    assert.equal(s.clauseRole, "AWARD_STAGE_OBLIGATION");
    assert.equal(s.admitToCanonical, true);
  });

  it("bidder performance security with the bid — admitted", () => {
    const s = interp(
      "The bidder shall provide a performance security with its bid.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.match(
      String(s.procurementPhase),
      /BID_SUBMISSION|PRE_AWARD|PRE_AWARD_COMMITMENT|PRE_BID|MULTI_PHASE/,
    );
  });

  it("bidder demonstrate installation capability — admitted pre-award", () => {
    const s = interp(
      "The bidder shall demonstrate that it can provide installation and commissioning.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.match(s.actor, /BIDDER|TENDERER|OFFEROR/);
    assert.notEqual(s.clausePurpose, "POST_AWARD_OBLIGATION");
  });

  it("bidder include installation methodology in proposal — admitted", () => {
    const s = interp(
      "The Bidder shall include an installation and commissioning methodology in the Technical Proposal.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.notEqual(s.clausePurpose, "POST_AWARD_OBLIGATION");
  });

  it("buyer install obligation never becomes bidder requirement", () => {
    const s = interp(
      "The Purchaser shall arrange site access for installation after award.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.clausePurpose), /BUYER|PROCEDURAL|POST_AWARD/);
  });

  it("excluded candidates retain audit exclusion codes", () => {
    const s = interp(
      "The Supplier shall transport the goods to the Site after contract signature.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.ok(s.exclusionCode);
    assert.ok(s.exclusionReason || s.exclusionCode);
  });

  it("joint-venture conditional submission remains admissible", () => {
    const s = interp(
      "Only if a joint venture is proposed, the JV must submit a joint liability statement.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.notEqual(s.clausePurpose, "BUYER_OBLIGATION");
  });
});
