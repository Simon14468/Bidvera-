/**
 * STI document-complexity hardening — universal real-world patterns.
 * Includes AfDB-style conditional reunification (condition + mandatory action).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeConditionality,
  analyzeVersionApplicability,
  buildCanonicalSemanticCandidates,
  buildTableSemanticContext,
  interpretSemanticStatement,
  reunifyClauseFromContext,
} from "@/domain/semantic-tender-intelligence";

describe("STI complexity — multi-paragraph / AfDB conditional attachment", () => {
  it("reunifies orphan condition + following mandatory action (AfDB pattern)", () => {
    const condition =
      "Where the bidder relies on a subcontractor for cybersecurity services";
    const action =
      "the bidder shall demonstrate that the subcontractor holds ISO 27001 certification.";
    const reunified = reunifyClauseFromContext({
      text: condition,
      followingText: action,
    });
    assert.equal(reunified.reconstructedFromContext, true);
    assert.match(reunified.reunifiedText, /Where the bidder relies/i);
    assert.match(reunified.reunifiedText, /shall demonstrate/i);

    const s = interpretSemanticStatement({
      text: condition,
      provenance: { sourceDocument: "afdb-cyber.pdf", sourcePage: 12 },
      context: { followingText: action, packageDocumentRole: "RFP" },
    });
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.applicability, "CONDITIONAL");
    assert.equal(s.obligationStrength, "CONDITIONAL");
    assert.ok(s.conditionality.conditionText);
    assert.ok(s.conditionality.actionText || /shall demonstrate/i.test(s.requirementText));
    assert.match(s.requirementText, /Where the bidder relies/i);
    assert.match(s.requirementText, /ISO 27001/i);
    assert.equal(s.reconstructedFromContext, true);
  });

  it("attaches preceding condition to isolated action sentence", () => {
    const s = interpretSemanticStatement({
      text: "The bidder shall provide evidence of ISO 27001 certification for the proposed SOC services.",
      provenance: { sourceDocument: "pack.pdf", sourcePage: 4 },
      context: {
        precedingText:
          "If the proposed solution includes managed security operations,",
      },
    });
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.applicability, "CONDITIONAL");
    assert.match(s.requirementText, /If the proposed solution/i);
    assert.match(s.requirementText, /ISO 27001/i);
  });

  it("orphan condition without action stays verification — never unconditional", () => {
    const s = interpretSemanticStatement({
      text: "Where applicable under the Tender Particulars.",
      provenance: { sourceDocument: "pack.pdf" },
    });
    assert.notEqual(s.applicability, "UNCONDITIONAL");
    assert.equal(s.admitToCanonical, false);
  });
});

describe("STI complexity — conditional structure preservation", () => {
  it("preserves PROVIDED THAT + exception", () => {
    const c = analyzeConditionality(
      "Provided that the bidder is registered in the project country, the bidder shall submit tax clearance, except where a tax exemption certificate is furnished.",
    );
    assert.equal(c.applicability, "CONDITIONAL");
    assert.ok(c.conditionText);
    assert.ok(c.actionText);
    assert.ok(c.exceptionText);
  });

  it("WHEN condition keeps CONDITIONAL strength on admission", () => {
    const s = interpretSemanticStatement({
      text: "When the bidder proposes equipment manufactured abroad, the bidder must provide manufacturer authorization.",
      provenance: { sourceDocument: "itt.pdf" },
    });
    assert.equal(s.admitToCanonical, true);
    assert.equal(s.applicability, "CONDITIONAL");
    assert.equal(s.obligationStrength, "CONDITIONAL");
  });
});

describe("STI complexity — tables", () => {
  it("table headers never become requirements", () => {
    const header = buildTableSemanticContext({
      text: "Item | Description | Qty | Unit",
      isHeader: true,
    });
    assert.equal(header.isTableHeader, true);
    const s = interpretSemanticStatement({
      text: "Item | Description | Qty | Unit",
      provenance: { sourceDocument: "sor.pdf", sourceCell: "A1" },
      context: { table: header, packageDocumentRole: "SCHEDULE_OF_REQUIREMENTS" },
    });
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.exclusionCode, "EXCLUDED_TABLE_HEADER");
  });

  it("table requirement cell preserves lot/unit/threshold provenance", () => {
    const table = buildTableSemanticContext({
      text: "Firewall throughput at least 2 Gbps",
      columnHeader: "Minimum requirement",
      rowLabel: "FW-01",
      sourceLocation: "Schedule A / Row 4",
    });
    const s = interpretSemanticStatement({
      text: "The bidder shall supply items conforming to firewall throughput at least 2 Gbps.",
      provenance: {
        sourceDocument: "sor.pdf",
        sourcePage: 8,
        sourceSection: "Schedule A",
        sourceCell: "B4",
      },
      context: { table, packageDocumentRole: "SCHEDULE_OF_REQUIREMENTS" },
    });
    assert.equal(s.admitToCanonical, true);
    assert.ok(s.tableContext);
    assert.equal(s.provenance.sourceDocument, "sor.pdf");
    assert.equal(s.provenance.sourcePage, 8);
    assert.ok(s.tableContext?.threshold || /2\s*Gbps/i.test(s.requirementText));
  });
});

describe("STI complexity — document role changes meaning", () => {
  it("same sentence: sample contract → post-award; ITB → may admit differently", () => {
    const text =
      "The Contractor shall provide monthly progress reports during the contract period.";
    const inContract = interpretSemanticStatement({
      text,
      provenance: { sourceDocument: "sample-contract.pdf" },
      context: { packageDocumentRole: "SAMPLE_CONTRACT" },
    });
    assert.equal(inContract.admitToCanonical, false);
    assert.match(inContract.clausePurpose, /POST_AWARD/);

    const inItb = interpretSemanticStatement({
      text: "The Bidder shall submit monthly staffing plans with the technical proposal.",
      provenance: { sourceDocument: "itt.pdf" },
      context: { packageDocumentRole: "INSTRUCTIONS_TO_BIDDERS" },
    });
    assert.equal(inItb.admitToCanonical, true);
  });
});

describe("STI complexity — procurement phase", () => {
  it("post-award contractor never becomes bidder compliance", () => {
    const s = interpretSemanticStatement({
      text: "The Contractor shall maintain insurance throughout the contract.",
      provenance: { sourceDocument: "gcc.pdf" },
      context: { packageDocumentRole: "CONTRACT_FORM" },
    });
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.procurementPhase), /POST_AWARD|CONTRACT_PERFORMANCE|CONTRACT_EXECUTION|DELIVERY_IMPLEMENTATION|UNKNOWN/);
  });

  it("award-stage successful bidder remains AWARD", () => {
    const s = interpretSemanticStatement({
      text: "The successful bidder shall provide performance security within 10 days of award.",
      provenance: { sourceDocument: "itt.pdf" },
    });
    assert.equal(s.procurementPhase, "AWARD");
    assert.equal(s.admitToCanonical, true);
  });
});

describe("STI complexity — templates & surrounding protection", () => {
  it("protects surrounding template-dependent clauses", () => {
    const s = interpretSemanticStatement({
      text: "The Contractor shall commence performance not later than [insert date] and choose one of the options below.",
      provenance: { sourceDocument: "forms.pdf" },
      context: { packageDocumentRole: "CONTRACT_FORM" },
    });
    assert.equal(s.admitToCanonical, false);
    assert.notEqual(s.templateStatus, "NOT_TEMPLATE");
  });
});

describe("STI complexity — procedural content", () => {
  it("buyer arithmetic correction is procedural", () => {
    const s = interpretSemanticStatement({
      text: "The Purchaser shall correct arithmetical errors in the financial offer without prior approval of the bidder.",
      provenance: { sourceDocument: "itt.pdf" },
    });
    assert.equal(s.admitToCanonical, false);
    assert.match(s.clausePurpose, /PROCEDURAL|BUYER/);
  });

  it("eSourcing click path is procedural", () => {
    const s = interpretSemanticStatement({
      text: "Click on the Upload button in the e-sourcing portal to attach your proposal files.",
      provenance: { sourceDocument: "guide.pdf" },
    });
    assert.equal(s.admitToCanonical, false);
    assert.ok(
      s.exclusionCode === "EXCLUDED_PORTAL_OPERATION" ||
        s.exclusionCode === "EXCLUDED_PROCEDURAL",
    );
  });
});

describe("STI complexity — versioning", () => {
  it("addendum metadata is not a requirement", () => {
    const v = analyzeVersionApplicability({
      text: "Addendum No. 2",
      documentRole: "AMENDMENT",
    });
    assert.equal(v.status, "NOT_APPLICABLE");
    const s = interpretSemanticStatement({
      text: "Addendum No. 2",
      provenance: { sourceDocument: "addendum-2.pdf", versionLabel: "Addendum 2" },
      context: { packageDocumentRole: "AMENDMENT" },
    });
    assert.equal(s.admitToCanonical, false);
  });

  it("unproven replacement is REVIEW — never invents substitute clause", () => {
    const v = analyzeVersionApplicability({
      text: "This corrigendum replaces Clause 4.2.",
      documentRole: "CORRIGENDUM",
    });
    assert.equal(v.status, "REVIEW");
    assert.equal(v.replacesProven, false);
  });
});

describe("STI complexity — fragments, duplicates, provenance, no silent drops", () => {
  it("rejects incomplete fragments with machine-readable reason", () => {
    const s = interpretSemanticStatement({
      text: "The bidder shall submit the following certificates to",
      provenance: { sourceDocument: "itt.pdf" },
    });
    assert.equal(s.boundaryComplete, false);
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.exclusionCode, "EXCLUDED_INCOMPLETE_BOUNDARY");
  });

  it("every rejected candidate in batch has exclusionCode", () => {
    const { rejected, candidates } = buildCanonicalSemanticCandidates(
      [
        {
          description: "The Purchaser shall evaluate the bids.",
          sourceDocument: "itt.pdf",
        },
        {
          description: "Item | Description | Qty",
          sourceDocument: "sor.pdf",
          isTableHeader: true,
        },
        {
          description:
            "The bidder shall submit audited financial statements for three years.",
          sourceDocument: "itt.pdf",
          sourcePage: 3,
          sourceSection: "Eligibility",
        },
      ],
      { packageLabel: "pack.pdf" },
    );
    assert.ok(candidates.length >= 1);
    assert.ok(rejected.length >= 1);
    for (const r of rejected) {
      assert.ok(r.exclusionCode, `missing exclusion for: ${r.requirementText}`);
    }
    const admitted = candidates[0]!;
    assert.ok(admitted.sourceDocument);
    assert.ok(admitted.provenance.length >= 1);
  });

  it("cross-document duplicate collapses with provenance links", () => {
    const { candidates } = buildCanonicalSemanticCandidates(
      [
        {
          description:
            "The bidder shall submit audited financial statements for the last three years.",
          sourceDocument: "itt.pdf",
          sourcePage: 2,
        },
        {
          description:
            "The bidder shall submit audited financial statements for the last three years.",
          sourceDocument: "addendum.pdf",
          sourcePage: 1,
        },
      ],
      { packageLabel: "pack.pdf" },
    );
    assert.equal(candidates.length, 1);
    assert.ok(candidates[0]!.provenance.length >= 2);
  });
});
