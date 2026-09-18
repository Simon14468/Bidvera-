/**
 * Requirement Intelligence — 12-category semantic classification regression suite.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyRequirementSemanticKind,
  deriveObligationStrength,
  isNonRequirementText,
  isRealBidderObligation,
  normalizeRequirements,
  semanticKindToCategory,
} from "./index";

describe("requirement intelligence — semantic classification", () => {
  const cases: Array<{
    text: string;
    kind: ReturnType<typeof classifyRequirementSemanticKind>;
    scoring: boolean;
  }> = [
    {
      text: "Bidder must have 5 years of experience in audiovisual installations",
      kind: "ELIGIBILITY_REQUIREMENT",
      scoring: true,
    },
    {
      text: "Submit company registration certificate with the tender dossier",
      kind: "REQUIRED_DOCUMENT",
      scoring: true,
    },
    {
      text: "Equipment must support 4K UHD resolution for all display outputs",
      kind: "TECHNICAL_REQUIREMENT",
      scoring: true,
    },
    {
      text: "Delivery must occur within 60 days of contract signature",
      kind: "PERFORMANCE_OBLIGATION",
      scoring: true,
    },
    {
      text: "Performance guarantee: 10% of contract value (caution definitive)",
      kind: "GUARANTEE_SECURITY_REQUIREMENT",
      scoring: true,
    },
    {
      text: "Technical score: 40% · Financial offer: 60%",
      kind: "EVALUATION_CRITERION",
      scoring: false,
    },
    {
      text: "Submission deadline: 30 September 2026 at 16:00",
      kind: "DEADLINE",
      scoring: false,
    },
    {
      text: "Estimated contract value: MAD 780,000 excluding VAT",
      kind: "INFORMATIONAL_FACT",
      scoring: false,
    },
    {
      text: "Supply and Installation of Audiovisual Equipment",
      kind: "INFORMATIONAL_FACT",
      scoring: false,
    },
  ];

  for (const { text, kind, scoring } of cases) {
    it(`classifies "${text.slice(0, 48)}…" as ${kind}`, () => {
      assert.equal(classifyRequirementSemanticKind({ description: text }), kind);
      assert.equal(semanticKindToCategory(kind) !== "INFORMATIONAL" || !scoring, true);
      const out = normalizeRequirements([{ category: "x", description: text, mandatory: true }]);
      if (scoring) {
        assert.ok(out.length >= 1, `expected scoring requirement for: ${text}`);
        assert.equal(out[0]!.semanticKind, kind);
      } else {
        assert.equal(out.length, 0, `should not become requirement row: ${text}`);
      }
    });
  }

  it("rejects example verification scenarios", () => {
    const text = "Example verification scenario — bidder may optionally demonstrate failover";
    assert.equal(isNonRequirementText(text), true);
    assert.equal(isRealBidderObligation(text), false);
    assert.equal(normalizeRequirements([{ category: "x", description: text, mandatory: false }]).length, 0);
  });

  it("rejects realistic tender QA lines (subject, tender facts, verification scenario)", () => {
    for (const text of [
      "Subject: Supply, installation, configuration and maintenance of an audiovisual system.",
      "tender facts. They must not be converted into bidder requirements unless another clause explicitly creates an obligation.",
      "B. An uploaded warranty document with unclear validity or scope must remain unverified until evidence is sufficient.",
    ]) {
      assert.equal(isNonRequirementText(text), true, text);
      assert.equal(isRealBidderObligation(text), false, text);
      assert.equal(
        normalizeRequirements([{ category: "x", description: text, mandatory: true }]).length,
        0,
        text,
      );
    }
  });

  it("preserves mandatory language without weakening", () => {
    const text = "The supplier must provide 24/7 on-site support during warranty period";
    const out = normalizeRequirements([{ category: "technical", description: text, mandatory: true }]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.obligationStrength, "MANDATORY");
    assert.equal(out[0]!.mandatory, true);
    assert.match(out[0]!.requirement, /must provide/);
  });

  it("does not infer mandatory without evidence", () => {
    const text = "Company registration certificate may be requested during evaluation";
    const strength = deriveObligationStrength(text, "REQUIRED_DOCUMENT");
    assert.notEqual(strength, "MANDATORY");
  });

  it("merges duplicate obligations with shared fingerprint", () => {
    const out = normalizeRequirements([
      {
        category: "administrative",
        description: "Bidders must submit CNSS attestation dated within 90 days",
        mandatory: true,
        sourcePage: 4,
      },
      {
        category: "document",
        description: "CNSS attestation (valid within 90 days) must be included in the dossier",
        mandatory: true,
        sourcePage: 7,
      },
    ]);
    assert.equal(out.length, 1);
    assert.ok((out[0]!.sourcePages?.length ?? 0) >= 1);
  });
});
