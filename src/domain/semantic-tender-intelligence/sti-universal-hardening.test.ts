/**
 * Universal hardening regressions — general failure classes only.
 * No tender, country, organization, filename, product, or language patches.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interpretSemanticStatement } from "./interpret";
import { buildCanonicalSemanticCandidates } from "./candidates";
import { analyzeVersionApplicability } from "./versioning";
import { analyzeLifecycleCommitmentFrame } from "./phase";
import {
  evaluateFinalSemanticAdmission,
  finalAdmissionFromCandidate,
} from "./final-admission-gate";
import type { CanonicalSemanticCandidate } from "./types";
import { buildCanonicalRequirements } from "@/domain/tender-requirements/canonical-extraction";
import { mergeNormalizedRequirements } from "@/domain/tender-requirements/semantic-dedupe";
import { mergeLotApplicability } from "@/domain/tender-requirements/lot-applicability";
import {
  extractTenderDeadlineFromText,
  inferDeadlineTimezone,
  buildDeadlineIsoWithLocalTime,
} from "@/domain/tender-requirements/tender-deadline";
import type { NormalizedRequirement } from "@/domain/tender-requirements/types";

const prov = {
  sourceDocument: "pack.pdf",
  sourcePage: 1,
  sourceSection: null,
  sourceCell: null,
  versionLabel: null,
  locator: null,
};

function interp(text: string, extra?: { documentRole?: string; section?: string }) {
  return interpretSemanticStatement({
    text,
    provenance: { ...prov, sourceSection: extra?.section ?? null },
    context: extra?.documentRole
      ? { packageDocumentRole: extra.documentRole }
      : null,
  });
}

function req(
  text: string,
  extra?: Partial<NormalizedRequirement>,
): NormalizedRequirement {
  return {
    category: "CONTRACTUAL",
    semanticKind: "TECHNICAL_REQUIREMENT",
    obligationStrength: "MANDATORY",
    title: "req",
    requirement: text,
    mandatory: true,
    confidence: "HIGH",
    page: 1,
    sourcePages: [1],
    evidenceText: text,
    value: null,
    verificationStatus: "UNKNOWN",
    ...extra,
  };
}

describe("hardening — lifecycle frame", () => {
  it("supplier execution without a trigger stays UNKNOWN, not invented post-award", () => {
    const text = "The Supplier shall install and commission the equipment.";
    const frame = analyzeLifecycleCommitmentFrame({ text, actor: "SUPPLIER" });
    assert.equal(frame.insufficientFrame, true);
    const s = interp(text);
    assert.equal(s.admitToCanonical, false);
    assert.notEqual(s.clausePurpose, "BIDDER_OBLIGATION");
    assert.notEqual(s.clausePurpose, "POST_AWARD_OBLIGATION");
  });

  it("explicit post-award trigger excludes; bidder bid-scope still admits", () => {
    const post = interp(
      "The Supplier shall install the equipment at the site after receipt of the purchase order.",
    );
    assert.equal(post.admitToCanonical, false);
    const bid = interp(
      "The bidder shall include an installation methodology with its proposal.",
    );
    assert.equal(bid.admitToCanonical, true);
  });
});

describe("hardening — lot and condition scope", () => {
  it("identical lot restatements may union lots but never become ALL_LOTS", () => {
    const text = "The bidder must submit a tax clearance certificate with the dossier.";
    const merged = mergeNormalizedRequirements([
      req(text, { lotApplicability: "LOT_1", sourceSection: "Lot 1" }),
      req(text, { lotApplicability: "LOT_2", sourceSection: "Lot 2" }),
    ]);
    assert.equal(merged.length, 1);
    assert.notEqual(merged[0]!.lotApplicability, "ALL_LOTS");
    assert.ok(/LOT_1/i.test(merged[0]!.lotApplicability ?? ""));
    assert.ok(/LOT_2/i.test(merged[0]!.lotApplicability ?? ""));
  });

  it("different lot thresholds stay separate", () => {
    const a = "For Lot 1 the bidder shall offer a 24-month warranty covering the supplied goods.";
    const b = "For Lot 2 the bidder shall offer a 36-month warranty covering the supplied goods.";
    const merged = mergeNormalizedRequirements([
      req(a, { lotApplicability: "LOT_1", sourceSection: "[LOT_1] Warranty" }),
      req(b, { lotApplicability: "LOT_2", sourceSection: "[LOT_2] Warranty" }),
    ]);
    assert.equal(merged.length, 2);
  });

  it("ALL + LOTS merge never expands a lot-specific duty to all lots", () => {
    const merged = mergeLotApplicability(
      { kind: "ALL" },
      { kind: "LOTS", lots: ["2"] },
    );
    assert.equal(merged.kind, "LOTS");
    if (merged.kind === "LOTS") assert.deepEqual(merged.lots, ["2"]);
  });

  it("conditional lot text remains conditional and is not admitted as global mandatory", () => {
    const s = interp(
      "If the bidder offers Lot 3, the bidder shall submit a manufacturer authorization with the bid.",
      { section: "Lot 3" },
    );
    assert.equal(s.admitToCanonical, true);
    assert.ok(s.conditional || s.conditionality.applicability === "CONDITIONAL");
    assert.ok(s.lotApplicability.kind === "LOTS" || /lot\s*3/i.test(s.requirementText));
  });
});

describe("hardening — versioning", () => {
  it("amendment document role does not invent a proven replacement", () => {
    const v = analyzeVersionApplicability({
      text: "The bidder shall submit ISO 9001 with the proposal.",
      documentRole: "AMENDMENT",
      versionLabel: "Addendum 2",
    });
    assert.equal(v.replacesProven, false);
    assert.notEqual(v.status, "SUPERSEDED");
  });

  it("unproven replace language stays REVIEW and is not admitted", () => {
    const s = interp("This corrigendum replaces Clause 4.2.", {
      documentRole: "CORRIGENDUM",
    });
    assert.equal(s.admitToCanonical, false);
  });
});

describe("hardening — isolated vocabulary is not a decision", () => {
  it("the words supplier, deliver, install, warranty, payment do not invent post-award", () => {
    const s = interp("Supplier deliver install warranty payment.");
    assert.equal(s.admitToCanonical, false);
    assert.notEqual(s.clausePurpose, "POST_AWARD_OBLIGATION");
  });

  it("buyer procedural statements stay non-requirements", () => {
    const s = interp("The Contracting Authority shall open the bids in public.");
    assert.equal(s.admitToCanonical, false);
    assert.ok(
      s.clausePurpose === "BUYER_OBLIGATION" || s.clausePurpose === "PROCEDURAL_RULE",
    );
  });

  it("metadata and headings are preserved as context, not canonical requirements", () => {
    const semantic = buildCanonicalSemanticCandidates([
      {
        description: "Submission deadline: 15 March 2026 at 10:30",
        sourceDocument: "notice.pdf",
        sourcePage: 1,
      },
      {
        description: "The bidder shall submit ISO 9001 certification with the proposal.",
        sourceDocument: "itt.pdf",
        sourcePage: 2,
      },
    ]);
    assert.ok(semantic.metadata.length >= 1);
    assert.equal(
      semantic.candidates.some((c) => /submission deadline/i.test(c.fullRequirementText)),
      false,
    );
    assert.ok(
      semantic.candidates.some((c) => /ISO 9001/i.test(c.fullRequirementText)),
    );
  });
});

describe("hardening — deadlines and timezone", () => {
  it("opening, validity, delivery and contract dates are not bid deadlines", () => {
    const samples = [
      "Bid opening date: 20 March 2026 at 14:00",
      "Bid validity shall expire on 15 June 2026",
      "Delivery date: 1 September 2026",
      "Contract commencement date: 1 July 2026",
    ];
    for (const text of samples) {
      const d = extractTenderDeadlineFromText(text, null);
      assert.equal(d.deadlineIso, null, text);
    }
  });

  it("labelled submission deadline is extracted; timezone stays UNKNOWN unless stated", () => {
    const d = extractTenderDeadlineFromText(
      "Submission deadline: 15 October 2026 at 10:30",
      "Morocco",
    );
    assert.ok(d.deadlineIso?.startsWith("2026-10-15T10:30:00"));
    assert.equal(d.deadlineTimezone, null);
    assert.equal(inferDeadlineTimezone("Morocco"), null);
    assert.equal(inferDeadlineTimezone("Malaysia"), null);
  });

  it("unknown IANA zone is not invented as UTC offset", () => {
    const unknown = buildDeadlineIsoWithLocalTime({
      dateYmd: "2026-10-15",
      hour: 10,
      minute: 30,
      timezone: "Not/A_Real_Zone",
    });
    assert.equal(unknown, "2026-10-15T10:30:00");
    assert.ok(!unknown.includes("+"), "must not invent an offset for an unknown zone");

    const paris = buildDeadlineIsoWithLocalTime({
      dateYmd: "2026-10-15",
      hour: 10,
      minute: 30,
      timezone: "Europe/Paris",
    });
    assert.equal(paris, "2026-10-15T10:30:00+02:00");
  });

  it("compact 1430 hrs is preserved when labelled as a bid deadline", () => {
    const d = extractTenderDeadlineFromText(
      "Bid due date and time: 15 October 2026 1430 hrs",
      null,
    );
    assert.equal(d.localHour, 14);
    assert.equal(d.localMinute, 30);
  });
});

describe("hardening — table surfaces and one-candidate failure", () => {
  it("the same obligation across row and response-column surfaces is one candidate", () => {
    const semantic = buildCanonicalSemanticCandidates([
      {
        description: "The bidder shall submit ISO 9001 with the proposal.",
        sourceDocument: "schedule.xlsx",
        sourcePage: 1,
        sourceCell: "B2",
        columnHeader: "Requirement",
        rowLabel: "1",
      },
      {
        description: "The bidder shall submit ISO 9001 with the proposal. Yes No",
        sourceDocument: "schedule.xlsx",
        sourcePage: 1,
        sourceCell: "C2",
        columnHeader: "Compliance",
        rowLabel: "1",
      },
    ]);
    assert.equal(semantic.candidates.length, 1);
  });

  it("one unreadable fragment does not block genuine neighbouring admission", () => {
    const semantic = buildCanonicalSemanticCandidates([
      { description: "   ", sourceDocument: "pack.pdf", sourcePage: 1 },
      {
        description: "The bidder shall submit ISO 9001 certification with the proposal.",
        sourceDocument: "pack.pdf",
        sourcePage: 2,
      },
    ]);
    assert.ok(semantic.rejected.length >= 1);
    assert.equal(semantic.candidates.length, 1);
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: [
        { description: "   ", category: "CONTRACTUAL", mandatory: true },
        {
          description: "The bidder shall submit ISO 9001 certification with the proposal.",
          category: "CONTRACTUAL",
          mandatory: true,
        },
      ],
      sourceDocument: "pack.pdf",
    });
    assert.equal(canonical.length, 1);
  });
});

function sealedCandidate(
  extra: Partial<CanonicalSemanticCandidate> = {},
): CanonicalSemanticCandidate {
  const text =
    extra.fullRequirementText ??
    "The bidder shall submit ISO 9001 certification with the proposal.";
  return {
    canonicalId: "c1",
    fullRequirementText: text,
    actor: "BIDDER",
    recipient: "BIDDER",
    clauseRole: "BIDDER_REQUIREMENT",
    clausePurpose: "BIDDER_OBLIGATION",
    documentRole: "INSTRUCTIONS_TO_BIDDERS",
    documentPurpose: "PROCUREMENT_REQUIREMENT_SOURCE",
    sectionRole: "REQUIRED_DOCUMENTS",
    semanticKind: "REQUIRED_DOCUMENT",
    contentKind: "BIDDER_REQUIREMENT",
    obligationStrength: "MANDATORY",
    procurementPhase: "BID_SUBMISSION",
    applicability: "UNCONDITIONAL",
    templateStatus: "NOT_TEMPLATE",
    condition: null,
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
    bidderRelevant: true,
    boundaryComplete: true,
    lotApplicability: null,
    sourceDocument: "pack.pdf",
    sourcePage: 1,
    sourceSection: null,
    sourceCell: null,
    version: null,
    provenance: [prov],
    confidence: 0.9,
    draft: {
      category: "MANDATORY_ADMINISTRATIVE",
      description: text,
      mandatory: true,
      sourcePage: 1,
      sourceSection: null,
      evidenceText: text,
      sourceDocument: "pack.pdf",
    },
    ...extra,
  };
}

function admissionBase(text: string, lotLabel: string | null) {
  return {
    requirementText: text,
    documentRole: "INSTRUCTIONS_TO_BIDDERS",
    sectionRole: "REQUIRED_DOCUMENTS",
    actor: "BIDDER" as const,
    recipient: "BIDDER" as const,
    procurementPhase: "BID_SUBMISSION" as const,
    clausePurpose: "BIDDER_OBLIGATION" as const,
    clauseRole: "BIDDER_REQUIREMENT" as const,
    bidderRelevant: true,
    conditionality: {
      applicability: "UNCONDITIONAL" as const,
      conditionText: null,
      actionText: text,
      thresholdText: null,
      exceptionText: null,
      timeframeText: null,
      scopeText: null,
      unresolved: false,
    },
    applicability: "UNCONDITIONAL" as const,
    templateStatus: "NOT_TEMPLATE" as const,
    obligationStrength: "MANDATORY",
    semanticKind: "REQUIRED_DOCUMENT" as const,
    lotLabel,
    boundaryComplete: true,
    provenanceSourceDocument: "pack.pdf",
  };
}

describe("hardening — seal path cannot bypass condition or lot scope", () => {
  it("unresolved orphan condition on the sealed candidate is not admitted", () => {
    const gate = finalAdmissionFromCandidate(
      sealedCandidate({
        fullRequirementText: "If the bidder is a joint venture.",
        applicability: "NEEDS_VERIFICATION",
        condition: "If the bidder is a joint venture",
        conditionality: {
          applicability: "NEEDS_VERIFICATION",
          conditionText: "If the bidder is a joint venture",
          actionText: null,
          thresholdText: null,
          exceptionText: null,
          timeframeText: null,
          scopeText: null,
          unresolved: true,
        },
      }),
    );
    assert.equal(gate.checks.completeBoundaryAndContext, false);
    assert.equal(gate.admit, false);
  });

  it("lot-specific text cannot be expanded to ALL_LOTS or dropped", () => {
    const text =
      "For Lot 2 the bidder shall submit a manufacturer authorization with the bid.";
    const expanded = evaluateFinalSemanticAdmission(admissionBase(text, "ALL_LOTS"));
    assert.equal(expanded.checks.lotApplicabilityPreserved, false);
    const dropped = evaluateFinalSemanticAdmission(admissionBase(text, null));
    assert.equal(dropped.checks.lotApplicabilityPreserved, false);
    const kept = evaluateFinalSemanticAdmission(admissionBase(text, "LOT_2"));
    assert.equal(kept.checks.lotApplicabilityPreserved, true);
  });
});

describe("hardening — genuine bidder intelligence is preserved", () => {
  it("eligibility, required documents, technical specs and commercial bid terms remain", () => {
    const texts = [
      "The bidder shall have completed at least three similar installation projects.",
      "The Bidder shall submit ISO 9001 certification with the proposal.",
      "The bidder shall supply equipment that operates at 220V / 50Hz.",
      "The bidder shall quote firm and non-revisable prices for the duration of the bid validity.",
    ];
    for (const text of texts) {
      const s = interp(text);
      assert.equal(s.admitToCanonical, true, text);
      assert.notEqual(s.clausePurpose, "POST_AWARD_OBLIGATION", text);
    }
  });
});
