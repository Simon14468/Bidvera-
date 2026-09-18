import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyRequirementCategory,
  normalizeRequirements,
  weightedRequirementsScore,
} from "./index";
import { runDecisionEngine } from "@/domain/decision/engine";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";

describe("tender requirement classification", () => {
  it("classifies mandatory vs preferred vs informational", () => {
    assert.equal(
      classifyRequirementCategory({
        description: "Le titulaire est tenu d'élire domicile au Maroc.",
      }),
      "MANDATORY_ELIGIBILITY",
    );
    assert.equal(
      classifyRequirementCategory({
        description:
          "Fourniture et installation de la solution hyperconvergée et de virtualisation.",
        mandatoryHint: true,
      }),
      "MANDATORY_TECHNICAL",
    );
    assert.equal(
      classifyRequirementCategory({
        description: "Caution provisoire obligatoire de 80.000 DHS.",
      }),
      "MANDATORY_ADMINISTRATIVE",
    );
    assert.equal(
      classifyRequirementCategory({
        description: "Une expérience cloud est souhaitable mais non obligatoire.",
      }),
      "PREFERRED",
    );
    assert.equal(
      classifyRequirementCategory({
        description:
          "En application des dispositions de l'article 143 du décret n° 2.22.431, l'approbation du marché doit intervenir.",
      }),
      "INFORMATIONAL",
    );
  });

  it("normalize drops informational noise and preserves distinct obligations", () => {
    const out = normalizeRequirements(
      [
        {
          category: "technical",
          description:
            "En application des dispositions de l'article 143 du décret, l'approbation du marché doit intervenir.",
          mandatory: true,
        },
        {
          category: "MANDATORY_ELIGIBILITY",
          description: "Bidder must establish domicile in Morocco",
          mandatory: true,
          value: "Morocco",
        },
        {
          category: "MANDATORY_TECHNICAL",
          description: "Provide hyperconverged virtualization solution",
          mandatory: true,
        },
        {
          category: "MANDATORY_TECHNICAL",
          description: "Provide hyperconverged virtualization solution",
          mandatory: true,
        },
      ],
      { includeInformational: false },
    );
    assert.equal(out.length, 2);
    assert.ok(out.every((r) => r.category !== "INFORMATIONAL"));
    assert.ok(out.every((r) => r.title && r.requirement));
  });

  it("weights mandatory failures harder than preferred uncertain", () => {
    const base: RuleRequirement[] = [
      {
        category: "MANDATORY_TECHNICAL",
        description: "HCI required",
        mandatory: true,
        value: null,
        status: "FAILED",
      },
      {
        category: "PREFERRED",
        description: "Nice logo",
        mandatory: false,
        value: null,
        status: "MATCHED",
      },
    ];
    const withPreferredFail: RuleRequirement[] = [
      {
        category: "MANDATORY_TECHNICAL",
        description: "HCI required",
        mandatory: true,
        value: null,
        status: "MATCHED",
      },
      {
        category: "PREFERRED",
        description: "Nice logo",
        mandatory: false,
        value: null,
        status: "FAILED",
      },
    ];
    const a = weightedRequirementsScore(base);
    const b = weightedRequirementsScore(withPreferredFail);
    assert.ok(a < b, `mandatory fail ${a} should score below preferred fail ${b}`);
  });
});

describe("canonical Fit consistency", () => {
  it("keeps fitScore and fitBreakdown.overall identical", () => {
    const profile: RuleCompanyProfile = {
      companyName: "Test Co",
      industry: "Information Technology",
      country: "Morocco",
      companySize: "11-50",
      experienceLevel: "experienced",
      services: ["Web Application Development", "Cloud Solutions"],
      certifications: ["ISO 9001"],
      experienceYears: 8,
      revenueRange: null,
      employeeRange: "11-50",
      geographicCoverage: ["Morocco"],
      contractSizeMin: null,
      contractSizeMax: null,
      customQualificationRules: [],
    };
    const requirements: RuleRequirement[] = [
      {
        category: "MANDATORY_ELIGIBILITY",
        description: "Morocco-based delivery capability is required.",
        mandatory: true,
        value: null,
        status: "MATCHED",
        evidence: "Morocco",
      },
      {
        category: "MANDATORY_TECHNICAL",
        description: "24/7 technical support is required.",
        mandatory: true,
        value: null,
        status: "FAILED",
        evidence: "No 24/7 support",
      },
      {
        category: "PREFERRED",
        description: "Preferred partner logo placement",
        mandatory: false,
        value: null,
        status: "UNCERTAIN",
      },
    ];
    const out = runDecisionEngine({
      profile,
      requirements,
      estimatedValue: null,
      tenderContext: {
        title: "IT tender",
        client: "Ministry",
        country: "Morocco",
        industry: "Information Technology",
        tenderText: "Morocco delivery 24/7 support hyperconverged",
      },
      ai: {
        suggestedDecision: "BID",
        fitScore: 80,
        confidence: "HIGH",
        reasoning: "Optimistic AI note",
      },
    });
    assert.equal(out.fitScore, out.fitBreakdown.overall);
    assert.match(out.reasoning, new RegExp(`${out.fitScore}%\\s+company–tender fit`));
  });
});
