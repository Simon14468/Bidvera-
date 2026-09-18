/**
 * Geographic coverage + GEO_MISMATCH integrity — general capability regressions.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateGeographicCoverage,
  isBidderGeographicCoverageObligation,
  isGeographicObligationDeferredPastBidding,
} from "@/domain/decision/geographic-coverage";
import { evaluateDeterministicRules } from "@/domain/decision/rules";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";
import { buildTenderDecisionRecommendation } from "@/domain/decision/recommendation";
import { interpretSemanticStatement } from "@/domain/semantic-tender-intelligence/interpret";
import { attributeObligationActor } from "@/domain/tender-requirements/obligation-actor";
import { isNonRequirementText } from "@/domain/tender-requirements/filter-non-requirements";
import { buildCanonicalRequirements } from "@/domain/tender-requirements";

const profileUk: RuleCompanyProfile = {
  companyName: "Acme",
  industry: "facilities",
  country: "England",
  companySize: null,
  experienceLevel: null,
  services: ["cleaning"],
  certifications: [],
  experienceYears: 10,
  revenueRange: null,
  employeeRange: null,
  geographicCoverage: ["England", "Wales"],
  contractSizeMin: null,
  contractSizeMax: null,
  customQualificationRules: [],
};

function req(description: string, over: Partial<RuleRequirement> = {}): RuleRequirement {
  return {
    category: "MANDATORY_ELIGIBILITY",
    description,
    mandatory: true,
    value: null,
    status: "UNCERTAIN",
    ...over,
  };
}

describe("geographic coverage obligation semantics", () => {
  it("national court does not create GEO_MISMATCH", () => {
    const text =
      "Nothing in this Undertaking shall constitute a waiver of privileges enjoyed under law, or as a submission to the jurisdiction of any national court or tribunal.";
    assert.equal(isBidderGeographicCoverageObligation(text), false);
    const { findings, requirements } = evaluateDeterministicRules({
      profile: profileUk,
      requirements: [req(text)],
      estimatedValue: null,
    });
    assert.equal(findings.some((f) => f.code === "GEO_MISMATCH"), false);
    assert.notEqual(requirements[0]!.status, "FAILED");
  });

  it("National Pharmaceutical Authority does not create GEO_MISMATCH", () => {
    const text =
      "Bidders shall submit registration certificates issued by a National Pharmaceutical Authority together with GMP certificates.";
    assert.equal(isBidderGeographicCoverageObligation(text), false);
    const { findings } = evaluateDeterministicRules({
      profile: profileUk,
      requirements: [req(text)],
      estimatedValue: null,
    });
    assert.equal(findings.some((f) => f.code === "GEO_MISMATCH"), false);
  });

  it("national regulatory requirements does not create GEO_MISMATCH", () => {
    const text =
      "Product registration will be required prior to supply in accordance with applicable national regulatory requirements.";
    assert.equal(isBidderGeographicCoverageObligation(text), false);
    const { findings } = evaluateDeterministicRules({
      profile: profileUk,
      requirements: [req(text)],
      estimatedValue: null,
    });
    assert.equal(findings.some((f) => f.code === "GEO_MISMATCH"), false);
  });

  it("real bidder geographic coverage can create GEO_MISMATCH when profile contradicts", () => {
    const text =
      "The bidder must operate and maintain geographic coverage across Scotland and provide services nationwide in Scotland.";
    assert.equal(isBidderGeographicCoverageObligation(text), true);
    const { findings, requirements } = evaluateDeterministicRules({
      profile: profileUk,
      requirements: [req(text)],
      estimatedValue: null,
    });
    assert.equal(findings.filter((f) => f.code === "GEO_MISMATCH").length, 1);
    assert.equal(requirements[0]!.status, "FAILED");
  });

  it("missing company geographic evidence produces NEEDS_VERIFICATION path, not GEO_MISMATCH", () => {
    const emptyGeo: RuleCompanyProfile = {
      ...profileUk,
      country: null,
      geographicCoverage: [],
    };
    const text =
      "The bidder must maintain geographic coverage across Scotland and deliver services in Scotland.";
    const { findings, requirements } = evaluateDeterministicRules({
      profile: emptyGeo,
      requirements: [req(text)],
      estimatedValue: null,
    });
    assert.equal(findings.some((f) => f.code === "GEO_MISMATCH"), false);
    assert.ok(findings.some((f) => f.code === "GEOGRAPHY_UNKNOWN"));
    assert.equal(requirements[0]!.status, "UNCERTAIN");
    assert.equal(evaluateGeographicCoverage(emptyGeo, text).covers, null);
  });

  it("conditional geographic obligation not applicable at bidding does not create confirmed gap", () => {
    const deferred =
      "The bidder must maintain geographic coverage in Scotland. Coverage is not required at the time of bidding but will be required prior to supply.";
    assert.equal(isGeographicObligationDeferredPastBidding(deferred), true);
    const { findings, requirements } = evaluateDeterministicRules({
      profile: profileUk,
      requirements: [req(deferred)],
      estimatedValue: null,
    });
    assert.equal(findings.some((f) => f.code === "GEO_MISMATCH"), false);
    assert.notEqual(requirements[0]!.status, "FAILED");
  });
});

describe("legal reservation semantic admission", () => {
  it("privileges/immunities legal-reservation text is rejected as bidder requirement", () => {
    const text =
      "Nothing in this Undertaking shall constitute or be deemed to constitute a waiver of any of the privileges and immunities enjoyed by the Organisation under any source of law, or as a submission to the jurisdiction of any national court or tribunal.";
    assert.equal(isNonRequirementText(text), true);
    assert.equal(attributeObligationActor(text).isBidderRequirement, false);
    assert.equal(attributeObligationActor(text).actor, "AUTHORITY_SIDE");
    const interpreted = interpretSemanticStatement({ text });
    assert.equal(interpreted.admitToCanonical, false);
    const canonical = buildCanonicalRequirements({
      aiDrafts: [],
      heuristicDrafts: [
        {
          category: "MANDATORY_TECHNICAL",
          description: text,
          mandatory: true,
          value: null,
          sourcePage: 1,
          sourceSection: null,
          evidenceText: text,
          verificationStatus: "UNKNOWN",
        },
      ],
      sourceDocument: "terms.docx",
    });
    assert.equal(
      canonical.some((r) => /privileges and immunities/i.test(r.requirement)),
      false,
    );
  });
  it("cross-document semantic admission remains intact for real bidder obligations", () => {
    const text = "The bidder shall submit a Form of Tender with the complete bid package.";
    const a = interpretSemanticStatement({
      text,
      provenance: { sourceDocument: "itt.pdf", sourcePage: 2 },
    });
    const b = interpretSemanticStatement({
      text,
      provenance: { sourceDocument: "appendix.pdf", sourcePage: 1 },
    });
    assert.equal(a.admitToCanonical, true);
    assert.equal(b.admitToCanonical, true);
    assert.equal(a.obligationActorKind, "BIDDER_SIDE");
  });
});

describe("recommendation finding identity dedupe", () => {
  it("identical underlying GEO_MISMATCH finding is emitted once", () => {
    const findings = [
      {
        code: "GEO_MISMATCH",
        severity: "HIGH" as const,
        category: "geography",
        description: "Geographic coverage requirement does not match company profile.",
        forcesDecision: "NO_BID" as const,
        requirementIndex: 0,
      },
      {
        code: "GEO_MISMATCH",
        severity: "HIGH" as const,
        category: "geography",
        description: "Geographic coverage requirement does not match company profile.",
        forcesDecision: "NO_BID" as const,
        requirementIndex: 1,
      },
      {
        code: "GEO_MISMATCH",
        severity: "HIGH" as const,
        category: "geography",
        description: "Geographic coverage requirement does not match company profile.",
        forcesDecision: "NO_BID" as const,
        requirementIndex: 2,
      },
    ];
    const rec = buildTenderDecisionRecommendation({
      aiParticipated: false,
      engine: {
        decision: "NO_BID",
        fitScore: 40,
        confidence: "HIGH",
        reasoning: "test",
        findings,
        requirements: [],
        hardFailure: true,
        matchedRequirements: [],
        failedRequirements: [],
        uncertainRequirements: [],
        fitBreakdown: {
          overall: 40,
          scoringAvailable: true,
          matches: [],
          gaps: [],
          unknowns: [],
          dimensions: [],
          attention: [],
          recommendation: "NO_BID",
        },
        hardBlockers: [],
      },
    });
    const geoBlockers = rec.criticalBlockers.filter((b) =>
      b.includes("Geographic coverage requirement does not match"),
    );
    assert.equal(geoBlockers.length, 1);
    assert.equal(rec.reasons.filter((r) => r.code === "GEO_MISMATCH").length, 1);
  });

  it("distinct legitimate findings remain distinct", () => {
    const findings = [
      {
        code: "GEO_MISMATCH",
        severity: "HIGH" as const,
        category: "geography",
        description: "Geographic coverage requirement does not match company profile.",
        forcesDecision: "NO_BID" as const,
      },
      {
        code: "CERT_EXPLICITLY_NOT_HELD",
        severity: "CRITICAL" as const,
        category: "certification",
        description: "ISO 27001 is explicitly not held.",
        forcesDecision: "NO_BID" as const,
      },
    ];
    const rec = buildTenderDecisionRecommendation({
      aiParticipated: false,
      engine: {
        decision: "NO_BID",
        fitScore: 20,
        confidence: "HIGH",
        reasoning: "test",
        findings,
        requirements: [],
        hardFailure: true,
        matchedRequirements: [],
        failedRequirements: [],
        uncertainRequirements: [],
        fitBreakdown: {
          overall: 20,
          scoringAvailable: true,
          matches: [],
          gaps: [],
          unknowns: [],
          dimensions: [],
          attention: [],
          recommendation: "NO_BID",
        },
        hardBlockers: [],
      },
    });
    assert.ok(rec.criticalBlockers.some((b) => /Geographic coverage/i.test(b)));
    assert.ok(rec.criticalBlockers.some((b) => /ISO 27001/i.test(b)));
    assert.equal(rec.criticalBlockers.length >= 2, true);
  });
});
