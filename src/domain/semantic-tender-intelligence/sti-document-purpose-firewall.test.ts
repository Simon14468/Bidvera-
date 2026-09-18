/**
 * Document-purpose + semantic admission firewall — new architectural classes.
 * Generic procurement patterns only. No tender/buyer/filename-specific rules.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  interpretSemanticStatement,
  buildCanonicalSemanticCandidates,
  buildSemanticIdentity,
  classifyDocumentPurpose,
  toContextualIntelligence,
} from "@/domain/semantic-tender-intelligence";

const prov = {
  sourceDocument: "pack.pdf",
  sourcePage: 1,
  sourceSection: null as string | null,
};

function interp(
  text: string,
  context?: Parameters<typeof interpretSemanticStatement>[0]["context"],
) {
  return interpretSemanticStatement({ text, provenance: prov, context: context ?? null });
}

describe("document purpose firewall — vendor guide vs portal vs policy", () => {
  it("portal operation instructions never enter canonical", () => {
    const s = interp(
      "Click on the Upload button and navigate to the e-sourcing portal to attach files.",
      { documentRole: "PORTAL_GUIDE" },
    );
    assert.equal(classifyDocumentPurpose({ text: s.requirementText, documentRole: "PORTAL_GUIDE" }), "PORTAL_GUIDE");
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.exclusionCode, "EXCLUDED_PORTAL_OPERATION");
  });

  it("a vendor guide may still admit a genuine bidder obligation", () => {
    const s = interp(
      "The Bidder shall submit ISO 27001 certification with the proposal.",
      { documentRole: "VENDOR_GUIDE" },
    );
    assert.equal(s.documentPurpose, "VENDOR_GUIDE");
    assert.equal(s.admitToCanonical, true);
    assert.notEqual(s.actor, "UNKNOWN");
  });

  it("vendor-guide process descriptions without a bidder-stage duty stay excluded", () => {
    const s = interp(
      "You will receive an automatic email notification once you have submitted your vendor response.",
      { documentRole: "VENDOR_GUIDE" },
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "PROCEDURAL_RULE");
  });

  it("vendor-guide portal clicks stay non-requirement context", () => {
    const s = interp(
      "How to use the portal: click on the upload icon, then log in to the e-sourcing system.",
      { documentRole: "VENDOR_GUIDE" },
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "PROCEDURAL_RULE");
  });

  it("policy or code-of-conduct context is not a bidder requirement", () => {
    const s = interp(
      "This ethics policy describes expected workplace behaviour for all staff of the authority.",
      { documentRole: "POLICY_OR_CODE_OF_CONDUCT" },
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "INFORMATIONAL_FACT");
    assert.equal(s.exclusionCode, "EXCLUDED_POLICY_CONTEXT");
  });

  it("explicit bidder compliance with a code remains eligibility", () => {
    const s = interp(
      "Bidders shall comply with the code of conduct as a condition of award.",
      { documentRole: "POLICY_OR_CODE_OF_CONDUCT" },
    );
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.documentPurpose, "PROCUREMENT_REQUIREMENT_SOURCE");
    assert.match(s.clausePurpose, /ELIGIBILITY|BIDDER_OBLIGATION|QUALIFICATION/);
  });
});

describe("actor and lifecycle — no keyword promotion", () => {
  it("buyer/authority actions never become bidder requirements", () => {
    const s = interp("The Authority shall evaluate the technical proposals and notify unsuccessful bidders.");
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "BUYER_OBLIGATION");
  });

  it("supplier post-award execution stays excluded", () => {
    const s = interp(
      "The Contractor shall repair defective items during the warranty period after delivery.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.ok(
      s.clausePurpose === "POST_AWARD_OBLIGATION" ||
        s.exclusionCode === "EXCLUDED_POST_AWARD" ||
        s.procurementPhase === "POST_AWARD" ||
        s.procurementPhase === "DELIVERY_IMPLEMENTATION" ||
        s.procurementPhase === "CONTRACT_EXECUTION",
    );
  });

  it("pre-award delivery commitment is PRE_AWARD, not invented post-award", () => {
    const s = interp(
      "The Bidder shall demonstrate that it can deliver the goods within 30 days of award.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.match(s.procurementPhase, /PRE_AWARD|BID_SUBMISSION/);
    assert.notEqual(s.clausePurpose, "POST_AWARD_OBLIGATION");
  });

  it("impersonal bid-submission duty is admitted without promoting actor to BIDDER", () => {
    const s = interp("Bids shall be submitted in two sealed envelopes before the closing time.");
    assert.equal(s.actor, "IMPERSONAL");
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.situation?.unattributedImpersonalObligation, true);
    assert.match(s.clausePurpose, /SUBMISSION|REQUIRED_DOCUMENT|BIDDER_OBLIGATION/);
  });

  it("incomplete impersonal methodology is not promoted to BIDDER", () => {
    const s = interp("A detailed methodology is required.");
    assert.notEqual(s.actor, "BIDDER");
    assert.equal(s.admitToCanonical, false);
  });

  it("evaluation methodology without bidder obligation stays excluded", () => {
    const s = interp("Technical proposals will be scored out of 100 points based on the weighting.");
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "EVALUATION");
  });

  it("evaluation scoring under an Evaluation heading is not promoted by must/shall", () => {
    const s = interp(
      "Proposals must be scored out of 100 points based on the published weighting.",
      { sectionRole: "EVALUATION" },
    );
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "EVALUATION");
  });

  it("deadline metadata is not a requirement", () => {
    const s = interp("Submission deadline: 18 November 2026 at 14:30.");
    assert.equal(s.admitToCanonical, false);
  });
});

describe("lots, duplicates, amendments, rejected context", () => {
  it("lot-specific obligations do not merge across lots", () => {
    const a = buildSemanticIdentity({
      text: "The Bidder shall supply 5 generators for Lot 1.",
      actor: "BIDDER",
      contentKind: "TECHNICAL_REQUIREMENT",
      lotLabel: "LOT_1",
    });
    const b = buildSemanticIdentity({
      text: "The Bidder shall supply 10 generators for Lot 2.",
      actor: "BIDDER",
      contentKind: "TECHNICAL_REQUIREMENT",
      lotLabel: "LOT_2",
    });
    assert.notEqual(a, b);
  });

  it("different numeric thresholds do not share identity", () => {
    const a = buildSemanticIdentity({
      text: "The Tenderer shall demonstrate 5 years of experience.",
      actor: "TENDERER",
      contentKind: "ELIGIBILITY_CONDITION",
    });
    const b = buildSemanticIdentity({
      text: "The Tenderer shall demonstrate 10 years of experience.",
      actor: "TENDERER",
      contentKind: "ELIGIBILITY_CONDITION",
    });
    assert.notEqual(a, b);
  });

  it("different conditions do not share a normalize-layer fingerprint", async () => {
    const { obligationFingerprint } = await import(
      "@/domain/tender-requirements/semantic-dedupe"
    );
    const a = obligationFingerprint(
      "The Bidder shall supply 5 generators.",
      "TECHNICAL",
      { conditionText: "if Lot 1 is offered" },
    );
    const b = obligationFingerprint(
      "The Bidder shall supply 10 generators.",
      "TECHNICAL",
      { conditionText: "if Lot 2 is offered" },
    );
    assert.notEqual(a, b);
  });

  it("same obligation across formats merges and keeps both provenances", () => {
    const { candidates } = buildCanonicalSemanticCandidates([
      {
        description: "The Bidder shall submit audited financial statements with the proposal.",
        sourceDocument: "instructions.pdf",
        pageNumber: 3,
        documentRole: "INSTRUCTIONS_TO_BIDDERS",
      },
      {
        description: "The Bidder shall submit audited financial statements with the proposal.",
        sourceDocument: "forms.docx",
        pageNumber: 1,
        documentRole: "RETURNABLE_BIDDING_FORMS",
      },
    ]);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.provenance.length, 2);
  });

  it("amendment metadata is rejected; a restated bidder duty may still admit", () => {
    const meta = interp("Corrigendum 1 — this amendment supersedes clause 4.2.", {
      documentRole: "AMENDMENT",
    });
    assert.equal(meta.admitToCanonical, false);
    const duty = interp(
      "The Bidder shall submit a revised price schedule with the proposal.",
      { documentRole: "INSTRUCTIONS_TO_BIDDERS" },
    );
    assert.equal(duty.admitToCanonical, true);
  });

  it("rejected content is preserved as contextual intelligence with reason and provenance", () => {
    const { rejected, metadata } = buildCanonicalSemanticCandidates([
      {
        description: "Click on the upload button to attach your files.",
        sourceDocument: "vendor-guide.pdf",
        documentRole: "VENDOR_GUIDE",
      },
      {
        description: "The Authority shall open the bids at 10:00.",
        sourceDocument: "itt.pdf",
        documentRole: "INSTRUCTIONS_TO_BIDDERS",
      },
      {
        description: "The Bidder shall submit ISO 27001 certification with the proposal.",
        sourceDocument: "itt.pdf",
        documentRole: "INSTRUCTIONS_TO_BIDDERS",
      },
    ]);
    const ctx = toContextualIntelligence(rejected, metadata);
    assert.ok(ctx.length >= 2);
    for (const row of ctx) {
      assert.ok(row.exclusionCode);
      assert.ok(row.sourceDocument);
      assert.ok(row.text.length > 0);
    }
    assert.ok(ctx.some((r) => r.kind === "PROCEDURAL" || r.kind === "BUYER_DUTY"));
  });

  it("conditional lot-specific requirement keeps condition and lot", () => {
    const s = interp(
      "If the Bidder offers Lot 2, it shall submit a factory acceptance test plan with the Technical Proposal.",
    );
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.conditionality.applicability, "CONDITIONAL");
    assert.ok(s.lotLabel);
  });
});
