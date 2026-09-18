/**
 * Regression for real E2E defects:
 * - REQUIREMENT COMPLETENESS: do not drop structured mandatory rows (D-xx) and do not over-dedupe distinct experience requirements.
 * - TENDER METADATA EXTRACTION is covered in requirements-heuristic.test.ts.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyRequirementSemanticKind,
  obligationFingerprint,
  normalizeRequirements,
} from "@/domain/tender-requirements";

describe("defect 1 regression — requirement completeness", () => {
  it("does not treat D-xx 'procedure' wording as CLARIFICATION_PROCEDURAL when D-xx is a requirement code", () => {
    const kind = classifyRequirementSemanticKind({
      description: "D-06 Support/escalation procedure",
      existingCategory: "technical",
      mandatoryHint: true,
    });
    assert.equal(kind, "TECHNICAL_REQUIREMENT");
  });

  it("dedupe does not collapse distinct IT experience requirements (equipment vs troubleshooting)", () => {
    const normalized = normalizeRequirements([
      {
        category: "experience",
        description:
          "EL-02 The bidder shall demonstrate relevant experience maintaining network equipment and enterprise IT hardware.",
        mandatory: true,
      },
      {
        category: "experience",
        description:
          "EL-03 The bidder shall provide qualified technicians with documented experience in network and hardware troubleshooting.",
        mandatory: true,
      },
    ]);

    // Both are real obligations and must survive as distinct canonical items.
    assert.equal(normalized.length, 2);
  });

  it("does not treat 'equipment reference' as an experience requirement (avoid experience fingerprint collision)", () => {
    const normalized = normalizeRequirements([
      {
        category: "experience",
        description:
          "EL-02 The bidder shall demonstrate at least three comparable projects during the last 5 years, with documentary references.",
        mandatory: true,
      },
      {
        category: "experience",
        description:
          "TECH-06 The contractor shall provide maintenance reports identifying equipment reference, incident, diagnosis, action and outcome.",
        mandatory: true,
      },
    ]);

    assert.equal(normalized.length, 2);

    const fps = normalized.map((r) => obligationFingerprint(r.requirement, r.category));
    assert.equal(new Set(fps).size, fps.length);
  });
});

