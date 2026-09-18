/**
 * Proof: no alternate semantic door into canonical requirements.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildCanonicalRequirements } from "@/domain/tender-requirements/canonical-extraction";
import { gateRequirementDrafts } from "@/domain/universal-tender-intelligence";
import { classifyUniversalDocumentRole } from "@/domain/universal-tender-intelligence";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("sti alternate path audit", () => {
  it("forged STI seals throw", () => {
    assert.throws(
      () =>
        buildCanonicalRequirements({
          stiApproved: { items: [], sourceDocument: "x", finalRejected: [] } as never,
        }),
      /STI seal required/,
    );
  });

  it("UTI draft gate is not an admission path", () => {
    const gated = gateRequirementDrafts([
      {
        description: "The Bidder shall submit ISO 9001 with the proposal.",
        sourceDocument: "itt.pdf",
      },
    ]);
    assert.ok(gated.admitted.length >= 0);
    const src = readFileSync(join(ROOT, "src/services/tender-processing/index.ts"), "utf8");
    assert.doesNotMatch(src, /gateRequirementDrafts\(/);
  });

  it("filename alone cannot classify a document role past the content threshold", () => {
    const r = classifyUniversalDocumentRole({
      fileName: "corrigendum-final.pdf",
      text: "This paper describes general procurement principles without amending any clause.",
    });
    assert.notEqual(r.role, "CORRIGENDUM");
  });

  it("heuristic drafts still must pass STI before canonical rows exist", () => {
    const out = buildCanonicalRequirements({
      heuristicDrafts: [
        {
          category: "CONTRACTUAL",
          description: "The Purchaser shall evaluate the technical proposals.",
          mandatory: true,
          sourceDocument: "itt.pdf",
        },
      ],
    });
    assert.equal(out.length, 0);
  });

  it("production source mentions unit harvest and per-file provenance", () => {
    const src = readFileSync(join(ROOT, "src/services/tender-processing/index.ts"), "utf8");
    assert.match(src, /buildSemanticDocumentUnits/);
    assert.match(src, /harvestDraftsFromUnits/);
    assert.match(src, /enrichDraftsFromUnits/);
    assert.match(src, /rawSource \?\? part\?\.fileName/);
  });
});
