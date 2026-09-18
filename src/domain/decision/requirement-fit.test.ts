/**
 * Canonical Company Fit / Evidence Matching — regression suite.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchRequirementWithEvidence } from "@/domain/company-knowledge/evidence-match";
import type { CompanyKnowledge } from "@/domain/company-knowledge/types";
import { runDecisionEngine } from "@/domain/decision/engine";
import {
  assertRequirementFitConsistency,
  deriveRequirementFitStatus,
  finalizeRequirementFit,
  mapFitStatusToReadiness,
} from "@/domain/decision/requirement-fit-status";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { classifyComplianceEvidenceState } from "@/domain/risk/classify";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";

function baseKnowledge(overrides?: Partial<CompanyKnowledge>): CompanyKnowledge {
  return {
    documentKind: "COMPANY_PROFILE",
    classificationConfidence: 0.9,
    classificationSignals: [],
    identity: {
      companyName: "Atlas AV",
      legalStructure: null,
      industry: "IT",
      sector: null,
      location: "Casablanca, Morocco",
      country: "Morocco",
      companySize: "11-50",
      employees: 25,
      foundedYear: 2015,
      experienceYears: 8,
    },
    services: [],
    capabilities: [],
    technologies: [],
    projects: [
      {
        name: "Municipal auditorium AV upgrade",
        clientSector: "public administration",
        description: "Audiovisual installation for public events",
        approximateValue: null,
        duration: "6 months",
        status: "completed",
        technologies: ["AV"],
        provenance: {
          sourceDocument: "Atlas_Profile.pdf",
          page: 4,
          section: "Projects",
          originalValue: "Municipal auditorium AV upgrade",
          normalizedValue: null,
          confidence: "VERIFIED",
          excerpt: "Municipal auditorium AV upgrade",
        },
      },
    ],
    certifications: [
      {
        name: "ISO 9001",
        status: "AVAILABLE",
        detail: "ISO 9001:2015 quality management",
        provenance: {
          sourceDocument: "Atlas_Profile.pdf",
          page: 2,
          section: "Certifications",
          originalValue: "ISO 9001:2015",
          normalizedValue: "ISO 9001",
          confidence: "VERIFIED",
          excerpt: "ISO 9001:2015",
        },
      },
    ],
    policies: [],
    insurance: [],
    geographicCoverage: [
      {
        key: "geo",
        value: "Morocco nationwide",
        provenance: {
          sourceDocument: "Atlas_Profile.pdf",
          page: 1,
          section: "Coverage",
          originalValue: "Morocco nationwide",
          normalizedValue: "Morocco",
          confidence: "VERIFIED",
          excerpt: "Morocco nationwide",
        },
      },
    ],
    contractCapacity: {
      preferredMin: null,
      preferredMax: null,
      preferredMaxNumeric: null,
      notes: null,
      provenance: null,
    },
    operationalCapacity: {
      totalEmployees: 25,
      developers: 10,
      projectManagers: 3,
      qa: 2,
      typicalConcurrentProjects: null,
      typicalDuration: "6-12 months",
      typicalDurationMonthsMin: 6,
      typicalDurationMonthsMax: 12,
      notes: [],
      provenance: null,
    },
    strengths: [],
    limitations: [
      {
        key: "support",
        value: "No stated 24/7 support operation",
        provenance: {
          sourceDocument: "Atlas_Profile.pdf",
          page: 5,
          section: "Limitations",
          originalValue: "No stated 24/7 support operation",
          normalizedValue: null,
          confidence: "VERIFIED",
          excerpt: "No stated 24/7 support operation",
        },
      },
    ],
    tenderPreferences: [],
    historicalOutcomes: [],
    extraFacts: [],
    sourceDocuments: ["Atlas_Profile.pdf"],
    extractedAt: new Date().toISOString(),
    ...overrides,
  };
}

const sparseProfile: RuleCompanyProfile = {
  companyName: "Test Co",
  industry: "IT",
  country: "Morocco",
  companySize: "11-50",
  experienceLevel: null,
  services: [],
  certifications: [],
  experienceYears: null,
  revenueRange: null,
  employeeRange: "11-50",
  geographicCoverage: [],
  contractSizeMin: null,
  contractSizeMax: null,
  customQualificationRules: [],
};

describe("requirement fit status — canonical derivation", () => {
  it("CONFIRMED_FIT requires provenance-backed evidence", () => {
    const fit = deriveRequirementFitStatus({
      category: "MANDATORY_ELIGIBILITY",
      mandatory: true,
      matchStatus: "MATCHED",
      evidence: "Morocco nationwide delivery",
      sourceDocument: "Atlas_Profile.pdf",
      page: 1,
      section: "Coverage",
      findings: [],
      requirementIndex: 0,
    });
    assert.equal(fit.fitStatus, "CONFIRMED_FIT");
    assert.ok(fit.provenance);
  });

  it("missing evidence is NEEDS_VERIFICATION not CONFIRMED_GAP", () => {
    const fit = deriveRequirementFitStatus({
      category: "MANDATORY_TECHNICAL",
      mandatory: true,
      matchStatus: "UNCERTAIN",
      evidence: null,
      sourceDocument: null,
      findings: [],
      requirementIndex: 0,
    });
    assert.equal(fit.fitStatus, "NEEDS_VERIFICATION");
    assert.notEqual(fit.fitStatus, "CONFIRMED_GAP");
  });

  it("explicit negative limitation yields CONFIRMED_GAP", () => {
    const fit = deriveRequirementFitStatus({
      category: "MANDATORY_TECHNICAL",
      mandatory: true,
      matchStatus: "FAILED",
      evidence: "No stated 24/7 support operation",
      sourceDocument: "Atlas_Profile.pdf",
      page: 5,
      section: "Limitations",
      findings: [],
      requirementIndex: 0,
    });
    assert.equal(fit.fitStatus, "CONFIRMED_GAP");
  });

  it("conflicting certification evidence stays NEEDS_VERIFICATION", () => {
    const fit = deriveRequirementFitStatus({
      category: "MANDATORY_TECHNICAL",
      mandatory: true,
      matchStatus: "UNCERTAIN",
      evidence: null,
      sourceDocument: null,
      findings: [],
      requirementIndex: 0,
      evidenceConflict: true,
    });
    assert.equal(fit.fitStatus, "NEEDS_VERIFICATION");
    assert.equal(fit.evidenceConflict, true);
  });

  it("informational requirements are NOT_APPLICABLE", () => {
    const fit = deriveRequirementFitStatus({
      category: "INFORMATIONAL",
      mandatory: false,
      matchStatus: "UNCERTAIN",
      evidence: null,
      sourceDocument: null,
      findings: [],
      requirementIndex: 0,
    });
    assert.equal(fit.fitStatus, "NOT_APPLICABLE");
  });
});

describe("evidence matching — semantic specialization", () => {
  it("confirms fit for public-sector experience with provenance", () => {
    const result = matchRequirementWithEvidence({
      requirement: "Minimum five (5) years of experience in public-sector audiovisual installation projects",
      category: "MANDATORY_ELIGIBILITY",
      mandatory: true,
      knowledge: baseKnowledge(),
    });
    assert.equal(result.status, "MATCHED");
    assert.ok(result.sourceDocument);
  });

  it("experience shortfall with stated years is FAILED not uncertain", () => {
    const result = matchRequirementWithEvidence({
      requirement: "Minimum 10 years of experience in healthcare hospital projects",
      category: "MANDATORY_ELIGIBILITY",
      mandatory: true,
      knowledge: baseKnowledge(),
    });
    assert.equal(result.status, "FAILED");
  });

  it("24/7 requirement with explicit limitation is FAILED", () => {
    const result = matchRequirementWithEvidence({
      requirement: "Supplier must provide 24/7 on-site support during warranty",
      category: "MANDATORY_TECHNICAL",
      mandatory: true,
      knowledge: baseKnowledge(),
    });
    assert.equal(result.status, "FAILED");
  });

  it("required document checks availability not generic capability", () => {
    const result = matchRequirementWithEvidence({
      requirement: "Submit ISO 9001 certification certificate with tender dossier",
      category: "MANDATORY_ADMINISTRATIVE",
      mandatory: true,
      semanticKind: "REQUIRED_DOCUMENT",
      knowledge: baseKnowledge(),
    });
    assert.equal(result.status, "MATCHED");
  });

  it("MATCHED without provenance downgrades to UNCERTAIN", () => {
    const knowledge = baseKnowledge({
      services: [
        {
          originalValue: "Cloud consulting",
          normalizedValue: "Cloud Solutions",
          provenance: {
            sourceDocument: "",
            page: "UNKNOWN",
            section: null,
            originalValue: "Cloud consulting",
            normalizedValue: "Cloud Solutions",
            confidence: "INFERRED",
            excerpt: null,
          },
        },
      ],
    });
    const result = matchRequirementWithEvidence({
      requirement: "Bidder must provide cloud solutions for deployment",
      category: "MANDATORY_TECHNICAL",
      mandatory: true,
      knowledge,
    });
    assert.notEqual(result.status, "MATCHED");
  });
});

describe("requirement fit — downstream readiness/risk/decision", () => {
  it("readiness consumes canonical fit status", () => {
    const requirements: RuleRequirement[] = [
      {
        id: "r1",
        category: "MANDATORY_ELIGIBILITY",
        description: "Morocco delivery",
        mandatory: true,
        value: null,
        status: "MATCHED",
        fitStatus: "CONFIRMED_FIT",
        evidence: "Morocco",
      },
      {
        id: "r2",
        category: "MANDATORY_TECHNICAL",
        description: "24/7 support",
        mandatory: true,
        value: null,
        status: "FAILED",
        fitStatus: "CONFIRMED_GAP",
        evidence: "No 24/7",
      },
      {
        id: "r3",
        category: "MANDATORY_TECHNICAL",
        description: "HCI platform",
        mandatory: true,
        value: null,
        status: "UNCERTAIN",
        fitStatus: "NEEDS_VERIFICATION",
      },
    ];
    const readiness = computeTenderReadiness({ requirements, profileHasAnyCapability: true });
    assert.equal(readiness.items[0]!.status, "READY");
    assert.equal(readiness.items[1]!.status, "MISSING");
    assert.equal(readiness.items[2]!.status, "VERIFY");
  });

  it("missing certification listing yields NEEDS_VERIFICATION via engine finalize", () => {
    const requirements: RuleRequirement[] = [
      {
        category: "MANDATORY_TECHNICAL",
        description: "ISO 27001 certification is mandatory for all bidders",
        mandatory: true,
        value: null,
        status: "UNCERTAIN",
        evidence: null,
      },
    ];
    const out = runDecisionEngine({
      profile: sparseProfile,
      requirements,
      estimatedValue: null,
    });
    assert.ok(out.requirements.every((r) => r.fitStatus !== "CONFIRMED_GAP"));
    assert.ok(out.requirements.some((r) => r.fitStatus === "NEEDS_VERIFICATION"));
  });

  it("experience shortfall with profile provenance yields CONFIRMED_GAP", () => {
    const out = runDecisionEngine({
      profile: { ...sparseProfile, experienceYears: 2 },
      requirements: [
        {
          category: "Experience",
          description: "Minimum 5 years public-sector AV experience",
          mandatory: true,
          value: null,
          status: "UNCERTAIN",
          evidence: "Tender §3",
        },
      ],
      estimatedValue: 500_000,
    });
    const exp = out.requirements[0]!;
    assert.equal(exp.fitStatus, "CONFIRMED_GAP");
    assert.ok(exp.fitProvenance?.sourceDocument);
    assert.ok(exp.fitProvenance?.excerpt.includes("2"));
  });

  it("risk does not treat NEEDS_VERIFICATION as confirmed non-compliance", () => {
    const state = classifyComplianceEvidenceState({
      readinessStatus: mapFitStatusToReadiness("NEEDS_VERIFICATION"),
      matchStatus: "UNCERTAIN",
      verificationStatus: "NEEDS_VERIFICATION",
      mandatory: true,
      evidence: null,
      findings: [],
      requirementIndex: 0,
    });
    assert.equal(state, "NEEDS_VERIFICATION");
    assert.notEqual(state, "CONFIRMED_NON_COMPLIANT");
  });

  it("finalize produces one fit record per requirement", () => {
    const finalized = finalizeRequirementFit({
      requirements: [
        {
          category: "MANDATORY_ELIGIBILITY",
          description: "Morocco domicile required",
          mandatory: true,
          value: null,
          status: "MATCHED",
          evidence: "Morocco",
          sourceDocument: "profile.pdf",
          page: 1,
          section: "Geo",
        },
      ],
      findings: [],
    });
    assert.equal(finalized.length, 1);
    assertRequirementFitConsistency(
      finalized.map((r) => ({
        description: r.description,
        fitStatus: r.fitStatus,
        fitProvenance: r.fitProvenance,
      })),
    );
  });
});
