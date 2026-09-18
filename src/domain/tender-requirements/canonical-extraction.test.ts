/**
 * Canonical requirement extraction — production regression suite.
 * Proves tender facts ≠ requirements, semantic dedupe, and source convergence.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUDIOVISUAL_TENDER_FIXTURE,
} from "./audiovisual-regression.test";
import {
  buildCanonicalRequirements,
  classifyRequirementCategory,
  isNonRequirementText,
  isRealBidderObligation,
  mergeNormalizedRequirements,
  normalizeRequirements,
  obligationFingerprint,
} from "./index";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";

describe("canonical extraction — tender facts are not requirements", () => {
  it("deadline lines are rejected as requirements", () => {
    assert.equal(isNonRequirementText("Closing date: 30 September 2026 at 17:00"), true);
    assert.equal(
      classifyRequirementCategory({ description: "Closing date: 30 September 2026 at 17:00" }),
      "INFORMATIONAL",
    );
    const out = normalizeRequirements([
      { category: "submission", description: "Closing date: 30 September 2026 at 17:00", mandatory: true },
    ]);
    assert.equal(out.length, 0);
  });

  it("contract value is rejected as a requirement", () => {
    assert.equal(isNonRequirementText("Estimated contract value: 4.200.000,00 DH TTC"), true);
    const out = normalizeRequirements([
      {
        category: "financial",
        description: "Estimated contract value: 4.200.000,00 DH TTC",
        mandatory: false,
      },
    ]);
    assert.equal(out.length, 0);
  });

  it("evaluation percentages are rejected as requirements", () => {
    assert.equal(isNonRequirementText("Technical score: 70% · Financial offer: 30%"), true);
    const out = normalizeRequirements([
      {
        category: "evaluation",
        description: "Technical score: 70% · Financial offer: 30%",
        mandatory: false,
      },
    ]);
    assert.equal(out.length, 0);
  });

  it("headings and synthetic meta are rejected", () => {
    for (const text of [
      "Table des matieres",
      "Section 2.1 Technical specifications",
      "This document is synthetic — for testing only.",
    ]) {
      assert.equal(isNonRequirementText(text), true, text);
      assert.equal(normalizeRequirements([{ category: "x", description: text, mandatory: false }]).length, 0);
    }
  });

  it("buyer/project descriptions without obligations are rejected", () => {
    const text =
      "The contracting authority aims to modernize auditorium facilities for public events.";
    assert.equal(isRealBidderObligation(text), false);
    assert.equal(normalizeRequirements([{ category: "info", description: text, mandatory: false }]).length, 0);
  });
});

describe("canonical extraction — semantic deduplication", () => {
  it("merges paraphrased provisional bond obligations into one", () => {
    const merged = mergeNormalizedRequirements([
      {
        category: "MANDATORY_ADMINISTRATIVE",
        semanticKind: "GUARANTEE_SECURITY_REQUIREMENT",
        obligationStrength: "MANDATORY",
        title: "Bond",
        requirement: "Provisional bond / caution provisoire required",
        mandatory: true,
        confidence: "MEDIUM",
        page: 6,
        sourcePages: [6],
        evidenceText: "caution provisoire",
        value: null,
        verificationStatus: "UNKNOWN",
      },
      {
        category: "MANDATORY_ADMINISTRATIVE",
        semanticKind: "GUARANTEE_SECURITY_REQUIREMENT",
        obligationStrength: "MANDATORY",
        title: "Bond",
        requirement:
          "Bidders must submit a provisional bond (caution provisoire) together with the tender dossier.",
        mandatory: true,
        confidence: "HIGH",
        page: 6,
        sourcePages: [6],
        evidenceText:
          "Bidders must submit a provisional bond (caution provisoire) together with the tender dossier.",
        value: null,
        verificationStatus: "UNKNOWN",
      },
    ]);
    assert.equal(merged.length, 1);
    assert.ok(merged[0]!.requirement.includes("must submit"));
    assert.match(
      obligationFingerprint(merged[0]!.requirement, merged[0]!.category),
      /^provisional-bond/,
    );
  });

  it("merges MAD bid security paraphrases into one obligation", () => {
    const merged = mergeNormalizedRequirements([
      {
        category: "MANDATORY_ADMINISTRATIVE",
        semanticKind: "GUARANTEE_SECURITY_REQUIREMENT",
        obligationStrength: "MANDATORY",
        title: "Bond",
        requirement:
          "The bid shall include a provisional bid security of MAD 84,000. The original document must be included in the bid dossier.",
        mandatory: true,
        confidence: "HIGH",
        page: 3,
        sourcePages: [3],
        evidenceText: null,
        value: null,
        verificationStatus: "UNKNOWN",
      },
      {
        category: "MANDATORY_ADMINISTRATIVE",
        semanticKind: "REQUIRED_DOCUMENT",
        obligationStrength: "MANDATORY",
        title: "Bond doc",
        requirement: "Provisional bid security — MAD 84,000 Mandatory",
        mandatory: true,
        confidence: "MEDIUM",
        page: 4,
        sourcePages: [4],
        evidenceText: null,
        value: null,
        verificationStatus: "UNKNOWN",
      },
    ]);
    assert.equal(merged.length, 1);
    assert.match(
      obligationFingerprint(merged[0]!.requirement, merged[0]!.category),
      /^provisional-bond-mad84,000/,
    );
  });

  it("AI + heuristic sources converge without duplicate count inflation", () => {
    const heuristic = extractTenderPackageHeuristic({
      text: AUDIOVISUAL_TENDER_FIXTURE,
      fileName: "Tender_Audiovisual_Equipment.pdf",
    });
    const canonical = buildCanonicalRequirements({
      aiDrafts: [
        {
          category: "technical",
          description:
            "Supply and install complete audiovisual system including projection equipment",
          mandatory: true,
        },
        {
          category: "technical",
          description:
            "The supplier must provide a minimum warranty period of 24 months on all installed AV equipment.",
          mandatory: true,
        },
      ],
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Tender_Audiovisual_Equipment.pdf",
    });
    assert.equal(canonical.length, 5);
  });
});

describe("canonical extraction — genuine obligations preserved", () => {
  it("audiovisual fixture yields exactly five canonical requirements", () => {
    const heuristic = extractTenderPackageHeuristic({
      text: AUDIOVISUAL_TENDER_FIXTURE,
      fileName: "Tender_Audiovisual_Equipment.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Tender_Audiovisual_Equipment.pdf",
    });
    assert.equal(canonical.length, 5);
    assert.ok(canonical.every((r) => isRealBidderObligation(r.requirement)));
    assert.ok(canonical.every((r) => r.category.startsWith("MANDATORY_") || r.category === "CONTRACTUAL"));
  });

  it("ambiguous referenced-only lines are not fabricated requirements", () => {
    const out = normalizeRequirements([
      {
        category: "experience",
        description: "Minimum experience requirement referenced",
        mandatory: true,
      },
      {
        category: "guarantee",
        description: "Guarantee / warranty condition referenced",
        mandatory: true,
      },
    ]);
    assert.equal(out.length, 0);
  });
});
