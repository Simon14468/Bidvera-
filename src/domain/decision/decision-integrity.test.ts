/**
 * Prompt 5 — Decision Engine integrity: BID / REVIEW / NO_BID from canonical Fit/Risk.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runDecisionEngine } from "@/domain/decision/engine";
import {
  assertDecisionIntegrity,
  collectMaterialHardBlockers,
  resolveCanonicalDecision,
  underlyingDecisionIssueKey,
} from "@/domain/decision/decision-integrity";
import {
  finalizeTenderDecision,
  refineDecisionWithEvidence,
  runCoreDecisionEngine,
} from "@/domain/decision/tender-decision-engine";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";
import {
  buildSimulationSnapshot,
  simulateTenderDecision,
} from "@/domain/decision-simulator";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import type { CanonicalTenderAnalysis } from "@/domain/tender-intelligence/canonical";

function profile(overrides: Partial<RuleCompanyProfile> = {}): RuleCompanyProfile {
  return {
    companyName: "Acme",
    industry: "IT",
    country: "Morocco",
    companySize: "51-200",
    experienceLevel: "experienced",
    services: ["software development", "web", "api"],
    certifications: ["ISO 27001", "ISO 9001"],
    experienceYears: 10,
    revenueRange: "5m-10m",
    employeeRange: "51-200",
    geographicCoverage: ["Morocco", "Africa"],
    contractSizeMin: null,
    contractSizeMax: 5_000_000,
    customQualificationRules: [],
    ...overrides,
  };
}

function req(
  partial: Partial<RuleRequirement> & Pick<RuleRequirement, "description" | "status">,
): RuleRequirement {
  const evidence =
    partial.evidence ??
    (partial.status === "FAILED"
      ? "Company profile explicitly states certification is not held."
      : partial.status === "MATCHED"
        ? "Listed in company profile services."
        : null);
  return {
    category: "Technical",
    mandatory: true,
    value: null,
    evidence,
    sourceDocument:
      partial.sourceDocument ??
      (partial.status === "FAILED" || partial.status === "MATCHED"
        ? "Company_Profile.pdf"
        : undefined),
    ...partial,
  };
}

describe("decision integrity — outcomes", () => {
  it("clear BID when mandatory requirements are confirmed fit", () => {
    const out = runDecisionEngine({
      profile: profile(),
      requirements: [
        req({
          description: "Web and API development experience",
          status: "MATCHED",
          evidence: "Listed in company profile services.",
          sourceDocument: "Company_Profile.pdf",
        }),
        req({
          description: "ISO 27001 certification mandatory",
          status: "MATCHED",
          category: "Certification",
          evidence: "ISO 27001 held",
          sourceDocument: "Company_Profile.pdf",
        }),
      ],
      estimatedValue: 250_000,
      tenderContext: {
        title: "Portal",
        client: "Gov",
        country: "Morocco",
        industry: "IT",
        tenderText: "Web API ISO 27001 Morocco IT software development",
      },
    });
    assert.equal(out.decision, "BID");
    assert.equal(out.hardFailure, false);
    assert.ok(out.explainability);
    assert.ok(out.explainability!.supportingFits.length >= 1);
    assert.equal(out.explainability!.confirmedBlockers.length, 0);
  });

  it("clear NO_BID from confirmed mandatory blocker", () => {
    const out = runDecisionEngine({
      profile: profile({ certifications: ["NOT_HELD: ISO 27001", "ISO 9001"] }),
      requirements: [
        req({
          description: "ISO 27001 certification mandatory",
          status: "UNCERTAIN",
          category: "Certification",
          evidence: "not_held: ISO 27001",
          sourceDocument: "Company_Profile.pdf",
        }),
      ],
      estimatedValue: 100_000,
      tenderContext: {
        title: "Secure RFP",
        client: "Gov",
        country: "Morocco",
        industry: "IT",
        tenderText: "ISO 27001 required",
      },
    });
    assert.equal(out.decision, "NO_BID");
    assert.equal(out.hardFailure, true);
    assert.ok(out.hardBlockers && out.hardBlockers.length >= 1);
    assert.ok(out.failedRequirements.some((r) => r.fitStatus === "CONFIRMED_GAP"));
  });

  it("REVIEW from unresolved verification — never NO_BID", () => {
    const out = runDecisionEngine({
      profile: profile({ certifications: ["ISO 9001"] }),
      requirements: [
        req({
          description: "ISO 27001 certification mandatory",
          status: "UNCERTAIN",
          category: "Certification",
          evidence: null,
        }),
        req({
          description: "Web development",
          status: "MATCHED",
        }),
      ],
      estimatedValue: 100_000,
      tenderContext: {
        title: "Portal",
        client: "X",
        country: "Morocco",
        industry: "IT",
        tenderText: "ISO 27001 web development Morocco IT",
      },
    });
    assert.equal(out.decision, "REVIEW");
    assert.equal(out.hardFailure, false);
    assert.ok(out.explainability!.verificationItems.length >= 1);
    assert.notEqual(out.decision, "NO_BID");
  });

  it("missing evidence is not NO_BID", () => {
    const out = runDecisionEngine({
      profile: profile({ certifications: [], experienceYears: null }),
      requirements: [
        req({
          description: "Specialized HCI platform experience",
          status: "UNCERTAIN",
          evidence: null,
        }),
      ],
      estimatedValue: null,
    });
    assert.notEqual(out.decision, "NO_BID");
    assert.equal(out.hardFailure, false);
  });

  it("confirmed fit never contributes a negative blocker", () => {
    const blockers = collectMaterialHardBlockers({
      requirements: [
        req({
          description: "ISO 9001",
          status: "MATCHED",
          fitStatus: "CONFIRMED_FIT",
          evidence: "held",
          sourceDocument: "p.pdf",
        }),
      ],
      findings: [],
    });
    assert.equal(blockers.length, 0);
  });

  it("confirmed gap on mandatory is a hard blocker", () => {
    const blockers = collectMaterialHardBlockers({
      requirements: [
        {
          ...req({
            description: "ISO 27001 mandatory",
            status: "FAILED",
            fitStatus: "CONFIRMED_GAP",
            evidence: "not_held: ISO 27001",
            sourceDocument: "Company_Profile.pdf",
          }),
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
      ],
    });
    assert.ok(blockers.length >= 1);
    assert.equal(new Set(blockers.map((b) => b.underlyingKey)).size, blockers.length);
  });

  it("optional requirement is not a hard blocker", () => {
    const blockers = collectMaterialHardBlockers({
      requirements: [
        req({
          description: "Preferred cloud experience",
          status: "FAILED",
          mandatory: false,
          fitStatus: "CONFIRMED_GAP",
          category: "PREFERRED",
          semanticKind: "EVALUATION_CRITERION",
        }),
      ],
      findings: [],
    });
    assert.equal(blockers.length, 0);
  });

  it("conditional / informational requirements do not hard-block", () => {
    const blockers = collectMaterialHardBlockers({
      requirements: [
        req({
          description: "Submission deadline 30 September",
          status: "UNCERTAIN",
          fitStatus: "NOT_APPLICABLE",
          semanticKind: "DEADLINE",
          category: "INFORMATIONAL",
          mandatory: false,
        }),
      ],
      findings: [],
    });
    assert.equal(blockers.length, 0);
  });

  it("duplicate requirements representing one issue do not double-count", () => {
    const blockers = collectMaterialHardBlockers({
      requirements: [
        req({
          id: "r1",
          description: "ISO 27001 certification is mandatory",
          status: "FAILED",
          fitStatus: "CONFIRMED_GAP",
          evidence: "not_held: ISO 27001",
          sourceDocument: "Company_Profile.pdf",
        }),
        req({
          id: "r2",
          description: "Bidder must hold ISO 27001",
          status: "FAILED",
          fitStatus: "CONFIRMED_GAP",
          evidence: "not_held: ISO 27001",
          sourceDocument: "Company_Profile.pdf",
        }),
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
    });
    assert.equal(blockers.length, 1);
    assert.equal(
      underlyingDecisionIssueKey({ description: "ISO 27001 certification is mandatory" }),
      underlyingDecisionIssueKey({ description: "Bidder must hold ISO 27001" }),
    );
  });

  it("financial/commercial blocker yields NO_BID", () => {
    const out = runDecisionEngine({
      profile: profile({ revenueRange: "100k-500k" }),
      requirements: [
        req({
          description: "Annual turnover not less than £5m mandatory",
          status: "UNCERTAIN",
          category: "Commercial",
          evidence: "Tender §4",
        }),
      ],
      estimatedValue: 2_000_000,
      tenderContext: {
        title: "Large RFP",
        client: "Gov",
        country: "Morocco",
        industry: "IT",
        tenderText: "Annual turnover not less than £5m mandatory",
      },
    });
    assert.equal(out.decision, "NO_BID");
    assert.equal(out.hardFailure, true);
  });

  it("deadline constraint downgrades BID to REVIEW — not NO_BID from missing evidence", () => {
    const engine = runDecisionEngine({
      profile: profile(),
      requirements: [
        req({ description: "Software delivery", status: "MATCHED" }),
        req({
          description: "ISO 27001",
          status: "MATCHED",
          category: "Certification",
          evidence: "Held",
        }),
      ],
      estimatedValue: 200_000,
      tenderContext: {
        title: "Late RFP",
        client: "X",
        country: "Morocco",
        industry: "IT",
        tenderText: "software delivery IT Morocco ISO 27001",
      },
    });
    const refined = refineDecisionWithEvidence({
      engine: { ...engine, decision: "BID", hardFailure: false },
      aiParticipated: false,
      deadline: new Date("2020-01-01T00:00:00Z"),
      asOf: new Date("2026-08-31T00:00:00Z"),
    });
    assert.equal(refined.decision, "REVIEW");
    assert.ok(refined.refinementReasons.some((r) => r.code === "DEADLINE_PASSED"));
  });

  it("AI recommendation conflicting with canonical evidence cannot force BID or invent NO_BID", () => {
    const blocked = runDecisionEngine({
      profile: profile({ certifications: ["NOT_HELD: ISO 27001", "ISO 9001"] }),
      requirements: [
        req({
          description: "ISO 27001 certification mandatory",
          status: "UNCERTAIN",
          category: "Certification",
          evidence: "not_held: ISO 27001",
          sourceDocument: "Company_Profile.pdf",
        }),
      ],
      estimatedValue: 50_000,
      ai: {
        suggestedDecision: "BID",
        fitScore: 95,
        confidence: "HIGH",
        reasoning: "Looks great — ignore gaps.",
      },
      tenderContext: {
        title: "Secure",
        client: "Gov",
        country: "Morocco",
        industry: "IT",
        tenderText: "ISO 27001 required",
      },
    });
    assert.equal(blocked.decision, "NO_BID");
    assert.equal(blocked.hardFailure, true);

    const softNoBid = runDecisionEngine({
      profile: profile(),
      requirements: [
        req({ description: "Web development", status: "MATCHED" }),
        req({
          description: "ISO 27001",
          status: "MATCHED",
          category: "Certification",
          evidence: "Held",
        }),
      ],
      estimatedValue: 150_000,
      ai: {
        suggestedDecision: "NO_BID",
        fitScore: 20,
        confidence: "HIGH",
        reasoning: "I feel this is a no-bid.",
      },
      tenderContext: {
        title: "Portal",
        client: "X",
        country: "Morocco",
        industry: "IT",
        tenderText: "web development ISO 27001 Morocco IT",
      },
    });
    assert.notEqual(softNoBid.decision, "NO_BID");
  });

  it("explainability inputs are exposed for Explainable Decision", () => {
    const out = runDecisionEngine({
      profile: profile({ certifications: ["ISO 9001"] }),
      requirements: [
        req({
          description: "ISO 27001 certification mandatory",
          status: "UNCERTAIN",
          category: "Certification",
        }),
        req({ description: "API integration", status: "MATCHED" }),
      ],
      estimatedValue: 100_000,
      tenderContext: {
        title: "API RFP",
        client: "Bank",
        country: "Morocco",
        industry: "IT",
        tenderText: "ISO 27001 API integration Morocco IT",
      },
    });
    assert.ok(out.explainability);
    assert.ok(Array.isArray(out.explainability!.verificationItems));
    assert.ok(Array.isArray(out.explainability!.supportingFits));
    assert.ok(Array.isArray(out.explainability!.confirmedBlockers));
    const finalized = finalizeTenderDecision({
      engine: out,
      aiParticipated: false,
    });
    assert.ok(finalized.recommendation.reasons.length > 0);
    assert.ok(finalized.recommendation.factors.some((f) => f.key === "fit"));
  });

  it("assertDecisionIntegrity rejects NO_BID from verification-only", () => {
    assert.throws(() =>
      assertDecisionIntegrity({
        decision: "NO_BID",
        hardFailure: false,
        blockers: [],
        requirements: [
          req({
            description: "ISO 27001",
            status: "UNCERTAIN",
            fitStatus: "NEEDS_VERIFICATION",
          }),
        ],
        findings: [],
      }),
    );
  });

  it("assertDecisionIntegrity rejects BID with confirmed mandatory gap", () => {
    assert.throws(() =>
      assertDecisionIntegrity({
        decision: "BID",
        hardFailure: false,
        blockers: [],
        requirements: [
          req({
            description: "ISO 27001 mandatory",
            status: "FAILED",
            fitStatus: "CONFIRMED_GAP",
            mandatory: true,
          }),
        ],
        findings: [],
      }),
    );
  });
});

describe("decision integrity — simulator consistency", () => {
  it("Simulator uses same canonical decision rules as baseline engine", () => {
    const requirements = [
      {
        id: "r1",
        category: "Certification",
        description: "ISO 27001 certification mandatory",
        mandatory: true,
        value: null as string | null,
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
        value: null as string | null,
        status: "MATCHED" as const,
        sourcePage: 2,
        sourceSection: "4.1",
        evidence: "Profile match",
        sortOrder: 1,
      },
    ];

    const ruleReqs = requirements.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      mandatory: r.mandatory,
      value: r.value,
      status: r.status,
      evidence: r.evidence,
      sourceDocument: r.id === "r1" ? "Company_Profile.pdf" : "Company_Profile.pdf",
    }));

    const p = profile({ certifications: ["NOT_HELD: ISO 27001", "ISO 9001"] });
    const baseline = runCoreDecisionEngine({
      profile: p,
      requirements: ruleReqs,
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
    assert.equal(baseline.decision, "NO_BID");

    const readiness = computeTenderReadiness({
      requirements: baseline.requirements,
      missingDocuments: [],
      fit: baseline.fitBreakdown,
      profileHasAnyCapability: true,
    });
    const intelligence = buildTenderIntelligence({
      tenderId: "t-sim",
      documentName: "RFP.pdf",
      tenderDeadline: null,
      extractedText: "ISO 27001 mandatory",
      requirements: requirements.map((r) => ({
        ...r,
        fitStatus: baseline.requirements.find((x) => x.id === r.id)?.fitStatus,
        sourceDocument: "Company_Profile.pdf",
      })),
      evidence: [],
      readiness,
      findings: baseline.findings,
      existingRisks: [],
      decision: baseline.decision,
      fitScore: baseline.fitScore,
    });
    const finalized = finalizeTenderDecision({
      engine: baseline,
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
        severity: r.severityCanonical ?? r.severity,
        evidenceState: r.evidenceState ?? null,
        fitStatus: r.fitStatus ?? null,
      })),
    });

    const canonical: CanonicalTenderAnalysis = {
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
      fitBreakdown: finalized.fitBreakdown,
      readiness,
      intelligence,
      bidScore: {
        score: 0,
        scoringAvailable: false,
        priority: "VERY_LOW",
        priorityLabel: "UNAVAILABLE",
        interpretation: "Not scored in this fixture.",
        expectedValue: "UNKNOWN",
        expectedValueNote: "",
        contractValue: null,
        contractValueLabel: "Contract value: Unknown",
        contractValueProvenance: "UNKNOWN",
        pursuitCost: null,
        pursuitCostLabel: "Pursuit cost: Unknown",
        pursuitCostProvenance: "UNKNOWN",
        winProbabilityLabel: "Win probability: Not available",
        winProbabilityProvenance: "UNKNOWN",
        effort: "UNKNOWN",
        effortNote: "",
        riskLevel: "UNKNOWN",
        drivers: [],
        reducedCertainty: true,
        certaintyNote: null,
        disclaimer: "Fixture only.",
      },
      requirements,
      evidence: [],
      risks: [],
      missingDocuments: [],
      nextActions: [],
      historicalSignals: [],
    };

    const snapshot = buildSimulationSnapshot({
      canonical,
      profile: p,
      country: "Morocco",
      industry: "IT",
      estimatedValue: 100_000,
      extractedText: "ISO 27001 mandatory",
    });

    // Simulation that does not remove the cert gap must preserve NO_BID under same rules
    const simulated = simulateTenderDecision(snapshot, {
      requirements: [{ id: "r2", status: "UNCERTAIN" }],
    });
    assert.equal(simulated.current.displayLabel, "NO-BID");
    assert.equal(simulated.simulated!.decision, "NO_BID");
    assert.equal(simulated.diff.noDecisionChange, true);
  });
});

describe("decision integrity — resolveCanonicalDecision", () => {
  it("never forces BID merely because no blocker was found when fit suggests REVIEW", () => {
    const result = resolveCanonicalDecision({
      requirements: [
        req({
          description: "Obscure specialty",
          status: "UNCERTAIN",
          fitStatus: "NEEDS_VERIFICATION",
        }),
      ],
      findings: [],
      fitSuggestedDecision: "REVIEW",
      aiSuggestedDecision: "BID",
    });
    assert.equal(result.decision, "REVIEW");
    assert.equal(result.hardFailure, false);
  });
});
