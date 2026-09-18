/**
 * PDF / UI / API report integrity — all three must use the same canonical slices.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import {
  assertCanonicalReportIntegrity,
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
  NOT_AVAILABLE,
} from "@/services/reports/report-canonical-view";
import {
  assertPdfCanonicalConsistency,
  buildReportDisplayContent,
} from "@/services/reports/report-display-content";
import {
  buildTenderReportPdf,
  buildTenderReportPdfPlainText,
} from "@/services/reports/tender-report";
import type { TenderReport } from "@/services/reports/types";
import { stampTestGuardianSnapshot } from "@/domain/decision-validation/test-stamp";

function fixtureReport(): TenderReport {
  const requirements = [
    {
      id: "r1",
      category: "TECHNICAL",
      description: "Provide audiovisual equipment installation plan with milestones.",
      mandatory: true,
      value: null as string | null,
      status: "UNCERTAIN" as const,
      sourcePage: 3,
      sourceSection: "2.1",
      evidence: "installation plan excerpt",
    },
    {
      id: "r2",
      category: "TECHNICAL",
      description: "Deliver warranty coverage for installed AV systems.",
      mandatory: true,
      value: null,
      status: "FAILED" as const,
      sourcePage: 5,
      sourceSection: "4.2",
      evidence: null,
    },
    {
      id: "r3",
      category: "PREFERRED",
      description: "Optional training workshop for operators.",
      mandatory: false,
      value: null,
      status: "MATCHED" as const,
      sourcePage: 8,
      sourceSection: null,
      evidence: "training offered",
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
    missingDocuments: [
      {
        id: "d1",
        documentName: "Attestation CNSS",
        reason: "Required administrative document",
        severity: "HIGH",
      },
      {
        id: "d2",
        documentName: "Bank guarantee",
        reason: "Financial guarantee referenced",
        severity: "MEDIUM",
      },
    ],
    profileHasAnyCapability: true,
  });

  const intelligence = buildTenderIntelligence({
    tenderId: "t-pdf",
    documentName: "AVIS+CPS",
    tenderDeadline: null,
    extractedText: "sample package",
    requirements,
    evidence: [
      {
        id: "e1",
        requirementId: "r1",
        sourcePage: 3,
        sourceSection: "2.1",
        evidenceText: "installation plan excerpt",
        verificationStatus: "VERIFIED",
      },
      {
        id: "e2",
        requirementId: "r2",
        sourcePage: null,
        sourceSection: null,
        evidenceText: "No supporting excerpt available — marked UNKNOWN.",
        verificationStatus: "UNKNOWN",
      },
    ],
    readiness,
    findings: [],
    existingRisks: [],
    decision: "REVIEW",
    fitScore: 62,
  });

  const gatedIntelligence = stampTestGuardianSnapshot(intelligence);

  return {
    tenderId: "t-pdf",
    companyId: "c1",
    title: "AV acquisition package",
    client: "Ministère Test",
    deadline: "2026-09-15T12:00:00.000Z",
    deadlineTimezone: "Africa/Casablanca",
    analyzedAt: "2026-08-31T13:12:00.000Z",
    decision: "REVIEW",
    fitScore: 62,
    confidence: "MEDIUM",
    reasoning: "Canonical reasoning from analysis.",
    companyKnowledgeOnly: false,
    fitBreakdown: {
      overall: 62,
      scoringAvailable: true,
      recommendation: "Proceed with verification.",
      attention: [],
      matches: [],
      gaps: [],
      unknowns: [],
      dimensions: [
        {
          key: "service",
          label: "Capability",
          score: 70,
          status: "scored",
          note: "From profile",
          basis: "confirmed_from_profile",
        },
      ],
    },
    readiness,
    intelligence: gatedIntelligence,
    complianceSummary: gatedIntelligence.complianceSummary,
    bidScore: {
      score: 55,
      scoringAvailable: true,
      priority: "MEDIUM",
      priorityLabel: "Medium priority",
      interpretation: "Pursue with care.",
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
        { label: "Solid fit", direction: "positive" },
        { label: "Missing warranty", direction: "negative" },
      ],
      reducedCertainty: false,
      certaintyNote: null,
      disclaimer: "Priority only — not win probability.",
    },
    historicalSignals: [],
    // Legacy engine lists — intentionally disagree with readiness statuses.
    // PDF must NOT use these for Missing / Verify sections.
    matched: [{ id: "r3", description: requirements[2].description, category: "PREFERRED", sourcePage: 8, sourceSection: null }],
    failed: [{ id: "r2", description: requirements[1].description, category: "TECHNICAL", sourcePage: 5, sourceSection: "4.2" }],
    uncertain: [
      { id: "r1", description: requirements[0].description, category: "TECHNICAL", sourcePage: 3, sourceSection: "2.1" },
    ],
    criticalRisks: [
      {
        id: "legacy-risk",
        category: "legacy",
        description: "Should be ignored when intelligence.risks exists",
        severity: "HIGH",
        sourcePage: null,
        mitigation: null,
      },
    ],
    missingDocuments: [
      {
        id: "d1",
        documentName: "Attestation CNSS",
        reason: "Required administrative document",
        severity: "HIGH",
      },
      {
        id: "d2",
        documentName: "Bank guarantee",
        reason: "Financial guarantee referenced",
        severity: "MEDIUM",
      },
    ],
    evidence: [
      {
        id: "e1",
        text: "installation plan excerpt",
        sourcePage: 3,
        sourceSection: "2.1",
        verificationStatus: "VERIFIED",
      },
      {
        id: "e2",
        text: "No supporting excerpt available — marked UNKNOWN.",
        sourcePage: null,
        sourceSection: null,
        verificationStatus: "UNKNOWN",
      },
    ],
    nextActions: [
      { id: "a1", title: "Verify warranty coverage", description: null, priority: 1 },
    ],
    decisionOutcome: null,
  };
}

describe("PDF report data integrity", () => {
  it("UI derivation and PDF plain text use identical canonical counts", () => {
    const report = fixtureReport();
    const ui = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    assertCanonicalReportIntegrity(ui);

    assert.equal(ui.complianceSummary?.totalRequirements, 3);
    assert.equal(ui.readinessTotal, 3);
    assert.equal(ui.missingRequirements.length, ui.complianceSummary?.missing);
    assert.equal(ui.verifyRequirements.length, ui.complianceSummary?.verify);
    assert.equal(ui.readyRequirements.length, ui.complianceSummary?.ready);

    // Missing docs remain separate (2 docs must not inflate requirement total)
    assert.equal(ui.missingDocuments.length, 2);
    assert.equal(ui.complianceMatrix.length, 3);

    const pdfText = buildTenderReportPdfPlainText(report);

    assert.match(
      pdfText,
      new RegExp(
        `${ui.complianceSummary!.totalRequirements} requirements · ${ui.complianceSummary!.ready} ready · ${ui.complianceSummary!.missing} missing · ${ui.complianceSummary!.verify} verify`,
      ),
    );
    assert.match(
      pdfText,
      new RegExp(
        `${ui.readinessTotal} requirements · ${ui.readinessCounts!.ready} ready · ${ui.readinessCounts!.verify} verify · ${ui.readinessCounts!.missing} missing`,
      ),
    );

    // Every matrix requirement appears in PDF
    for (const row of ui.complianceMatrix) {
      assert.ok(
        pdfText.includes(row.requirement),
        `PDF omitted requirement: ${row.requirement}`,
      );
      assert.ok(pdfText.includes(`[${row.status}]`));
    }

    // Missing docs section present and separate
    assert.match(pdfText, /# Missing documents/);
    assert.ok(pdfText.includes("Attestation CNSS"));
    assert.ok(pdfText.includes("Bank guarantee"));

    // Must not use legacy engine-only failed list as the Missing section when
    // matrix statuses differ — Missing section uses matrix MISSING rows only.
    const missingSection = pdfText.split("# Missing requirements")[1]?.split("#")[0] ?? "";
    for (const row of ui.missingRequirements) {
      assert.ok(missingSection.includes(row.requirement));
    }
    assert.equal(
      (missingSection.match(/^• /gm) ?? []).length,
      ui.missingRequirements.length,
    );

    // Placeholder evidence excluded (same as UI)
    assert.equal(ui.evidence.length, 1);
    assert.ok(pdfText.includes("installation plan excerpt"));
    assert.ok(!pdfText.includes("marked UNKNOWN"));

    // Risks come from intelligence when present
    assert.equal(ui.risks, report.intelligence!.risks);
    assert.ok(!pdfText.includes("Should be ignored when intelligence.risks exists"));
  });

  it("unavailable scores render Not available — never fabricate", () => {
    const report = fixtureReport();
    report.fitScore = null;
    report.fitBreakdown = {
      ...report.fitBreakdown!,
      scoringAvailable: false,
      overall: null,
    };
    report.bidScore = {
      ...report.bidScore!,
      scoringAvailable: false,
    };
    report.readiness = {
      ...report.readiness!,
      scoringAvailable: false,
      score: null,
    };

    const ui = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    assert.equal(ui.fitScoreDisplay, NOT_AVAILABLE);
    assert.equal(ui.bidScoreDisplay, NOT_AVAILABLE);
    assert.equal(ui.readinessScoreDisplay, NOT_AVAILABLE);

    const pdfText = buildTenderReportPdfPlainText(report);
    assert.match(pdfText, /Company–Tender Fit: Not available/);
    assert.match(pdfText, /Bid Score: Not available/);
    assert.match(pdfText, /Score: Not available/);
  });

  it("generated PDF buffer embeds branding and the same requirement totals as the API report", async () => {
    const report = fixtureReport();
    const ui = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    const pdf = await buildTenderReportPdf(report, {
      locale: "en",
      companyName: "Acme Procurement Ltd",
      appOrigin: "http://localhost:3000",
    });
    assert.ok(pdf.byteLength > 2000);
    assert.ok(
      pdf.byteLength < 4_000_000,
      `Latin-only report must not embed the 16MB CJK face (got ${pdf.byteLength} bytes)`,
    );

    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: pdf });
    const parsed = await parser.getText();
    const text = parsed.text;

    assert.ok(text.includes("Report by http://localhost:3000"));
    assert.ok(!text.includes("bidvera.com"));
    assert.ok(!text.includes("Powered by"));
    assert.equal((text.match(/Report by /g) ?? []).length, 1);
    // Clickable URI annotation targeting the resolved origin
    const raw = pdf.toString("latin1");
    assert.ok(raw.includes("/URI"), "PDF missing URI link annotation");
    assert.ok(
      raw.includes("http://localhost:3000") || raw.includes("localhost:3000"),
      "PDF link must target resolved app origin",
    );
    assert.ok(text.includes("Acme Procurement Ltd"));
    assert.ok(
      text.includes(
        `${ui.complianceSummary!.totalRequirements} requirements`,
      ) || text.includes(String(ui.complianceSummary!.totalRequirements)),
    );
    for (const row of ui.complianceMatrix) {
      assert.ok(text.includes(row.requirement.slice(0, 40)));
    }
    assert.ok(text.includes("Attestation CNSS"));
    assert.ok(text.includes("Missing documents") || text.includes("missing documents"));
    assert.ok(text.includes("Page 1 of") || text.includes("Page 2 of"));
  });

  it("Arabic UI generates English PDF without Arabic glyphs or tofu", async () => {
    const report = fixtureReport();
    report.title =
      "Fourniture et installation — équipement audiovisuel / توريد وتركيب";
    report.client = "Ministère de l'Éducation — وزارة التربية";
    report.reasoning =
      "L'acquisition, la livraison, l'installation et la mise en service. " +
      "يجب التحقق من الضمان والتدريب. Verify warranty coverage before bid.";
    report.intelligence!.complianceMatrix[0]!.requirement =
      "Plan d'installation avec jalons — خطة التركيب مع المعالم";
    report.matched[0]!.description = report.intelligence!.complianceMatrix[2]!.requirement;
    report.uncertain[0]!.description = report.intelligence!.complianceMatrix[0]!.requirement;
    report.failed[0]!.description = report.intelligence!.complianceMatrix[1]!.requirement;
    // Matrix mutation invalidates prior Guardian hash — re-stamp after content change
    report.intelligence = stampTestGuardianSnapshot(report.intelligence!);

    const pdf = await buildTenderReportPdf(report, {
      locale: "ar",
      companyName: "شركة أكمي — Acme SARL",
      appOrigin: "http://localhost:3000",
    });
    assert.ok(pdf.byteLength > 2000);

    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: pdf });
    const parsed = await parser.getText();
    const text = parsed.text;

    const { containsGlyphFallback } = await import(
      "@/services/reports/premium-pdf-text"
    );
    assert.equal(containsGlyphFallback(text), false);
    // Arabic UI → English chrome (GO / CONDITIONAL GO / NO-BID)
    assert.ok(
      text.includes("CONDITIONAL GO") ||
        text.includes("GO") ||
        text.includes("Recommendation") ||
        text.includes("Review"),
    );
    assert.ok(!text.includes("يحتاج تحقق"));
    assert.ok(!text.includes("انطلاق مشروط"));
    // Latin content preserved; Arabic script stripped from PDF drawing
    assert.ok(text.includes("équipement") || text.includes("equipement"));
    assert.ok(text.includes("l'installation") || text.includes("installation"));
    assert.ok(text.includes("Verify") && text.includes("warranty"));
    assert.ok(text.includes("Acme SARL"));
    assert.ok(!/[\u0600-\u06FF]/.test(text));
  });

  it("fails integrity when readiness total diverges from compliance (guard)", () => {
    const report = fixtureReport();
    const broken = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    broken.readinessTotal = (broken.readinessTotal ?? 0) + 3;
    assert.throws(() => assertCanonicalReportIntegrity(broken), /readiness\.total/);
  });

  it("blocks PDF generation when display content is tampered", () => {
    const report = fixtureReport();
    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    assertCanonicalReportIntegrity(sections);
    const content = buildReportDisplayContent(sections, "en");
    content.missingRequirementLines.push("INVENTED REQUIREMENT");
    assert.throws(
      () => assertPdfCanonicalConsistency(report, sections, content),
      /display content does not match canonical sections/,
    );
  });

  it("display content decision label matches localized web report", () => {
    const report = fixtureReport();
    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    const ar = buildReportDisplayContent(sections, "ar");
    const en = buildReportDisplayContent(sections, "en");
    assert.equal(en.decisionLabel, "CONDITIONAL GO");
    assert.equal(ar.decisionLabel, "انطلاق مشروط");
    assert.equal(ar.complianceRows.length, sections.complianceMatrix.length);
  });
});
