import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExtractionBlockedAnalysis,
  displayFitScore,
  evaluateRequirementExtractionGate,
  isScoringBlocked,
} from "./extraction-gate";
import { runDecisionEngine } from "./engine";
import type { RuleCompanyProfile, RuleRequirement } from "./types";
import { computeCompanyTenderFit } from "./company-fit";
import { buildBidScoreFromAnalysis } from "@/domain/bid-score";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { computeTenderReadiness } from "./tender-readiness";

describe("extraction gate — blocked analysis", () => {
  it("zero reliable requirements blocks scoring", () => {
    const gate = evaluateRequirementExtractionGate({
      reliableRequirementCount: 0,
      packageTextLength: 5000,
    });
    assert.equal(gate.status, "blocked");
    assert.equal(gate.reason, "NO_RELIABLE_REQUIREMENTS");
  });

  it("unreliable short package text blocks scoring", () => {
    const gate = evaluateRequirementExtractionGate({
      reliableRequirementCount: 0,
      packageTextLength: 120,
    });
    assert.equal(gate.status, "blocked");
    assert.equal(gate.reason, "DOCUMENT_UNREADABLE");
  });

  it("avis-only package reason is preserved in gate messaging", () => {
    const gate = evaluateRequirementExtractionGate({
      reliableRequirementCount: 5,
      packageTextLength: 5000,
      packageBlockedReason: "ONLY_AVIS",
      packageBlockedMessage:
        "Only a tender notice was available. CPS / technical specifications are missing.",
    });
    assert.equal(gate.status, "blocked");
    assert.equal(gate.reason, "ONLY_AVIS");
    assert.match(gate.message ?? "", /CPS|technical/i);
  });

  it("failed extraction produces UNAVAILABLE scores (DB placeholder REVIEW)", () => {
    const blocked = buildExtractionBlockedAnalysis({
      reason: "EXTRACTION_FAILED",
      packageLabel: "CPS.pdf",
    });
    // DB enum placeholder only — canonical read path nulls this when scoring blocked.
    assert.equal(blocked.decision, "REVIEW");
    assert.equal(blocked.fitBreakdown.scoringAvailable, false);
    assert.equal(blocked.fitBreakdown.overall, null);
    assert.equal(blocked.fitBreakdown.dimensions.length, 0);
    assert.equal(blocked.readiness.scoringAvailable, false);
    assert.equal(blocked.readiness.score, null);
    assert.equal(blocked.bidScore.scoringAvailable, false);
    assert.equal(blocked.bidScore.priorityLabel, "UNAVAILABLE");
    assert.equal(blocked.bidScore.expectedValue, "UNKNOWN");
    assert.equal(blocked.intelligence.complianceStatus, "INCOMPLETE");
    assert.equal(blocked.intelligence.complianceMatrix.length, 0);
    assert.equal(blocked.intelligence.risks.length, 0);
    assert.ok(blocked.intelligence.keyBlockers.length >= 1);
    assert.match(blocked.reasoning, /not a completed tender analysis/i);
  });

  it("displayFitScore hides numeric fit when gate blocked", () => {
    const blocked = buildExtractionBlockedAnalysis({
      reason: "NO_RELIABLE_REQUIREMENTS",
    });
    assert.equal(
      displayFitScore({
        fitScore: 44,
        fitBreakdown: blocked.fitBreakdown,
      }),
      null,
    );
    assert.equal(isScoringBlocked(blocked.fitBreakdown), true);
  });
});

describe("extraction gate — successful path unchanged", () => {
  const profile: RuleCompanyProfile = {
    companyName: "Test Co",
    industry: "Information Technology",
    country: "Morocco",
    companySize: "11-50",
    experienceLevel: "experienced",
    services: ["Web Application Development"],
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
      description: "Web portal development experience.",
      mandatory: true,
      value: null,
      status: "MATCHED",
    },
  ];

  it("valid extraction still computes fit, readiness, and bid score", () => {
    const gate = evaluateRequirementExtractionGate({
      reliableRequirementCount: requirements.length,
      packageTextLength: 8000,
    });
    assert.equal(gate.status, "valid");

    const decision = runDecisionEngine({
      profile,
      requirements,
      estimatedValue: 1_000_000,
      tenderContext: {
        title: "IT tender",
        client: "Ministry",
        country: "Morocco",
        industry: "Information Technology",
        tenderText: "Morocco web portal",
      },
    });

    assert.ok(decision.fitScore > 0);
    assert.ok(decision.fitBreakdown.overall != null);
    assert.notEqual(decision.fitBreakdown.scoringAvailable, false);
    assert.ok(decision.fitBreakdown.dimensions.length > 0);

    const readiness = computeTenderReadiness({
      requirements,
      profileHasAnyCapability: true,
      fit: decision.fitBreakdown,
    });
    assert.ok(readiness.score != null);
    assert.notEqual(readiness.scoringAvailable, false);

    const intelligence = buildTenderIntelligence({
      tenderId: "t1",
      documentName: "CPS.pdf",
      tenderDeadline: null,
      extractedText: "Morocco web portal",
      requirements: requirements.map((r, i) => ({
        id: `r${i}`,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        sourcePage: null,
        sourceSection: null,
        evidence: r.evidence ?? null,
      })),
      evidence: [],
      readiness,
      findings: [],
      existingRisks: [],
      decision: decision.decision,
      fitScore: decision.fitScore,
    });
    assert.equal(intelligence.complianceStatus, "COMPLETE");
    assert.ok(intelligence.complianceMatrix.length > 0);

    const bidScore = buildBidScoreFromAnalysis({
      fitScore: decision.fitScore,
      fitBreakdown: decision.fitBreakdown,
      readiness,
      intelligence,
      estimatedValue: 1_000_000,
      deadline: null,
      decision: decision.decision,
    });
    assert.ok(bidScore.score >= 0);
    assert.notEqual(bidScore.scoringAvailable, false);
    assert.notEqual(bidScore.priorityLabel, "UNAVAILABLE");
  });

  it("computeCompanyTenderFit still scores dimensions when requirements exist", () => {
    const fit = computeCompanyTenderFit({
      profile,
      requirements,
      context: {
        title: "Portal",
        client: "Gov",
        country: "Morocco",
        industry: "IT",
        estimatedValue: null,
        tenderText: "web portal Morocco",
      },
    });
    assert.ok(fit.overall != null && fit.overall > 0);
    assert.ok(fit.dimensions.some((d) => d.status === "scored"));
  });
});
