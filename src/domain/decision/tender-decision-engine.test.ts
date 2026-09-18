import assert from "node:assert/strict";
import test from "node:test";
import { runDecisionEngine } from "@/domain/decision/engine";
import {
  assertRecommendationConsistency,
  buildTenderDecisionRecommendation,
  finalizeTenderDecision,
  refineDecisionWithEvidence,
  runTenderDecisionEngine,
  toTenderDecisionLabel,
} from "@/domain/decision/tender-decision-engine";
import { localizeTenderDecisionLabel } from "@/domain/decision/labels";
import { getDecisionLabel } from "@/lib/labels";
import { decisionMemoryLabel } from "@/domain/decision-memory";
import type { RuleCompanyProfile, RuleRequirement } from "@/domain/decision/types";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import { deriveCanonicalReportSections, FULL_REPORT_FEATURE_ACCESS } from "@/services/reports/report-canonical-view";
import type { TenderReport } from "@/services/reports/types";

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
        : "From tender §3");
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

test("labels: BID/REVIEW/NO_BID map to GO / CONDITIONAL GO / NO-BID everywhere", () => {
  assert.equal(toTenderDecisionLabel("BID"), "GO");
  assert.equal(toTenderDecisionLabel("REVIEW"), "CONDITIONAL GO");
  assert.equal(toTenderDecisionLabel("NO_BID"), "NO-BID");
  assert.equal(decisionMemoryLabel("BID"), "GO");
  assert.equal(getDecisionLabel("BID", "en"), "GO");
  assert.equal(getDecisionLabel("REVIEW", "en"), "CONDITIONAL GO");
  assert.equal(getDecisionLabel("NO_BID", "en"), "NO-BID");
  assert.equal(localizeTenderDecisionLabel("REVIEW", "ar"), "انطلاق مشروط");
});

test("hard mandatory cert failure → NO-BID with critical blockers", () => {
  const engine = runDecisionEngine({
    profile: profile({ certifications: ["NOT_HELD: ISO 27001", "ISO 9001"] }),
    requirements: [
      req({
        description: "ISO 27001 certification mandatory",
        status: "UNCERTAIN",
        category: "Certification",
        sourceDocument: "Company_Profile.pdf",
        evidence: "not_held: ISO 27001",
      }),
    ],
    estimatedValue: 100_000,
    tenderContext: {
      title: "Secure platform",
      client: "Gov",
      country: "Morocco",
      industry: "IT",
      tenderText: "ISO 27001 certification mandatory",
    },
  });
  const result = finalizeTenderDecision({
    engine,
    aiParticipated: false,
  });
  assert.equal(result.displayLabel, "NO-BID");
  assert.equal(result.decision, "NO_BID");
  assert.equal(result.hardFailure, true);
  assert.ok(result.recommendation.criticalBlockers.length > 0);
  assertRecommendationConsistency(result.recommendation);
});

test("strong fit without blockers can yield GO", () => {
  const result = runTenderDecisionEngine({
    profile: profile(),
    requirements: [
      req({
        description: "Web and API development experience",
        status: "MATCHED",
        evidence: "Company profile lists web and API",
      }),
      req({
        description: "ISO 27001",
        status: "MATCHED",
        category: "Certification",
        evidence: "Held ISO 27001",
      }),
    ],
    estimatedValue: 200_000,
    tenderContext: {
      title: "Web platform RFP",
      client: "Bank",
      country: "Morocco",
      industry: "IT",
      tenderText: "Web and API development ISO 27001 Morocco",
    },
  });
  assert.ok(["GO", "CONDITIONAL GO"].includes(result.displayLabel));
  if (result.displayLabel === "GO") {
    assert.equal(result.decision, "BID");
  }
  assert.ok(result.recommendation.reasons.length > 0);
  assert.ok(result.recommendation.factors.some((f) => f.key === "fit"));
});

test("GO downgrades to CONDITIONAL GO when readiness missing items exist", () => {
  const engine = runDecisionEngine({
    profile: profile(),
    requirements: [
      req({
        description: "Web development",
        status: "MATCHED",
        evidence: "Listed",
      }),
    ],
    estimatedValue: 150_000,
    tenderContext: {
      title: "Portal",
      client: "X",
      country: "Morocco",
      industry: "IT",
      tenderText: "web development portal Morocco IT software",
    },
  });
  // Force a BID-looking engine output only when fit suggests it; otherwise skip
  const refined = refineDecisionWithEvidence({
    engine: { ...engine, decision: "BID", hardFailure: false },
    aiParticipated: false,
    readiness: {
      score: 55,
      counts: { ready: 2, missing: 3, verify: 1, unknown: 0 },
      attention: ["Missing bank guarantee"],
      recommendation: "Resolve missing items",
    },
  });
  assert.equal(refined.decision, "REVIEW");
  assert.ok(refined.refinementReasons.some((r) => r.code === "READINESS_MISSING"));
});

test("Decision Memory never overrides current evidence", () => {
  const engine = runDecisionEngine({
    profile: profile({ certifications: ["NOT_HELD: ISO 27001", "ISO 9001"] }),
    requirements: [
      req({
        description: "ISO 27001 certification required",
        status: "UNCERTAIN",
        category: "Certification",
        evidence: "not_held: ISO 27001",
        sourceDocument: "Company_Profile.pdf",
      }),
    ],
    estimatedValue: 50_000,
    tenderContext: {
      title: "Secure RFP",
      client: "Gov",
      country: "Morocco",
      industry: "IT",
      tenderText: "ISO 27001 required",
    },
  });
  assert.equal(engine.decision, "NO_BID");

  const rec = buildTenderDecisionRecommendation({
    engine,
    aiParticipated: false,
    memoryInsights: {
      computed: true,
      matches: [
        {
          memoryId: "m1",
          tenderId: "t-old",
          title: "Prior similar win",
          client: "Gov",
          decision: "BID",
          decisionLabel: "GO",
          fitScore: 90,
          readinessScore: 80,
          bidScore: 85,
          reasoning: "Won previously",
          similarity: 0.9,
          relevanceReasons: ["Same industry band"],
          analyzedAt: new Date().toISOString(),
          disclaimer: "Reference only",
        },
      ],
      emptyReason: null,
      currentAnalysisNote: "Current wins",
      historicalNote: "Historical is reference only",
    },
  });
  assert.equal(rec.displayLabel, "NO-BID");
  assert.equal(rec.decision, "NO_BID");
  const memoryFactor = rec.factors.find((f) => f.key === "memory");
  assert.ok(memoryFactor);
  assert.equal(memoryFactor!.influencedDecision, false);
  assert.equal(memoryFactor!.referenceOnly, true);
  assertRecommendationConsistency(rec);
});

test("deadline passed downgrades GO to CONDITIONAL GO", () => {
  const engine = runDecisionEngine({
    profile: profile(),
    requirements: [
      req({ description: "Software delivery", status: "MATCHED", evidence: "OK" }),
    ],
    estimatedValue: 100_000,
    tenderContext: {
      title: "Late RFP",
      client: "Y",
      country: "Morocco",
      industry: "IT",
      tenderText: "software delivery IT Morocco web api",
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

test("missing deadline is noted — never invented", () => {
  const engine = runDecisionEngine({
    profile: profile(),
    requirements: [
      req({ description: "Software", status: "MATCHED", evidence: "OK" }),
    ],
    estimatedValue: null,
    tenderContext: {
      title: "No deadline RFP",
      client: null,
      country: "Morocco",
      industry: "IT",
      tenderText: "software IT Morocco",
    },
  });
  const refined = refineDecisionWithEvidence({
    engine: { ...engine, decision: "BID", hardFailure: false },
    aiParticipated: false,
    deadline: null,
  });
  assert.ok(
    refined.missingDataNotes.some((n) => /deadline/i.test(n)),
  );
});

test("same inputs produce identical recommendation hash (deterministic)", () => {
  const input = {
    profile: profile(),
    requirements: [
      req({ description: "API integration", status: "MATCHED", evidence: "Listed" }),
      req({
        description: "ISO 27001",
        status: "MATCHED",
        category: "Certification",
        evidence: "Held",
      }),
    ],
    estimatedValue: 250_000,
    tenderContext: {
      title: "Determinism check",
      client: "Bank",
      country: "Morocco",
      industry: "IT",
      tenderText: "API integration ISO 27001 Morocco IT",
    },
  };
  const a = runTenderDecisionEngine(input, {
    readiness: {
      score: 80,
      counts: { ready: 5, missing: 0, verify: 1, unknown: 0 },
      attention: [],
      recommendation: "Proceed with verification",
    },
    compliance: {
      totalRequirements: 6,
      ready: 5,
      missing: 0,
      verify: 1,
      notApplicable: 0,
      unknown: 0,
      sources: 4,
      risks: 0,
      requiredActions: 1,
      clarifications: 0,
    },
    keyBlockers: [],
    deadline: new Date("2026-12-01T12:00:00Z"),
    asOf: new Date("2026-08-31T12:00:00Z"),
  });
  const b = runTenderDecisionEngine(input, {
    readiness: {
      score: 80,
      counts: { ready: 5, missing: 0, verify: 1, unknown: 0 },
      attention: [],
      recommendation: "Proceed with verification",
    },
    compliance: {
      totalRequirements: 6,
      ready: 5,
      missing: 0,
      verify: 1,
      notApplicable: 0,
      unknown: 0,
      sources: 4,
      risks: 0,
      requiredActions: 1,
      clarifications: 0,
    },
    keyBlockers: [],
    deadline: new Date("2026-12-01T12:00:00Z"),
    asOf: new Date("2026-08-31T12:00:00Z"),
  });
  assert.equal(a.decision, b.decision);
  assert.equal(a.displayLabel, b.displayLabel);
  assert.equal(a.recommendation.contentHash, b.recommendation.contentHash);
  assert.equal(a.fitScore, b.fitScore);
});

test("soft AI NO_BID without hard rules stays CONDITIONAL GO (engine invariant)", () => {
  const engine = runDecisionEngine({
    profile: profile(),
    requirements: [
      req({ description: "Web services", status: "MATCHED", evidence: "OK" }),
    ],
    estimatedValue: 100_000,
    tenderContext: {
      title: "Soft AI",
      client: "Z",
      country: "Morocco",
      industry: "IT",
      tenderText: "web services Morocco IT software development",
    },
    ai: {
      suggestedDecision: "NO_BID",
      fitScore: 30,
      confidence: "LOW",
      reasoning: "AI soft decline",
    },
  });
  assert.notEqual(engine.decision, "NO_BID");
  const final = finalizeTenderDecision({ engine, aiParticipated: true });
  assert.notEqual(final.displayLabel, "NO-BID");
});

test("report display labels stay consistent with Decision Memory and dashboard", () => {
  for (const d of ["BID", "REVIEW", "NO_BID"] as const) {
    assert.equal(getDecisionLabel(d, "en"), decisionMemoryLabel(d));
    assert.equal(getDecisionLabel(d, "en"), toTenderDecisionLabel(d));
  }
  assert.equal(getDecisionLabel("REVIEW", "en"), "CONDITIONAL GO");
  assert.equal(getDecisionLabel("REVIEW", "ar"), "انطلاق مشروط");

  // Minimal report path — same helper PDF/UI use
  const report = {
    companyKnowledgeOnly: false,
    decision: "REVIEW" as const,
    fitScore: 60,
    confidence: "MEDIUM" as const,
    reasoning: "Test",
    matched: [],
    failed: [],
    uncertain: [],
    risks: [],
    nextActions: [],
    documents: [],
    missingDocuments: [],
    evidence: [],
    intelligence: {
      complianceMatrix: [],
      complianceSummary: {
        totalRequirements: 0,
        ready: 0,
        missing: 0,
        verify: 0,
        notApplicable: 0,
        unknown: 0,
        sources: 0,
        risks: 0,
        requiredActions: 0,
        clarifications: 0,
      },
      risks: [],
      contradictions: [],
      clarificationQuestions: [],
      keyBlockers: [],
      decisionContext: "CONDITIONAL GO",
      learningSignal: null,
    },
    readiness: null,
    bidScore: null,
    title: "T",
    client: null,
    analyzedAt: new Date(),
  } as unknown as TenderReport;

  const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
  const en = buildReportDisplayContent(sections, "en");
  assert.equal(en.decisionLabel, "CONDITIONAL GO");
});

test("never upgrades NO-BID to GO via secondary evidence", () => {
  const engine = runDecisionEngine({
    profile: profile({ certifications: ["NOT_HELD: ISO 27001", "ISO 9001"] }),
    requirements: [
      req({
        description: "Must hold ISO 27001",
        status: "UNCERTAIN",
        category: "Certification",
        evidence: "not_held: ISO 27001",
        sourceDocument: "Company_Profile.pdf",
      }),
    ],
    estimatedValue: 10_000,
    tenderContext: {
      title: "Hard fail",
      client: "A",
      country: "Morocco",
      industry: "IT",
      tenderText: "ISO 27001 mandatory",
    },
  });
  const refined = refineDecisionWithEvidence({
    engine,
    aiParticipated: false,
    readiness: {
      score: 99,
      counts: { ready: 10, missing: 0, verify: 0, unknown: 0 },
      attention: [],
      recommendation: "Ready",
    },
    compliance: {
      totalRequirements: 1,
      ready: 1,
      missing: 0,
      verify: 0,
      notApplicable: 0,
      unknown: 0,
      sources: 1,
      risks: 0,
      requiredActions: 0,
      clarifications: 0,
    },
    keyBlockers: [],
    memoryInsights: {
      computed: true,
      matches: [],
      emptyReason: null,
      currentAnalysisNote: "",
      historicalNote: "",
    },
  });
  assert.equal(refined.decision, "NO_BID");
});
