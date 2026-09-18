/**
 * Canonical risk classification — unknown must never become HIGH/CRITICAL risk.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runDecisionEngine } from "@/domain/decision/engine";
import type { DeterministicFinding, RuleCompanyProfile } from "@/domain/decision/types";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import {
  buildCanonicalStructuredRisks,
  classifyComplianceEvidenceState,
  classifyRiskSeverity,
  countIdentifiedRisks,
  enrichComplianceRowRiskFields,
  isObjectivelyExpiredEvidence,
} from "@/domain/risk";
import { buildCanonicalRequirements } from "@/domain/tender-requirements";
import {
  buildComplianceSummary,
  buildTenderIntelligence,
} from "@/domain/tender-intelligence";
import { extractTenderPackageHeuristic } from "@/services/tender-extraction/requirements-heuristic";
import { AUDIOVISUAL_TENDER_FIXTURE } from "@/domain/tender-requirements/audiovisual-regression.test";
import type { ComplianceRow } from "@/domain/tender-intelligence/types";

function baseRow(partial: Partial<ComplianceRow> = {}): Omit<
  ComplianceRow,
  "evidenceState" | "risk" | "requiredAction"
> {
  return {
    id: "CM-1",
    requirementId: "r1",
    requirement: "ISO 27001 certification required",
    requirementType: "Certification",
    mandatory: true,
    priority: "HIGH",
    status: "VERIFY",
    companyFit: null,
    sourceDocument: "Spec.pdf",
    pageNumber: 1,
    section: null,
    evidence: "Supplier must hold ISO 27001",
    tenderSource: null,
    companyEvidence: null,
    companyEvidenceMessage: null,
    notes: null,
    sourceBasis: "AI_INTERPRETATION",
    sourceLocated: true,
    evidenceId: null,
    verificationStatus: "NEEDS_VERIFICATION",
    verificationReason: null,
    locationLabel: null,
    verifierLabel: null,
    verifiedAt: null,
    ...partial,
  };
}

describe("canonical risk classification", () => {
  it("unknown requirement state is not HIGH risk", () => {
    const state = classifyComplianceEvidenceState({
      readinessStatus: "UNKNOWN",
      matchStatus: "UNCERTAIN",
      verificationStatus: "NEEDS_VERIFICATION",
      mandatory: true,
      evidence: null,
      findings: [],
      requirementIndex: 0,
    });
    assert.equal(state, "UNKNOWN");
    const severity = classifyRiskSeverity({
      evidenceState: state,
      mandatory: true,
      finding: null,
      requirementCriticality: "HIGH",
    });
    assert.ok(severity === "MEDIUM" || severity === "LOW");
    assert.notEqual(severity, "HIGH");
    assert.notEqual(severity, "CRITICAL");
  });

  it("missing profile data is NEEDS_VERIFICATION not confirmed risk", () => {
    const enriched = enrichComplianceRowRiskFields({
      row: baseRow({ status: "MISSING" }),
      requirement: {
        id: "r1",
        category: "Certification",
        description: "ISO 27001 required",
        mandatory: true,
        status: "UNCERTAIN",
        evidence: null,
      },
      requirementIndex: 0,
      readinessStatus: "MISSING",
      verificationStatus: "NEEDS_VERIFICATION",
      findings: [
        {
          code: "CERT_UNKNOWN",
          severity: "HIGH",
          category: "certification",
          description: "Cert not listed on profile",
          forcesDecision: "REVIEW",
          requirementStatus: "UNCERTAIN",
          requirementIndex: 0,
        },
      ],
    });
    assert.equal(enriched.evidenceState, "NEEDS_VERIFICATION");
    assert.equal(enriched.risk, null);
    assert.ok(enriched.requiredAction?.includes("Verification"));
  });

  it("CERT_MISSING finding does not create structured HIGH risk", () => {
    const matrix: ComplianceRow[] = [
      {
        ...baseRow({ status: "MISSING", evidenceState: "NEEDS_VERIFICATION", risk: null }),
        evidenceState: "NEEDS_VERIFICATION",
        risk: null,
        requiredAction: "Verification required",
      },
    ];
    const risks = buildCanonicalStructuredRisks({
      matrix,
      requirements: [
        {
          id: "r1",
          category: "Certification",
          description: "ISO 27001 required",
          mandatory: true,
          status: "FAILED",
          evidence: null,
          fitStatus: "NEEDS_VERIFICATION",
        },
      ],
      findings: [
        {
          code: "CERT_MISSING",
          severity: "CRITICAL",
          category: "certification",
          description: "ISO 27001 not listed on profile",
          forcesDecision: "REVIEW",
          requirementStatus: "UNCERTAIN",
          requirementIndex: 0,
        },
      ],
      existingRisks: [],
      documentName: "Spec.pdf",
    });
    const high = risks.filter(
      (r) =>
        r.severityCanonical === "HIGH" ||
        r.severityCanonical === "CRITICAL" ||
        (r.severity === "HIGH" && r.evidenceState === "CONFIRMED_NON_COMPLIANT"),
    );
    assert.equal(high.length, 0);
    assert.ok(
      risks.every(
        (r) =>
          r.evidenceState === "NEEDS_VERIFICATION" ||
          r.severityCanonical === "MEDIUM" ||
          r.severityCanonical === "LOW",
      ),
    );
  });

  it("explicit non-compliance creates confirmed HIGH/CRITICAL risk", () => {
    const finding: DeterministicFinding = {
      code: "CERT_EXPLICITLY_NOT_HELD",
      severity: "CRITICAL",
      category: "certification",
      description: 'Company profile states "not_held: ISO 27001".',
      forcesDecision: "NO_BID",
      requirementStatus: "FAILED",
      requirementIndex: 0,
    };
    const state = classifyComplianceEvidenceState({
      readinessStatus: "MISSING",
      matchStatus: "FAILED",
      verificationStatus: "NEEDS_VERIFICATION",
      mandatory: true,
      evidence: "not_held: ISO 27001",
      findings: [finding],
      requirementIndex: 0,
    });
    assert.equal(state, "CONFIRMED_NON_COMPLIANT");
    assert.equal(
      classifyRiskSeverity({
        evidenceState: state,
        mandatory: true,
        finding,
        requirementCriticality: "HIGH",
      }),
      "CRITICAL",
    );

    const matrix: ComplianceRow[] = [
      {
        ...baseRow({
          status: "MISSING",
          evidence: "not_held: ISO 27001",
          evidenceState: "CONFIRMED_NON_COMPLIANT",
          risk: "Confirmed non-compliance",
        }),
        evidenceState: "CONFIRMED_NON_COMPLIANT",
        risk: "Confirmed non-compliance",
        requiredAction: "Resolve",
      },
    ];
    const risks = buildCanonicalStructuredRisks({
      matrix,
      requirements: [
        {
          id: "r1",
          category: "Certification",
          description: "ISO 27001 required",
          mandatory: true,
          status: "FAILED",
          evidence: "not_held: ISO 27001",
        },
      ],
      findings: [finding],
      existingRisks: [],
      documentName: "Spec.pdf",
    });
    assert.equal(risks.length, 1);
    assert.equal(risks[0]!.severityCanonical, "CRITICAL");
    assert.ok(risks[0]!.whyRisky?.includes("CERT_EXPLICITLY_NOT_HELD"));
  });

  it("confirmed inability (revenue below) is a risk", () => {
    const finding: DeterministicFinding = {
      code: "REVENUE_BELOW",
      severity: "CRITICAL",
      category: "financial",
      description: "Turnover below mandatory threshold.",
      forcesDecision: "NO_BID",
      requirementStatus: "FAILED",
      requirementIndex: 0,
    };
    const risks = buildCanonicalStructuredRisks({
      matrix: [
        {
          ...baseRow({
            requirement: "Minimum turnover £5m",
            requirementType: "Commercial",
            evidenceState: "CONFIRMED_NON_COMPLIANT",
          }),
          evidenceState: "CONFIRMED_NON_COMPLIANT",
          risk: "Confirmed non-compliance",
          requiredAction: "Resolve",
        },
      ],
      requirements: [
        {
          id: "r1",
          category: "Commercial",
          description: "Minimum turnover £5m",
          mandatory: true,
          status: "FAILED",
          evidence: "below the required threshold",
        },
      ],
      findings: [finding],
      existingRisks: [],
      documentName: "Spec.pdf",
    });
    assert.equal(risks.length, 1);
    assert.equal(risks[0]!.evidenceState, "CONFIRMED_NON_COMPLIANT");
  });

  it("objectively expired mandatory certificate is confirmed non-compliance", () => {
    const past = new Date("2020-06-01T00:00:00.000Z");
    assert.equal(
      isObjectivelyExpiredEvidence("Certificate valid until 2019-12-31", past),
      true,
    );
    const state = classifyComplianceEvidenceState({
      readinessStatus: "VERIFY",
      matchStatus: "UNCERTAIN",
      verificationStatus: "NEEDS_VERIFICATION",
      mandatory: true,
      evidence: "ISO 9001 certification",
      findings: [],
      requirementIndex: 0,
      evidenceExcerpt: "Certificate expiry date 2019-12-31",
    });
    assert.equal(state, "CONFIRMED_NON_COMPLIANT");
  });

  it("ambiguous requirement stays verification — not high risk", () => {
    const enriched = enrichComplianceRowRiskFields({
      row: baseRow({ status: "VERIFY", requirement: "Supplier should preferably hold relevant certifications" }),
      requirement: {
        id: "r1",
        category: "PREFERRED",
        description: "Supplier should preferably hold relevant certifications",
        mandatory: false,
        status: "UNCERTAIN",
        evidence: "preferably hold",
      },
      requirementIndex: 0,
      readinessStatus: "VERIFY",
      verificationStatus: "NEEDS_VERIFICATION",
      findings: [],
    });
    assert.equal(enriched.evidenceState, "NEEDS_VERIFICATION");
    assert.equal(enriched.risk, null);
  });

  it("risk count is not equal to unknown/verify count", () => {
    const requirements = [
      { id: "r1", description: "Req A", mandatory: true },
      { id: "r2", description: "Req B", mandatory: true },
      { id: "r3", description: "Req C", mandatory: true },
    ];
    const readiness = computeTenderReadiness({
      requirements: requirements.map((r) => ({
        id: r.id,
        category: "TECHNICAL",
        description: r.description,
        mandatory: r.mandatory,
        value: null,
        status: "UNCERTAIN",
        evidence: null,
      })),
      missingDocuments: [],
      profileHasAnyCapability: true,
    });

    const intelligence = buildTenderIntelligence({
      tenderId: "t-risk-count",
      documentName: "Doc.pdf",
      tenderDeadline: null,
      extractedText: "",
      requirements: requirements.map((r) => ({
        id: r.id,
        category: "TECHNICAL",
        description: r.description,
        mandatory: r.mandatory,
        value: null,
        status: "UNCERTAIN",
        sourcePage: null,
        sourceSection: null,
        evidence: null,
      })),
      evidence: [],
      readiness,
      findings: [],
      existingRisks: [],
      decision: "REVIEW",
      fitScore: 50,
    });

    const unknownOrVerify =
      intelligence.complianceSummary.verify +
      intelligence.complianceSummary.missing +
      intelligence.complianceSummary.unknown;
    assert.ok(unknownOrVerify >= 1);
    assert.equal(intelligence.complianceSummary.risks, 0);
    assert.notEqual(intelligence.complianceSummary.risks, unknownOrVerify);
    assert.equal(countIdentifiedRisks(intelligence.risks), 0);
  });

  it("audiovisual tender — unknown obligations do not inflate risk count", () => {
    const heuristic = extractTenderPackageHeuristic({
      text: AUDIOVISUAL_TENDER_FIXTURE,
      fileName: "Tender_Audiovisual_Equipment.pdf",
    });
    const normalized = buildCanonicalRequirements({
      heuristicDrafts: heuristic.requirements,
      sourceDocument: "Tender_Audiovisual_Equipment.pdf",
    });
    const requirements = normalized.map((r, i) => ({
      id: `av-r${i + 1}`,
      category: r.category,
      description: r.requirement,
      mandatory: r.mandatory,
      value: r.value ?? null,
      status: "UNCERTAIN" as const,
      sourcePage: r.page ?? null,
      sourceSection: r.sourceSection ?? null,
      evidence: r.evidenceText ?? null,
    }));

    const profile: RuleCompanyProfile = {
      companyName: "AV Integrator",
      industry: "Audiovisual",
      country: "Morocco",
      companySize: "11-50",
      experienceLevel: "experienced",
      services: ["audiovisual installation"],
      certifications: [],
      experienceYears: 8,
      revenueRange: null,
      employeeRange: "11-50",
      geographicCoverage: ["Morocco"],
      contractSizeMin: null,
      contractSizeMax: null,
      customQualificationRules: [],
    };

    const engine = runDecisionEngine({
      profile,
      requirements,
      estimatedValue: heuristic.estimatedValue,
      tenderContext: {
        title: "Tender Audiovisual Equipment",
        client: null,
        country: "Morocco",
        industry: "AV",
        tenderText: AUDIOVISUAL_TENDER_FIXTURE.slice(0, 4000),
      },
      ai: {
        suggestedDecision: "REVIEW",
        fitScore: 52,
        confidence: "MEDIUM",
        reasoning: "Review AV scope.",
      },
    });

    const readiness = computeTenderReadiness({
      requirements: engine.requirements.map((r) => ({
        id: r.id!,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        evidence: r.evidence,
        fitStatus: r.fitStatus,
      })),
      missingDocuments: heuristic.missingDocuments.map((d, i) => ({
        id: `md-${i}`,
        documentName: d.documentName,
        reason: d.reason,
        severity: d.severity,
      })),
      profileHasAnyCapability: true,
    });

    const intelligence = buildTenderIntelligence({
      tenderId: "av-risk",
      documentName: "Tender_Audiovisual_Equipment.pdf",
      tenderDeadline: heuristic.deadlineIso,
      extractedText: AUDIOVISUAL_TENDER_FIXTURE,
      requirements: engine.requirements.map((r, i) => ({
        id: r.id ?? `av-r${i + 1}`,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        sourcePage: requirements[i]?.sourcePage ?? null,
        sourceSection: requirements[i]?.sourceSection ?? null,
        evidence: r.evidence ?? null,
        fitStatus: r.fitStatus,
        evidenceConflict: r.evidenceConflict,
        sourceDocument: r.sourceDocument ?? r.fitProvenance?.sourceDocument ?? null,
        fitProvenanceExcerpt: r.fitProvenance?.excerpt ?? null,
      })),
      evidence: [],
      readiness,
      findings: engine.findings,
      existingRisks: [],
      decision: engine.decision,
      fitScore: engine.fitScore,
    });

    const verifyLike =
      intelligence.complianceSummary.verify +
      intelligence.complianceSummary.missing +
      intelligence.complianceSummary.unknown;
    const highRisks = intelligence.risks.filter(
      (r) =>
        r.severity === "HIGH" ||
        r.severityCanonical === "HIGH" ||
        r.severityCanonical === "CRITICAL",
    );

    console.log("\n--- Audiovisual risk audit (after fix) ---");
    console.log(`Requirements: ${intelligence.complianceSummary.totalRequirements}`);
    console.log(`Verify/missing/unknown rows: ${verifyLike}`);
    console.log(`Canonical identified risks (summary): ${intelligence.complianceSummary.risks}`);
    console.log(`Structured HIGH/CRITICAL risks: ${highRisks.length}`);

    assert.ok(verifyLike >= 1, "AV fixture should have unverified rows");
    assert.equal(intelligence.complianceSummary.risks, highRisks.length);
    assert.equal(highRisks.length, 0, "unknown AV obligations must not become HIGH risks");
    assert.ok(
      intelligence.complianceMatrix.every(
        (r) =>
          r.evidenceState !== "CONFIRMED_NON_COMPLIANT" ||
          r.risk != null,
      ),
    );
  });

  it("compliance summary risk count matches structured risks", () => {
    const matrix: ComplianceRow[] = [
      {
        ...baseRow(),
        evidenceState: "NEEDS_VERIFICATION",
        risk: null,
        requiredAction: "Verify",
      },
    ];
    const risks = buildCanonicalStructuredRisks({
      matrix,
      requirements: [
        {
          id: "r1",
          category: "Certification",
          description: "ISO 27001",
          mandatory: true,
          status: "UNCERTAIN",
          evidence: null,
        },
      ],
      findings: [],
      existingRisks: [],
      documentName: "Doc.pdf",
    });
    const summary = buildComplianceSummary(matrix, 0, risks);
    assert.equal(summary.risks, countIdentifiedRisks(risks));
  });
});
