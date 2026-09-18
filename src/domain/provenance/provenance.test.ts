/**
 * Strict provenance — validation, tender vs company separation, traceability.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { buildTenderDecisionRecommendation } from "@/domain/decision/recommendation";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import {
  NO_COMPANY_EVIDENCE_MESSAGE,
  PLACEHOLDER_TENDER_EVIDENCE,
  assertProvenanceConsistency,
  buildRequirementTenderSource,
  buildSourceReference,
  formatCompanyEvidenceDisplay,
  formatSourceLocation,
  sanitizePageNumber,
  validatePageNumber,
} from "@/domain/provenance";
import {
  buildReportDisplayContent,
  assertPdfCanonicalConsistency,
} from "@/services/reports/report-display-content";
import {
  deriveCanonicalReportSections,
  assertCanonicalReportIntegrity,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import type { TenderReport } from "@/services/reports/types";

describe("provenance validation", () => {
  it("rejects invalid and out-of-range page numbers", () => {
    assert.equal(validatePageNumber(0).ok, false);
    assert.equal(validatePageNumber(-1).ok, false);
    assert.equal(validatePageNumber(1.5).ok, false);
    assert.equal(validatePageNumber(99, { maxPage: 10 }).ok, false);
    assert.equal(sanitizePageNumber(99, { maxPage: 10 }), null);
    assert.equal(validatePageNumber(3, { maxPage: 10 }).ok, true);
  });

  it("rejects page not in extraction markers", () => {
    const result = validatePageNumber(42, { knownPages: new Set([1, 2, 3]) });
    assert.equal(result.ok, false);
  });

  it("assertProvenanceConsistency blocks tender/company basis mix-up", () => {
    const badTender = {
      kind: "TENDER_SOURCE" as const,
      documentId: null,
      documentName: "CPS.pdf",
      page: 2,
      section: "3.1",
      excerpt: "Bid bond required",
      normalizedText: null,
      classification: null,
      confidence: "INFERRED" as const,
      basis: "TEAM_VERIFIED" as const,
      located: true,
      verificationStatus: "UNKNOWN" as const,
    };
    assert.throws(
      () => assertProvenanceConsistency(badTender),
      /tender source cannot use TEAM_VERIFIED/,
    );
    const badCompany = {
      kind: "COMPANY_EVIDENCE" as const,
      documentId: null,
      documentName: null,
      page: null,
      section: null,
      excerpt: "ISO certificate on file",
      normalizedText: null,
      classification: null,
      confidence: "VERIFIED" as const,
      basis: "TENDER_DOCUMENT" as const,
      located: false,
      verificationStatus: "VERIFIED" as const,
    };
    assert.throws(
      () => assertProvenanceConsistency(badCompany),
      /company evidence cannot use TENDER_DOCUMENT/,
    );
  });
});

describe("tender source vs company evidence", () => {
  it("compliance matrix separates tender excerpt from company evidence message", () => {
    const requirements = [
      {
        id: "r1",
        category: "MANDATORY_TECHNICAL",
        description: "Deliver warranty coverage for installed systems.",
        mandatory: true,
        value: null as string | null,
        status: "FAILED" as const,
        sourcePage: 5,
        sourceSection: "4.2",
        evidence: "The supplier must provide a minimum warranty period of 24 months.",
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
      tenderId: "t-prov",
      documentName: "CPS.pdf",
      tenderDeadline: null,
      extractedText: "warranty 24 months",
      requirements,
      evidence: [],
      readiness,
      findings: [],
      existingRisks: [],
      decision: "REVIEW",
      fitScore: 50,
    });
    const row = intel.complianceMatrix[0]!;
    assert.equal(row.tenderSource?.kind, "TENDER_SOURCE");
    assert.ok(row.evidence?.includes("warranty"));
    assert.match(row.tenderSource?.excerpt ?? "", /Deliver warranty coverage/);
    assert.ok(!(row.tenderSource?.excerpt ?? "").includes("24 months"));
    assert.equal(row.companyEvidence, null);
    assert.equal(row.companyEvidenceMessage, NO_COMPANY_EVIDENCE_MESSAGE);
    assert.notEqual(row.tenderSource?.kind, "COMPANY_EVIDENCE");
  });

  it("formatCompanyEvidenceDisplay never returns tender text as company proof", () => {
    const tender = buildRequirementTenderSource({
      documentName: "CPS.pdf",
      page: 1,
      section: "2",
      originalExcerpt: "Mandatory ISO certification",
      normalizedRequirement: "ISO certification",
      requirementType: "Certification",
    });
    assert.equal(
      formatCompanyEvidenceDisplay(null),
      NO_COMPANY_EVIDENCE_MESSAGE,
    );
    assert.ok(tender.excerpt?.includes("ISO"));
  });
});

describe("provenance report parity", () => {
  function fixture(): TenderReport {
    const requirements = [
      {
        id: "r1",
        category: "TECHNICAL",
        description: "Provide installation plan with milestones.",
        mandatory: true,
        value: null as string | null,
        status: "UNCERTAIN" as const,
        sourcePage: 3,
        sourceSection: "2.1",
        evidence: "installation plan excerpt from tender page 3",
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
    const intelligence = buildTenderIntelligence({
      tenderId: "t",
      documentName: "AVIS.pdf",
      tenderDeadline: null,
      extractedText: "text",
      requirements,
      evidence: [],
      readiness,
      findings: [],
      existingRisks: [],
      decision: "REVIEW",
      fitScore: 60,
    });
    return {
      tenderId: "t",
      companyId: "c",
      title: "Test",
      client: "Client",
      deadline: null,
      deadlineTimezone: null,
      analyzedAt: new Date().toISOString(),
      decision: "REVIEW",
      fitScore: 60,
      confidence: "MEDIUM",
      reasoning: "Review",
      fitBreakdown: null,
      readiness,
      intelligence,
      complianceSummary: intelligence.complianceSummary,
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
  }

  it("web/PDF display uses same source location as compliance matrix", () => {
    const report = fixture();
    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    assertCanonicalReportIntegrity(sections);
    const content = buildReportDisplayContent(sections, "en");
    assertPdfCanonicalConsistency(report, sections, content);
    const row = sections.complianceMatrix[0]!;
    const displayRow = content.complianceRows[0]!;
    const matrixLoc = formatSourceLocation(row.tenderSource);
    assert.ok(displayRow.sourceLine.includes("AVIS.pdf") || displayRow.sourceLine.includes("Page 3"));
    assert.ok(matrixLoc.includes("Page 3") || matrixLoc.includes("2.1"));
  });

  it("placeholder tender evidence is not treated as located source", () => {
    const ref = buildSourceReference({
      kind: "TENDER_SOURCE",
      excerpt: PLACEHOLDER_TENDER_EVIDENCE,
      page: 5,
      section: "1",
    });
    assert.equal(ref.located, false);
    assert.equal(ref.excerpt, null);
  });

  it("company evidence line matches between web display and canonical matrix", () => {
    const report = fixture();
    const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
    const content = buildReportDisplayContent(sections, "en");
    const row = sections.complianceMatrix[0]!;
    const display = content.complianceRows[0]!;
    assert.equal(
      display.companyEvidenceLine,
      row.companyEvidenceMessage ?? NO_COMPANY_EVIDENCE_MESSAGE,
    );
  });
});

describe("decision traceability", () => {
  it("failed mandatory requirements link to tender source and company evidence refs", () => {
    const requirements = [
      {
        id: "r-fail",
        category: "MANDATORY_TECHNICAL",
        description: "Bid bond of 2% required.",
        mandatory: true,
        value: null as string | null,
        status: "FAILED" as const,
        sourcePage: 7,
        sourceSection: "5.1",
        evidence: "A bid bond equal to 2% of tender value is mandatory.",
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
    const intelligence = buildTenderIntelligence({
      tenderId: "t-dec",
      documentName: "ITT.pdf",
      tenderDeadline: new Date("2026-06-01"),
      extractedText: "bid bond 2% deadline 1 June 2026",
      requirements,
      evidence: [],
      readiness,
      findings: [],
      existingRisks: [],
      decision: "NO_BID",
      fitScore: 30,
    });
    const rec = buildTenderDecisionRecommendation({
      engine: {
        decision: "NO_BID",
        confidence: "HIGH",
        hardFailure: true,
        fitScore: 30,
        fitBreakdown: {
          overall: 30,
          scoringAvailable: true,
          dimensions: [],
          matches: [],
          gaps: [],
          unknowns: [],
          attention: [],
          recommendation: "Address mandatory gaps before bidding.",
        },
        matchedRequirements: [],
        failedRequirements: requirements.map((r) => ({
          id: r.id,
          description: r.description,
          mandatory: r.mandatory,
          status: r.status,
          evidence: r.evidence,
          fitStatus: "CONFIRMED_GAP" as const,
          category: r.category,
          value: r.value,
        })),
        uncertainRequirements: [],
        requirements,
        findings: [],
        reasoning: "Mandatory gap",
      },
      aiParticipated: false,
      complianceMatrix: intelligence.complianceMatrix,
    });
    const reqEvidence = rec.supportingEvidence.find((e) => e.requirementId === "r-fail");
    assert.ok(reqEvidence);
    assert.ok(reqEvidence.detail?.includes("Tender source"));
    assert.ok(reqEvidence.detail?.includes(NO_COMPANY_EVIDENCE_MESSAGE));
    const trace = rec.decisionTrace.find((t) => t.requirementId === "r-fail");
    assert.ok(trace);
    assert.equal(trace.tenderSource?.kind, "TENDER_SOURCE");
    assert.equal(trace.companyEvidence, null);
    assert.ok(intelligence.tenderFactsProvenance?.some((f) => f.key === "deadline"));
  });
});
