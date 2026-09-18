import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateTenderDocumentValidity,
  analyzeDocumentStructure,
  isExampleOrScenarioLine,
} from "@/domain/tender-validity";
import { messageForExtractionGateReason } from "@/domain/decision/extraction-gate";
import { resolveExtractionGateMessage } from "@/i18n/extraction-gate-messages";
import { sanitizeAiRiskSeverity } from "@/domain/risk/sanitize-ai-risk";
import {
  isNonRequirementText,
  buildCanonicalRequirements,
} from "@/domain/tender-requirements";

describe("tender validity gate", () => {
  it("rejects invoice documents before analysis", () => {
    const result = evaluateTenderDocumentValidity({
      text: "Tax Invoice #4421\nAmount due: 1,200 EUR\nPayment terms: Net 30\nThank you for your business.",
      fileName: "invoice-march.pdf",
    });
    assert.equal(result.valid, false);
    assert.equal(result.reason, "NOT_A_TENDER_DOCUMENT");
  });

  it("accepts RFP with bidder obligations", () => {
    const result = evaluateTenderDocumentValidity({
      text: `Request for Proposal — Auditorium AV Upgrade
Submission deadline: 30 September 2026
Tenderers shall provide ISO 9001 certification and must submit a provisional bond.
Technical specifications require HD projection and centralized control.`,
      fileName: "RFP-Auditorium.pdf",
    });
    assert.equal(result.valid, true);
  });

  it("rejects unreadable empty text", () => {
    const result = evaluateTenderDocumentValidity({
      text: "   ",
      fileName: "blank.pdf",
    });
    assert.equal(result.valid, false);
    assert.equal(result.reason, "UNREADABLE");
  });

  it("provides localized NOT_A_TENDER message", () => {
    const fr = resolveExtractionGateMessage("NOT_A_TENDER_DOCUMENT", "fr");
    assert.match(fr, /appel d'offres/i);
    assert.ok(messageForExtractionGateReason("NOT_A_TENDER_DOCUMENT").length > 20);
  });
});

describe("document understanding — examples excluded", () => {
  it("detects example sections in structure", () => {
    const structure = analyzeDocumentStructure(
      "Section 3 Technical requirements\nExample scenario: bidder provides sample layout only.",
    );
    assert.equal(structure.containsExamples, true);
  });

  it("rejects sample questions and test scenarios as requirements", () => {
    for (const text of [
      "Example: tenderer may submit a sample response for illustration only.",
      "Sample question 1: What is your warranty policy?",
      "Test case — verification scenario for mock bid layout.",
      "Tender title: Supply of AV Equipment",
      "Publication date: 1 January 2026",
    ]) {
      assert.equal(isNonRequirementText(text), true, text);
      assert.equal(isExampleOrScenarioLine(text) || isNonRequirementText(text), true, text);
    }
  });

  it("keeps real obligations in canonical set", () => {
    const canonical = buildCanonicalRequirements({
      aiDrafts: [
        {
          category: "certification",
          description: "Tenderers must provide ISO 9001 certification valid on submission date.",
          mandatory: true,
        },
        {
          category: "example",
          description: "Example scenario: sample booth layout for illustration only.",
          mandatory: false,
        },
        {
          category: "bond",
          description: "Bidder shall submit a provisional bond of 2% of contract value.",
          mandatory: true,
        },
      ],
      heuristicDrafts: [
        {
          category: "bond",
          description: "Provisional bond of two percent required at submission.",
          mandatory: true,
        },
      ],
    });
    assert.ok(canonical.length >= 1);
    assert.ok(
      canonical.some((r) => /iso 9001/i.test(r.requirement)),
      "real obligation kept",
    );
    assert.ok(
      !canonical.some((r) => /example scenario/i.test(r.requirement)),
      "example excluded",
    );
  });
});

describe("unknown ≠ high risk — AI risk sanitization", () => {
  it("caps uncertain AI risks below HIGH", () => {
    assert.equal(
      sanitizeAiRiskSeverity("HIGH", "Unable to determine if certification is valid"),
      "MEDIUM",
    );
    assert.equal(
      sanitizeAiRiskSeverity("CRITICAL", "Unknown compliance status — needs verification"),
      "MEDIUM",
    );
    assert.equal(
      sanitizeAiRiskSeverity("HIGH", "Mandatory ISO 9001 explicitly not held per profile"),
      "HIGH",
    );
  });
});
