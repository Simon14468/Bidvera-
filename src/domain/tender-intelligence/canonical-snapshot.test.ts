/**
 * Canonical analysis snapshot — count, inventory, heading, fragment, and action invariants.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanonicalSnapshotInvariants,
  freezeCanonicalAnalysisSnapshot,
  isCanonicalAnalysisSnapshot,
  metricsFromComplianceSummary,
} from "./canonical-snapshot";
import type { ComplianceRow, ComplianceSummary } from "./types";
import { deriveCanonicalReportSections, FULL_REPORT_FEATURE_ACCESS } from "@/services/reports/report-canonical-view";
import type { TenderReport } from "@/services/reports/types";
import { extractTenderPackageFromParts } from "@/services/tender-extraction/requirements-heuristic";
import { assembleTenderPackage, expandTenderPackageUploads, buildStoredZipForTests } from "@/domain/tender-package";
import { buildCanonicalRequirements } from "@/domain/tender-requirements";
import { isProcuringEntityProcedure } from "@/domain/tender-requirements/obligation";

function summary(n: number, ready = 0, verify = n, missing = 0): ComplianceSummary {
  return {
    totalRequirements: n,
    ready,
    missing,
    verify,
    notApplicable: 0,
    unknown: 0,
    sources: n,
    risks: 0,
    requiredActions: verify + missing,
    clarifications: 0,
    verifiedRequirements: ready,
    needsVerification: verify,
    confirmedGaps: missing,
  };
}

function row(id: string, text: string, status: ComplianceRow["status"] = "VERIFY"): ComplianceRow {
  return {
    id: `CM-${id}`,
    requirementId: id,
    requirement: text,
    requirementType: "TECHNICAL",
    mandatory: true,
    priority: "HIGH",
    status,
    companyFit: null,
    sourceDocument: "spec.pdf",
    pageNumber: 1,
    section: null,
    evidence: text,
    tenderSource: null,
    companyEvidence: null,
    companyEvidenceMessage: null,
    notes: null,
    sourceBasis: "UNKNOWN",
    sourceLocated: true,
    evidenceId: null,
    risk: null,
    requiredAction: null,
  };
}

describe("canonical analysis snapshot", () => {
  it("INVARIANT 4: totalRequirements === snapshot.requirementIds.length", () => {
    const snap = freezeCanonicalAnalysisSnapshot({
      tenderId: "t1",
      packageLabel: "pack",
      discoveredFileCount: 2,
      files: [
        { fileName: "a.pdf", processingStatus: "COMPLETED", role: "AVIS", error: null },
        { fileName: "b.pdf", processingStatus: "COMPLETED", role: "CPS", error: null },
      ],
      metadata: {
        title: "NCB",
        client: "Indraprastha Gas Ltd",
        deadlineIso: "2026-10-20T15:00:00+05:30",
        deadlineTimezone: "Asia/Kolkata",
        factsNote: "buyer=Indraprastha Gas Ltd (source=Doc4)",
        metadataStatus: "OK",
      },
      requirementIds: ["r1", "r2"],
      summary: summary(2, 0, 2, 0),
    });
    assert.equal(snap.counts.totalRequirements, 2);
    assert.equal(isCanonicalAnalysisSnapshot(snap), true);
    assertCanonicalSnapshotInvariants({
      snapshot: snap,
      canonicalRequirementCount: 2,
      requirementTexts: [
        "The bidder shall submit a manufacturer authorization form with the offer.",
        "The contractor shall maintain spare parts for twenty four months.",
      ],
      uniqueRequirementIds: ["r1", "r2"],
      matrix: [
        row("r1", "The bidder shall submit a manufacturer authorization form with the offer."),
        row("r2", "The contractor shall maintain spare parts for twenty four months."),
      ],
      summary: summary(2, 0, 2, 0),
      readiness: {
        score: 40,
        total: 2,
        totalRequirements: 2,
        scoringAvailable: true,
        counts: { ready: 0, missing: 0, verify: 2, unknown: 0, notApplicable: 0 },
        items: [
          { id: "r1", status: "VERIFY", mandatory: true, category: "technical", requirement: "a", reason: "", source: "", priority: "HIGH" },
          { id: "r2", status: "VERIFY", mandatory: true, category: "technical", requirement: "b", reason: "", source: "", priority: "HIGH" },
        ],
        attention: [],
        recommendation: "Verify remaining requirements.",
        disclaimer: "Based on provided information.",
      },
      reportTotal: 2,
      pdfTotal: 2,
      apiTotal: 2,
      actionPlan: {
        computed: true,
        items: [
          {
            id: "a1",
            title: "Submit manufacturer authorization",
            linkedRequirementId: "r1",
            blocking: true,
            sourceType: "REQUIREMENT",
            sourceId: "r1",
            simulationOnly: false,
            priority: "HIGH",
            status: "OPEN",
          },
        ],
      } as never,
      fitStatuses: [
        { fitStatus: "NEEDS_VERIFICATION", companyEvidence: null },
        { fitStatus: "NEEDS_VERIFICATION", companyEvidence: null },
      ],
    });
  });

  it("INVARIANT 9/10: headings and fragments fail freeze checks", () => {
    const snap = freezeCanonicalAnalysisSnapshot({
      tenderId: "t2",
      packageLabel: "igl",
      discoveredFileCount: 1,
      files: [{ fileName: "tech.pdf", processingStatus: "COMPLETED", role: "TECHNICAL_SPECIFICATION", error: null }],
      metadata: {
        title: null,
        client: null,
        deadlineIso: null,
        deadlineTimezone: null,
        factsNote: null,
        metadataStatus: "UNKNOWN",
      },
      requirementIds: ["bad"],
      summary: summary(1),
    });
    assert.throws(() =>
      assertCanonicalSnapshotInvariants({
        snapshot: snap,
        canonicalRequirementCount: 1,
        requirementTexts: ["SUPPLY OF MDPE PIPE FITTINGS, VALVES AND TRANSITION FITTINGS"],
        uniqueRequirementIds: ["bad"],
        matrix: [row("bad", "SUPPLY OF MDPE PIPE FITTINGS, VALVES AND TRANSITION FITTINGS")],
        summary: summary(1),
        readiness: null,
      }),
    );
    assert.throws(() =>
      assertCanonicalSnapshotInvariants({
        snapshot: snap,
        canonicalRequirementCount: 1,
        requirementTexts: ["API 5L GR.B LINE PIPE SHALL BE"],
        uniqueRequirementIds: ["bad"],
        matrix: [row("bad", "API 5L GR.B LINE PIPE SHALL BE")],
        summary: summary(1),
        readiness: null,
      }),
    );
  });

  it("INVARIANT 11: missing company evidence is not CONFIRMED_GAP", () => {
    const snap = freezeCanonicalAnalysisSnapshot({
      tenderId: "t3",
      packageLabel: "iso",
      discoveredFileCount: 1,
      files: [{ fileName: "rfp.pdf", processingStatus: "COMPLETED", role: "RFP", error: null }],
      metadata: {
        title: null,
        client: null,
        deadlineIso: null,
        deadlineTimezone: null,
        factsNote: null,
        metadataStatus: "UNKNOWN",
      },
      requirementIds: ["iso"],
      summary: summary(1, 0, 1, 0),
    });
    assert.throws(() =>
      assertCanonicalSnapshotInvariants({
        snapshot: snap,
        canonicalRequirementCount: 1,
        requirementTexts: ["The bidder shall hold ISO 9001 certification."],
        uniqueRequirementIds: ["iso"],
        matrix: [row("iso", "The bidder shall hold ISO 9001 certification.")],
        summary: summary(1, 0, 1, 0),
        readiness: null,
        fitStatuses: [{ fitStatus: "CONFIRMED_GAP", companyEvidence: null }],
      }),
    );
    assert.equal(isProcuringEntityProcedure("The Procuring Entity shall publish responses."), true);
  });

  it("INVARIANT 5–7: web/PDF/API totals must match snapshot", () => {
    const snap = freezeCanonicalAnalysisSnapshot({
      tenderId: "t4",
      packageLabel: "p",
      discoveredFileCount: 1,
      files: [{ fileName: "a.pdf", processingStatus: "COMPLETED", role: "RFP", error: null }],
      metadata: {
        title: "T",
        client: "C",
        deadlineIso: "2026-01-01T10:00:00",
        deadlineTimezone: null,
        factsNote: null,
        metadataStatus: "OK",
      },
      requirementIds: ["r1"],
      summary: summary(1, 1, 0, 0),
    });
    const report: TenderReport = {
      tenderId: "t4",
      companyId: "c1",
      title: "T",
      client: "C",
      deadline: "2026-01-01T10:00:00",
      deadlineTimezone: null,
      analyzedAt: null,
      decision: "REVIEW",
      fitScore: 50,
      confidence: "MEDIUM",
      reasoning: "Review",
      companyKnowledgeOnly: false,
      fitBreakdown: null,
      readiness: {
        score: 100,
        total: 1,
        totalRequirements: 1,
        scoringAvailable: true,
        counts: { ready: 1, missing: 0, verify: 0, unknown: 0, notApplicable: 0 },
        items: [],
        attention: [],
        recommendation: "Ready.",
        disclaimer: "Based on provided information.",
      },
      intelligence: {
        complianceMatrix: [row("r1", "The bidder shall submit ISO 9001 evidence.", "READY")],
        complianceSummary: summary(1, 1, 0, 0),
        risks: [],
        contradictions: [],
        clarificationQuestions: [],
        keyBlockers: [],
        decisionContext: "",
        learningSignal: null,
        canonicalSnapshot: snap,
      },
      complianceSummary: summary(1, 1, 0, 0),
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
    };
    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    assert.equal(sections.canonicalTotalRequirements, 1);
    assert.equal(sections.complianceSummary?.totalRequirements, 1);
  });

  it("metricsFromComplianceSummary keeps total distinct from derived buckets", () => {
    const m = metricsFromComplianceSummary(summary(24, 4, 18, 2), 24);
    assert.equal(m.totalRequirements, 24);
    assert.equal(m.verifiedRequirements, 4);
    assert.equal(m.needsVerification, 18);
    assert.equal(m.confirmedGaps, 2);
    assert.notEqual(m.totalRequirements, m.verifiedRequirements + m.confirmedGaps);
  });
});

describe("same canonical package architecture — files / zip", () => {
  it("loose files and zip expansion share discover → assemble → canonical set", async () => {
    const textA = "Procuring entity: Later Buyer Ltd\nThe bidder shall submit a bid bond of 2%.";
    const textB = "Submission deadline: 20 October 2026 at 15:00 IST\nThe bidder shall submit a bid bond of 2%.";
    const loose = extractTenderPackageFromParts(
      [
        { fileName: "notice.pdf", text: textA },
        { fileName: "cps.pdf", text: textB },
      ],
      "loose-pack",
    );
    const MINI_PDF = Buffer.from(
      "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n",
    );
    const zipBuf = buildStoredZipForTests([
      { name: "notice.pdf", data: MINI_PDF },
      { name: "cps.pdf", data: MINI_PDF },
    ]);
    const expanded = await expandTenderPackageUploads([
      {
        fileName: "pack.zip",
        mimeType: "application/zip",
        fileSize: zipBuf.length,
        bytes: zipBuf,
      },
    ]);
    assert.equal(expanded.length, 2);
    const assembly = assembleTenderPackage([
      { fileName: "notice.pdf", documentKind: "TENDER", text: textA },
      { fileName: "cps.pdf", documentKind: "TENDER", text: textB },
    ]);
    assert.equal(assembly.parts.length, 2);
    const canonical = buildCanonicalRequirements({ heuristicDrafts: loose.requirements });
    const snap = freezeCanonicalAnalysisSnapshot({
      tenderId: "arch",
      packageLabel: assembly.packageLabel,
      discoveredFileCount: expanded.length,
      files: expanded.map((f) => ({
        fileName: f.fileName,
        processingStatus: "COMPLETED",
        role: "OTHER",
        error: null,
      })),
      metadata: {
        title: loose.title,
        client: loose.client,
        deadlineIso: loose.deadlineIso,
        deadlineTimezone: loose.deadlineTimezone,
        factsNote: null,
        metadataStatus: loose.packageMetadata?.buyer.status ?? "OK",
      },
      requirementIds: canonical.map((r) => r.id ?? r.requirement.slice(0, 12)),
      summary: summary(canonical.length, 0, canonical.length, 0),
    });
    assert.equal(snap.package.discoveredFileCount, 2);
    assert.equal(snap.counts.totalRequirements, canonical.length);
    assert.match(loose.client ?? "", /Later Buyer/i);
    assert.equal(loose.deadlineTimezone, "Asia/Kolkata");
    assert.ok(canonical.every((r) => !/SUPPLY OF MDPE/i.test(r.requirement)));
    assert.ok(canonical.every((r) => !/\bSHALL BE\s*$/i.test(r.requirement)));
  });
});
