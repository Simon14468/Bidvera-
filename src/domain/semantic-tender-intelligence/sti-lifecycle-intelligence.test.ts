/**
 * Universal procurement lifecycle intelligence — commitment-frame regressions.
 * Generic patterns only. No tender / country / company / product rules.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretSemanticStatement } from "./interpret";
import { buildSemanticIdentity } from "./identity";
import { toContextualIntelligence } from "./contextual-intelligence";
import { FINAL_ADMISSION_CHECKS } from "./final-admission-gate";
import { normalizeRequirements } from "@/domain/tender-requirements/normalize";
import { obligationFingerprint } from "@/domain/tender-requirements/semantic-dedupe";
import type { SemanticProvenance } from "./types";

const BID_TIME = /BID_SUBMISSION|PRE_AWARD|PRE_AWARD_COMMITMENT|PRE_BID/;
const POST_TIME =
  /POST_AWARD|CONTRACT_EXECUTION|CONTRACT_PERFORMANCE|DELIVERY|DELIVERY_IMPLEMENTATION|INSTALLATION_IMPLEMENTATION/;

const prov: SemanticProvenance = {
  sourceDocument: "pack.pdf",
  sourcePage: 1,
  sourceSection: null,
  sourceCell: null,
  versionLabel: null,
  locator: null,
};

function interp(
  text: string,
  extra?: {
    sourceDocument?: string;
    documentRole?: string;
    sectionRole?: string;
    lotNumber?: string;
    versionLabel?: string;
  },
) {
  return interpretSemanticStatement({
    text,
    provenance: {
      ...prov,
      sourceDocument: extra?.sourceDocument ?? "pack.pdf",
      versionLabel: extra?.versionLabel ?? null,
    },
    context: {
      documentRole: extra?.documentRole as never,
      sectionRole: extra?.sectionRole as never,
      table: extra?.lotNumber
        ? {
            isTableHeader: false,
            columnHeader: null,
            rowLabel: null,
            unit: null,
            threshold: null,
            lotNumber: extra.lotNumber,
            conditionInCell: null,
            sourceLocation: extra.lotNumber,
          }
        : null,
    },
  });
}

describe("lifecycle intelligence — unattributed bid-stage commercial", () => {
  it("unattributed firm/fixed offer prices during bid validity are admitted", () => {
    const s = interp("Prices shall remain firm and non-revisable during bid validity.");
    assert.equal(s.actor, "UNKNOWN");
    assert.equal(s.clausePurpose, "COMMERCIAL");
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.situation?.unattributedCommercialEvidence, true);
    assert.match(s.procurementPhase, BID_TIME);
    assert.notEqual(s.procurementPhase, "MULTI_PHASE");
  });

  it("unattributed bid validity of the offer is admitted", () => {
    const s = interp("The offer shall remain valid for ninety (90) days from the bid closing date.");
    assert.equal(s.admitToCanonical, true);
    assert.match(s.procurementPhase, BID_TIME);
    assert.equal(s.clausePurpose, "COMMERCIAL");
  });

  it("unattributed currency and payment terms of the offer are admitted", () => {
    const currency = interp("Prices shall be quoted in USD as the currency of the bid.");
    assert.equal(currency.admitToCanonical, true);
    assert.match(currency.procurementPhase, BID_TIME);
    assert.equal(currency.clausePurpose, "COMMERCIAL");

    const payment = interp("Payment terms shall be thirty (30) days from invoice date.");
    assert.equal(payment.admitToCanonical, true);
    assert.match(payment.procurementPhase, BID_TIME);
    assert.equal(payment.clausePurpose, "COMMERCIAL");
  });

  it("does not force every unattributed commercial sentence to UNKNOWN", () => {
    const s = interp("Prices shall remain firm and fixed.");
    assert.notEqual(s.procurementPhase, "UNKNOWN");
    assert.equal(s.admitToCanonical, true);
  });

  it("firm prices throughout the contract period stay bid-disclosed commercial, not MULTI_PHASE", () => {
    const s = interp(
      "Prices shall remain firm and non-revisable throughout the contract period.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.clausePurpose, "COMMERCIAL");
    assert.match(s.procurementPhase, BID_TIME);
    assert.notEqual(s.procurementPhase, "MULTI_PHASE");
    assert.notEqual(s.procurementPhase, "MIXED_OR_AMBIGUOUS");
  });
});

describe("lifecycle intelligence — capability vs execution", () => {
  it("bidder capability for future delivery stays pre-award", () => {
    const s = interp(
      "The Bidder shall demonstrate the ability to deliver within 30 days.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.match(s.actor, /BIDDER|TENDERER|OFFEROR/);
    assert.match(s.procurementPhase, BID_TIME);
    assert.notEqual(s.clausePurpose, "POST_AWARD_OBLIGATION");
  });

  it("actual delivery after PO is post-award and not admitted", () => {
    const s = interp(
      "The Bidder shall deliver the goods within 30 days after receiving the purchase order.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.procurementPhase), POST_TIME);
    assert.notEqual(s.clausePurpose, "BIDDER_OBLIGATION");
  });

  it("installation after award is post-award and not admitted", () => {
    const s = interp(
      "The Supplier shall install and commission the equipment after award.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.procurementPhase), POST_TIME);
  });

  it("warranty/maintenance during the warranty period is post-award unless a bid commitment", () => {
    const execution = interp(
      "The Supplier shall maintain the equipment during the warranty period.",
    );
    assert.equal(execution.admitToCanonical, false);
    assert.match(String(execution.procurementPhase), POST_TIME);

    const commitment = interp(
      "The Bidder shall demonstrate a 24-month warranty with the proposal.",
    );
    assert.equal(commitment.admitToCanonical, true);
    assert.match(commitment.procurementPhase, BID_TIME);
    assert.notEqual(commitment.clausePurpose, "POST_AWARD_OBLIGATION");
  });
});

describe("lifecycle intelligence — successful bidder and security", () => {
  it("successful bidder without an award trigger stays MIXED_OR_AMBIGUOUS", () => {
    const s = interp("The successful bidder shall furnish the required documentation.");
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.procurementPhase, "MIXED_OR_AMBIGUOUS");
  });

  it("award-triggered security is AWARD, not open execution", () => {
    const s = interp(
      "The successful bidder shall provide performance security within 10 days of award.",
    );
    assert.equal(s.procurementPhase, "AWARD");
    assert.equal(s.admitToCanonical, true);
  });

  it("bid-stage security with the bid is admitted", () => {
    const s = interp("The bidder shall provide bid security with its bid.");
    assert.equal(s.admitToCanonical, true);
    assert.match(s.procurementPhase, BID_TIME);
  });
});

describe("lifecycle intelligence — mixed, conditional, lot, amendment", () => {
  it("mixed pre/post clause is MIXED_OR_AMBIGUOUS with REVIEW, not silently dropped", () => {
    const s = interp(
      "The Bidder shall submit a delivery plan with the bid, and shall deliver the goods after receiving the purchase order.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.procurementPhase, "MIXED_OR_AMBIGUOUS");
    const ctx = toContextualIntelligence([s], []);
    assert.ok(ctx.some((r) => r.kind === "AMBIGUOUS"));
  });

  it("conditional lifecycle preserves conditionality and does not invent a phase", () => {
    const s = interp(
      "If the contract is awarded, the Bidder shall deliver the goods after receiving the purchase order.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.ok(
      s.procurementPhase === "MIXED_OR_AMBIGUOUS" ||
        POST_TIME.test(String(s.procurementPhase)),
    );
    assert.ok(s.conditionality.conditionText || s.conditionality.unresolved);
  });

  it("lot-specific lifecycle identities stay distinct", () => {
    const a = interp(
      "The Bidder shall deliver the goods for Lot 1 within 30 days after receiving the purchase order.",
      { lotNumber: "1" },
    );
    const b = interp(
      "The Bidder shall demonstrate the ability to deliver for Lot 2 within 30 days.",
      { lotNumber: "2" },
    );
    assert.notEqual(a.semanticIdentity, b.semanticIdentity);
    assert.equal(b.admitToCanonical, true);
    assert.equal(a.admitToCanonical, false);
  });

  it("amendment changing the lifecycle trigger does not collapse identity", () => {
    const original = interp(
      "The Bidder shall demonstrate the ability to deliver within 30 days.",
      { versionLabel: "ITB original" },
    );
    const amended = interp(
      "The Bidder shall deliver the goods within 30 days after receiving the purchase order.",
      { versionLabel: "Addendum 1" },
    );
    assert.notEqual(original.semanticIdentity, amended.semanticIdentity);
    assert.equal(original.admitToCanonical, true);
    assert.equal(amended.admitToCanonical, false);
  });
});

describe("lifecycle intelligence — cross-format and non-bidder frames", () => {
  it("equivalent wording is invariant across PDF/DOCX/XLSX/TXT wrappers", () => {
    const text = "Prices shall remain firm and non-revisable during bid validity.";
    const phases = ["itb.pdf", "itb.docx", "schedule.xlsx", "notes.txt"].map((file) => {
      const s = interp(text, { sourceDocument: file });
      assert.equal(s.admitToCanonical, true, file);
      assert.match(s.procurementPhase, BID_TIME, file);
      return s.semanticIdentity;
    });
    assert.equal(new Set(phases).size, 1);
  });

  it("buyer/authority actions never become bidder-stage requirements", () => {
    const s = interp(
      "The Purchaser shall evaluate the bids and notify the successful bidder after award.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.clausePurpose), /BUYER|EVALUATION|PROCEDURAL/);
  });

  it("portal/vendor guidance process text is not admitted as a bidder duty", () => {
    const portal = interp(
      "Click on the Upload button and navigate to the e-sourcing portal to attach files.",
      { documentRole: "PORTAL_GUIDE" },
    );
    assert.equal(portal.admitToCanonical, false);

    const guide = interp(
      "You will receive an email confirming that your files were uploaded successfully.",
      { documentRole: "VENDOR_GUIDE" },
    );
    assert.equal(guide.admitToCanonical, false);
  });
});

describe("lifecycle intelligence — identity and downstream seal", () => {
  it("pre-award commitment and post-award execution never share identity", () => {
    const pre = buildSemanticIdentity({
      text: "The Bidder shall deliver within 30 days.",
      actor: "BIDDER",
      contentKind: "TECHNICAL_REQUIREMENT",
      procurementPhase: "PRE_AWARD_COMMITMENT",
    });
    const post = buildSemanticIdentity({
      text: "The Bidder shall deliver within 30 days.",
      actor: "BIDDER",
      contentKind: "TECHNICAL_REQUIREMENT",
      procurementPhase: "DELIVERY",
    });
    assert.notEqual(pre, post);
  });

  it("normalize fingerprints keep lifecycle families apart", () => {
    const pre = obligationFingerprint("The Bidder shall deliver within 30 days.", "CONTRACTUAL", {
      procurementPhase: "PRE_AWARD_COMMITMENT",
    });
    const post = obligationFingerprint("The Bidder shall deliver within 30 days.", "CONTRACTUAL", {
      procurementPhase: "DELIVERY",
    });
    assert.notEqual(pre, post);
  });

  it("trustStiSemantics does not re-infer lifecycle from raw keywords", () => {
    const s = interp("Prices shall remain firm and non-revisable during bid validity.");
    const [row] = normalizeRequirements(
      [
        {
          category: "CONTRACTUAL",
          description: s.requirementText,
          mandatory: true,
          sourceDocument: "pack.pdf",
          sti: {
            actor: s.actor,
            recipient: s.recipient,
            clauseRole: s.clauseRole,
            clausePurpose: s.clausePurpose,
            procurementPhase: s.procurementPhase,
            semanticKind: s.semanticKind,
            obligationStrength: s.obligationStrength,
            conditionText: s.conditionality.conditionText,
            conditionality: s.conditionality,
            applicability: s.applicability,
            templateStatus: s.templateStatus,
            confidence: s.confidence,
            lotApplicability: null,
            provenance: [],
            bidderRelevant: s.bidderRelevant,
          },
        },
      ],
      { trustStiSemantics: true, sourceDocument: "pack.pdf" },
    );
    assert.ok(row);
    assert.equal(row.stiProcurementPhase, s.procurementPhase);
  });

  it("does not add a 17th final admission check", () => {
    assert.equal(FINAL_ADMISSION_CHECKS.length, 16);
  });
});
