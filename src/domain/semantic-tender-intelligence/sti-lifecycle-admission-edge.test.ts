/**
 * Lifecycle admission edge: supplier/performer execution without a complete
 * commitment frame must not enter bidder-stage canonical requirements.
 * General failure classes only — no tender/country/org/filename rules.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretSemanticStatement } from "./interpret";
import { analyzeLifecycleCommitmentFrame } from "./phase";
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

describe("lifecycle frame — execution without trigger stays UNKNOWN", () => {
  it("supplier delivery / unload / install / commission without trigger is not admitted", () => {
    const samples = [
      "The Supplier shall deliver the equipment within eight weeks.",
      "The supplier shall unload the goods.",
      "The Supplier shall carry out installation of the equipment.",
      "The Supplier shall install and commission the equipment.",
    ];
    for (const text of samples) {
      const frame = analyzeLifecycleCommitmentFrame({ text, actor: "SUPPLIER" });
      assert.equal(frame.insufficientFrame, true, text);
      const s = interp(text);
      assert.equal(s.admitToCanonical, false, text);
      assert.notEqual(s.clausePurpose, "BIDDER_OBLIGATION", text);
      assert.notEqual(s.procurementPhase, "BID_SUBMISSION", text);
    }
  });

  it("corrective maintenance / replacement / post-contract service without trigger stay REVIEW", () => {
    const samples = [
      "The Supplier shall provide corrective maintenance and replacement of parts.",
      "The supplier shall provide post-contract service for the equipment.",
    ];
    for (const text of samples) {
      const s = interp(text);
      assert.equal(s.admitToCanonical, false, text);
      assert.ok(
        s.procurementPhase === "UNKNOWN" ||
          s.clausePurpose === "UNKNOWN" ||
          s.clausePurpose === "POST_AWARD_OBLIGATION",
        text,
      );
      assert.notEqual(s.clausePurpose, "BIDDER_OBLIGATION", text);
    }
  });

  it("does not invent post-award from the words supplier, deliver, install, warranty or payment alone", () => {
    const s = interp("The Supplier shall deliver the equipment.");
    assert.equal(s.admitToCanonical, false);
    assert.notEqual(s.clausePurpose, "POST_AWARD_OBLIGATION");
    assert.equal(s.procurementPhase, "UNKNOWN");
  });
});

describe("lifecycle frame — explicit post-award trigger excludes", () => {
  it("delivery / site / reception / contract-period / artefact triggers are EXCLUDED_POST_AWARD", () => {
    const samples = [
      "The Supplier shall deliver the goods to the site after receipt of the purchase order.",
      "The supplier shall unload the goods at the premises.",
      "The Supplier shall install and commission the equipment after delivery.",
      "The Supplier shall provide corrective maintenance during the contract period.",
      "The supplier shall replace defective items after acceptance.",
      "The Supplier shall provide post-contract service during the warranty period.",
      "The supplier shall submit delivery notes and installation completion reports.",
    ];
    for (const text of samples) {
      const s = interp(text);
      assert.equal(s.admitToCanonical, false, text);
      assert.ok(
        s.exclusionCode === "EXCLUDED_POST_AWARD" ||
          s.exclusionCode === "AMBIGUOUS_PHASE" ||
          s.clausePurpose === "POST_AWARD_OBLIGATION",
        `${text} → ${s.exclusionCode} ${s.clausePurpose}`,
      );
    }
  });
});

describe("lifecycle frame — genuine pre-award commitments still admit", () => {
  it("bidder capability / plan / bid-inclusion frames remain admissible", () => {
    const samples = [
      "The bidder shall demonstrate that it can provide installation and commissioning.",
      "The Bidder shall include an installation and commissioning methodology in the Technical Proposal.",
      "The tenderer shall submit a delivery schedule with its bid.",
      "The bidder shall offer a two-year warranty as part of the proposal.",
    ];
    for (const text of samples) {
      const s = interp(text);
      assert.equal(s.admitToCanonical, true, text);
      assert.notEqual(s.clausePurpose, "POST_AWARD_OBLIGATION", text);
    }
  });

  it("technical specifications, eligibility and required documents remain admissible", () => {
    const samples = [
      "The bidder shall supply equipment that operates at 220V / 50Hz and conforms to IEC 60601.",
      "The bidder shall have completed at least three similar installation projects.",
      "The Bidder shall submit ISO 9001 certification with the proposal.",
    ];
    for (const text of samples) {
      const s = interp(text);
      assert.equal(s.admitToCanonical, true, text);
      assert.notEqual(s.clausePurpose, "POST_AWARD_OBLIGATION", text);
    }
  });

  it("buyer / authority procedural statements remain non-requirements", () => {
    const s = interp(
      "The Purchaser shall arrange site access for installation after award.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.clausePurpose), /BUYER|PROCEDURAL|POST_AWARD/);
  });
});
