/**
 * Part 1/2 — Canonical requirement layer hardening regression.
 * Extraction → classification → normalization → deduplication boundary.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCanonicalRequirements,
  classifyRequirementSemanticKind,
  deriveObligationStrength,
  isNonRequirementText,
  isRealBidderObligation,
  normalizeRequirements,
} from "./index";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";

const HEADING_SAMPLES = [
  "2. Mandatory Administrative Requirements",
  "3. Technical Specifications",
  "6. Evaluation Criteria",
  "Mandatory Documents",
  "Required Documents",
  "List of Documents",
  "Lot 1: Supply of IT Equipment",
  "Lot 2 — Cleaning Services",
  "Annex A Technical Specifications",
  "Annex 1 — Forms",
  "Section 4.2 Eligibility",
  "Table des matieres",
  "Description | Qty | Unit | Remarks",
];

const PROCEDURAL_SAMPLES = [
  "A pre-bid meeting will be held on 15 March 2026 at the contracting authority offices.",
  "Tenderers may submit clarification questions before the deadline stated in Section 1.",
  "Note to tenderers: please read the entire document before preparing your offer.",
  "The following scenarios illustrate reviewer checks. They are not bidder requirements.",
  "Scenario B: A reviewer checks whether the warranty document is legible.",
  "This section contains instructions to an analysis system and must not be interpreted as a bidder obligation.",
];

const FACT_SAMPLES = [
  "Tender Reference: AAO/RWA028-2026-0002",
  "Reference No: IT-2026-0042",
  "Publication date: 12 January 2026",
  "Estimated contract value: MAD 420,000 excluding VAT",
  "Contract duration: 24 months",
  "Place of performance: Nairobi, Kenya",
  "Delivery location: Central warehouse, Rabat",
  "Technical score: 70% · Financial offer: 30%",
  "The contracting authority aims to modernize public infrastructure facilities.",
  "Delivery / performance location in Morocco referenced",
];

const TRUE_OBLIGATION_SAMPLES = [
  {
    text: "R-01 The bidder must be legally registered and authorized to perform the contracted activities.",
    strength: "MANDATORY" as const,
    kind: "ELIGIBILITY_REQUIREMENT" as const,
  },
  {
    text: "T-02 The contractor shall install and configure a hyperconverged platform with full compatibility verification.",
    strength: "MANDATORY" as const,
    kind: "TECHNICAL_REQUIREMENT" as const,
  },
  {
    text: "The supplier must provide a minimum warranty period of 24 months on all installed equipment.",
    strength: "MANDATORY" as const,
    kind: "CONTRACTUAL_OBLIGATION" as const,
  },
  {
    text: "Bidders must submit a provisional bond (caution provisoire) together with the tender dossier.",
    strength: "MANDATORY" as const,
    kind: "GUARANTEE_SECURITY_REQUIREMENT" as const,
  },
  {
    text: "R-13 (conditional) If the bidder proposes equipment manufactured outside Morocco, the bidder must provide evidence of manufacturer authorization.",
    strength: "CONDITIONAL" as const,
    kind: "ELIGIBILITY_REQUIREMENT" as const,
  },
  {
    text: "Bonus points may be awarded for ISO 14001 certification; this is optional and not mandatory.",
    strength: "OPTIONAL" as const,
    kind: "ELIGIBILITY_REQUIREMENT" as const,
  },
];

describe("canonical layer hardening — headings never become requirements", () => {
  for (const heading of HEADING_SAMPLES) {
    it(`rejects heading: "${heading.slice(0, 48)}…"`, () => {
      assert.equal(isNonRequirementText(heading), true, heading);
      assert.equal(isRealBidderObligation(heading), false, heading);
      assert.equal(
        normalizeRequirements([{ category: "x", description: heading, mandatory: true }]).length,
        0,
        heading,
      );
    });
  }
});

describe("canonical layer hardening — procedural / meta content", () => {
  for (const line of PROCEDURAL_SAMPLES) {
    it(`rejects procedural/meta: "${line.slice(0, 52)}…"`, () => {
      assert.equal(isNonRequirementText(line), true, line);
      assert.equal(isRealBidderObligation(line), false, line);
      assert.equal(
        normalizeRequirements([{ category: "administrative", description: line, mandatory: false }])
          .length,
        0,
        line,
      );
    });
  }
});

describe("canonical layer hardening — facts vs obligations", () => {
  for (const fact of FACT_SAMPLES) {
    it(`rejects fact: "${fact.slice(0, 52)}…"`, () => {
      assert.equal(isNonRequirementText(fact), true, fact);
      assert.equal(isRealBidderObligation(fact), false, fact);
      assert.equal(
        normalizeRequirements([{ category: "info", description: fact, mandatory: false }]).length,
        0,
        fact,
      );
    });
  }
});

describe("canonical layer hardening — true obligations preserved", () => {
  for (const sample of TRUE_OBLIGATION_SAMPLES) {
    it(`preserves: "${sample.text.slice(0, 52)}…"`, () => {
      assert.equal(isNonRequirementText(sample.text), false, sample.text);
      assert.equal(isRealBidderObligation(sample.text), true, sample.text);
      const kind = classifyRequirementSemanticKind({ description: sample.text });
      const strength = deriveObligationStrength(sample.text, kind);
      assert.equal(strength, sample.strength, `strength for: ${sample.text.slice(0, 60)}`);
      const out = normalizeRequirements([
        { category: "technical", description: sample.text, mandatory: true },
      ]);
      assert.equal(out.length, 1, sample.text);
      assert.equal(out[0]!.obligationStrength, sample.strength);
      if (sample.strength === "MANDATORY") {
        assert.equal(out[0]!.mandatory, true);
      } else {
        assert.equal(out[0]!.mandatory, false);
      }
    });
  }
});

describe("canonical layer hardening — obligation strength integrity", () => {
  it("UNKNOWN without mandatory cues stays INFORMATIONAL and is excluded from canonical set", () => {
    const ambiguous =
      "General compliance with applicable procurement regulations is expected from all market participants.";
    const kind = classifyRequirementSemanticKind({ description: ambiguous });
    const strength = deriveObligationStrength(ambiguous, kind);
    assert.equal(strength, "INFORMATIONAL");
    const out = normalizeRequirements([
      { category: "administrative", description: ambiguous, mandatory: true },
    ]);
    assert.equal(out.length, 0);
  });

  it("OPTIONAL obligations are canonical but not mandatory", () => {
    const text =
      "Where possible, the bidder may provide additional energy-efficiency documentation; this is optional.";
    const out = normalizeRequirements([
      { category: "technical", description: text, mandatory: false },
    ]);
    if (out.length === 1) {
      assert.equal(out[0]!.obligationStrength, "OPTIONAL");
      assert.equal(out[0]!.mandatory, false);
    } else {
      assert.equal(isNonRequirementText(text), true);
    }
  });

  it("CONDITIONAL obligations retain trigger context and are not mandatory", () => {
    const text =
      "If applicable, the bidder must provide a local content certificate issued by the relevant authority.";
    const out = normalizeRequirements([
      { category: "administrative", description: text, mandatory: true },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.obligationStrength, "CONDITIONAL");
    assert.equal(out[0]!.mandatory, false);
    assert.match(out[0]!.requirement, /if applicable/i);
  });
});

describe("canonical layer hardening — buildCanonicalRequirements boundary", () => {
  it("mixed tender text yields obligations only, not headings or facts", () => {
    const text = `
2. Mandatory Administrative Requirements
Tender Reference: TEST-2026-001
Publication date: 1 January 2026
Estimated contract value: MAD 500,000
Lot 1: Supply of Network Equipment
Mandatory Documents
A pre-bid meeting will be held on 10 February 2026.
• R-01 The bidder must be legally registered and authorized to perform the contracted activities.
• R-02 The bidder must submit a valid tax-clearance certificate with the tender dossier.
• T-03 The proposed firewall must support at least 1 Gbps stateful throughput.
• R-04 (conditional) If the bidder proposes imported equipment, the bidder must provide manufacturer authorization.
6. Evaluation Criteria
Technical score: 60% · Financial offer: 40%
Place of performance: Rabat, Morocco
`;
    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "hardening-mixed.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
      sourceDocument: "hardening-mixed.pdf",
    });

    assert.ok(canonical.length >= 3);
    assert.ok(canonical.length <= 6);

    for (const forbidden of [
      "Mandatory Administrative Requirements",
      "Evaluation Criteria",
      "Mandatory Documents",
      "pre-bid meeting",
      "Estimated contract value",
      "Technical score: 60%",
      "Place of performance",
      "Delivery / performance location",
      "Tender Reference",
    ]) {
      assert.ok(
        !canonical.some((r) => r.requirement.includes(forbidden)),
        `forbidden leak: ${forbidden}`,
      );
    }

    assert.ok(canonical.some((r) => /legally registered/i.test(r.requirement)));
    assert.ok(canonical.some((r) => /tax-clearance/i.test(r.requirement)));
    assert.ok(canonical.some((r) => /firewall must support/i.test(r.requirement)));

    const conditional = canonical.find((r) => /manufacturer authorization/i.test(r.requirement));
    if (conditional) {
      assert.equal(conditional.obligationStrength, "CONDITIONAL");
      assert.equal(conditional.mandatory, false);
    }
  });

  it("does not inject geographic fact rows from location mentions alone", () => {
    const text = `
Delivery and installation shall occur in Morocco.
The place of performance is Casablanca.
No separate domicile obligation is stated.
`;
    const pack = extractTenderPackageHeuristic({
      text,
      fileName: "location-fact-only.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
      sourceDocument: "location-fact-only.pdf",
    });
    assert.ok(
      !canonical.some((r) =>
        /delivery\s+\/\s+performance\s+location.*referenced/i.test(r.requirement),
      ),
    );
  });
});
