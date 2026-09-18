/**
 * STI final authority — 16-check admission gate, contamination invariants,
 * metadata separation, and complete STI field carry-through.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FINAL_ADMISSION_CHECKS,
  StiApprovedRequirementBatch,
  buildCanonicalSemanticCandidates,
  evaluateFinalSemanticAdmission,
  finalAdmissionFromInterpreted,
  interpretSemanticStatement,
} from "@/domain/semantic-tender-intelligence";
import {
  buildCanonicalRequirements,
  buildCanonicalRequirementsThroughSti,
} from "@/domain/tender-requirements";

describe("STI final authority — 16-check admission gate", () => {
  it("exposes exactly 16 named conjuncts", () => {
    assert.equal(FINAL_ADMISSION_CHECKS.length, 16);
  });

  it("AfDB conditional obligation preserves condition + action through seal", () => {
    const { candidates, rejected } = buildCanonicalSemanticCandidates(
      [
        {
          description:
            "Where the bidder relies on a subcontractor for cybersecurity services",
          followingText:
            "the bidder shall demonstrate that the subcontractor holds ISO 27001 certification.",
          sourceDocument: "afdb-cyber.pdf",
          sourcePage: 12,
        },
      ],
      { packageLabel: "afdb-pack" },
    );
    const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(
      candidates,
      "afdb-pack",
    );
    assert.equal(sealed.size, 1, `rejected=${JSON.stringify(rejected.map((r) => r.exclusionCode))} final=${JSON.stringify(sealed.finalRejected)}`);
    const item = sealed.items[0]!;
    assert.match(item.fullRequirementText, /Where the bidder relies/i);
    assert.match(item.fullRequirementText, /ISO 27001/i);
    assert.equal(item.applicability, "CONDITIONAL");
    assert.ok(item.conditionality.conditionText);
    assert.notEqual(item.applicability, "UNCONDITIONAL");

    const out = buildCanonicalRequirements({ stiApproved: sealed });
    assert.equal(out.length, 1);
    assert.match(out[0]!.requirement, /Where the bidder relies/i);
    assert.equal(out[0]!.stiApplicability, "CONDITIONAL");
    assert.ok(out[0]!.stiConditionality?.conditionText);
    assert.ok(out[0]!.stiProvenance?.length);
  });

  it("UNOPS buyer / procedural never contaminates bidder requirements", () => {
    const out = buildCanonicalRequirementsThroughSti({
      heuristicDrafts: [
        {
          category: "MANDATORY_ADMINISTRATIVE",
          description:
            "UNOPS shall notify the bidder of the outcome within 10 days.",
          mandatory: true,
          sourceDocument: "unops-itt.pdf",
        },
        {
          category: "MANDATORY_ADMINISTRATIVE",
          description:
            "Click on the Upload button in the e-sourcing portal to attach files.",
          mandatory: true,
          sourceDocument: "unops-guide.pdf",
        },
        {
          category: "MANDATORY_ADMINISTRATIVE",
          description:
            "The bidder shall submit audited financial statements for the last three years.",
          mandatory: true,
          sourceDocument: "unops-itt.pdf",
          sourcePage: 4,
        },
      ],
    });
    assert.ok(out.every((r) => !/UNOPS shall/i.test(r.requirement)));
    assert.ok(out.every((r) => !/Click on the Upload/i.test(r.requirement)));
    assert.ok(out.some((r) => /audited financial/i.test(r.requirement)));
    assert.ok(out.every((r) => r.stiActor !== "BUYER" && r.stiActor !== "AUTHORITY"));
  });

  it("contractor / template never becomes pre-bid bidder requirement", () => {
    const out = buildCanonicalRequirementsThroughSti({
      heuristicDrafts: [
        {
          category: "CONTRACTUAL",
          description:
            "The Contractor shall commence the Services not later than [insert date].",
          mandatory: true,
          sourceDocument: "forms.pdf",
        },
        {
          category: "CONTRACTUAL",
          description: "[Note to be deleted] Insert warranty period here.",
          mandatory: true,
          sourceDocument: "forms.pdf",
        },
      ],
    });
    assert.equal(out.length, 0);
  });

  it("WHO legal-reservation pattern is never a requirement", () => {
    const out = buildCanonicalRequirementsThroughSti({
      heuristicDrafts: [
        {
          category: "CONTRACTUAL",
          description:
            "Nothing in this Request for Proposal shall be deemed a waiver of the privileges and immunities of WHO.",
          mandatory: true,
          sourceDocument: "who-rfp.pdf",
        },
      ],
    });
    assert.equal(out.length, 0);
  });

  it("table requirements admit with provenance; headers do not", () => {
    const { candidates, rejected } = buildCanonicalSemanticCandidates([
      {
        description: "Item | Description | Qty | Unit",
        isTableHeader: true,
        sourceDocument: "sor.pdf",
        sourceCell: "A1",
      },
      {
        description:
          "The bidder shall supply firewall appliances with throughput of at least 2 Gbps.",
        sourceDocument: "sor.pdf",
        sourcePage: 8,
        sourceSection: "Schedule A",
        sourceCell: "B4",
        columnHeader: "Minimum requirement",
        rowLabel: "FW-01",
      },
    ]);
    assert.ok(rejected.some((r) => r.exclusionCode === "EXCLUDED_TABLE_HEADER"));
    const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(candidates);
    assert.equal(sealed.size, 1);
    assert.ok(sealed.items[0]!.sourceDocument);
    assert.ok(sealed.items[0]!.provenance.length >= 1);
  });

  it("amendments / corrigenda do not invent replacement clauses", () => {
    const s = interpretSemanticStatement({
      text: "This corrigendum replaces Clause 4.2.",
      provenance: { sourceDocument: "corrigendum.pdf", versionLabel: "Corr.1" },
      context: { packageDocumentRole: "CORRIGENDUM" },
    });
    const gate = finalAdmissionFromInterpreted(s);
    assert.equal(gate.admit, false);
  });

  it("multi-document package collapses duplicates with provenance", () => {
    const { candidates } = buildCanonicalSemanticCandidates([
      {
        description:
          "The bidder shall submit a valid tax clearance certificate.",
        sourceDocument: "itt.pdf",
        sourcePage: 2,
      },
      {
        description:
          "The bidder shall submit a valid tax clearance certificate.",
        sourceDocument: "addendum.pdf",
        sourcePage: 1,
      },
    ]);
    const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(candidates);
    assert.equal(sealed.size, 1);
    assert.ok(sealed.items[0]!.provenance.length >= 2);
  });

  it("metadata remains a separate semantic output", () => {
    const { candidates, metadata, rejected } = buildCanonicalSemanticCandidates([
      {
        description: "Submission deadline: 15 May 2026 at 10:00 local time.",
        sourceDocument: "notice.pdf",
      },
      {
        description: "Procuring Entity: Ministry of Health",
        sourceDocument: "notice.pdf",
      },
      {
        description:
          "The bidder shall provide a bid security of 2% of the bid price.",
        sourceDocument: "itt.pdf",
        sourcePage: 5,
      },
    ]);
    assert.ok(metadata.length >= 1);
    assert.ok(metadata.every((m) => m.exclusionCode === "EXCLUDED_METADATA_FACT"));
    assert.ok(!candidates.some((c) => /Submission deadline/i.test(c.fullRequirementText)));
    assert.ok(rejected.every((r) => r.exclusionCode));
    const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(candidates);
    assert.ok(sealed.size >= 1);
    assert.ok(
      sealed.items.every((c) => !/Submission deadline|Procuring Entity/i.test(c.fullRequirementText)),
    );
  });

  it("cross-page reunification admits; orphan fragment does not", () => {
    const reunified = interpretSemanticStatement({
      text: "If the proposed solution includes managed security operations,",
      provenance: { sourceDocument: "pack.pdf", sourcePage: 3 },
      context: {
        followingText:
          "the bidder shall provide evidence of ISO 27001 certification.",
      },
    });
    assert.equal(reunified.admitToCanonical, true);
    assert.equal(reunified.reconstructedFromContext, true);

    const orphan = interpretSemanticStatement({
      text: "Where applicable under the Tender Particulars.",
      provenance: { sourceDocument: "pack.pdf" },
    });
    assert.equal(orphan.admitToCanonical, false);
    assert.notEqual(orphan.applicability, "UNCONDITIONAL");
  });

  it("ambiguous cases stay REVIEW/UNKNOWN — never invented requirements", () => {
    const ambiguous = interpretSemanticStatement({
      text: "Certificates may be required as specified elsewhere.",
      provenance: { sourceDocument: "itt.pdf" },
    });
    const gate = finalAdmissionFromInterpreted(ambiguous);
    assert.equal(gate.admit, false);

    const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates([]);
    assert.equal(sealed.size, 0);
  });
});

describe("STI final authority — contamination invariants", () => {
  const patterns: Array<{ name: string; text: string; expectFail: boolean }> = [
    {
      name: "Buyer → bidder",
      text: "The Purchaser shall evaluate all substantially responsive bids.",
      expectFail: true,
    },
    {
      name: "Contractor → bidder",
      text: "The Contractor shall maintain insurance throughout the contract.",
      expectFail: true,
    },
    {
      name: "Manufacturer → bidder",
      text: "The manufacturer shall provide a 24-month warranty on all equipment.",
      expectFail: true,
    },
    {
      name: "Procedural/eSourcing",
      text: "Click Upload in the e-sourcing system to submit your proposal.",
      expectFail: true,
    },
    {
      name: "Form/template",
      text: "The Contractor shall start on [insert date] and [choose option].",
      expectFail: true,
    },
    {
      name: "Heading",
      text: "Section 3 — Eligibility Criteria",
      expectFail: true,
    },
    {
      name: "Missing provenance",
      text: "The bidder shall submit three references.",
      expectFail: true,
    },
  ];

  for (const p of patterns) {
    it(`blocks ${p.name}`, () => {
      const s = interpretSemanticStatement({
        text: p.text,
        provenance: {
          sourceDocument: p.name === "Missing provenance" ? null : "pack.pdf",
        },
      });
      const gate = finalAdmissionFromInterpreted(s);
      if (p.expectFail) {
        assert.equal(gate.admit, false, `${p.name} should fail final gate`);
      }
    });
  }

  it("never uses shall/must alone as proof", () => {
    const gate = evaluateFinalSemanticAdmission({
      requirementText: "All documents shall be duly signed.",
      documentRole: "UNKNOWN",
      sectionRole: "UNKNOWN",
      actor: "UNKNOWN",
      recipient: "UNKNOWN",
      procurementPhase: "UNKNOWN",
      clausePurpose: "UNKNOWN",
      clauseRole: "UNKNOWN",
      bidderRelevant: false,
      conditionality: {
        applicability: "UNCONDITIONAL",
        conditionText: null,
        actionText: null,
        thresholdText: null,
        exceptionText: null,
        timeframeText: null,
        scopeText: null,
        unresolved: false,
      },
      applicability: "UNCONDITIONAL",
      templateStatus: "NOT_TEMPLATE",
      obligationStrength: "MANDATORY",
      semanticKind: "UNKNOWN",
      lotLabel: null,
      boundaryComplete: true,
      provenanceSourceDocument: "x.pdf",
    });
    assert.equal(gate.admit, false);
    assert.ok(gate.failedChecks.length >= 1);
  });
});

describe("STI final authority — complete field carry-through", () => {
  it("canonical requirements carry full STI interpretation", () => {
    const out = buildCanonicalRequirementsThroughSti({
      heuristicDrafts: [
        {
          category: "MANDATORY_ELIGIBILITY",
          description:
            "If the bidder is a joint venture, the bidder shall submit a JV agreement.",
          mandatory: true,
          sourceDocument: "itt.pdf",
          sourcePage: 7,
          sourceSection: "Eligibility",
        },
      ],
    });
    assert.equal(out.length, 1);
    const r = out[0]!;
    assert.ok(r.stiActor);
    assert.ok(r.stiRecipient);
    assert.ok(r.stiClauseRole);
    assert.ok(r.stiClausePurpose);
    assert.ok(r.stiDocumentRole != null || r.stiSectionRole != null);
    assert.ok(r.stiProcurementPhase);
    assert.ok(r.semanticKind);
    assert.ok(r.obligationStrength);
    assert.ok(r.stiApplicability);
    assert.ok(r.stiTemplateStatus);
    assert.ok(r.stiConditionality);
    assert.ok(r.stiConfidence != null);
    assert.ok(r.stiProvenance && r.stiProvenance.length >= 1);
    assert.match(r.requirement, /If the bidder is a joint venture/i);
  });

  it("production path still seals before buildCanonicalRequirements", () => {
    const src = readFileSync(
      join(process.cwd(), "src/services/tender-processing/index.ts"),
      "utf8",
    );
    assert.match(src, /StiApprovedRequirementBatch\.fromAdmittedCandidates/);
    assert.match(src, /buildCanonicalRequirements\(\{\s*stiApproved/);
  });

  it("final gate rejections are traceable on the seal", () => {
    const { candidates } = buildCanonicalSemanticCandidates([
      {
        description: "The Purchaser shall open the bids publicly.",
        sourceDocument: "itt.pdf",
      },
    ]);
    // Entry gate should already reject; if anything slips through seal must catch.
    const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(candidates);
    assert.equal(sealed.size, 0);
  });
});
