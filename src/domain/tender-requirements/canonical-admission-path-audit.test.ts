/**
 * Architectural audit: no alternative semantic path into canonical intelligence.
 * Downstream layers cannot resurrect STI-rejected or semantically invalid content.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  buildCanonicalRequirements,
  enforceCanonicalAdmissionFirewall,
  normalizeRequirements,
} from "@/domain/tender-requirements";
import { isStiApprovedRequirementBatch } from "@/domain/semantic-tender-intelligence";
import { classifySemanticContent } from "@/domain/universal-tender-intelligence";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("canonical admission path audit", () => {
  it("production analysis seals STI before canonical construction", () => {
    const src = readSrc("src/services/tender-processing/index.ts");
    assert.match(src, /buildCanonicalSemanticCandidates/);
    assert.match(src, /StiApprovedRequirementBatch\.fromAdmittedCandidates/);
    assert.match(src, /buildCanonicalRequirements\(\{\s*stiApproved/);
    assert.doesNotMatch(
      src,
      /buildCanonicalRequirements\(\{\s*aiDrafts:\s*extraction/,
    );
  });

  it("canonical extraction has a single convergence point", () => {
    const src = readSrc("src/domain/tender-requirements/canonical-extraction.ts");
    assert.match(src, /function sealNormalizeAndFirewall/);
    assert.match(src, /enforceCanonicalAdmissionFirewall/);
    assert.match(src, /mergeNormalizedRequirements\(admitted\)/);
    assert.match(src, /assertBidderStageCanonicalInvariants/);
    assert.match(src, /STI seal required/);
    assert.doesNotMatch(src, /return normalizeRequirements\(mergedDrafts/);
  });

  it("normalize cannot resurrect excluded content on the production STI path", () => {
    const excluded = [
      "The Purchaser shall evaluate the technical proposals.",
      "The Contractor shall install and commission the equipment after delivery.",
      "Click Upload in the e-sourcing portal.",
      "Insert bidder name here.",
    ];
    const normalized = normalizeRequirements(
      excluded.map((description) => ({
        category: "CONTRACTUAL",
        description,
        mandatory: true,
        sourceDocument: "pack.pdf",
      })),
      { trustStiSemantics: true },
    );
    assert.equal(normalized.length, 0);

    const forged = normalizeRequirements(
      [
        {
          category: "MANDATORY_ADMINISTRATIVE",
          description: "The Contractor shall install and commission the equipment after delivery.",
          mandatory: true,
          sourceDocument: "pack.pdf",
          sti: {
            actor: "BIDDER",
            clauseRole: "BIDDER_REQUIREMENT",
            clausePurpose: "BIDDER_OBLIGATION",
            procurementPhase: "BID_SUBMISSION",
            semanticKind: "TECHNICAL_REQUIREMENT",
            obligationStrength: "MANDATORY",
            conditionText: null,
            applicability: "UNCONDITIONAL",
            templateStatus: "NOT_TEMPLATE",
            confidence: 0.9,
          },
        },
      ],
      { trustStiSemantics: true },
    );
    const { admitted, rejected } = enforceCanonicalAdmissionFirewall(forged);
    assert.equal(admitted.length, 0);
    assert.ok(rejected.length >= 1);
    assert.match(rejected[0]!.exclusionCode, /POST_AWARD|CONTRACT_EXECUTION|SEMANTIC_CONFLICT/);
  });

  it("forged seal objects cannot enter buildCanonicalRequirements", () => {
    assert.equal(isStiApprovedRequirementBatch({ items: [], sourceDocument: "x" }), false);
    assert.throws(() =>
      buildCanonicalRequirements({
        stiApproved: { items: [], sourceDocument: "x" } as never,
      }),
    );
  });

  it("UTI adapter cannot admit what STI rejected", () => {
    const u = classifySemanticContent({
      text: "The Contractor shall commence performance after contract signature.",
      fileName: "gcc.pdf",
    });
    assert.equal(u.admitToRequirements, false);
    assert.notEqual(u.actor, "BIDDER");
  });

  it("UTI does not map manufacturer or subcontractor onto bidder", () => {
    const mfr = classifySemanticContent({
      text: "The manufacturer shall provide a 24-month warranty on all equipment.",
      fileName: "spec.pdf",
    });
    assert.notEqual(mfr.actor, "BIDDER");
    assert.equal(mfr.admitToRequirements, false);
  });

  it("decision / evidence / fit modules consume canonical rows, not raw drafts", () => {
    const decision = readSrc("src/domain/decision/company-fit.ts");
    const evidence = readSrc("src/domain/evidence-verification/select-evidence.ts");
    const risk = readSrc("src/domain/risk/assess.ts");
    assert.doesNotMatch(decision, /buildCanonicalSemanticCandidates/);
    assert.doesNotMatch(evidence, /interpretSemanticStatement/);
    assert.doesNotMatch(risk, /admitToCanonical\s*=\s*true/);
  });
});
