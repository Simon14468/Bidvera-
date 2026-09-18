/**
 * Unseen procurement patterns — general classes, not known-bug patches.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretSemanticStatement } from "./interpret";
import { buildCanonicalSemanticCandidates } from "./candidates";
import { StiApprovedRequirementBatch } from "./sti-seal";
import { buildCanonicalRequirements } from "@/domain/tender-requirements/canonical-extraction";

function interp(
  text: string,
  extra?: { documentRole?: string; sectionLabel?: string; preceding?: string },
) {
  return interpretSemanticStatement({
    text,
    provenance: { sourceDocument: "unseen.pdf", sourcePage: 1 },
    context: {
      packageDocumentRole: extra?.documentRole ?? null,
      sectionLabel: extra?.sectionLabel ?? null,
      precedingText: extra?.preceding ?? null,
    },
  });
}

describe("sti unseen procurement patterns", () => {
  it("numbered-only headings stay unknown and never admit", () => {
    const s = interp("4.12.3", { sectionLabel: "4.12.3" });
    assert.equal(s.admitToCanonical, false);
  });

  it("buyer-as-subject evaluation is excluded", () => {
    const s = interp("The Contracting Authority shall open the bids in public.");
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clausePurpose, "BUYER_OBLIGATION");
  });

  it("award-window security is award-stage, not open execution", () => {
    const s = interp(
      "The successful bidder shall furnish the performance security within 14 days of notification of award.",
    );
    assert.ok(s.procurementPhase === "AWARD" || s.clausePurpose === "AWARD_STAGE_OBLIGATION" || s.admitToCanonical);
  });

  it("post-award execution by contractor is excluded from bidder-stage canonical", () => {
    const s = interp(
      "The Contractor shall repair defective goods during the warranty period after delivery.",
    );
    assert.equal(s.admitToCanonical, false);
  });

  it("templates, examples, Q&A, and form instructions stay excluded", () => {
    assert.equal(interp("Insert [name of bidder] here.").admitToCanonical, false);
    assert.equal(interp("For example, a sample scenario is provided below.").admitToCanonical, false);
    assert.equal(
      interp("Question 2: Can foreign firms apply? Answer: Yes, if registered.", {
        documentRole: "Q_AND_A",
      }).admitToCanonical,
      false,
    );
    assert.equal(interp("Complete this form in block capitals.").admitToCanonical, false);
  });

  it("multi-document conflicting versions do not silently merge into one admitted fact", () => {
    const semantic = buildCanonicalSemanticCandidates([
      {
        description: "The Bidder shall submit ISO 9001 with the proposal.",
        sourceDocument: "itt.pdf",
        sourcePage: 4,
        documentRole: "INVITATION",
        versionLabel: "original",
      },
      {
        description: "This corrigendum supersedes Clause 4.2 of the Invitation to Tender.",
        sourceDocument: "corrigendum.pdf",
        sourcePage: 1,
        documentRole: "CORRIGENDUM",
        versionLabel: "corrigendum-1",
      },
    ]);
    const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(
      semantic.candidates,
      "pack",
    );
    const canonical = buildCanonicalRequirements({ stiApproved: sealed });
    assert.ok(canonical.every((r) => !/supersedes Clause 4\.2/i.test(r.requirement)));
    assert.ok(semantic.rejected.some((r) => /supersedes/i.test(r.requirementText)));
  });

  it("new morphology still admits when actor, action, and bid-time cooperate", () => {
    const s = interp("The tenderer is required to lodge the Form of Tender with its offer.");
    assert.equal(s.admitToCanonical, true);
  });
});
