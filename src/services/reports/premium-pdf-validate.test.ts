/**
 * PDF post-render validation tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractMeaningfulPageText,
  validatePremiumPdfBuffer,
} from "@/services/reports/premium-pdf-validate";
import { buildTenderReportPdf } from "@/services/reports/tender-report";
import { stampTestGuardianSnapshot } from "@/domain/decision-validation/test-stamp";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import type { TenderReport } from "@/services/reports/types";

function buildSizedFixture(requirementCount: number, options?: { longText?: boolean }): TenderReport {
  const longSuffix = options?.longText
    ? " " +
      "Extended obligation narrative with installation milestones, acceptance testing, operator training, warranty terms, and maintenance SLAs that must flow across pages without orphan blank sheets. ".repeat(
        6,
      )
    : "";

  const requirements = Array.from({ length: requirementCount }, (_, i) => ({
    id: `r${i}`,
    category: "TECHNICAL",
    description: `Requirement ${i + 1}: deliver subsystem component with documented acceptance criteria.${longSuffix}`,
    mandatory: i % 3 !== 2,
    value: null as string | null,
    status: (i % 4 === 0 ? "FAILED" : i % 3 === 0 ? "UNCERTAIN" : "MATCHED") as
      | "FAILED"
      | "UNCERTAIN"
      | "MATCHED",
    sourcePage: i + 1,
    sourceSection: `${i + 1}.1`,
    evidence: i % 2 === 0 ? `Evidence excerpt for requirement ${i + 1}${longSuffix}` : null,
  }));

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
    missingDocuments: [
      {
        id: "d1",
        documentName: "Attestation CNSS",
        reason: "Required administrative document",
        severity: "HIGH" as const,
      },
    ],
    profileHasAnyCapability: true,
  });

  const intelligence = stampTestGuardianSnapshot(
    buildTenderIntelligence({
      tenderId: "t-pagination",
      documentName: "AVIS+CPS",
      tenderDeadline: null,
      extractedText: "sample package with many requirements",
      requirements,
      evidence: [],
      readiness,
      findings: [],
      existingRisks: [],
      decision: "REVIEW",
      fitScore: 58,
    }),
  );

  return {
    tenderId: "t-pagination",
    companyId: "c1",
    title: "Large AV acquisition package for pagination regression",
    client: "Ministère Test",
    deadline: "2026-09-15T12:00:00.000Z",
    deadlineTimezone: "Africa/Casablanca",
    analyzedAt: "2026-08-31T13:12:00.000Z",
    decision: "REVIEW",
    fitScore: 58,
    confidence: "MEDIUM",
    reasoning:
      "Multi-paragraph reasoning block that should flow across pages without leaving orphan headings or blank trailing pages. " +
      "Verify warranty coverage, installation plan completeness, and operator training scope before submission.",
    companyKnowledgeOnly: false,
    fitBreakdown: {
      overall: 58,
      scoringAvailable: true,
      recommendation: "Proceed with verification on mandatory gaps.",
      attention: ["Warranty evidence incomplete"],
      matches: [],
      gaps: [],
      unknowns: [],
      dimensions: [
        { key: "service", label: "Capability", score: 65, status: "scored", note: "", basis: "confirmed_from_profile" },
        { key: "industry", label: "Sector", score: 52, status: "scored", note: "", basis: "confirmed_from_profile" },
        { key: "geography", label: "Geography", score: 70, status: "scored", note: "", basis: "confirmed_from_profile" },
        { key: "size", label: "Scale", score: 45, status: "scored", note: "", basis: "ai_assessment" },
      ],
    },
    readiness,
    intelligence,
    complianceSummary: intelligence.complianceSummary,
    bidScore: {
      score: 52,
      scoringAvailable: true,
      priority: "MEDIUM",
      priorityLabel: "Medium priority",
      interpretation: "Pursue with structured verification.",
      expectedValue: "MEDIUM",
      expectedValueNote: "Illustrative only.",
      contractValue: null,
      contractValueLabel: "Contract value: Medium",
      contractValueProvenance: "UNKNOWN",
      pursuitCost: null,
      pursuitCostLabel: "Pursuit cost: Medium",
      pursuitCostProvenance: "UNKNOWN",
      winProbabilityLabel: "Win probability: Not a Bidvera output",
      winProbabilityProvenance: "UNKNOWN",
      effort: "MEDIUM",
      effortNote: "",
      riskLevel: "MEDIUM",
      drivers: [
        { label: "Partial fit", direction: "positive" },
        { label: "Open mandatory gaps", direction: "negative" },
      ],
      reducedCertainty: false,
      certaintyNote: null,
      disclaimer: "Priority only — not win probability.",
    },
    historicalSignals: [],
    matched: [],
    failed: [],
    uncertain: [],
    criticalRisks: [],
    missingDocuments: [
      {
        id: "d1",
        documentName: "Attestation CNSS",
        reason: "Required administrative document",
        severity: "HIGH",
      },
    ],
    evidence: [
      {
        id: "e1",
        text: "installation plan excerpt with milestones",
        sourcePage: 3,
        sourceSection: "2.1",
        verificationStatus: "VERIFIED",
      },
    ],
    nextActions: [
      { id: "a1", title: "Verify warranty coverage", description: null, priority: 1 },
      { id: "a2", title: "Confirm CNSS attestation", description: null, priority: 2 },
    ],
    decisionOutcome: null,
  };
}

function baseFixture(): TenderReport {
  return buildSizedFixture(12);
}

async function assertPdfHasNoBlankPages(
  pdf: Buffer,
  title: string,
): Promise<{ pageCount: number; meaningfulCharsPerPage: number[] }> {
  const result = await validatePremiumPdfBuffer(pdf, { headerPhrases: [title] });
  for (let i = 0; i < result.meaningfulCharsPerPage.length; i++) {
    const chars = result.meaningfulCharsPerPage[i]!;
    const min = i === 0 ? 40 : 60;
    assert.ok(chars >= min, `page ${i + 1} too sparse: ${chars} chars`);
  }
  return result;
}

describe("premium-pdf-validate", () => {
  it("extractMeaningfulPageText strips chrome lines and repeating header titles", () => {
    const raw = "Executive Summary\nConfidential\nPage 2 of 5\n3 requirements · 1 ready";
    const meaningful = extractMeaningfulPageText(raw);
    assert.ok(meaningful.includes("Executive Summary"));
    assert.ok(meaningful.includes("3 requirements"));
    assert.ok(!/confidential/i.test(meaningful));
    assert.ok(!/page 2 of 5/i.test(meaningful));

    const headerOnly = extractMeaningfulPageText(
      "Tender Audiovisual Equipment\nConfidential\nPage 3 of 24",
      { headerPhrases: ["Tender Audiovisual Equipment"] },
    );
    assert.equal(headerOnly.length, 0);
  });

  it("validatePremiumPdfBuffer rejects nearly-empty synthetic page text", async () => {
    await assert.rejects(
      () =>
        validatePremiumPdfBuffer(Buffer.from("%PDF-1.4 invalid"), {
          minMeaningfulCharsContent: 9999,
        }),
      /validation failed|Invalid PDF/i,
    );
  });

  it("generated report passes blank-page and density validation", async () => {
    const report = baseFixture();
    const pdf = await buildTenderReportPdf(report, {
      locale: "en",
      companyName: "Acme Procurement Ltd",
      appOrigin: "http://localhost:3000",
    });
    const result = await assertPdfHasNoBlankPages(pdf, report.title);
    assert.ok(result.pageCount >= 3);
  });

  it("pagination regression — 1, 8, 14, and 50+ requirements produce no blank pages", async () => {
    for (const count of [1, 8, 14, 52]) {
      const report = buildSizedFixture(count, { longText: count >= 14 });
      report.reasoning =
        "Canonical reasoning block that must paginate cleanly across content pages without reserving empty slots or orphan headings.";
      const pdf = await buildTenderReportPdf(report, {
        locale: "en",
        companyName: "Acme Procurement Ltd",
        appOrigin: "http://localhost:3000",
      });
      const result = await assertPdfHasNoBlankPages(pdf, report.title);
      assert.ok(
        result.pageCount <= count + 8,
        `${count} requirements should not explode page count (${result.pageCount} pages)`,
      );
    }
  });

  it("audiovisual canonical tender PDF has compact page count and full body on every page", async () => {
    const { buildCanonicalRequirements } = await import("@/domain/tender-requirements");
    const { extractTenderPackageHeuristic } = await import(
      "@/services/tender-extraction/requirements-heuristic"
    );
    const { AUDIOVISUAL_TENDER_FIXTURE } = await import(
      "@/domain/tender-requirements/audiovisual-regression.test"
    );

    const heuristic = extractTenderPackageHeuristic({
      text: AUDIOVISUAL_TENDER_FIXTURE,
      fileName: "AV.pdf",
    });
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "AV.pdf",
    });
    const requirements = canonical.map((r, i) => ({
      id: `r${i}`,
      category: r.category,
      description: r.requirement,
      mandatory: r.mandatory,
      value: r.value ?? null,
      status: "UNCERTAIN" as const,
      sourcePage: r.page ?? null,
      sourceSection: r.sourceSection ?? null,
      evidence: r.evidenceText ?? null,
    }));
    const readiness = computeTenderReadiness({
      requirements,
      missingDocuments: heuristic.missingDocuments.map((d, i) => ({
        id: `d${i}`,
        documentName: d.documentName,
        reason: d.reason,
        severity: d.severity,
      })),
      profileHasAnyCapability: true,
    });
    const intelligence = stampTestGuardianSnapshot(
      buildTenderIntelligence({
        tenderId: "av-pdf",
        documentName: "AV.pdf",
        tenderDeadline: heuristic.deadlineIso,
        extractedText: AUDIOVISUAL_TENDER_FIXTURE,
        requirements,
        evidence: [],
        readiness,
        findings: [],
        existingRisks: [],
        decision: "REVIEW",
        fitScore: 47,
      }),
    );

    const report: TenderReport = {
      ...baseFixture(),
      tenderId: "av-pdf",
      title: "Tender Audiovisual Equipment",
      client: null,
      decision: "REVIEW",
      fitScore: 47,
      reasoning: "Review AV scope and verify mandatory administrative documents.",
      fitBreakdown: { ...baseFixture().fitBreakdown!, overall: 47 },
      readiness,
      intelligence,
      complianceSummary: intelligence.complianceSummary,
      matched: [],
      failed: [],
      uncertain: requirements.map((r) => ({
        id: r.id,
        description: r.description,
        category: r.category,
        sourcePage: r.sourcePage,
        sourceSection: r.sourceSection,
      })),
      missingDocuments: heuristic.missingDocuments.map((d, i) => ({
        id: `d${i}`,
        documentName: d.documentName,
        reason: d.reason,
        severity: d.severity,
      })),
    };

    const pdf = await buildTenderReportPdf(report, {
      locale: "en",
      companyName: "Test Co",
      appOrigin: "http://localhost:3000",
    });
    const result = await assertPdfHasNoBlankPages(pdf, report.title);
    assert.ok(
      result.pageCount <= 10,
      `AV tender should not produce excessive pages (got ${result.pageCount})`,
    );
    assert.equal(readiness.totalRequirements, 5);
  });

  it("multi-page PDF repeats table dimension header on continuation", async () => {
    const pdf = await buildTenderReportPdf(baseFixture(), {
      locale: "en",
      companyName: "Acme",
      appOrigin: "http://localhost:3000",
    });
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: pdf });
    const parsed = await parser.getText();
    await parser.destroy();
    const dimensionHeaders =
      parsed.text.match(/DIMENSION/gi)?.length ?? 0;
    assert.ok(
      dimensionHeaders >= 2,
      "fit table header should repeat when table spans pages",
    );
  });

  it("empty list sections are omitted to avoid title-only pages", async () => {
    const report = baseFixture();
    report.intelligence!.risks = [];
    report.criticalRisks = [];
    report.evidence = [];
    report.nextActions = [];
    report.missingDocuments = [];

    const pdf = await buildTenderReportPdf(report, {
      locale: "en",
      companyName: "Acme",
      appOrigin: "http://localhost:3000",
    });
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: pdf });
    const parsed = await parser.getText();
    await parser.destroy();
    assert.ok(!parsed.text.includes("Recommended next actions"));
    assert.ok(!parsed.text.match(/#?\s*Risks\s*\n\s*None/i));
    await validatePremiumPdfBuffer(pdf);
  });
});
