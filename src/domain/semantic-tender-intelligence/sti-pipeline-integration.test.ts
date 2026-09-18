/**
 * STI pipeline integration — architectural invariants + critical regressions A–G.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  StiApprovedRequirementBatch,
  buildCanonicalSemanticCandidates,
  interpretSemanticStatement,
  isStiApprovedRequirementBatch,
} from "@/domain/semantic-tender-intelligence";
import {
  buildCanonicalRequirements,
  buildCanonicalRequirementsThroughSti,
} from "@/domain/tender-requirements";

describe("STI single authoritative boundary — architecture", () => {
  it("StiApprovedRequirementBatch cannot be forged with a plain object", () => {
    assert.equal(
      isStiApprovedRequirementBatch({
        items: [],
        sourceDocument: null,
        approved: true,
      }),
      false,
    );
    const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates([]);
    assert.equal(isStiApprovedRequirementBatch(sealed), true);
  });

  it("production tender-processing seals STI candidates before canonical build", () => {
    const src = readFileSync("src/services/tender-processing/index.ts", "utf8");
    assert.match(src, /StiApprovedRequirementBatch\.fromAdmittedCandidates/);
    assert.match(src, /buildCanonicalRequirements\(\{\s*stiApproved/);
    assert.doesNotMatch(
      src,
      /buildCanonicalRequirements\(\{\s*aiDrafts:\s*semanticAi\.candidates\.map/,
    );
  });

  it("draft inputs are forced through STI — buyer shall never becomes canonical", () => {
    const out = buildCanonicalRequirements({
      heuristicDrafts: [
        {
          category: "CONTRACTUAL",
          description:
            "UNOPS shall gather all requests for clarification and respond in writing.",
          mandatory: true,
          sourceDocument: "itt.pdf",
        },
        {
          category: "CONTRACTUAL",
          description:
            "The Bidder shall submit audited financial statements for the last three years.",
          mandatory: true,
          sourceDocument: "itt.pdf",
        },
      ],
      sourceDocument: "itt.pdf",
    });
    assert.ok(
      out.every((r) => !/UNOPS shall/i.test(r.requirement)),
      "buyer obligation leaked into canonical set",
    );
    assert.ok(out.some((r) => /audited financial/i.test(r.requirement)));
    assert.ok(out.every((r) => r.stiActor != null));
  });

  it("sealed path preserves STI procurement phase on award-stage obligations", () => {
    const { candidates } = buildCanonicalSemanticCandidates(
      [
        {
          description:
            "The successful bidder shall provide performance security within 10 days of award.",
          sourceDocument: "itt.pdf",
        },
      ],
      { packageLabel: "itt.pdf" },
    );
    const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(
      candidates,
      "itt.pdf",
    );
    const out = buildCanonicalRequirements({ stiApproved: sealed });
    assert.equal(out.length, 1);
    assert.equal(out[0]!.stiProcurementPhase, "AWARD");
  });
});

describe("STI critical regressions A–G (pipeline)", () => {
  it("A. UNOPS shall… is not a bidder requirement", () => {
    const s = interpretSemanticStatement({
      text: "UNOPS shall gather all requests for clarification and circulate answers.",
      provenance: { sourceDocument: "itt.pdf" },
    });
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.clauseRole, "BUYER_OBLIGATION");
  });

  it("B. Contractor + [insert date] is not a pre-bid bidder requirement", () => {
    const out = buildCanonicalRequirementsThroughSti({
      heuristicDrafts: [
        {
          category: "CONTRACTUAL",
          description:
            "The Contractor shall commence performance not later than [insert date].",
          mandatory: true,
          sourceDocument: "contract.pdf",
        },
      ],
      sourceDocument: "contract.pdf",
      context: { packageDocumentRole: "SAMPLE_CONTRACT" },
    });
    assert.equal(out.length, 0);
  });

  it("C. [Note to be deleted] never becomes a requirement", () => {
    const out = buildCanonicalRequirementsThroughSti({
      heuristicDrafts: [
        {
          category: "CONTRACTUAL",
          description:
            "[Note to be deleted: choose either Option A or Option B before issue.]",
          mandatory: true,
          sourceDocument: "forms.pdf",
        },
      ],
      sourceDocument: "forms.pdf",
    });
    assert.equal(out.length, 0);
  });

  it("D. Unresolved clarification-meeting conditionality stays non-unconditional", () => {
    const s = interpretSemanticStatement({
      text: "If the clarification meeting is mandatory, the bidder shall attend.",
      provenance: { sourceDocument: "itt.pdf" },
    });
    assert.equal(s.applicability, "NEEDS_VERIFICATION");
    assert.equal(s.admitToCanonical, false);
  });

  it("E. Bidder audited statements remain canonical", () => {
    const out = buildCanonicalRequirementsThroughSti({
      heuristicDrafts: [
        {
          category: "MANDATORY_ADMINISTRATIVE",
          description:
            "The Bidder shall submit audited financial statements for the last three years.",
          mandatory: true,
          sourceDocument: "itt.pdf",
        },
      ],
      sourceDocument: "itt.pdf",
    });
    assert.equal(out.length, 1);
    assert.match(out[0]!.stiActor ?? "", /BIDDER|TENDERER/);
  });

  it("F. Successful bidder performance security is AWARD phase", () => {
    const s = interpretSemanticStatement({
      text: "Successful bidder shall provide performance security within 10 days of award.",
      provenance: { sourceDocument: "itt.pdf" },
    });
    assert.equal(s.procurementPhase, "AWARD");
    assert.equal(s.admitToCanonical, true);
  });

  it("G. Table technical requirement keeps provenance", () => {
    const out = buildCanonicalRequirementsThroughSti({
      heuristicDrafts: [
        {
          category: "MANDATORY_TECHNICAL",
          description:
            "The bidder shall supply items conforming to the quantities stated in Schedule A technical specification table.",
          mandatory: true,
          sourceDocument: "sor.pdf",
          sourcePage: 12,
          sourceSection: "Schedule A / Row 4",
        },
      ],
      sourceDocument: "sor.pdf",
    });
    assert.equal(out.length, 1);
    assert.equal(out[0]!.page, 12);
    assert.ok(out[0]!.sourceSection);
    assert.ok(out[0]!.sourceDocument);
  });
});
