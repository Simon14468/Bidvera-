/**
 * Authoritative STI admission firewall — adversarial matrix + I1–I18 invariants.
 * Generic procurement patterns only. No tender/buyer-specific rules.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCanonicalRequirements,
  buildCanonicalRequirementsThroughSti,
  enforceCanonicalAdmissionFirewall,
  evaluateNormalizedAdmissionFirewall,
  getLastCanonicalAdmissionAudit,
  STI_ADMISSION_VERSION,
} from "@/domain/tender-requirements";
import {
  interpretSemanticStatement,
  StiApprovedRequirementBatch,
  isStiApprovedRequirementBatch,
  hasMixedLifecycleFrames,
  buildCanonicalSemanticCandidates,
  buildTableSemanticContext,
} from "@/domain/semantic-tender-intelligence";
import {
  isStalePreFirewallSnapshot,
  STI_ADMISSION_SNAPSHOT_VERSION,
  type CanonicalAnalysisSnapshot,
} from "@/domain/tender-intelligence/canonical-snapshot";

const prov = {
  sourceDocument: "pack.pdf",
  sourcePage: 1,
  sourceSection: null as string | null,
};

function interp(text: string) {
  return interpretSemanticStatement({ text, provenance: prov, context: null });
}

describe("STI admission firewall — adversarial matrix", () => {
  const cases: Array<{
    id: string;
    text: string;
    admit: boolean;
    actor?: RegExp;
    phase?: RegExp;
    purpose?: RegExp;
  }> = [
    {
      id: "A submission",
      text: "The Bidder shall submit audited financial statements with the proposal.",
      admit: true,
      actor: /BIDDER|TENDERER/,
      phase: /BID_SUBMISSION|PRE_AWARD|PRE_BID/,
    },
    {
      id: "B qualification",
      text: "The Tenderer shall demonstrate at least five years of relevant experience.",
      admit: true,
      phase: /BID_SUBMISSION|PRE_AWARD|PRE_BID/,
    },
    {
      id: "C procedural",
      text: "Offerors shall notify the Purchaser of any ambiguities in the tender documents.",
      admit: true,
      purpose: /BIDDER_PROCEDURAL|BIDDER_OBLIGATION|SUBMISSION/,
    },
    {
      id: "D methodology",
      text: "The Bidder shall include an installation methodology in the Technical Proposal.",
      admit: true,
    },
    {
      id: "E capability",
      text: "The bidder shall demonstrate that it can provide installation and commissioning.",
      admit: true,
    },
    {
      id: "F conditional",
      text: "If the Bidder proposes subcontractors, it shall submit their CVs with the Technical Proposal.",
      admit: true,
    },
    {
      id: "G award-stage",
      text: "The successful bidder shall provide performance security within 10 days of award.",
      admit: true,
      phase: /AWARD/,
      purpose: /AWARD_STAGE/,
    },
    {
      id: "H after contract",
      text: "The successful bidder shall furnish performance security after receipt of the contract.",
      admit: false,
      phase: /POST_AWARD|CONTRACT_EXECUTION|DELIVERY/,
    },
    {
      id: "I supplier delivery",
      text: "The Supplier shall deliver the goods to the Site within 30 days after contract signature.",
      admit: false,
    },
    {
      id: "J transportation",
      text: "The Supplier shall transport the goods to the Site after contract signature.",
      admit: false,
    },
    {
      id: "K installation",
      text: "The Supplier shall install and commission the equipment after delivery.",
      admit: false,
    },
    {
      id: "L testing commissioning",
      text: "The Contractor shall perform testing and commissioning after delivery.",
      admit: false,
    },
    {
      id: "M training",
      text: "The Contractor shall provide training after installation of the equipment.",
      admit: false,
    },
    {
      id: "N warranty execution",
      text: "The Supplier shall replace defective goods under the warranty during the warranty period.",
      admit: false,
    },
    {
      id: "O repair",
      text: "The Supplier shall repair faulty equipment during the defects liability period.",
      admit: false,
    },
    {
      id: "P contractor reports",
      text: "The Contractor shall submit monthly progress reports during the contract period.",
      admit: false,
    },
    {
      id: "Q buyer evaluation",
      text: "The Purchaser shall evaluate the technical proposals in accordance with the ITB.",
      admit: false,
      purpose: /BUYER|PROCEDURAL|EVALUATION/,
    },
    {
      id: "R buyer approval",
      text: "The Authority shall approve the contractor's mobilisation plan after award.",
      admit: false,
    },
    {
      id: "S buyer payment",
      text: "The Employer shall make payment within 30 days of invoice acceptance.",
      admit: false,
    },
    {
      id: "T template",
      text: "The Contractor shall commence performance not later than [insert date].",
      admit: false,
    },
    {
      id: "U returnable form",
      text: "The Bidder shall complete and submit Form of Tender with the proposal.",
      admit: true,
    },
    {
      id: "W ambiguous successful bidder",
      text: "The successful bidder shall provide a performance guarantee equal to 10% of the contract value.",
      admit: false,
    },
    {
      id: "X amendment",
      text: "Corrigendum 1 — Amendment to Clause 12. This amendment supersedes the prior wording.",
      admit: false,
    },
    {
      id: "Y clarification",
      text: "Question: What is the delivery period? Answer: Delivery shall be within 60 days.",
      admit: false,
    },
    {
      id: "Z buyer debrief",
      text: "ABCD shall promptly respond to an unsuccessful Offeror who requests a debriefing.",
      admit: false,
    },
  ];

  for (const c of cases) {
    it(`${c.id}: admit=${c.admit}`, () => {
      const s = interp(c.text);
      assert.equal(s.admitToCanonical, c.admit, c.text);
      if (c.actor) assert.match(s.actor, c.actor);
      if (c.phase) assert.match(String(s.procurementPhase), c.phase);
      if (c.purpose) assert.match(String(s.clausePurpose), c.purpose);
      if (!c.admit) {
        assert.ok(s.exclusionCode, `missing exclusionCode for: ${c.text}`);
      }
    });
  }

  it("V mixed clause — fail closed", () => {
    const text =
      "The bidder shall describe its proposed installation methodology, and after award the contractor shall perform installation.";
    assert.equal(hasMixedLifecycleFrames(text), true);
    const s = interp(text);
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.procurementPhase, "MIXED_OR_AMBIGUOUS");
    assert.ok(s.exclusionCode);
  });

  it("AA table cell obligation admits; header does not", () => {
    const cell = interp(
      "The Bidder shall supply Category 6A cabling for all permanent links.",
    );
    assert.equal(cell.admitToCanonical, true);
    const header = interpretSemanticStatement({
      text: "Item | Description | Qty | Unit",
      provenance: prov,
      context: {
        table: buildTableSemanticContext({
          text: "Item | Description | Qty | Unit",
          columnHeader: "Description",
          isHeader: true,
        }),
      },
    });
    assert.equal(header.admitToCanonical, false);
  });

  it("AB spreadsheet-style row remains bidder obligation when framed as bid submission", () => {
    const s = interp(
      "The Bidder shall complete the price schedule spreadsheet and submit it with the financial proposal.",
    );
    assert.equal(s.admitToCanonical, true);
  });

  it("AC OCR reunified bidder text admits; incomplete fragment does not", () => {
    assert.equal(
      interp("The Bidder shall submit a signed Form of Tender with the offer.").admitToCanonical,
      true,
    );
    assert.equal(interp("shall be").admitToCanonical, false);
  });

  it("AD multi-document seal collapses buyer contamination", () => {
    const { candidates, rejected } = buildCanonicalSemanticCandidates(
      [
        {
          description: "WXYZ shall evaluate the bids in accordance with the ITB.",
          sourceDocument: "itb.pdf",
        },
        {
          description: "The Bidder shall submit a signed Form of Tender with the proposal.",
          sourceDocument: "forms.pdf",
        },
      ],
      { packageLabel: "pack.zip" },
    );
    assert.equal(candidates.length, 1);
    assert.ok(rejected.some((r) => r.clausePurpose === "BUYER_OBLIGATION"));
    const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(candidates, "pack.zip");
    const out = buildCanonicalRequirements({ stiApproved: sealed });
    assert.equal(out.length, 1);
    assert.ok(out[0]!.stiActor);
    assert.ok(out[0]!.stiProcurementPhase);
  });
});

describe("STI admission firewall — hard invariants I1–I18", () => {
  it("I1–I6: post-award / execution / buyer / template / mixed never enter canonical", () => {
    const out = buildCanonicalRequirementsThroughSti({
      heuristicDrafts: [
        {
          category: "x",
          description: "The Supplier shall install and commission the equipment after delivery.",
          mandatory: true,
          sourceDocument: "sor.pdf",
        },
        {
          category: "x",
          description: "The Purchaser shall evaluate the technical proposals.",
          mandatory: true,
          sourceDocument: "itb.pdf",
        },
        {
          category: "x",
          description: "Insert delivery schedule here.",
          mandatory: true,
          sourceDocument: "form.pdf",
        },
        {
          category: "x",
          description:
            "The bidder shall describe its proposed installation methodology, and after award the contractor shall perform installation.",
          mandatory: true,
          sourceDocument: "mixed.pdf",
        },
        {
          category: "x",
          description: "The Bidder shall submit Form of Tender with the proposal.",
          mandatory: true,
          sourceDocument: "forms.pdf",
        },
      ],
      sourceDocument: "pack.pdf",
    });
    assert.ok(out.every((r) => r.stiProcurementPhase !== "POST_AWARD"));
    assert.ok(out.every((r) => r.stiProcurementPhase !== "CONTRACT_EXECUTION"));
    assert.ok(out.every((r) => r.stiProcurementPhase !== "DELIVERY_IMPLEMENTATION"));
    assert.ok(out.every((r) => r.stiProcurementPhase !== "DELIVERY"));
    assert.ok(out.every((r) => r.stiProcurementPhase !== "INSTALLATION_IMPLEMENTATION"));
    assert.ok(out.every((r) => r.stiProcurementPhase !== "MIXED_OR_AMBIGUOUS"));
    assert.ok(out.every((r) => r.stiActor !== "BUYER" && r.stiActor !== "AUTHORITY"));
    assert.ok(out.every((r) => r.stiClausePurpose !== "TEMPLATE"));
    assert.ok(out.some((r) => /Form of Tender/i.test(r.requirement)));
  });

  it("I7–I8: pre-award and award-stage remain distinct and admissible", () => {
    const out = buildCanonicalRequirementsThroughSti({
      heuristicDrafts: [
        {
          category: "x",
          description: "The bidder shall demonstrate that it can provide installation and commissioning.",
          mandatory: true,
          sourceDocument: "itb.pdf",
        },
        {
          category: "x",
          description: "The successful bidder shall provide performance security within 10 days of award.",
          mandatory: true,
          sourceDocument: "itb.pdf",
        },
      ],
      sourceDocument: "pack.pdf",
    });
    assert.equal(out.length, 2);
    const award = out.find((r) => /performance security/i.test(r.requirement));
    assert.equal(award?.stiProcurementPhase, "AWARD");
    assert.equal(award?.stiClauseRole, "AWARD_STAGE_OBLIGATION");
  });

  it("I9: conditionality is not upgraded to mandatory", () => {
    const out = buildCanonicalRequirementsThroughSti({
      heuristicDrafts: [
        {
          category: "x",
          description:
            "If the Bidder proposes subcontractors, it shall submit their CVs with the Technical Proposal.",
          mandatory: true,
          sourceDocument: "itb.pdf",
        },
      ],
      sourceDocument: "pack.pdf",
    });
    assert.equal(out.length, 1);
    assert.equal(out[0]!.obligationStrength, "CONDITIONAL");
    assert.equal(out[0]!.mandatory, false);
  });

  it("I10–I13: vocabulary / section alone do not force lifecycle", () => {
    const supplierBid = interp(
      "The Supplier shall submit a price schedule with its bid.",
    );
    assert.equal(supplierBid.admitToCanonical, true);
    assert.match(String(supplierBid.procurementPhase), /BID_SUBMISSION/);

    const contractDemo = interpretSemanticStatement({
      text: "The Bidder shall demonstrate its proposed reporting methodology in the Technical Proposal.",
      provenance: prov,
      context: { packageDocumentRole: "SAMPLE_CONTRACT" },
    });
    assert.equal(contractDemo.admitToCanonical, true);
  });

  it("I14–I15: forged seal rejected; normalize cannot resurrect excluded", () => {
    assert.throws(() =>
      buildCanonicalRequirements({
        stiApproved: {
          items: [
            {
              fullRequirementText: "The Supplier shall install after delivery.",
            },
          ],
        } as never,
      }),
    );
    assert.equal(isStiApprovedRequirementBatch({ approved: true }), false);
  });

  it("I16–I18: admitted rows carry STI provenance; exclusions auditable", () => {
    const out = buildCanonicalRequirementsThroughSti({
      heuristicDrafts: [
        {
          category: "x",
          description: "The Bidder shall submit Form X with the proposal.",
          mandatory: true,
          sourceDocument: "forms.pdf",
        },
        {
          category: "x",
          description: "The Supplier shall install and commission after delivery.",
          mandatory: true,
          sourceDocument: "contract.pdf",
        },
      ],
      sourceDocument: "pack.pdf",
    });
    assert.ok(out.every((r) => r.stiActor && r.stiProcurementPhase && r.stiClausePurpose));
    assert.ok(out.every((r) => r.sourceDocument || r.stiProvenance?.length));
    const audit = getLastCanonicalAdmissionAudit();
    assert.ok(audit);
    assert.equal(audit!.admittedCount, out.length);
    assert.ok(
      (audit!.stiFinalGateRejected.length > 0 || audit!.firewallRejected.length >= 0) &&
        STI_ADMISSION_VERSION === "sti-admission/v3",
    );
  });

  it("firewall strips post-award if STI fields were somehow present on a bad row", () => {
    const { rejected } = enforceCanonicalAdmissionFirewall([
      {
        category: "CONTRACTUAL",
        semanticKind: "CONTRACTUAL_OBLIGATION",
        obligationStrength: "MANDATORY",
        title: "x",
        requirement: "The Supplier shall install after delivery.",
        mandatory: true,
        confidence: "HIGH",
        sourceDocument: "x.pdf",
        stiActor: "SUPPLIER",
        stiProcurementPhase: "CONTRACT_EXECUTION",
        stiClausePurpose: "POST_AWARD_OBLIGATION",
        stiClauseRole: "POST_AWARD_CONTRACTUAL_OBLIGATION",
      },
    ]);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0]!.exclusionCode, "CONTRACT_EXECUTION");
    assert.ok(evaluateNormalizedAdmissionFirewall({
      category: "CONTRACTUAL",
      semanticKind: "CONTRACTUAL_OBLIGATION",
      obligationStrength: "MANDATORY",
      title: "x",
      requirement: "bad",
      mandatory: true,
      confidence: "HIGH",
      sourceDocument: "x.pdf",
    }));
  });

  it("legacy snapshot without stiAdmission is stale", () => {
    const stale = {
      version: "canonical-analysis-snapshot/v1",
      frozenAt: new Date().toISOString(),
      tenderId: "t1",
      package: { discoveredFileCount: 0, label: "p", files: [] },
      metadata: {
        title: null,
        client: null,
        deadlineIso: null,
        deadlineTimezone: null,
        factsNote: null,
        metadataStatus: null,
      },
      requirementIds: [],
      counts: {
        totalRequirements: 0,
        verifiedRequirements: 0,
        needsVerification: 0,
        confirmedGaps: 0,
        notApplicable: 0,
      },
    } as CanonicalAnalysisSnapshot;
    assert.equal(isStalePreFirewallSnapshot(stale), true);
    assert.equal(
      isStalePreFirewallSnapshot({
        ...stale,
        stiAdmission: {
          version: STI_ADMISSION_SNAPSHOT_VERSION,
          sealedAt: new Date().toISOString(),
          admittedCount: 0,
          finalGateRejectedCount: 0,
          firewallRejectedCount: 0,
          exclusions: [],
        },
      }),
      false,
    );
  });
});
