/**
 * General failure class: non-requirement text must not enter the canonical set.
 * No solicitation number, buyer, country, or filename rules.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretSemanticStatement } from "./interpret";
import { detectMetadataFact } from "./metadata";
import { analyzeObligationFrame } from "./obligation-frame";
import { buildCanonicalRequirements } from "@/domain/tender-requirements";
import { isNonRequirementText } from "@/domain/tender-requirements/filter-non-requirements";
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
  return interpretSemanticStatement({
    text,
    provenance: prov,
    context: null,
  });
}

describe("root cause — non-requirement text cannot enter canonical", () => {
  it("document identifier + disclaimer is metadata, not a bidder duty", () => {
    const text =
      "Invitation reference: ABC/2026/001 however, this does not limit the inclusion of a firm from another jurisdiction.";
    const frame = analyzeObligationFrame(text);
    assert.equal(frame.canAdmitAsBidderObligation, false);
    assert.match(String(frame.blockReason), /DOCUMENT_IDENTIFIER|DISCLAIMER_OR_LIMITATION/);
    assert.equal(detectMetadataFact(text).isMetadata, true);
    assert.equal(isNonRequirementText(text), true);
    const s = interp(text);
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.clausePurpose), /METADATA|INFORMATIONAL/);
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: [{ description: text, category: "CONTRACTUAL", mandatory: true }],
      sourceDocument: "pack.pdf",
    });
    assert.equal(canonical.length, 0);
  });

  it("instrument abbreviation + reference label is metadata even with trailing prose", () => {
    const text =
      "RFP Ref No: SOL/2026/441 however, this invitation is intended to outline the procedure only.";
    assert.equal(detectMetadataFact(text).isMetadata, true);
    assert.equal(detectMetadataFact(text).field, "reference");
    assert.equal(interp(text).admitToCanonical, false);
    assert.equal(
      buildCanonicalRequirements({
        heuristicDrafts: [{ description: text, category: "CONTRACTUAL", mandatory: true }],
        sourceDocument: "itt.pdf",
      }).length,
      0,
    );
  });

  it("heading / section label never admits", () => {
    for (const text of [
      "Section 1 — Introduction",
      "Technical Specifications",
      "Item | Description | Qty | Unit | Price",
    ]) {
      assert.equal(interp(text).admitToCanonical, false, text);
    }
  });

  it("introductory / background prose never admits", () => {
    const text =
      "This invitation sets out the background and context for the procurement of laboratory equipment.";
    assert.equal(analyzeObligationFrame(text).blockReason, "INTRODUCTORY_PROSE");
    assert.equal(interp(text).admitToCanonical, false);
  });

  it("buyer / authority statements never admit", () => {
    const s = interp("The Purchaser shall evaluate the technical proposals and notify unsuccessful bidders.");
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "BUYER_OBLIGATION");
  });

  it("disclaimer without a bidder duty never admits", () => {
    const text =
      "This section is provided for information only and does not limit the inclusion of additional lots.";
    assert.equal(analyzeObligationFrame(text).blockReason, "DISCLAIMER_OR_LIMITATION");
    assert.equal(interp(text).admitToCanonical, false);
  });

  it("factual dates / values / locations alone never admit", () => {
    for (const text of [
      "Closing date: 30 September 2026 at 17:00",
      "Estimated contract value: 4.200.000,00 DH TTC",
      "Place of performance: the capital city.",
    ]) {
      assert.equal(interp(text).admitToCanonical, false, text);
    }
  });

  it("evaluation description without a bidder duty never admits", () => {
    const s = interp("Technical score: 70% · Financial offer: 30%");
    assert.equal(s.admitToCanonical, false);
  });

  it("example / note / template text never admits", () => {
    for (const text of [
      "For example only: a sample bid response is attached.",
      "Insert bidder name here.",
      "Note to tenderers: this page is a drafting note.",
    ]) {
      assert.equal(interp(text).admitToCanonical, false, text);
    }
  });

  it("incomplete fragment never admits", () => {
    assert.equal(interp("The bidder shall").admitToCanonical, false);
    assert.equal(interp("shall be").admitToCanonical, false);
  });

  it("mixed document: identifier is dropped, genuine bidder duty remains", () => {
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: [
        {
          description:
            "Solicitation No: 12-345 — this does not limit the inclusion of a firm from another region.",
          category: "CONTRACTUAL",
          mandatory: true,
        },
        {
          description: "The bidder shall submit ISO 9001 certification with the proposal.",
          category: "MANDATORY_ADMINISTRATIVE",
          mandatory: true,
        },
        {
          description: "This document describes the procurement procedure.",
          category: "INFORMATIONAL",
          mandatory: false,
        },
      ],
      sourceDocument: "mixed.pdf",
    });
    assert.equal(canonical.length, 1);
    assert.match(canonical[0]!.requirement, /ISO 9001/i);
    assert.ok(!canonical.some((r) => /does not limit the inclusion/i.test(r.requirement)));
    assert.ok(!canonical.some((r) => /this document describes/i.test(r.requirement)));
  });

  it("genuine pre-award bidder requirements still pass", () => {
    const samples = [
      "The bidder shall submit a valid tax-clearance certificate with the offer.",
      "The tenderer must demonstrate at least five years of comparable experience.",
      "Prices shall remain firm and non-revisable throughout the contract period.",
    ];
    for (const text of samples) {
      assert.equal(analyzeObligationFrame(text).canAdmitAsBidderObligation, true, text);
      assert.equal(interp(text).admitToCanonical, true, text);
    }
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: samples.map((description) => ({
        description,
        category: "CONTRACTUAL",
        mandatory: true,
      })),
      sourceDocument: "itt.pdf",
    });
    assert.equal(canonical.length, 3);
  });
});
