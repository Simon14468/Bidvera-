/**
 * FINAL universal STI admission certification.
 * Adversarial corpus + I1–I25 + format/multi-doc/persistence/downstream.
 * Generic procurement patterns only — no buyer/tender-specific rules.
 *
 * Mixed clauses: fail-closed to MIXED_OR_AMBIGUOUS (no invented bidder split).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCanonicalRequirements,
  buildCanonicalRequirementsThroughSti,
  enforceCanonicalAdmissionFirewall,
  getLastCanonicalAdmissionAudit,
} from "@/domain/tender-requirements";
import {
  buildCanonicalSemanticCandidates,
  hasMixedLifecycleFrames,
  interpretSemanticStatement,
  isStiApprovedRequirementBatch,
  StiApprovedRequirementBatch,
  buildTableSemanticContext,
} from "@/domain/semantic-tender-intelligence";
import {
  freezeCanonicalAnalysisSnapshot,
  isStalePreFirewallSnapshot,
  STI_ADMISSION_SNAPSHOT_VERSION,
} from "@/domain/tender-intelligence/canonical-snapshot";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import { TEST_2_FIXTURE } from "@/domain/tender-requirements/test-2-canonical-regression.test";
import { AUDIOVISUAL_TENDER_FIXTURE } from "@/domain/tender-requirements/audiovisual-regression.test";
import { STRESS_TEST_FIXTURE } from "@/domain/tender-requirements/stress-test-regression.test";

const prov = { sourceDocument: "pack.pdf", sourcePage: 1, sourceSection: null as string | null };

function interp(text: string, sourceDocument = "pack.pdf") {
  return interpretSemanticStatement({
    text,
    provenance: { ...prov, sourceDocument },
    context: null,
  });
}

type Expect = {
  id: number;
  text: string;
  admit: boolean;
  phase?: RegExp;
  purpose?: RegExp;
};

const CORPUS: Expect[] = [
  // PRE-AWARD 1–10
  { id: 1, text: "The Bidder shall submit a tax clearance certificate with the proposal.", admit: true },
  { id: 2, text: "The Bidder shall provide qualification evidence of similar contracts.", admit: true },
  { id: 3, text: "The Bidder shall complete and submit the attached returnable Form A.", admit: true },
  { id: 4, text: "The Bidder shall submit completed price schedules with the financial proposal.", admit: true },
  { id: 5, text: "The Bidder shall notify the Purchaser of any ambiguities in the tender documents.", admit: true },
  { id: 6, text: "The Bidder shall attend the pre-bid meeting or submit a written waiver.", admit: true },
  { id: 7, text: "The Bidder shall demonstrate capability to deliver the required services.", admit: true },
  { id: 8, text: "The Bidder shall describe its proposed methodology in the Technical Proposal.", admit: true },
  { id: 9, text: "The Bidder shall confirm delivery capability in its bid.", admit: true },
  {
    id: 10,
    text: "The Bidder shall commit to the technical requirements stated in the Schedule of Requirements with its bid.",
    admit: true,
  },
  // AWARD 11–12
  {
    id: 11,
    text: "The successful bidder shall provide performance security within 14 days of award.",
    admit: true,
    phase: /^AWARD$/,
    purpose: /AWARD_STAGE/,
  },
  {
    id: 12,
    text: "The successful bidder shall sign the contract documents within 10 days of award.",
    admit: true,
    phase: /^AWARD$/,
  },
  // POST-AWARD 13–24
  {
    id: 13,
    text: "The successful bidder shall provide performance security after receipt of the contract.",
    admit: false,
    phase: /POST_AWARD|CONTRACT_EXECUTION|DELIVERY/,
  },
  { id: 14, text: "The Supplier shall deliver the goods to the Site.", admit: false },
  {
    id: 15,
    text: "The Supplier shall transport and unload the equipment at the Site after delivery.",
    admit: false,
  },
  { id: 16, text: "The Supplier shall install the equipment after delivery.", admit: false },
  {
    id: 17,
    text: "The Supplier shall test and commission the equipment after installation.",
    admit: false,
  },
  { id: 18, text: "The Supplier shall train users after installation.", admit: false },
  {
    id: 19,
    text: "The Supplier shall repair defective goods during the warranty period.",
    admit: false,
  },
  { id: 20, text: "The Supplier shall replace defective goods under the warranty.", admit: false },
  {
    id: 21,
    text: "The Supplier shall provide warranty service during the warranty period.",
    admit: false,
  },
  {
    id: 22,
    text: "The Contractor shall submit monthly progress reports during the contract period.",
    admit: false,
  },
  {
    id: 23,
    text: "The Contractor shall maintain the equipment throughout the contract period.",
    admit: false,
  },
  {
    id: 24,
    text: "The Supplier shall perform implementation activities after award.",
    admit: false,
  },
  // BUYER 25–29
  { id: 25, text: "The Purchaser shall evaluate the bids in accordance with the ITB.", admit: false },
  {
    id: 26,
    text: "The Buyer shall approve deliverables submitted by the Contractor.",
    admit: false,
  },
  {
    id: 27,
    text: "The Procuring Entity shall issue clarifications to all bidders.",
    admit: false,
  },
  {
    id: 28,
    text: "The Employer shall make payments within thirty days of invoice acceptance.",
    admit: false,
  },
  {
    id: 29,
    text: "The Procuring Entity shall inspect the works after completion.",
    admit: false,
  },
  // TEMPLATE 30–35
  { id: 30, text: "[Insert company name]", admit: false },
  {
    id: 31,
    text: "The Contractor shall commence not later than [insert date].",
    admit: false,
  },
  { id: 32, text: "To be completed by the bidder in block capitals.", admit: false },
  { id: 33, text: "Insert price here.", admit: false },
  {
    id: 34,
    text: "Note to drafter: delete this instruction before issue.",
    admit: false,
  },
  {
    id: 35,
    text: "For example, the bidder may submit ISO 9001 certification.",
    admit: false,
  },
  // Genuine returnable (not template exclusion)
  {
    id: 36,
    text: "The Bidder shall complete and submit the attached price schedule.",
    admit: true,
  },
];

describe("CERT — adversarial corpus (pre/award/post/buyer/template)", () => {
  for (const c of CORPUS) {
    it(`#${c.id} admit=${c.admit}`, () => {
      const s = interp(c.text);
      assert.equal(s.admitToCanonical, c.admit, c.text);
      if (c.phase) assert.match(String(s.procurementPhase), c.phase);
      if (c.purpose) assert.match(String(s.clausePurpose), c.purpose);
      if (!c.admit) assert.ok(s.exclusionCode, `auditable exclusion required: ${c.text}`);
    });
  }
});

describe("CERT — mixed / ambiguous", () => {
  it("mixed bidder+contractor clause fails closed (no invented split)", () => {
    const text =
      "The bidder shall describe its proposed installation methodology, and after award the contractor shall perform installation.";
    assert.equal(hasMixedLifecycleFrames(text), true);
    const s = interp(text);
    assert.equal(s.admitToCanonical, false);
    assert.equal(s.procurementPhase, "MIXED_OR_AMBIGUOUS");
    assert.ok(s.exclusionCode);
  });

  it("buyer + bidder same paragraph — buyer subject wins exclusion", () => {
    const s = interp(
      "The Purchaser shall evaluate the technical proposals and may request clarifications from the Bidder.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.clausePurpose), /BUYER|PROCEDURAL|EVALUATION/);
  });

  it("conditional post-award does not become mandatory bidder requirement", () => {
    const s = interp(
      "If the contract is awarded, the Supplier shall install the equipment after delivery.",
    );
    assert.equal(s.admitToCanonical, false);
    assert.match(String(s.clausePurpose), /POST_AWARD/);
  });

  it("table rows with different actors — header excluded; bidder cell may admit", () => {
    const header = interpretSemanticStatement({
      text: "Item | Description | Qty",
      provenance: prov,
      context: {
        table: buildTableSemanticContext({
          text: "Item | Description | Qty",
          columnHeader: "Description",
          isHeader: true,
        }),
      },
    });
    assert.equal(header.admitToCanonical, false);
    assert.equal(
      interp("The Bidder shall supply projection equipment matching the schedule row.").admitToCanonical,
      true,
    );
  });
});

describe("CERT — I1–I25 hard invariants", () => {
  const mixed = buildCanonicalRequirementsThroughSti({
    heuristicDrafts: CORPUS.map((c) => ({
      category: "x",
      description: c.text,
      mandatory: true,
      sourceDocument: `doc-${c.id}.pdf`,
    })),
    sourceDocument: "adversarial-pack.zip",
  });
  const mixedAudit = getLastCanonicalAdmissionAudit();

  it("I1–I6 blocked phases/purposes never in canonical", () => {
    for (const r of mixed) {
      assert.notEqual(r.stiProcurementPhase, "POST_AWARD");
      assert.notEqual(r.stiProcurementPhase, "CONTRACT_EXECUTION");
      assert.notEqual(r.stiProcurementPhase, "DELIVERY_IMPLEMENTATION");
      assert.notEqual(r.stiProcurementPhase, "DELIVERY");
      assert.notEqual(r.stiProcurementPhase, "INSTALLATION_IMPLEMENTATION");
      assert.notEqual(r.stiProcurementPhase, "MIXED_OR_AMBIGUOUS");
      assert.notEqual(r.stiClausePurpose, "BUYER_OBLIGATION");
      assert.notEqual(r.stiClausePurpose, "TEMPLATE");
      assert.notEqual(r.stiActor, "BUYER");
      assert.notEqual(r.stiActor, "AUTHORITY");
      assert.notEqual(r.stiActor, "CONTRACTOR");
    }
  });

  it("I7–I8 pre-award and award-stage remain admissible and distinct", () => {
    assert.ok(mixed.some((r) => /tax clearance/i.test(r.requirement)));
    const award = mixed.find((r) => /within 14 days of award/i.test(r.requirement));
    assert.ok(award);
    assert.equal(award!.stiProcurementPhase, "AWARD");
    assert.equal(award!.stiClauseRole, "AWARD_STAGE_OBLIGATION");
    assert.ok(!mixed.some((r) => /after receipt of the contract/i.test(r.requirement)));
  });

  it("I9 conditionality not upgraded", () => {
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

  it("I10–I14 vocabulary/section alone do not force lifecycle", () => {
    assert.equal(
      interp("The Supplier shall submit a price schedule with its bid.").admitToCanonical,
      true,
    );
    const tech = interpretSemanticStatement({
      text: "The Bidder shall submit Form of Tender with the proposal.",
      provenance: prov,
      context: {
        packageDocumentRole: "TECHNICAL_SPECIFICATION",
        sectionLabel: "Technical Requirements",
      },
    });
    assert.equal(tech.admitToCanonical, true);
    const contractBid = interpretSemanticStatement({
      text: "The Bidder shall demonstrate its proposed reporting methodology in the Technical Proposal.",
      provenance: prov,
      context: { packageDocumentRole: "SAMPLE_CONTRACT" },
    });
    assert.equal(contractBid.admitToCanonical, true);
    assert.equal(
      interp("The successful bidder shall provide a performance guarantee equal to 10% of the contract value.")
        .admitToCanonical,
      false,
    );
  });

  it("I15–I16 normalization/downstream cannot resurrect excluded", () => {
    const excludedSnippets = [
      "install the equipment after delivery",
      "monthly progress reports during the contract",
      "evaluate the bids in accordance",
      "[Insert company name]",
    ];
    for (const snip of excludedSnippets) {
      assert.ok(
        !mixed.some((r) => r.requirement.toLowerCase().includes(snip.toLowerCase())),
        `resurrected: ${snip}`,
      );
    }
    const { rejected } = enforceCanonicalAdmissionFirewall(mixed);
    assert.equal(rejected.length, 0);
  });

  it("I17–I19 provenance + auditable exclusions + STI stamp", () => {
    assert.ok(mixed.every((r) => r.stiActor && r.stiProcurementPhase && r.stiClausePurpose));
    assert.ok(
      mixed.every(
        (r) => Boolean(r.sourceDocument?.trim()) || Boolean(r.stiProvenance?.length),
      ),
    );
    for (const c of CORPUS.filter((x) => !x.admit)) {
      const s = interp(c.text);
      assert.ok(s.exclusionCode, c.text);
    }
    const audit = mixedAudit;
    assert.ok(audit);
    assert.equal(audit!.admittedCount, mixed.length);
  });

  it("I20 forged STI seal cannot bypass", () => {
    assert.equal(isStiApprovedRequirementBatch({ items: [] }), false);
    assert.throws(() =>
      buildCanonicalRequirements({
        stiApproved: { items: [], sourceDocument: "x" } as never,
      }),
    );
  });

  it("I21 format invariance — equivalent clauses identical across extensions", () => {
    const text =
      "The Bidder shall submit a signed Form of Tender with the proposal.";
    const formats = ["a.pdf", "a.docx", "a.xlsx", "a.csv", "a.txt", "a.pptx", "scan.ocr.pdf"];
    const first = interp(text, formats[0]!);
    for (const f of formats.slice(1)) {
      const s = interp(text, f);
      assert.equal(s.admitToCanonical, first.admitToCanonical, f);
      assert.equal(s.actor, first.actor, f);
      assert.equal(s.procurementPhase, first.procurementPhase, f);
      assert.equal(s.clausePurpose, first.clausePurpose, f);
    }
  });

  it("I22 multi-document package preserves lifecycle + provenance", () => {
    const { candidates, rejected } = buildCanonicalSemanticCandidates(
      [
        {
          description: "The Bidder shall submit Form of Tender with the proposal.",
          sourceDocument: "01_ITB.pdf",
          packageDocumentRole: "INSTRUCTIONS_TO_BIDDERS",
        },
        {
          description: "The Supplier shall install and commission after delivery.",
          sourceDocument: "07_Contract.docx",
          packageDocumentRole: "CONTRACT_FORM",
        },
        {
          description: "The Purchaser shall evaluate the technical proposals.",
          sourceDocument: "01_ITB.pdf",
          packageDocumentRole: "INSTRUCTIONS_TO_BIDDERS",
        },
        {
          description: "The Bidder shall complete and submit the attached price schedule.",
          sourceDocument: "05_Price_Schedule.xlsx",
          packageDocumentRole: "FINANCIAL_FORMS",
        },
        {
          description: "Question: delivery period? Answer: within 60 days after award.",
          sourceDocument: "09_QA.pdf",
          packageDocumentRole: "Q_AND_A",
        },
      ],
      { packageLabel: "generic-multi.zip" },
    );
    const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(
      candidates,
      "generic-multi.zip",
    );
    const out = buildCanonicalRequirements({ stiApproved: sealed });
    assert.ok(out.length >= 2);
    assert.ok(out.every((r) => r.sourceDocument || r.stiProvenance?.length));
    assert.ok(!out.some((r) => /install and commission after delivery/i.test(r.requirement)));
    assert.ok(!out.some((r) => /Purchaser shall evaluate/i.test(r.requirement)));
    assert.ok(rejected.some((r) => r.clausePurpose === "BUYER_OBLIGATION" || r.clausePurpose === "POST_AWARD_OBLIGATION" || r.clausePurpose === "Q_AND_A"));
  });

  it("I23 amendment/corrigendum metadata cannot become requirements", () => {
    assert.equal(
      interp("Corrigendum 1 — This amendment supersedes Clause 12 of the ITB.").admitToCanonical,
      false,
    );
  });

  it("I24 buyer/contractor excluded even with bidder terminology nearby", () => {
    assert.equal(
      interp(
        "The Purchaser shall notify unsuccessful bidders within five days of award.",
      ).admitToCanonical,
      false,
    );
    assert.equal(
      interp(
        "After award, the Contractor shall submit reports and may request clarification from the Bidder's site team.",
      ).admitToCanonical,
      false,
    );
  });

  it("I25 genuine bidder procedural remains admissible", () => {
    assert.equal(
      interp(
        "Offerors shall notify the Purchaser of any ambiguities in the tender documents.",
      ).admitToCanonical,
      true,
    );
  });
});

describe("CERT — persistence / snapshot boundary", () => {
  it("stiAdmission stamp round-trip; stale pre-firewall detected", () => {
    const out = buildCanonicalRequirementsThroughSti({
      heuristicDrafts: [
        {
          category: "x",
          description: "The Bidder shall submit Form of Tender with the proposal.",
          mandatory: true,
          sourceDocument: "itb.pdf",
        },
      ],
      sourceDocument: "pack.pdf",
    });
    const audit = getLastCanonicalAdmissionAudit();
    const snap = freezeCanonicalAnalysisSnapshot({
      tenderId: "cert-t1",
      packageLabel: "pack.pdf",
      discoveredFileCount: 1,
      files: [{ fileName: "pack.pdf", processingStatus: "READY", role: "ITB", error: null }],
      metadata: {
        title: "Cert",
        client: null,
        deadlineIso: null,
        deadlineTimezone: null,
        factsNote: null,
        metadataStatus: null,
      },
      requirementIds: out.map((_, i) => `r${i}`),
      summary: {
        totalRequirements: out.length,
        ready: 0,
        missing: 0,
        verify: out.length,
        notApplicable: 0,
        unknown: 0,
        sources: out.length,
        risks: 0,
        requiredActions: 0,
        clarifications: 0,
      },
      stiAdmission: {
        version: STI_ADMISSION_SNAPSHOT_VERSION,
        sealedAt: new Date().toISOString(),
        admittedCount: audit?.admittedCount ?? out.length,
        finalGateRejectedCount: audit?.stiFinalGateRejected.length ?? 0,
        firewallRejectedCount: audit?.firewallRejected.length ?? 0,
        exclusions: [],
      },
    });
    assert.equal(isStalePreFirewallSnapshot(snap), false);
    assert.equal(snap.stiAdmission?.version, STI_ADMISSION_SNAPSHOT_VERSION);
    assert.equal(isStalePreFirewallSnapshot({ ...snap, stiAdmission: null }), true);
    // Semantic fields survive on canonical rows (persistence truth), not reinvented from text alone.
    assert.ok(out[0]!.stiActor);
    assert.ok(out[0]!.stiProcurementPhase);
    assert.ok(out[0]!.stiClausePurpose);
  });

  it("read-path cannot reinterpret excluded DB-like text into canonical", () => {
    // Simulate a contaminated historical DB row being re-fed as a draft:
    // STI + firewall must still exclude it.
    const out = buildCanonicalRequirementsThroughSti({
      heuristicDrafts: [
        {
          category: "CONTRACTUAL",
          description: "The Supplier shall install and commission the equipment after delivery.",
          mandatory: true,
          sourceDocument: "legacy-db-row.pdf",
        },
      ],
      sourceDocument: "legacy.pdf",
    });
    assert.equal(out.length, 0);
  });
});

describe("CERT — real-package offline fixtures (3 packages)", () => {
  function packageReport(label: string, text: string, fileName: string) {
    const heuristic = extractTenderPackageHeuristic({ text, fileName });
    const { candidates, rejected } = buildCanonicalSemanticCandidates(
      heuristic.requirements.map((r) => ({
        description: r.description,
        category: r.category,
        mandatory: r.mandatory,
        sourceDocument: r.sourceDocument ?? fileName,
        sourcePage: r.sourcePage ?? null,
        sourceSection: r.sourceSection ?? null,
      })),
      { packageLabel: fileName },
    );
    const sealed = StiApprovedRequirementBatch.fromAdmittedCandidates(candidates, fileName);
    const canonical = buildCanonicalRequirements({ stiApproved: sealed });
    const buyer = rejected.filter((r) => r.clausePurpose === "BUYER_OBLIGATION").length;
    const post = rejected.filter((r) => r.clausePurpose === "POST_AWARD_OBLIGATION").length;
    const template = rejected.filter(
      (r) => r.clausePurpose === "TEMPLATE" || r.clausePurpose === "FORM_INSTRUCTION",
    ).length;
    const mixed = rejected.filter((r) => r.procurementPhase === "MIXED_OR_AMBIGUOUS").length;
    return {
      label,
      files: 1,
      formats: [fileName.split(".").pop() ?? "txt"],
      drafts: heuristic.requirements.length,
      stiCandidates: candidates.length,
      admitted: canonical.length,
      buyerExcluded: buyer,
      postAwardExcluded: post,
      templateExcluded: template,
      ambiguousMixed: mixed,
      samplesAdmitted: canonical.slice(0, 3).map((r) => ({
        text: r.requirement.slice(0, 100),
        actor: r.stiActor,
        phase: r.stiProcurementPhase,
        purpose: r.stiClausePurpose,
      })),
      samplesExcluded: rejected.slice(0, 3).map((r) => ({
        text: r.requirementText.slice(0, 100),
        purpose: r.clausePurpose,
        code: r.exclusionCode,
      })),
      contamination: canonical.filter(
        (r) =>
          r.stiProcurementPhase === "POST_AWARD" ||
          r.stiProcurementPhase === "CONTRACT_EXECUTION" ||
          r.stiClausePurpose === "BUYER_OBLIGATION" ||
          r.stiActor === "CONTRACTOR",
      ),
    };
  }

  it("Package A — Canonical Integrity Test 2 (IT/admin mix)", () => {
    const r = packageReport("Test2", TEST_2_FIXTURE, "test2.pdf");
    assert.equal(r.contamination.length, 0);
    assert.ok(r.admitted >= 8);
    assert.ok(r.admitted <= 14);
  });

  it("Package B — Audiovisual synthetic pack", () => {
    const r = packageReport("Audiovisual", AUDIOVISUAL_TENDER_FIXTURE, "av.pdf");
    assert.equal(r.contamination.length, 0);
    assert.ok(r.admitted >= 4);
  });

  it("Package C — Stress test pack", () => {
    const r = packageReport("Stress", STRESS_TEST_FIXTURE, "stress.pdf");
    assert.equal(r.contamination.length, 0);
    assert.ok(r.admitted >= 10);
  });
});
