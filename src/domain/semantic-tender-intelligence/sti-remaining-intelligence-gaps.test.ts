/**
 * Remaining universal intelligence gaps — architectural regressions.
 * Generic procurement patterns only. No tender / country / filename rules.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { interpretSemanticStatement } from "./interpret";
import { buildSemanticIdentity } from "./identity";
import { classifyDocumentPurpose } from "./document-purpose";
import { detectMetadataFact } from "./metadata";
import { stripTableResponseChrome } from "./table-context";
import { buildCanonicalSemanticCandidates } from "./candidates";
import { attributeObligationActor } from "@/domain/tender-requirements/obligation-actor";
import { obligationFingerprint } from "@/domain/tender-requirements/semantic-dedupe";
import { extractSpreadsheetText } from "@/services/document/extract-spreadsheet";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import {
  harvestDraftsFromUnits,
  looksLikeObligationCandidate,
} from "@/domain/document-intelligence/semantic-units";
import { buildTenderIntelligence } from "@/domain/tender-intelligence/build";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import type { SemanticProvenance } from "./types";

const BID_TIME = /BID_SUBMISSION|PRE_AWARD|PRE_AWARD_COMMITMENT|PRE_BID/;

const prov: SemanticProvenance = {
  sourceDocument: "pack.pdf",
  sourcePage: 1,
  sourceSection: null,
  sourceCell: null,
  versionLabel: null,
  locator: null,
};

function interp(
  text: string,
  extra?: {
    sourceDocument?: string;
    documentRole?: string;
    sourceCell?: string | null;
    versionLabel?: string | null;
  },
) {
  return interpretSemanticStatement({
    text,
    provenance: {
      ...prov,
      sourceDocument: extra?.sourceDocument ?? "pack.pdf",
      sourceCell: extra?.sourceCell ?? null,
      versionLabel: extra?.versionLabel ?? null,
    },
    context: {
      documentRole: extra?.documentRole as never,
    },
  });
}

function xlsxBuffer(rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Schedule");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

describe("spreadsheet semantic cleanup", () => {
  it("extract text never embeds cell-address prefixes as harvestable meaning", () => {
    const buf = xlsxBuffer([
      ["Item", "Requirement"],
      ["1", "The Bidder shall submit ISO 9001 with the proposal."],
    ]);
    const result = extractSpreadsheetText(buf, { fileName: "schedule.xlsx" });
    assert.match(result.text, /ISO 9001/);
    assert.doesNotMatch(result.text, /\b[A-Z]{1,3}\d{1,4}=/);
    assert.doesNotMatch(result.text, /\[Cells:/);
    const cell = result.structure.tables[0]?.rows.flat().find((c) => /ISO/i.test(c.text ?? ""));
    assert.ok(cell?.address);
  });

  it("leftover cell chrome is stripped before semantic identity", () => {
    const cleaned = stripTableResponseChrome(
      "A4=The Bidder shall submit a signed Form of Tender.",
    );
    assert.doesNotMatch(cleaned, /^A4=/);
    assert.match(cleaned, /Form of Tender/);
    const s = interp("B9=The Bidder shall attach the price schedule to the bid.");
    assert.doesNotMatch(s.requirementText, /\bB9=/);
    assert.equal(s.admitToCanonical, true);
  });
});

describe("discovery completeness", () => {
  it("heuristic harvest is not silently capped at 80 obligations", () => {
    const lines = Array.from(
      { length: 95 },
      (_, i) => `The Bidder shall submit labelled evidence item ${i + 1} with the proposal.`,
    );
    const extracted = extractTenderPackageHeuristic({
      text: lines.join("\n"),
      fileName: "itt.pdf",
    });
    assert.ok(extracted.requirements.length > 80);
    assert.equal(extracted.harvestLimitReached, false);
  });

  it("structured label-value and numbered fields are discoverable without shall/must", () => {
    assert.equal(
      looksLikeObligationCandidate("Minimum quantity: 5 units for Lot A under this schedule."),
      true,
    );
    assert.equal(
      looksLikeObligationCandidate("4.2.1 Tax clearance certificate attached to the proposal pack."),
      true,
    );
    const extracted = extractTenderPackageHeuristic({
      text: [
        "Minimum quantity: 5 units for Lot A under this schedule of requirements.",
        "4.2.1 Tax clearance certificate attached to the proposal pack before closing.",
      ].join("\n"),
      fileName: "forms.docx",
    });
    assert.ok(
      extracted.requirements.some((r) => /5 units/i.test(r.description)),
      "structured quantity field must be harvested",
    );
  });
});

describe("actor attribution", () => {
  it("supplier as recipient of a buyer-agent duty is not the obligated actor", () => {
    const text =
      "The UNOPS appointed focal person shall issue a release Purchase Order (PO) to the supplier.";
    const attribution = attributeObligationActor(text);
    assert.equal(attribution.actor, "AUTHORITY_SIDE");
    const s = interp(text);
    assert.match(String(s.actor), /AUTHORITY|BUYER|PROCURING_ENTITY|EVALUATOR/);
    assert.notEqual(s.actor, "SUPPLIER");
    assert.equal(s.admitToCanonical, false);
  });

  it("supplier as grammatical subject remains SUPPLIER", () => {
    const s = interp("The Supplier shall submit a price schedule with its bid.");
    assert.equal(s.actor, "SUPPLIER");
    assert.equal(s.admitToCanonical, true);
    assert.match(s.procurementPhase, BID_TIME);
  });

  it("unproven actor stays UNKNOWN and is not invented as BIDDER", () => {
    const s = interp("A detailed methodology is required.");
    assert.match(String(s.actor), /UNKNOWN|IMPERSONAL/);
    assert.notEqual(s.actor, "BIDDER");
    assert.equal(s.admitToCanonical, false);
  });
});

describe("document purpose and contextual volumes", () => {
  it("pre-bid minutes without a bidder-stage duty are BACKGROUND", () => {
    assert.equal(
      classifyDocumentPurpose({
        text: "Minutes of the pre-bid conference held on 12 May. The presentation summarises the scope.",
        documentRole: "PREBID_MATERIAL",
      }),
      "BACKGROUND",
    );
    const s = interp(
      "Minutes of the pre-bid conference. This presentation summarises the procurement timeline.",
      { documentRole: "PREBID_MATERIAL" },
    );
    assert.equal(s.documentPurpose, "BACKGROUND");
    assert.equal(s.admitToCanonical, false);
  });

  it("a genuine bidder duty inside instructions remains admissible", () => {
    const s = interp("The Bidder shall submit the Form of Tender with the proposal.", {
      documentRole: "INSTRUCTIONS_TO_BIDDERS",
    });
    assert.equal(s.documentPurpose, "PROCUREMENT_REQUIREMENT_SOURCE");
    assert.equal(s.admitToCanonical, true);
  });
});

describe("semantic identity without over-merge", () => {
  it("quantity, duration and currency facets stay distinct", () => {
    const five = buildSemanticIdentity({
      text: "The Bidder shall supply 5 units of the equipment with the bid.",
      actor: "BIDDER",
      contentKind: "TECHNICAL_REQUIREMENT",
      procurementPhase: "BID_SUBMISSION",
    });
    const ten = buildSemanticIdentity({
      text: "The Bidder shall supply 10 units of the equipment with the bid.",
      actor: "BIDDER",
      contentKind: "TECHNICAL_REQUIREMENT",
      procurementPhase: "BID_SUBMISSION",
    });
    assert.notEqual(five, ten);
    const d30 = obligationFingerprint(
      "The offer shall remain valid for 30 days from the bid closing date.",
      "CONTRACTUAL",
    );
    const d90 = obligationFingerprint(
      "The offer shall remain valid for 90 days from the bid closing date.",
      "CONTRACTUAL",
    );
    assert.notEqual(d30, d90);
  });

  it("pre-award commitment and post-award execution never share identity", () => {
    const pre = buildSemanticIdentity({
      text: "The Bidder shall deliver within 30 days.",
      actor: "BIDDER",
      contentKind: "TECHNICAL_REQUIREMENT",
      procurementPhase: "PRE_AWARD_COMMITMENT",
    });
    const post = buildSemanticIdentity({
      text: "The Bidder shall deliver within 30 days.",
      actor: "BIDDER",
      contentKind: "TECHNICAL_REQUIREMENT",
      procurementPhase: "DELIVERY",
    });
    assert.notEqual(pre, post);
  });
});

describe("structured tables, metadata, amendments, contradictions", () => {
  it("table headers and cell coordinates are not admitted as requirements", () => {
    const header = interp("Requirement | Compliance | Remarks", {
      sourceDocument: "returnable.xlsx",
    });
    assert.equal(header.admitToCanonical, false);
    const cell = interp("A4=");
    assert.equal(cell.admitToCanonical, false);
  });

  it("opening date and offer validity are not submission-deadline metadata", () => {
    const opening = detectMetadataFact("Bid opening date: 12 May 2026 at 10:00");
    assert.equal(opening.isMetadata, true);
    assert.notEqual(opening.field, "deadline");
    const validity = detectMetadataFact(
      "The offer shall remain valid for ninety (90) days from the bid closing date.",
    );
    assert.equal(validity.isMetadata, false);
  });

  it("an amendment sentence is not assumed to replace a prior clause", () => {
    const original = interp("The Bidder shall submit ISO 9001 with the proposal.", {
      versionLabel: "ITB original",
    });
    const aside = interp("This addendum clarifies the site visit arrangements for Lot 2.", {
      sourceDocument: "addendum.pdf",
      documentRole: "AMENDMENT",
      versionLabel: "Addendum 1",
    });
    assert.equal(original.admitToCanonical, true);
    assert.equal(aside.admitToCanonical, false);
    assert.notEqual(original.semanticIdentity, aside.semanticIdentity);
  });

  it("conflicting proven values across documents are preserved as REVIEW contradictions", () => {
    const requirements = [
      {
        id: "r-valid-90",
        category: "CONTRACTUAL",
        description: "The offer shall remain valid for 90 days from the bid closing date.",
        mandatory: true,
        value: null as string | null,
        status: "UNCERTAIN" as const,
        sourcePage: 1,
        sourceSection: "Instructions",
        sourceDocument: "itt.pdf",
        versionLabel: "original",
        semanticKind: "FINANCIAL_COMMERCIAL_CONDITION",
        evidence: "The offer shall remain valid for 90 days from the bid closing date.",
      },
      {
        id: "r-valid-60",
        category: "CONTRACTUAL",
        description: "The offer shall remain valid for 60 days from the bid closing date.",
        mandatory: true,
        value: null,
        status: "UNCERTAIN" as const,
        sourcePage: 1,
        sourceSection: "Addendum",
        sourceDocument: "addendum.pdf",
        versionLabel: "Addendum 1",
        semanticKind: "FINANCIAL_COMMERCIAL_CONDITION",
        evidence: "The offer shall remain valid for 60 days from the bid closing date.",
      },
    ];
    const readiness = computeTenderReadiness({
      requirements: requirements.map((r) => ({
        id: r.id,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        evidence: r.evidence,
      })),
      missingDocuments: [],
      profileHasAnyCapability: true,
    });
    const intel = buildTenderIntelligence({
      tenderId: "t-conflict",
      documentName: "pack",
      tenderDeadline: null,
      extractedText: "",
      requirements,
      evidence: [],
      readiness,
      findings: [],
      existingRisks: [],
      decision: "REVIEW",
      fitScore: 50,
    });
    assert.ok(intel.contradictions.length >= 1);
    assert.ok(intel.contradictions[0]!.items.includes("r-valid-90"));
    assert.ok(intel.contradictions[0]!.items.includes("r-valid-60"));
  });
});

describe("failure isolation and provenance", () => {
  it("one malformed unit does not abort harvest of independent units", () => {
    const drafts = harvestDraftsFromUnits([
      {
        id: "u-bad",
        kind: "paragraph",
        text: null as unknown as string,
        fileName: "broken.pdf",
        page: 1,
        sectionPath: null,
        nonRequirement: false,
        precedingText: null,
        followingText: null,
        table: null,
        packageDocumentRole: null,
        versionLabel: null,
      },
      {
        id: "u-ok",
        kind: "paragraph",
        text: "The Bidder shall submit ISO 9001 certification with the proposal.",
        fileName: "itt.pdf",
        page: 2,
        sectionPath: "Eligibility",
        nonRequirement: false,
        precedingText: null,
        followingText: null,
        table: null,
        packageDocumentRole: "INSTRUCTIONS_TO_BIDDERS",
        versionLabel: null,
      },
    ] as never);
    assert.ok(drafts.some((d) => /ISO 9001/i.test(d.description)));
  });

  it("interpretation failure is excluded with an explicit code and does not invent certainty", () => {
    const empty = interp("");
    assert.equal(empty.admitToCanonical, false);
    assert.ok(empty.exclusionCode);

    const { rejected, candidates } = buildCanonicalSemanticCandidates([
      {
        description: "The Bidder shall submit a signed Form of Tender with the proposal.",
        sourceDocument: "itt.pdf",
        sourcePage: 2,
        documentRole: "INSTRUCTIONS_TO_BIDDERS",
      },
    ]);
    assert.ok(candidates.some((c) => /Form of Tender/i.test(c.fullRequirementText)));
    assert.ok(rejected.every((r) => Boolean(r.exclusionCode)));
  });

  it("equivalent PDF/DOCX/XLSX wrappers keep the same admitted meaning", () => {
    const text = "The Bidder shall submit a signed Form of Tender with the proposal.";
    const ids = ["clause.pdf", "clause.docx", "clause.xlsx", "clause.txt", "slides.pptx"].map(
      (file) => {
        const s = interp(text, { sourceDocument: file });
        assert.equal(s.admitToCanonical, true, file);
        assert.equal(s.actor, "BIDDER", file);
        return s.semanticIdentity;
      },
    );
    assert.equal(new Set(ids).size, 1);
  });
});
