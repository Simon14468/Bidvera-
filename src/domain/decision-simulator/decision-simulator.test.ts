/**
 * Decision Simulator unit tests — read-only, canonical engine reuse.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import {
  finalizeTenderDecision,
  runCoreDecisionEngine,
  runTenderDecisionEngine,
} from "@/domain/decision/tender-decision-engine";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";
import {
  applySimulationOverrides,
  buildSimulationSnapshot,
  simulateTenderDecision,
  validateSimulationOverrides,
} from "@/domain/decision-simulator";
import type { CanonicalTenderAnalysis } from "@/domain/tender-intelligence/canonical";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";

function profile(overrides: Partial<RuleCompanyProfile> = {}): RuleCompanyProfile {
  return {
    companyName: "Acme",
    industry: "IT",
    country: "Morocco",
    companySize: "51-200",
    experienceLevel: "experienced",
    services: ["software development", "web", "api"],
    certifications: ["ISO 27001"],
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

function req(
  id: string,
  partial: Partial<RuleRequirement> & Pick<RuleRequirement, "description" | "status">,
): RuleRequirement {
  return {
    id,
    category: "Technical",
    mandatory: true,
    value: null,
    evidence: "Tender §3",
    ...partial,
  };
}

function minimalCanonical(
  overrides: Partial<CanonicalTenderAnalysis> = {},
): CanonicalTenderAnalysis {
  const requirements = [
    {
      id: "r1",
      category: "Certification",
      description: "ISO 27001 certification mandatory",
      mandatory: true,
      value: null,
      status: "UNCERTAIN" as const,
      sourcePage: 1,
      sourceSection: "3.1",
      evidence: "not_held: ISO 27001",
      sortOrder: 0,
    },
    {
      id: "r2",
      category: "Technical",
      description: "Web and API development experience",
      mandatory: true,
      value: null,
      status: "MATCHED" as const,
      sourcePage: 2,
      sourceSection: "4.1",
      evidence: "Profile match",
      sortOrder: 1,
    },
  ];

  const engine = runCoreDecisionEngine({
    profile: profile({ certifications: ["NOT_HELD: ISO 27001", "ISO 9001"] }),
    requirements: requirements.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      evidence: r.evidence,
      sourceDocument: r.id === "r1" ? "Company_Profile.pdf" : undefined,
    })),
    estimatedValue: 100_000,
    tenderContext: {
      title: "Secure platform",
      client: "Gov",
      country: "Morocco",
      industry: "IT",
      tenderText: requirements.map((r) => r.description).join("\n"),
    },
    ai: null,
  });

  const readiness = computeTenderReadiness({
    requirements: engine.requirements,
    missingDocuments: [],
    fit: engine.fitBreakdown,
    profileHasAnyCapability: true,
  });

  const intelligence = buildTenderIntelligence({
    tenderId: "t-sim",
    documentName: "RFP.pdf",
    tenderDeadline: null,
    extractedText: "ISO 27001 mandatory",
    requirements,
    evidence: [],
    readiness,
    findings: engine.findings,
    existingRisks: [],
    decision: engine.decision,
    fitScore: engine.fitScore,
  });

  const finalized = finalizeTenderDecision({
    engine,
    aiParticipated: false,
    readiness: {
      score: readiness.score,
      counts: readiness.counts,
      attention: readiness.attention,
      recommendation: readiness.recommendation,
    },
    compliance: intelligence.complianceSummary,
    keyBlockers: intelligence.keyBlockers,
    structuredRiskTitles: intelligence.risks.map((r) => ({
      title: r.title,
      severity: r.severity,
    })),
  });

  return {
    tenderId: "t-sim",
    companyId: "c1",
    title: "Secure platform",
    client: "Gov",
    deadline: null,
    deadlineTimezone: null,
    analyzedAt: new Date().toISOString(),
    analysisStatus: "COMPLETE",
    documentName: "RFP.pdf",
    outcome: null,
    decision: finalized.decision,
    fitScore: finalized.fitScore,
    confidence: finalized.confidence,
    reasoning: finalized.reasoning,
    isAiSuggested: false,
    companyKnowledgeOnly: false,
    fitBreakdown: finalized.fitBreakdown,
    readiness,
    intelligence,
    bidScore: {
      score: 40,
      scoringAvailable: true,
      priority: "MEDIUM",
      priorityLabel: "Medium",
      interpretation: "Test",
      expectedValue: "UNKNOWN",
      expectedValueNote: "",
      contractValue: null,
      contractValueLabel: "",
      contractValueProvenance: "UNKNOWN",
      pursuitCost: null,
      pursuitCostLabel: "",
      pursuitCostProvenance: "UNKNOWN",
      winProbabilityLabel: "",
      winProbabilityProvenance: "UNKNOWN",
      effort: "MEDIUM",
      effortNote: "",
      riskLevel: "MEDIUM",
      drivers: [],
      reducedCertainty: false,
      certaintyNote: null,
      disclaimer: "",
    },
    requirements,
    evidence: [],
    risks: intelligence.risks.map((r, i) => ({
      id: r.id,
      category: r.category,
      description: r.explanation,
      severity: r.severity,
      sourcePage: r.source.page,
      mitigation: r.recommendedAction,
      sortOrder: i,
    })),
    missingDocuments: [],
    nextActions: [],
    historicalSignals: [],
    ...overrides,
  };
}

describe("decision-simulator", () => {
  it("validateSimulationOverrides rejects empty overrides", () => {
    const canonical = minimalCanonical();
    const snapshot = buildSimulationSnapshot({
      canonical,
      profile: profile({ certifications: ["ISO 9001"] }),
      country: "Morocco",
      industry: "IT",
      estimatedValue: 100_000,
      extractedText: "ISO 27001 mandatory",
    });
    const result = validateSimulationOverrides(snapshot, {});
    assert.equal(result.ok, false);
  });

  it("GO / CONDITIONAL GO / NO-BID — simulating cert match can improve decision", () => {
    const canonical = minimalCanonical();
    assert.equal(canonical.decision, "NO_BID");

    const snapshot = buildSimulationSnapshot({
      canonical,
      profile: profile({ certifications: ["ISO 9001"] }),
      country: "Morocco",
      industry: "IT",
      estimatedValue: 100_000,
      extractedText: "ISO 27001 mandatory",
    });

    const simulated = simulateTenderDecision(snapshot, {
      requirements: [{ id: "r1", status: "MATCHED" }],
      profile: { certifications: ["ISO 27001", "ISO 9001"] },
    });

    assert.equal(simulated.current.displayLabel, "NO-BID");
    assert.ok(simulated.simulated);
    assert.equal(simulated.simulated!.isSimulated, true);
    assert.notEqual(simulated.simulated!.displayLabel, "NO-BID");
    assert.equal(simulated.diff.decisionChanged, true);
    assert.ok(simulated.diff.summaryReason.includes("SIMULATED"));
  });

  it("unchanged decision reports no decision change", () => {
    const canonical = minimalCanonical();
    assert.equal(canonical.decision, "NO_BID");
    const snapshot = buildSimulationSnapshot({
      canonical,
      profile: profile({ certifications: ["NOT_HELD: ISO 27001", "ISO 9001"] }),
      country: "Morocco",
      industry: "IT",
      estimatedValue: 100_000,
      extractedText: "test",
    });

    const result = simulateTenderDecision(snapshot, {
      requirements: [{ id: "r2", status: "UNCERTAIN" }],
    });
    assert.equal(result.diff.noDecisionChange, true);
    assert.equal(result.diff.decisionChanged, false);
    assert.ok(result.diff.summaryReason.includes("No decision change"));
  });

  it("applySimulationOverrides does not mutate the original snapshot", () => {
    const canonical = minimalCanonical();
    const snapshot = buildSimulationSnapshot({
      canonical,
      profile: profile(),
      country: "Morocco",
      industry: "IT",
      estimatedValue: 100_000,
      extractedText: "test",
    });
    const beforeStatus = snapshot.requirements[0]!.status;
    applySimulationOverrides(snapshot, {
      requirements: [{ id: "r1", status: "MATCHED" }],
    });
    assert.equal(snapshot.requirements[0]!.status, beforeStatus);
  });

  it("uses production runTenderDecisionEngine rules — not arbitrary point math", () => {
    const requirements = [
      req("a", {
        description: "Web and API development experience",
        status: "MATCHED",
      }),
    ];
    const canonical = minimalCanonical({
      decision: "REVIEW",
      requirements: requirements.map((r, i) => ({
        id: r.id!,
        category: r.category,
        description: r.description,
        mandatory: r.mandatory,
        value: r.value,
        status: r.status,
        sourcePage: 1,
        sourceSection: "1",
        evidence: r.evidence ?? null,
        sortOrder: i,
      })),
    });

    const snapshot = buildSimulationSnapshot({
      canonical,
      profile: profile(),
      country: "Morocco",
      industry: "IT",
      estimatedValue: 200_000,
      extractedText: "Web and API",
    });

    const simulated = simulateTenderDecision(snapshot, {
      requirements: [{ id: "a", status: "UNCERTAIN" }],
    });

    const directUncertain = runTenderDecisionEngine({
      profile: profile(),
      requirements: [{ ...requirements[0]!, status: "UNCERTAIN" }],
      estimatedValue: 200_000,
      tenderContext: {
        title: "Dev",
        client: "Gov",
        country: "Morocco",
        industry: "IT",
        tenderText: "Web and API",
      },
      ai: null,
    });

    assert.equal(simulated.simulated!.decision, directUncertain.decision);
  });

  it("UNKNOWN readiness stays UNKNOWN when profile is sparse and requirement is MISSING", () => {
    const sparseCanonical = minimalCanonical({
      requirements: [
        {
          id: "u1",
          category: "Technical",
          description: "Obscure specialty capability",
          mandatory: false,
          value: null,
          status: "UNCERTAIN",
          sourcePage: 1,
          sourceSection: null,
          evidence: null,
          sortOrder: 0,
        },
      ],
    });

    const snapshot = buildSimulationSnapshot({
      canonical: sparseCanonical,
      profile: profile({
        industry: null,
        country: null,
        companySize: null,
        experienceLevel: null,
        experienceYears: null,
        services: [],
        certifications: [],
      }),
      country: null,
      industry: null,
      estimatedValue: null,
      extractedText: "",
    });

    const result = simulateTenderDecision(snapshot, {
      requirements: [{ id: "u1", status: "MISSING" }],
    });

    const readinessItem = result.simulated?.readiness.items.find((i) => i.id === "u1");
    assert.ok(readinessItem);
    assert.equal(readinessItem!.status, "UNKNOWN");
  });
});
