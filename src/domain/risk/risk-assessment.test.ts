/**
 * Prompt 4 — Professional Risk Assessment Engine tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runDecisionEngine } from "@/domain/decision/engine";
import { refineDecisionWithEvidence } from "@/domain/decision/recommendation";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import {
  assessRequirementRisk,
  assertRiskConsistency,
  buildCanonicalStructuredRisks,
  countIdentifiedRisks,
  deriveRiskCategory,
} from "@/domain/risk";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import type { ComplianceRow } from "@/domain/tender-intelligence/types";

function profile(overrides: Partial<RuleCompanyProfile> = {}): RuleCompanyProfile {
  return {
    companyName: "Acme",
    industry: "IT",
    country: "Morocco",
    companySize: "51-200",
    experienceLevel: "experienced",
    services: ["software"],
    certifications: ["ISO 9001"],
    experienceYears: 10,
    revenueRange: "5m-10m",
    employeeRange: "51-200",
    geographicCoverage: ["Morocco"],
    contractSizeMin: null,
    contractSizeMax: 5_000_000,
    customQualificationRules: [],
    ...overrides,
  };
}

function matrixRow(partial: Partial<ComplianceRow> & { requirementId: string; requirement: string }): ComplianceRow {
  return {
    id: `CM-${partial.requirementId}`,
    requirementType: "Technical",
    mandatory: true,
    priority: "HIGH",
    status: "VERIFY",
    companyFit: null,
    sourceDocument: "Spec.pdf",
    pageNumber: 1,
    section: "3.1",
    evidence: "Tender excerpt",
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
    evidenceState: "NEEDS_VERIFICATION",
    risk: null,
    requiredAction: "Verify",
    ...partial,
  };
}

describe("professional risk assessment engine", () => {
  it("confirmed fit → no false negative risk", () => {
    const assessment = assessRequirementRisk({
      requirementId: "r1",
      description: "ISO 9001 certification required",
      category: "Certification",
      mandatory: true,
      fitStatus: "CONFIRMED_FIT",
      matchStatus: "MATCHED",
      evidence: "ISO 9001 held",
      companySourceDocument: "Company_Profile.pdf",
      companyEvidenceExcerpt: "ISO 9001 held",
      verificationStatus: "VERIFIED",
      finding: null,
      requirementCriticality: "HIGH",
      humanVerified: true,
    });
    assert.equal(assessment.include, false);
    assert.notEqual(assessment.evidenceState, "CONFIRMED_NON_COMPLIANT");

    const risks = buildCanonicalStructuredRisks({
      matrix: [
        matrixRow({
          requirementId: "r1",
          requirement: "ISO 9001 certification required",
          status: "READY",
          evidenceState: "CONFIRMED_COMPLIANT",
        }),
      ],
      requirements: [
        {
          id: "r1",
          category: "Certification",
          description: "ISO 9001 certification required",
          mandatory: true,
          status: "MATCHED",
          evidence: "ISO 9001 held",
          fitStatus: "CONFIRMED_FIT",
          sourceDocument: "Company_Profile.pdf",
        },
      ],
      findings: [],
      existingRisks: [],
      documentName: "Spec.pdf",
    });
    assert.equal(risks.length, 0);
  });

  it("confirmed gap → appropriate HIGH/CRITICAL risk with provenance", () => {
    const risks = buildCanonicalStructuredRisks({
      matrix: [
        matrixRow({
          requirementId: "r1",
          requirement: "ISO 27001 certification mandatory",
          status: "MISSING",
          evidenceState: "CONFIRMED_NON_COMPLIANT",
        }),
      ],
      requirements: [
        {
          id: "r1",
          category: "Certification",
          description: "ISO 27001 certification mandatory",
          mandatory: true,
          status: "FAILED",
          evidence: "not_held: ISO 27001",
          fitStatus: "CONFIRMED_GAP",
          sourceDocument: "Company_Profile.pdf",
          semanticKind: "ELIGIBILITY_REQUIREMENT",
        },
      ],
      findings: [
        {
          code: "CERT_EXPLICITLY_NOT_HELD",
          severity: "CRITICAL",
          category: "certification",
          description: "ISO 27001 not held",
          forcesDecision: "NO_BID",
          requirementIndex: 0,
        },
      ],
      existingRisks: [],
      documentName: "Spec.pdf",
    });
    assert.equal(risks.length, 1);
    assert.equal(risks[0]!.evidenceState, "CONFIRMED_NON_COMPLIANT");
    assert.equal(risks[0]!.fitStatus, "CONFIRMED_GAP");
    assert.ok(
      risks[0]!.severityCanonical === "CRITICAL" || risks[0]!.severityCanonical === "HIGH",
    );
    assert.ok(risks[0]!.whyRisky && !/may be risky/i.test(risks[0]!.whyRisky));
    assert.ok(risks[0]!.source.document);
  });

  it("missing evidence → verification risk only (never HIGH/CRITICAL)", () => {
    const risks = buildCanonicalStructuredRisks({
      matrix: [matrixRow({ requirementId: "r1", requirement: "ISO 27001 required" })],
      requirements: [
        {
          id: "r1",
          category: "Certification",
          description: "ISO 27001 required",
          mandatory: true,
          status: "UNCERTAIN",
          evidence: null,
          fitStatus: "NEEDS_VERIFICATION",
        },
      ],
      findings: [],
      existingRisks: [],
      documentName: "Spec.pdf",
    });
    assert.ok(risks.length >= 1);
    assert.ok(risks.every((r) => r.evidenceState === "NEEDS_VERIFICATION"));
    assert.ok(
      risks.every(
        (r) => r.severityCanonical === "MEDIUM" || r.severityCanonical === "LOW",
      ),
    );
    assert.equal(countIdentifiedRisks(risks), 0);
  });

  it("conflicting evidence produces verification/conflict risk", () => {
    const assessment = assessRequirementRisk({
      requirementId: "r1",
      description: "ISO 27001 certification mandatory",
      category: "Certification",
      mandatory: true,
      fitStatus: "NEEDS_VERIFICATION",
      evidenceConflict: true,
      matchStatus: "UNCERTAIN",
      evidence: null,
      verificationStatus: "NEEDS_VERIFICATION",
      finding: null,
      requirementCriticality: "HIGH",
    });
    assert.equal(assessment.include, true);
    assert.equal(assessment.category, "EVIDENCE_VERIFICATION");
    assert.equal(assessment.evidenceState, "NEEDS_VERIFICATION");
    assert.ok(assessment.severity === "MEDIUM" || assessment.severity === "LOW");
    assert.ok(/conflict/i.test(assessment.whyRisky));
  });

  it("mandatory confirmed gap may be HIGH/CRITICAL", () => {
    const out = runDecisionEngine({
      profile: profile({
        certifications: ["NOT_HELD: ISO 27001", "ISO 9001"],
        experienceYears: 2,
      }),
      requirements: [
        {
          category: "Certification",
          description: "ISO 27001 certification mandatory",
          mandatory: true,
          value: null,
          status: "UNCERTAIN",
          evidence: "not_held: ISO 27001",
          sourceDocument: "Company_Profile.pdf",
        },
      ],
      estimatedValue: 100_000,
    });
    assert.equal(out.requirements[0]!.fitStatus, "CONFIRMED_GAP");

    const readiness = computeTenderReadiness({
      requirements: out.requirements,
      profileHasAnyCapability: true,
    });
    const intelligence = buildTenderIntelligence({
      tenderId: "t1",
      documentName: "Spec.pdf",
      tenderDeadline: null,
      extractedText: "ISO 27001 mandatory",
      requirements: out.requirements.map((r, i) => ({
        id: r.id ?? `r${i}`,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        sourcePage: 1,
        sourceSection: null,
        evidence: r.evidence ?? null,
        fitStatus: r.fitStatus,
        sourceDocument: r.sourceDocument,
        fitProvenanceExcerpt: r.fitProvenance?.excerpt ?? null,
      })),
      evidence: [],
      readiness,
      findings: out.findings,
      existingRisks: [],
      decision: out.decision,
      fitScore: out.fitScore,
    });
    const material = intelligence.risks.filter(
      (r) => r.evidenceState === "CONFIRMED_NON_COMPLIANT",
    );
    assert.ok(material.length >= 1);
    assert.ok(
      material.some(
        (r) => r.severityCanonical === "HIGH" || r.severityCanonical === "CRITICAL",
      ),
    );
  });

  it("optional requirement does not become material compliance risk", () => {
    const assessment = assessRequirementRisk({
      requirementId: "r1",
      description: "Preferred: cloud experience is advantageous",
      category: "PREFERRED",
      semanticKind: "EVALUATION_CRITERION",
      mandatory: false,
      obligationStrength: "OPTIONAL",
      fitStatus: "NEEDS_VERIFICATION",
      matchStatus: "UNCERTAIN",
      evidence: null,
      verificationStatus: "NEEDS_VERIFICATION",
      finding: null,
      requirementCriticality: "LOW",
    });
    assert.equal(assessment.include, false);
  });

  it("conditional requirement with unknown applicability preserves uncertainty", () => {
    const assessment = assessRequirementRisk({
      requirementId: "r1",
      description: "If applicable, provide local partner attestation",
      category: "ADMINISTRATIVE",
      semanticKind: "REQUIRED_DOCUMENT",
      mandatory: true,
      obligationStrength: "CONDITIONAL",
      applicabilityUnknown: true,
      fitStatus: "NEEDS_VERIFICATION",
      matchStatus: "UNCERTAIN",
      evidence: null,
      verificationStatus: "NEEDS_VERIFICATION",
      finding: null,
      requirementCriticality: "MEDIUM",
    });
    assert.equal(assessment.include, true);
    assert.equal(assessment.severity, "LOW");
    assert.equal(assessment.evidenceState, "NEEDS_VERIFICATION");
    assert.ok(/applicab/i.test(assessment.explanation));
  });

  it("categorizes eligibility, technical, financial, contractual, deadline risks", () => {
    assert.equal(
      deriveRiskCategory({
        category: "Eligibility",
        description: "Minimum 5 years experience required",
        semanticKind: "ELIGIBILITY_REQUIREMENT",
      }),
      "ELIGIBILITY",
    );
    assert.equal(
      deriveRiskCategory({
        category: "Technical",
        description: "Solution must support 24/7 operations",
        semanticKind: "TECHNICAL_REQUIREMENT",
      }),
      "TECHNICAL_DELIVERY",
    );
    assert.equal(
      deriveRiskCategory({
        category: "Commercial",
        description: "Minimum turnover £5m",
        semanticKind: "FINANCIAL_COMMERCIAL_CONDITION",
      }),
      "FINANCIAL_COMMERCIAL",
    );
    assert.equal(
      deriveRiskCategory({
        category: "Contractual",
        description: "Liquidated damages apply for delay",
        semanticKind: "CONTRACTUAL_OBLIGATION",
      }),
      "CONTRACTUAL",
    );
    assert.equal(
      deriveRiskCategory({
        category: "Submission",
        description: "Submission deadline is 30 September",
        semanticKind: "DEADLINE",
      }),
      "DEADLINE_PROCEDURAL",
    );
  });

  it("multiple requirements produce one underlying risk (semantic dedupe)", () => {
    const risks = buildCanonicalStructuredRisks({
      matrix: [
        matrixRow({
          requirementId: "r1",
          requirement: "ISO 27001 certification is mandatory",
          status: "MISSING",
        }),
        matrixRow({
          requirementId: "r2",
          requirement: "Bidder must hold ISO 27001",
          status: "MISSING",
        }),
      ],
      requirements: [
        {
          id: "r1",
          category: "Certification",
          description: "ISO 27001 certification is mandatory",
          mandatory: true,
          status: "FAILED",
          evidence: "not_held: ISO 27001",
          fitStatus: "CONFIRMED_GAP",
          sourceDocument: "Company_Profile.pdf",
        },
        {
          id: "r2",
          category: "Certification",
          description: "Bidder must hold ISO 27001",
          mandatory: true,
          status: "FAILED",
          evidence: "not_held: ISO 27001",
          fitStatus: "CONFIRMED_GAP",
          sourceDocument: "Company_Profile.pdf",
        },
      ],
      findings: [
        {
          code: "CERT_EXPLICITLY_NOT_HELD",
          severity: "CRITICAL",
          category: "certification",
          description: "not held",
          forcesDecision: "NO_BID",
          requirementIndex: 0,
        },
        {
          code: "CERT_EXPLICITLY_NOT_HELD",
          severity: "CRITICAL",
          category: "certification",
          description: "not held",
          forcesDecision: "NO_BID",
          requirementIndex: 1,
        },
      ],
      existingRisks: [],
      documentName: "Spec.pdf",
    });
    assert.equal(risks.length, 1);
    assert.ok((risks[0]!.linkedRequirementIds?.length ?? 0) >= 2);
  });

  it("provenance preserved on material risks", () => {
    const risks = buildCanonicalStructuredRisks({
      matrix: [
        matrixRow({
          requirementId: "r1",
          requirement: "Revenue not less than £5m",
          requirementType: "Commercial",
          status: "MISSING",
        }),
      ],
      requirements: [
        {
          id: "r1",
          category: "Commercial",
          description: "Annual turnover not less than £5m",
          mandatory: true,
          status: "FAILED",
          evidence: "Company revenue (1m-5m) is below the required threshold.",
          fitStatus: "CONFIRMED_GAP",
          sourceDocument: "Company Profile",
          semanticKind: "FINANCIAL_COMMERCIAL_CONDITION",
        },
      ],
      findings: [
        {
          code: "REVENUE_BELOW",
          severity: "CRITICAL",
          category: "financial",
          description: "Below threshold",
          forcesDecision: "NO_BID",
          requirementIndex: 0,
        },
      ],
      existingRisks: [],
      documentName: "Spec.pdf",
    });
    assert.equal(risks[0]!.source.document, "Company Profile");
    assert.ok(risks[0]!.source.excerpt?.includes("below"));
    assert.equal(risks[0]!.fitStatus, "CONFIRMED_GAP");
  });

  it("severity calibration — mandatory alone does not force CRITICAL without material finding", () => {
    const assessment = assessRequirementRisk({
      requirementId: "r1",
      description: "Provide project methodology document",
      category: "Documentation",
      semanticKind: "REQUIRED_DOCUMENT",
      mandatory: true,
      fitStatus: "CONFIRMED_GAP",
      matchStatus: "FAILED",
      evidence: "Document not available in company records",
      companySourceDocument: "Company Profile",
      companyEvidenceExcerpt: "Document not available in company records",
      verificationStatus: "NEEDS_VERIFICATION",
      finding: null,
      requirementCriticality: "MEDIUM",
    });
    assert.equal(assessment.include, true);
    assert.notEqual(assessment.severity, "CRITICAL");
  });

  it("Risk → Decision: confirmed risks downgrade BID; verification does not force NO_BID", () => {
    const engine = runDecisionEngine({
      profile: profile(),
      requirements: [
        {
          category: "Technical",
          description: "Web development",
          mandatory: true,
          value: null,
          status: "MATCHED",
          evidence: "Listed in company profile services.",
          sourceDocument: "Company_Profile.pdf",
        },
      ] satisfies RuleRequirement[],
      estimatedValue: 100_000,
      tenderContext: {
        title: "Portal",
        client: "X",
        country: "Morocco",
        industry: "IT",
        tenderText: "web development Morocco IT",
      },
    });

    const withVerificationOnly = refineDecisionWithEvidence({
      engine: { ...engine, decision: "BID", hardFailure: false },
      aiParticipated: false,
      structuredRiskTitles: [
        {
          title: "ISO pending verification",
          severity: "MEDIUM",
          evidenceState: "NEEDS_VERIFICATION",
          fitStatus: "NEEDS_VERIFICATION",
        },
      ],
    });
    assert.equal(withVerificationOnly.decision, "BID");
    assert.ok(!withVerificationOnly.refinementReasons.some((r) => r.code === "HIGH_RISK_PRESENT"));

    const withConfirmed = refineDecisionWithEvidence({
      engine: { ...engine, decision: "BID", hardFailure: false },
      aiParticipated: false,
      structuredRiskTitles: [
        {
          title: "ISO 27001 not held",
          severity: "CRITICAL",
          evidenceState: "CONFIRMED_NON_COMPLIANT",
          fitStatus: "CONFIRMED_GAP",
        },
      ],
    });
    assert.equal(withConfirmed.decision, "REVIEW");
    assert.ok(withConfirmed.refinementReasons.some((r) => r.code === "HIGH_RISK_PRESENT"));
  });

  it("rejects invalid risk consistency states", () => {
    assert.throws(() =>
      assertRiskConsistency([
        {
          title: "Fake risk",
          severity: "HIGH",
          evidenceState: "CONFIRMED_NON_COMPLIANT",
          fitStatus: "CONFIRMED_FIT",
          requirementId: "r1",
        },
      ]),
    );
    assert.throws(() =>
      assertRiskConsistency([
        {
          title: "Inflated verify",
          severity: "CRITICAL",
          evidenceState: "NEEDS_VERIFICATION",
          fitStatus: "NEEDS_VERIFICATION",
          requirementId: "r1",
          whyRisky: "Missing evidence",
        },
      ]),
    );
  });
});
