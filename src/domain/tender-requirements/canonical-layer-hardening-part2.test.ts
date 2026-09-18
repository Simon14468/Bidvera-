/**
 * Part 2 — Canonical requirement integrity (conditional, lots, numbering, tables,
 * page breaks, OCR, duplicates, IDs, required documents, UNKNOWN).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCanonicalRequirements,
  classifyRequirementSemanticKind,
  decodeLotFromSourceSection,
  deriveObligationStrength,
  extractLotApplicability,
  formatLotApplicability,
  hasConditionalTriggerContext,
  isNonRequirementText,
  isRealBidderObligation,
  mergeNormalizedRequirements,
  normalizeRequirements,
  obligationFingerprint,
  reconcileConditionalObligation,
} from "./index";
import type { NormalizedRequirement } from "./types";
import { extractTenderPackageHeuristic, joinSoftWrappedPdfLines } from "@/services/tender-extraction/requirements-heuristic";

function base(
  partial: Partial<NormalizedRequirement> & Pick<NormalizedRequirement, "requirement">,
): NormalizedRequirement {
  return {
    category: "MANDATORY_TECHNICAL",
    semanticKind: "TECHNICAL_REQUIREMENT",
    obligationStrength: "MANDATORY",
    title: "Req",
    mandatory: true,
    confidence: "MEDIUM",
    ...partial,
  };
}

describe("Part2 — conditional requirements preserve trigger context", () => {
  const triggers = [
    "If applicable, the bidder must provide a local content certificate.",
    "Where applicable, the Tenderer shall submit manufacturer authorization.",
    "When applicable, a performance bond must be furnished within 10 days.",
    "Only if a joint venture is proposed, the JV must submit a joint liability statement.",
    "Applicable to Lot 2 only: the contractor shall provide 36 months warranty.",
    "For joint ventures, each member must demonstrate registration in the country of performance.",
  ];

  for (const text of triggers) {
    it(`keeps trigger: "${text.slice(0, 48)}…"`, () => {
      assert.ok(hasConditionalTriggerContext(text) || /lot\s*2|joint\s+venture/i.test(text));
      const out = normalizeRequirements([
        { category: "administrative", description: text, mandatory: true },
      ]);
      assert.equal(out.length, 1, text);
      assert.ok(out[0]!.requirement.length >= text.length - 5);
      if (hasConditionalTriggerContext(text)) {
        assert.equal(out[0]!.obligationStrength, "CONDITIONAL");
        assert.equal(out[0]!.mandatory, false);
      }
    });
  }

  it("orphan CONDITIONAL without recoverable trigger becomes NEEDS_VERIFICATION", () => {
    const orphan = reconcileConditionalObligation(
      base({
        requirement: "Provide manufacturer authorization for imported equipment.",
        obligationStrength: "CONDITIONAL",
        mandatory: false,
        evidenceText: "manufacturer authorization",
      }),
    );
    assert.equal(orphan.obligationStrength, "INFORMATIONAL");
    assert.equal(orphan.mandatory, false);
    assert.equal(orphan.confidence, "UNCERTAIN");
    assert.match(orphan.verificationReason ?? "", /needs verification/i);
  });
});

describe("Part2 — lots applicability", () => {
  it("extracts lot-specific applicability", () => {
    const lot = extractLotApplicability(
      "The contractor shall install CCTV cameras for Lot 1.",
      "Lot 1: Security systems",
    );
    assert.equal(formatLotApplicability(lot), "LOT_1");
  });

  it("detects all-lots applicability", () => {
    const lot = extractLotApplicability(
      "Applicable to all lots: the bidder must be legally registered.",
      null,
    );
    assert.equal(formatLotApplicability(lot), "ALL_LOTS");
  });

  it("merges identical obligations across lots without duplicating rows", () => {
    const merged = mergeNormalizedRequirements([
      base({
        requirement: "The bidder must submit a tax clearance certificate with the dossier.",
        sourceSection: "Lot 1",
        lotApplicability: "LOT_1",
        semanticKind: "REQUIRED_DOCUMENT",
        category: "MANDATORY_ADMINISTRATIVE",
      }),
      base({
        requirement: "The bidder must submit a tax clearance certificate with the dossier.",
        sourceSection: "Lot 2",
        lotApplicability: "LOT_2",
        semanticKind: "REQUIRED_DOCUMENT",
        category: "MANDATORY_ADMINISTRATIVE",
      }),
    ]);
    assert.equal(merged.length, 1);
    assert.ok(/LOT_1/i.test(merged[0]!.lotApplicability ?? ""));
    assert.ok(/LOT_2/i.test(merged[0]!.lotApplicability ?? ""));
    const decoded = decodeLotFromSourceSection(merged[0]!.sourceSection);
    assert.equal(decoded.kind, "LOTS");
    if (decoded.kind === "LOTS") {
      assert.deepEqual(decoded.lots, ["1", "2"]);
    }
  });

  it("does not merge distinct lot-specific thresholds", () => {
    const merged = mergeNormalizedRequirements([
      base({
        requirement: "For Lot 1 the supplier shall provide a warranty period of 24 months.",
        sourceSection: "Lot 1",
      }),
      base({
        requirement: "For Lot 2 the supplier shall provide a warranty period of 36 months.",
        sourceSection: "Lot 2",
      }),
    ]);
    assert.equal(merged.length, 2);
  });

  it("canonical normalize encodes lot into sourceSection", () => {
    const out = normalizeRequirements([
      {
        category: "technical",
        description: "Lot 2: The contractor shall install Wi-Fi 6 access points with central management.",
        mandatory: true,
        sourceSection: "Lot 2 Technical",
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.lotApplicability, "LOT_2");
    assert.match(out[0]!.sourceSection ?? "", /\[LOT_2\]/);
  });
});

describe("Part2 — numbering is semantic, not structural", () => {
  it("rejects numbered instructions without obligation", () => {
    const text = "5.4 Instructions to tenderers on how to prepare the offer.";
    assert.equal(isNonRequirementText(text), true);
    assert.equal(isRealBidderObligation(text), false);
    assert.equal(
      normalizeRequirements([{ category: "x", description: text, mandatory: false }]).length,
      0,
    );
  });

  it("keeps numbered obligation with shall", () => {
    const text = "5.5 The Tenderer shall submit the signed proposal before the tender opening date.";
    assert.equal(isRealBidderObligation(text), true);
    const out = normalizeRequirements([
      { category: "administrative", description: text, mandatory: true },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.id, undefined); // no ETR-style ID manufactured from 5.5
  });
});

describe("Part2 — tables preserve obligations, not headers", () => {
  it("rejects table header lines", () => {
    assert.equal(isNonRequirementText("Description | Qty | Unit | Remarks"), true);
    assert.equal(
      normalizeRequirements([
        { category: "technical", description: "Item | Specification | Compliance", mandatory: false },
      ]).length,
      0,
    );
  });

  it("keeps obligation rows from specification tables", () => {
    const text =
      "T-06 The proposed firewall must support at least 1 Gbps stateful throughput and active subscriptions.";
    const out = normalizeRequirements([
      { category: "technical", description: text, mandatory: true, sourceSection: "Technical schedule" },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.id, "T-06");
  });

  it("heuristic harvest keeps table obligation and drops header", () => {
    const pack = extractTenderPackageHeuristic({
      text: `
Technical Schedule
Item | Description | Requirement
1 | Firewall | The bidder shall supply a firewall supporting 1 Gbps throughput.
`,
      fileName: "table.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
      sourceDocument: "table.pdf",
    });
    assert.ok(canonical.some((r) => /firewall/i.test(r.requirement) && /shall/i.test(r.requirement)));
    assert.ok(!canonical.some((r) => /^Item\s*\|\s*Description/i.test(r.requirement)));
  });
});

describe("Part2 — page breaks and OCR text quality", () => {
  it("joins hyphenated wraps and skips repeated OCR headers", () => {
    const joined = joinSoftWrappedPdfLines(
      [
        "The bidder shall complete the installa-",
        "tion works within 60 days.",
        "Confidential",
        "Confidential",
        "Page 3 of 20",
      ].join("\n"),
    );
    assert.match(joined, /installation works within 60 days/i);
    assert.equal((joined.match(/Confidential/gi) ?? []).length, 1);
  });

  it("continues obligation across pdf-parse page markers", () => {
    const text = `
E-02 The bidder shall demonstrate at least five years of comparable
--- Page 4 (pdf-parse) ---
project experience with documentary references.
`;
    const pack = extractTenderPackageHeuristic({ text, fileName: "ocr-page.pdf" });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
      sourceDocument: "ocr-page.pdf",
    });
    assert.ok(canonical.some((r) => /documentary references/i.test(r.requirement)));
    assert.ok(canonical.every((r) => !/\b(the|and|of|for|with|by|to)\s*$/i.test(r.requirement.trim())));
  });
});

describe("Part2 — duplicates preserve provenance and do not over-merge", () => {
  it("collapses paraphrases while keeping pages and conditional context", () => {
    const merged = mergeNormalizedRequirements([
      base({
        requirement: "Provisional bond / caution provisoire of MAD 12,000 required",
        page: 2,
        sourcePages: [2],
        semanticKind: "GUARANTEE_SECURITY_REQUIREMENT",
        category: "MANDATORY_ADMINISTRATIVE",
      }),
      base({
        requirement:
          "If applicable, a provisional bond (caution provisoire) of MAD 12,000 must be submitted with the dossier.",
        page: 5,
        sourcePages: [5],
        obligationStrength: "CONDITIONAL",
        mandatory: false,
        semanticKind: "GUARANTEE_SECURITY_REQUIREMENT",
        category: "MANDATORY_ADMINISTRATIVE",
      }),
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.obligationStrength, "CONDITIONAL");
    assert.ok((merged[0]!.sourcePages ?? []).includes(2));
    assert.ok((merged[0]!.sourcePages ?? []).includes(5));
    assert.ok(hasConditionalTriggerContext(merged[0]!.requirement));
  });

  it("does not merge merely similar wording with different obligations", () => {
    const a = "The bidder must provide ISO 9001 certification.";
    const b = "The bidder must provide ISO 14001 certification.";
    assert.notEqual(
      obligationFingerprint(a, "MANDATORY_ELIGIBILITY"),
      obligationFingerprint(b, "MANDATORY_ELIGIBILITY"),
    );
    const merged = mergeNormalizedRequirements([
      base({
        requirement: a,
        semanticKind: "ELIGIBILITY_REQUIREMENT",
        category: "MANDATORY_ELIGIBILITY",
      }),
      base({
        requirement: b,
        semanticKind: "ELIGIBILITY_REQUIREMENT",
        category: "MANDATORY_ELIGIBILITY",
      }),
    ]);
    assert.equal(merged.length, 2);
  });
});

describe("Part2 — requirement IDs stay meaningful", () => {
  it("preserves ETR codes and does not invent IDs from section numbers", () => {
    const out = normalizeRequirements([
      {
        category: "technical",
        description: "R-09 The bidder must supply and install Category 6A structured cabling.",
        mandatory: true,
      },
      {
        category: "administrative",
        description: "3.2 The Tenderer shall sign every page of the financial offer.",
        mandatory: true,
      },
    ]);
    const r09 = out.find((r) => /Category 6A/i.test(r.requirement));
    const signed = out.find((r) => /sign every page/i.test(r.requirement));
    assert.ok(r09);
    assert.equal(r09!.id, "R-09");
    if (signed) {
      assert.equal(signed.id, undefined);
    }
  });
});

describe("Part2 — required documents vs capability vs evidence", () => {
  it("keeps experience capability separate from evidence document", () => {
    const capability =
      "The bidder must demonstrate at least 5 years of experience in comparable public-sector projects.";
    const evidenceDoc =
      "The bidder must submit reference letters proving 5 years of experience as supporting documents.";
    assert.notEqual(
      obligationFingerprint(capability, "MANDATORY_ELIGIBILITY"),
      obligationFingerprint(evidenceDoc, "MANDATORY_ADMINISTRATIVE"),
    );
    const kindCap = classifyRequirementSemanticKind({ description: capability });
    const kindDoc = classifyRequirementSemanticKind({ description: evidenceDoc });
    assert.equal(kindCap, "ELIGIBILITY_REQUIREMENT");
    assert.equal(kindDoc, "REQUIRED_DOCUMENT");
    const out = normalizeRequirements([
      { category: "experience", description: capability, mandatory: true },
      { category: "documentation", description: evidenceDoc, mandatory: true },
    ]);
    assert.equal(out.length, 2);
  });
});

describe("Part2 — UNKNOWN remains uncertain, not a false requirement", () => {
  it("ambiguous non-obligation text does not enter canonical set", () => {
    const text =
      "Market participants are expected to observe ordinary commercial practices referenced herein.";
    const kind = classifyRequirementSemanticKind({ description: text });
    const strength = deriveObligationStrength(text, kind);
    assert.ok(strength === "INFORMATIONAL" || !isRealBidderObligation(text));
    assert.equal(
      normalizeRequirements([{ category: "administrative", description: text, mandatory: true }])
        .length,
      0,
    );
  });

  it("clear obligation without domain cues can remain UNKNOWN but never mandatory/high-confidence", () => {
    const text =
      "The bidder shall comply with all site access and safety induction rules published by the contracting authority.";
    assert.equal(isRealBidderObligation(text), true);
    const kind = classifyRequirementSemanticKind({ description: text });
    const out = normalizeRequirements([
      {
        category: "administrative",
        description: text,
        mandatory: true,
        evidenceText: text,
        sourcePage: 3,
      },
    ]);
    assert.equal(out.length, 1);
    assert.ok(
      kind === "UNKNOWN" ||
        kind === "ADMINISTRATIVE_REQUIREMENT" ||
        kind === "CONTRACTUAL_OBLIGATION" ||
        kind === "PERFORMANCE_OBLIGATION",
    );
    if (out[0]!.semanticKind === "UNKNOWN") {
      assert.equal(out[0]!.mandatory, false);
      assert.equal(out[0]!.confidence, "UNCERTAIN");
      assert.notEqual(out[0]!.obligationStrength, "MANDATORY");
    } else {
      assert.equal(out[0]!.obligationStrength, "MANDATORY");
    }
  });
});
