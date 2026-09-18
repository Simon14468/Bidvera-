/**
 * Evidence & provenance source-of-truth — general adversarial cases.
 * No tender/country/filename-specific patches.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { normalizeRequirements } from "@/domain/tender-requirements/normalize";
import { mergeNormalizedRequirements } from "@/domain/tender-requirements/semantic-dedupe";
import { deriveCanonicalReportSections } from "@/services/reports/report-canonical-view";
import type { TenderReport } from "@/services/reports/types";
import type { RequirementMatchStatus } from "@prisma/client";

function intelligenceFrom(reqs: Array<{
  id: string;
  description: string;
  sourceDocument?: string | null;
  sourcePage?: number | null;
  sourceSection?: string | null;
  evidenceText?: string | null;
  sourceCell?: string | null;
  columnHeader?: string | null;
  versionLabel?: string | null;
  sourceCompleteness?: "COMPLETE" | "TRUNCATED" | "PARTIAL" | "UNREADABLE" | null;
  evidence?: string | null;
  fitProvenanceExcerpt?: string | null;
}>) {
  const requirements = reqs.map((r) => ({
    id: r.id,
    category: "MANDATORY_TECHNICAL",
    description: r.description,
    mandatory: true,
    value: null,
    status: "UNCERTAIN" as RequirementMatchStatus,
    sourcePage: r.sourcePage ?? null,
    sourceSection: r.sourceSection ?? null,
    evidence: r.evidence ?? null,
    sourceDocument: r.sourceDocument ?? null,
    evidenceText: r.evidenceText ?? null,
    sourceCell: r.sourceCell ?? null,
    columnHeader: r.columnHeader ?? null,
    versionLabel: r.versionLabel ?? null,
    sourceCompleteness: r.sourceCompleteness ?? null,
    fitProvenanceExcerpt: r.fitProvenanceExcerpt ?? null,
  }));
  return buildTenderIntelligence({
    tenderId: "t-prov",
    documentName: "pack-label.pdf + other.pdf",
    tenderDeadline: null,
    extractedText: "IGNORE THIS RAW TEXT Submission deadline: 1 January 1999 at 09:00",
    deadlineEvidence: null,
    requirements,
    evidence: [],
    readiness: computeTenderReadiness({
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
      fit: null,
    }),
    findings: [],
    existingRisks: [],
    decision: "REVIEW",
    fitScore: 50,
  });
}

describe("evidence source of truth — document identity", () => {
  it("does not stamp every requirement with the package label", () => {
    const intel = intelligenceFrom([
      {
        id: "r1",
        description: "The bidder shall submit a bid bond of two percent.",
        sourceDocument: "volume-b-schedule.pdf",
        sourcePage: 4,
        sourceSection: "3.2",
        evidenceText: "Bid bond of 2% of the estimated contract value.",
      },
      {
        id: "r2",
        description: "The bidder shall provide ISO 9001 certification.",
        sourceDocument: "volume-c-forms.pdf",
        sourcePage: 1,
        sourceSection: "Form A",
        evidenceText: "ISO 9001 certificate is required.",
      },
    ]);
    const a = intel.complianceMatrix.find((r) => r.requirementId === "r1")!;
    const b = intel.complianceMatrix.find((r) => r.requirementId === "r2")!;
    assert.equal(a.tenderSource?.documentName, "volume-b-schedule.pdf");
    assert.equal(b.tenderSource?.documentName, "volume-c-forms.pdf");
    assert.notEqual(a.sourceDocument, "pack-label.pdf + other.pdf");
  });

  it("does not attach company evidence as the tender source document", () => {
    const intel = intelligenceFrom([
      {
        id: "r1",
        description: "The bidder shall hold ISO 27001.",
        sourceDocument: "itt.pdf",
        sourcePage: 2,
        sourceSection: "Eligibility",
        evidenceText: "ISO 27001 is required.",
        evidence: "Company profile lists ISO 27001.",
        fitProvenanceExcerpt: "ISO 27001 — company certificate store",
      },
    ]);
    const row = intel.complianceMatrix[0]!;
    assert.equal(row.tenderSource?.documentName, "itt.pdf");
    assert.equal(row.tenderSource?.kind, "TENDER_SOURCE");
    assert.match(row.tenderSource?.excerpt ?? "", /ISO 27001 is required/);
    assert.equal(row.companyEvidence?.kind, "COMPANY_EVIDENCE");
    assert.match(row.companyEvidence?.excerpt ?? "", /company certificate/);
  });
});

describe("evidence source of truth — tables and versions", () => {
  it("normalize and dedupe keep Excel cell and column header", () => {
    const [row] = normalizeRequirements([
      {
        category: "MANDATORY_TECHNICAL",
        description: "The bidder shall supply item A at the stated quantity.",
        mandatory: true,
        sourceDocument: "boq.xlsx",
        sourcePage: 1,
        sourceSection: "Sheet1",
        sourceCell: "C14",
        columnHeader: "Requirement",
        rowLabel: "Item A",
        evidenceText: "Item A | Qty 10 | Mandatory",
      },
    ]);
    assert.ok(row);
    assert.equal(row.sourceCell, "C14");
    assert.equal(row.columnHeader, "Requirement");
    assert.equal(row.sourceDocument, "boq.xlsx");
  });

  it("duplicate obligations from two cells keep both provenance links", () => {
    const merged = mergeNormalizedRequirements([
      {
        category: "MANDATORY_TECHNICAL",
        semanticKind: "TECHNICAL_REQUIREMENT",
        obligationStrength: "MANDATORY",
        title: "Qty",
        requirement: "The bidder shall supply ten units of item A.",
        mandatory: true,
        confidence: "HIGH",
        sourceDocument: "boq.xlsx",
        page: 1,
        sourceSection: "Sheet1",
        sourceCell: "C14",
        evidenceText: "C14: ten units",
        stiProvenance: [
          {
            sourceDocument: "boq.xlsx",
            sourcePage: 1,
            sourceSection: "Sheet1",
            sourceCell: "C14",
            versionLabel: null,
          },
        ],
      },
      {
        category: "MANDATORY_TECHNICAL",
        semanticKind: "TECHNICAL_REQUIREMENT",
        obligationStrength: "MANDATORY",
        title: "Qty",
        requirement: "The bidder shall supply ten units of item A.",
        mandatory: true,
        confidence: "HIGH",
        sourceDocument: "boq.xlsx",
        page: 1,
        sourceSection: "Sheet1",
        sourceCell: "F14",
        evidenceText: "F14: ten units",
        stiProvenance: [
          {
            sourceDocument: "boq.xlsx",
            sourcePage: 1,
            sourceSection: "Sheet1",
            sourceCell: "F14",
            versionLabel: null,
          },
        ],
      },
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.stiProvenance?.length, 2);
    assert.ok(merged[0]!.stiProvenance?.some((p) => p.sourceCell === "C14"));
    assert.ok(merged[0]!.stiProvenance?.some((p) => p.sourceCell === "F14"));
  });

  it("amendment provenance does not silently drop the original source", () => {
    const merged = mergeNormalizedRequirements([
      {
        category: "MANDATORY_ADMINISTRATIVE",
        semanticKind: "REQUIRED_DOCUMENT",
        obligationStrength: "MANDATORY",
        title: "Bond",
        requirement: "The bidder shall submit a bid bond of one percent.",
        mandatory: true,
        confidence: "HIGH",
        sourceDocument: "itt.pdf",
        page: 3,
        sourceSection: "Bid security",
        versionLabel: "original",
        evidenceText: "bid bond of 1%",
        stiProvenance: [
          {
            sourceDocument: "itt.pdf",
            sourcePage: 3,
            sourceSection: "Bid security",
            sourceCell: null,
            versionLabel: "original",
          },
        ],
      },
      {
        category: "MANDATORY_ADMINISTRATIVE",
        semanticKind: "REQUIRED_DOCUMENT",
        obligationStrength: "MANDATORY",
        title: "Bond",
        requirement: "The bidder shall submit a bid bond of one percent.",
        mandatory: true,
        confidence: "HIGH",
        sourceDocument: "corrigendum.pdf",
        page: 1,
        sourceSection: "Amendment 1",
        versionLabel: "corrigendum-1",
        evidenceText: "bid bond remains 1%",
        stiProvenance: [
          {
            sourceDocument: "corrigendum.pdf",
            sourcePage: 1,
            sourceSection: "Amendment 1",
            sourceCell: null,
            versionLabel: "corrigendum-1",
          },
        ],
      },
    ]);
    assert.equal(merged.length, 1);
    const docs = merged[0]!.sourceDocuments ?? [];
    assert.ok(docs.some((d) => /itt\.pdf/i.test(d)));
    assert.ok(docs.some((d) => /corrigendum/i.test(d)));
    assert.equal(merged[0]!.stiProvenance?.length, 2);
  });

  it("conflicting source texts are not collapsed into one invented clause", () => {
    const merged = mergeNormalizedRequirements([
      {
        category: "MANDATORY_ADMINISTRATIVE",
        semanticKind: "REQUIRED_DOCUMENT",
        obligationStrength: "MANDATORY",
        title: "Bond",
        requirement: "The bidder shall submit a bid bond of one percent.",
        mandatory: true,
        confidence: "HIGH",
        sourceDocument: "itt.pdf",
        page: 3,
        sourceSection: "Bid security",
        versionLabel: "original",
        evidenceText: "bid bond of 1%",
      },
      {
        category: "MANDATORY_ADMINISTRATIVE",
        semanticKind: "REQUIRED_DOCUMENT",
        obligationStrength: "MANDATORY",
        title: "Bond",
        requirement: "The bidder shall submit a bid bond of two percent.",
        mandatory: true,
        confidence: "HIGH",
        sourceDocument: "corrigendum.pdf",
        page: 1,
        sourceSection: "Amendment 1",
        versionLabel: "corrigendum-1",
        evidenceText: "bid bond of 2%",
      },
    ]);
    assert.equal(merged.length, 2);
    assert.ok(merged.some((r) => /one percent/.test(r.requirement)));
    assert.ok(merged.some((r) => /two percent/.test(r.requirement)));
  });

  it("truncated extraction keeps incompleteness instead of looking located from a package label", () => {
    const intel = intelligenceFrom([
      {
        id: "r1",
        description: "The bidder shall submit the outstanding form",
        sourceDocument: "notice.pdf",
        sourceCompleteness: "TRUNCATED",
        evidenceText: "The bidder shall submit the outstand",
      },
    ]);
    const row = intel.complianceMatrix[0]!;
    assert.equal(row.tenderSource?.completeness, "TRUNCATED");
    assert.equal(row.tenderSource?.located, false);
  });
});

describe("evidence source of truth — no raw-text reconstruction", () => {
  it("does not invent a deadline excerpt by scanning concatenated package text", () => {
    const intel = intelligenceFrom([
      {
        id: "r1",
        description: "The bidder shall submit two envelopes.",
        sourceDocument: "itt.pdf",
        sourcePage: 1,
        sourceSection: "Instructions",
        evidenceText: "Submit two envelopes.",
      },
    ]);
    const deadline = intel.tenderFactsProvenance?.find((f) => f.key === "deadline");
    assert.ok(deadline);
    assert.equal(deadline!.value, null);
    assert.equal(deadline!.source, null);
    assert.ok(!/1999/.test(deadline!.note ?? ""));
  });

  it("report sections consume stored tender source, not a reconstructed package name", () => {
    const intel = intelligenceFrom([
      {
        id: "r1",
        description: "The bidder shall provide a method statement.",
        sourceDocument: "tech-vol.pdf",
        sourcePage: 8,
        sourceSection: "4.1",
        evidenceText: "A method statement is required.",
      },
    ]);
    const report = {
      tenderId: "t-prov",
      companyId: "c1",
      title: "Pack",
      client: null,
      deadline: null,
      deadlineTimezone: null,
      analyzedAt: null,
      decision: null,
      fitScore: null,
      confidence: null,
      reasoning: null,
      fitBreakdown: null,
      readiness: null,
      intelligence: intel,
      complianceSummary: intel.complianceSummary,
      bidScore: null,
      historicalSignals: [],
      matched: [],
      failed: [],
      uncertain: [],
      criticalRisks: [],
      missingDocuments: [],
      evidence: [],
      nextActions: [],
      decisionOutcome: null,
    } as unknown as TenderReport;
    const sections = deriveCanonicalReportSections(report);
    assert.equal(sections.complianceMatrix[0]?.tenderSource?.documentName, "tech-vol.pdf");
    assert.equal(sections.complianceMatrix[0]?.tenderSource?.page, 8);
  });
});
