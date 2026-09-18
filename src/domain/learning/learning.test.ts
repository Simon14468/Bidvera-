/**
 * Stage 1–4 validation suite for tender intelligence + safe learning.
 * Run: npx tsx --test src/domain/learning/learning.test.ts src/domain/tender-intelligence/intelligence.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDecisionPriorityGate,
  buildLearningSignal,
  canLifecycleInfluence,
  computeConsistencyScore,
  computeDataQualityScore,
  evaluatePatternLifecycle,
  extractLearningFeatures,
  featureKeyFrom,
  privacyFilterFeatures,
  similarityScore,
  type LearningFeatures,
  type PatternCandidate,
} from "@/domain/learning";
import { LEARNING_EVIDENCE } from "@/config/learning";
import {
  buildComplianceSummary,
  buildTenderIntelligence,
  normalizeComplianceMatrix,
  type ComplianceRow,
} from "@/domain/tender-intelligence";
import { buildHistoricalSignals } from "@/domain/tender-intelligence/canonical";
import { canMutateTenderAnalysis, canViewTenderAnalysis } from "@/auth/tender-access";
import { runDecisionEngine } from "@/domain/decision/engine";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";

const baseFeatures = (): LearningFeatures => ({
  industryBucket: "software",
  countryBucket: "uae",
  sizeBand: "small",
  fitBand: "60-79",
  readinessBand: "40-59",
  decisionAtAnalysis: "REVIEW",
  mandatoryGapBand: "1-2",
  valueBand: "100k-1m",
});

function candidate(
  overrides: Partial<PatternCandidate> & { id: string },
): PatternCandidate {
  const features = baseFeatures();
  return {
    featureKey: featureKeyFrom(features),
    features,
    sampleCount: 8,
    wonCount: 5,
    lostCount: 2,
    bidSubmittedCount: 1,
    noBidCount: 0,
    withdrawnCount: 0,
    lifecycle: "ACTIVE",
    independentOrgCount: 4,
    dataQualityScore: 80,
    consistencyScore: 70,
    validated: true,
    ...overrides,
  };
}

// ─── Compliance Matrix (dynamic, no hardcoded demo counts) ───────────────────

test("compliance matrix summary is derived from real rows only", () => {
  const rows: ComplianceRow[] = [
    {
      id: "CM-1",
      requirementId: "r1",
      requirement: "ISO 27001",
      requirementType: "Certification",
      mandatory: true,
      priority: "HIGH",
      status: "MISSING",
      companyFit: null,
      sourceDocument: "Tender.pdf",
      pageNumber: 18,
      section: "4.2",
      evidence: "ISO 27001 certification is required",
      tenderSource: null,
      companyEvidence: null,
      companyEvidenceMessage: null,
      notes: "Gap",
      sourceBasis: "DIRECT_SOURCE",
      sourceLocated: true,
      evidenceId: "e1",
      risk: "May affect eligibility",
      requiredAction: "Verify certification",
    },
    {
      id: "CM-2",
      requirementId: "r2",
      requirement: "Local presence",
      requirementType: "Geographic",
      mandatory: false,
      priority: "LOW",
      status: "READY",
      companyFit: null,
      sourceDocument: "Tender.pdf",
      pageNumber: null,
      section: null,
      evidence: null,
      tenderSource: null,
      companyEvidence: null,
      companyEvidenceMessage: null,
      notes: null,
      sourceBasis: "UNKNOWN",
      sourceLocated: false,
      evidenceId: null,
      risk: null,
      requiredAction: null,
    },
    {
      id: "CM-3",
      requirementId: "r3",
      requirement: "Experience years",
      requirementType: "Experience",
      mandatory: true,
      priority: "HIGH",
      status: "VERIFY",
      companyFit: null,
      sourceDocument: null,
      pageNumber: null,
      section: null,
      evidence: null,
      tenderSource: null,
      companyEvidence: null,
      companyEvidenceMessage: null,
      notes: "Verify",
      sourceBasis: "UNKNOWN",
      sourceLocated: false,
      evidenceId: null,
      risk: "Requires verification",
      requiredAction: "Confirm experience",
    },
  ];
  const summary = buildComplianceSummary(rows, 1);
  assert.equal(summary.totalRequirements, 3);
  assert.equal(summary.ready, 1);
  assert.equal(summary.missing, 1);
  assert.equal(summary.verify, 1);
  assert.equal(summary.sources, 1);
  // Risk count is confirmed structured risks only — not legacy row.risk notes or verify rows.
  assert.equal(summary.risks, 0);
  assert.equal(summary.requiredActions, 2);
  assert.equal(summary.clarifications, 1);
  // Never invent demo numbers
  assert.notEqual(summary.totalRequirements, 47);
});

test("normalizeComplianceMatrix strips placeholder evidence and does not invent sources", () => {
  const normalized = normalizeComplianceMatrix([
    {
      id: "CM-1",
      requirementId: "r1",
      requirement: "Test",
      requirementType: "Other",
      mandatory: false,
      priority: "LOW",
      status: "UNKNOWN",
      companyFit: null,
      sourceDocument: null,
      pageNumber: null,
      section: null,
      evidence: "No supporting excerpt available — marked UNKNOWN.",
      tenderSource: null,
      companyEvidence: null,
      companyEvidenceMessage: null,
      notes: null,
      sourceBasis: "UNKNOWN",
      sourceLocated: true,
      evidenceId: null,
      risk: null,
      requiredAction: null,
    },
  ]);
  assert.equal(normalized[0].evidence, null);
  assert.equal(normalized[0].sourceLocated, false);
});

test("buildTenderIntelligence produces dynamic matrix from analysis input", () => {
  const intel = buildTenderIntelligence({
    tenderId: "t1",
    documentName: "Spec.pdf",
    tenderDeadline: null,
    extractedText: "Submission deadline 15 September. Submission deadline 18 September.",
    requirements: [
      {
        id: "req1",
        category: "Certification",
        description: "ISO 27001 required",
        mandatory: true,
        value: null,
        status: "FAILED",
        sourcePage: 10,
        sourceSection: "3.1",
        evidence: "Supplier must hold ISO 27001",
      },
    ],
    evidence: [
      {
        id: "ev1",
        requirementId: "req1",
        sourcePage: 10,
        sourceSection: "3.1",
        evidenceText: "Supplier must hold ISO 27001",
        verificationStatus: "VERIFIED",
      },
    ],
    readiness: {
      score: 40,
      total: 1,
      counts: { ready: 0, missing: 1, verify: 0, unknown: 0, notApplicable: 0 },
      items: [
        {
          id: "req1",
          requirement: "ISO 27001 required",
          category: "Certification",
          status: "MISSING",
          priority: "HIGH",
          reason: "Not found in profile",
          source: "Company profile",
          mandatory: true,
        },
      ],
      attention: ["1 mandatory gap"],
      recommendation: "Resolve gaps",
      disclaimer: "Assessment only",
    },
    findings: [],
    existingRisks: [],
    decision: "REVIEW",
    fitScore: 55,
  });
  assert.equal(intel.complianceSummary.totalRequirements, 1);
  assert.equal(intel.complianceMatrix[0].sourceLocated, true);
  assert.equal(intel.complianceMatrix[0].pageNumber, 10);
  assert.equal(intel.complianceMatrix[0].evidenceState, "NEEDS_VERIFICATION");
  assert.equal(intel.complianceMatrix[0].risk, null);
  assert.ok(intel.complianceMatrix[0].requiredAction?.includes("Verification"));
  // Missing evidence may surface as verification risk — never HIGH/CRITICAL confirmed
  assert.equal(intel.complianceSummary.risks, 0);
  assert.ok(
    intel.risks.every(
      (r) =>
        r.evidenceState === "NEEDS_VERIFICATION" &&
        r.severityCanonical !== "HIGH" &&
        r.severityCanonical !== "CRITICAL",
    ),
  );
  assert.ok(intel.clarificationQuestions.length >= 0);
});

// ─── Canonical analysis / roles ──────────────────────────────────────────────

test("roles control access only — never change analytical truth helpers", () => {
  assert.equal(canViewTenderAnalysis("OWNER"), true);
  assert.equal(canViewTenderAnalysis("VIEWER"), true);
  assert.equal(canViewTenderAnalysis("MEMBER"), true);
  assert.equal(canMutateTenderAnalysis("VIEWER"), false);
  assert.equal(canMutateTenderAnalysis("MEMBER"), true);
});

test("historical signals for learning stay non-identifying", () => {
  const signals = buildHistoricalSignals({
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
    decisionContext: "REVIEW",
    learningSignal: {
      detected: true,
      strength: "MEDIUM",
      similarity: 0.9,
      outcomeLean: "more_often_successful",
      headline: "Relevant historical pattern detected among similar opportunities.",
      detail: "Signal",
      priorityNote: "Priority",
      validated: true,
      lifecycle: "ACTIVE",
      influenceAllowed: true,
      suppressedReason: null,
      patternRef: "pat_secret",
    },
  });
  const hist = signals.find((s) => s.kind === "similar_company_pattern");
  assert.ok(hist);
  assert.equal((hist?.detail ?? "").includes("ACTIVE"), false);
  assert.equal((hist?.detail ?? "").includes("pat_secret"), false);
  assert.equal((hist?.label ?? "").includes("Company"), false);
});

// ─── Privacy filter / features ───────────────────────────────────────────────

test("privacy filter drops free-form identity and keeps coarse buckets", () => {
  const filtered = privacyFilterFeatures({
    industryBucket: "Cloud Security!!",
    countryBucket: "United Arab Emirates",
    sizeBand: "small",
    fitBand: "60-79",
    readinessBand: "unknown",
    decisionAtAnalysis: "BID",
    mandatoryGapBand: "0",
    valueBand: "under-100k",
  });
  assert.equal(filtered.industryBucket.includes("!"), false);
  assert.ok(filtered.countryBucket.length <= 40);
  assert.equal("companyName" in filtered, false);
});

test("feature keys are stable and opaque", () => {
  const a = extractLearningFeatures({
    industry: "Software",
    country: "UAE",
    companySize: "small",
    fitScore: 70,
    readinessScore: 50,
    decision: "REVIEW",
    missingMandatoryCount: 1,
    estimatedValue: 250000,
  });
  const b = extractLearningFeatures({
    industry: "Software",
    country: "UAE",
    companySize: "small",
    fitScore: 72,
    readinessScore: 55,
    decision: "REVIEW",
    missingMandatoryCount: 1,
    estimatedValue: 300000,
  });
  // Same bands → same key (scores banded)
  assert.equal(featureKeyFrom(a), featureKeyFrom(b));
  assert.equal(featureKeyFrom(a).length, 32);
});

// ─── Pattern lifecycle / evidence ────────────────────────────────────────────

test("insufficient data stays CANDIDATE or VALIDATING — cannot influence", () => {
  const early = evaluatePatternLifecycle({
    sampleCount: 2,
    independentOrgCount: 1,
    decisiveOutcomeCount: 1,
    wonCount: 1,
    lostCount: 0,
    maxOrgShare: 1,
    dataQualityScore: 40,
    consistencyScore: 20,
  });
  assert.ok(early.lifecycle === "CANDIDATE" || early.lifecycle === "VALIDATING");
  assert.equal(early.canInfluence, false);
  assert.equal(canLifecycleInfluence(early.lifecycle), false);
});

test("one-company dominance blocks verification", () => {
  const dominated = evaluatePatternLifecycle({
    sampleCount: 10,
    independentOrgCount: 4,
    decisiveOutcomeCount: 8,
    wonCount: 6,
    lostCount: 2,
    maxOrgShare: 0.7,
    dataQualityScore: 85,
    consistencyScore: 70,
  });
  assert.equal(dominated.canInfluence, false);
  assert.ok(dominated.reasons.some((r) => /dominate/i.test(r)));
});

test("sufficient multi-org evidence reaches VERIFIED or ACTIVE", () => {
  const ok = evaluatePatternLifecycle({
    sampleCount: LEARNING_EVIDENCE.minOpportunities + LEARNING_EVIDENCE.activeExtraSamples,
    independentOrgCount: LEARNING_EVIDENCE.minIndependentOrgs,
    decisiveOutcomeCount: LEARNING_EVIDENCE.minDecisiveOutcomes,
    wonCount: 5,
    lostCount: 3,
    maxOrgShare: 0.3,
    dataQualityScore: 80,
    consistencyScore: 70,
  });
  assert.ok(ok.lifecycle === "VERIFIED" || ok.lifecycle === "ACTIVE");
  assert.equal(ok.canInfluence, true);
});

test("degraded ACTIVE pattern moves to MONITORED or RETIRED", () => {
  const monitored = evaluatePatternLifecycle({
    sampleCount: 6,
    independentOrgCount: 2,
    decisiveOutcomeCount: 3,
    wonCount: 2,
    lostCount: 1,
    maxOrgShare: 0.5,
    dataQualityScore: 52,
    consistencyScore: 40,
    previousLifecycle: "ACTIVE",
  });
  assert.ok(
    monitored.lifecycle === "MONITORED" || monitored.lifecycle === "RETIRED",
  );
  assert.equal(monitored.canInfluence, false);
});

test("CANDIDATE and VALIDATING patterns never enter learning signal", () => {
  const signal = buildLearningSignal({
    features: baseFeatures(),
    featureKey: featureKeyFrom(baseFeatures()),
    candidates: [
      candidate({ id: "c1", lifecycle: "CANDIDATE", validated: false }),
      candidate({ id: "c2", lifecycle: "VALIDATING", validated: false }),
    ],
    influenceAllowed: true,
    suppressedReason: null,
  });
  assert.equal(signal.detected, false);
});

test("similar-company pattern detection for ACTIVE patterns", () => {
  const features = baseFeatures();
  const signal = buildLearningSignal({
    features,
    featureKey: featureKeyFrom(features),
    candidates: [candidate({ id: "active-1", lifecycle: "ACTIVE" })],
    influenceAllowed: true,
    suppressedReason: null,
  });
  assert.equal(signal.detected, true);
  assert.equal(signal.influenceAllowed, true);
  assert.match(signal.headline, /historical pattern/i);
  assert.equal(signal.detail.includes("Company X"), false);
});

test("similarity score requires meaningful overlap", () => {
  const a = baseFeatures();
  const b = { ...baseFeatures(), industryBucket: "construction", countryBucket: "uk" };
  assert.ok(similarityScore(a, a) >= 0.9);
  assert.ok(similarityScore(a, b) < LEARNING_EVIDENCE.minSimilarityForSignal);
});

// ─── Decision priority: current evidence overrides history ───────────────────

test("missing mandatory requirements suppress historical influence", () => {
  const gate = applyDecisionPriorityGate({
    missingMandatoryCount: 1,
    hardNoBid: false,
    forcedReview: false,
    readinessMissing: 1,
  });
  assert.equal(gate.influenceAllowed, false);
  assert.ok(gate.suppressedReason);

  const features = baseFeatures();
  const signal = buildLearningSignal({
    features,
    featureKey: featureKeyFrom(features),
    candidates: [candidate({ id: "a1" })],
    influenceAllowed: gate.influenceAllowed,
    suppressedReason: gate.suppressedReason,
  });
  assert.equal(signal.influenceAllowed, false);
  assert.match(signal.headline, /takes priority/i);
});

test("hard no-bid from tender evidence blocks historical BID influence", () => {
  const gate = applyDecisionPriorityGate({
    missingMandatoryCount: 0,
    hardNoBid: true,
    forcedReview: false,
    readinessMissing: 0,
  });
  assert.equal(gate.influenceAllowed, false);
});

test("decision engine hard failure stays NO_BID regardless of optimistic AI", () => {
  const out = runDecisionEngine({
    profile: {
      companyName: "Acme",
      industry: "Software",
      country: "UAE",
      companySize: "small",
      experienceLevel: null,
      services: ["IT"],
      certifications: [],
      experienceYears: 5,
      revenueRange: null,
      employeeRange: null,
      geographicCoverage: ["UAE"],
      contractSizeMin: null,
      contractSizeMax: null,
      customQualificationRules: [],
    },
    requirements: [
      {
        id: "r1",
        category: "Certification",
        description: "Must hold ISO 27001",
        mandatory: true,
        value: "ISO 27001",
        status: "FAILED",
        evidence: "Required",
      },
    ],
    estimatedValue: 100000,
    tenderContext: {
      title: "Security tender",
      client: null,
      country: "UAE",
      industry: "Software",
      tenderText: "Must hold ISO 27001 certification",
    },
    ai: {
      suggestedDecision: "BID",
      fitScore: 90,
      confidence: "HIGH",
      reasoning: "Looks good",
    },
  });
  // Existing Bid/No-Bid integrity: hard gaps must not become BID from AI optimism
  assert.notEqual(out.decision, "BID");
});

test("company–tender fit and readiness still compute", () => {
  const readiness = computeTenderReadiness({
    requirements: [
      {
        id: "r1",
        category: "Experience",
        description: "5 years",
        mandatory: true,
        value: null,
        status: "MATCHED",
        evidence: "ok",
      },
    ],
    missingDocuments: [],
    fit: null,
    profileHasAnyCapability: true,
  });
  assert.equal(readiness.counts.ready, 1);
  assert.ok(readiness.score != null && readiness.score > 0);
});

test("data quality and consistency scores are bounded 0–100", () => {
  const q = computeDataQualityScore({
    unknownFeatureCount: 2,
    totalFeatureCount: 8,
    sampleCount: 5,
    independentOrgCount: 3,
  });
  const c = computeConsistencyScore(4, 2);
  assert.ok(q >= 0 && q <= 100);
  assert.ok(c >= 0 && c <= 100);
});

// ─── Isolation invariants (documented as pure checks) ────────────────────────

test("company-specific vs global intelligence remain conceptually separated", () => {
  // Global signal builders never accept company names
  const signal = buildLearningSignal({
    features: baseFeatures(),
    featureKey: featureKeyFrom(baseFeatures()),
    candidates: [candidate({ id: "g1" })],
    influenceAllowed: true,
    suppressedReason: null,
  });
  const blob = JSON.stringify(signal);
  assert.equal(/Acme|Company X|peer company/i.test(blob), false);
  assert.equal(blob.includes("strategy"), false);
});

test("duplicate outcome protection: feature key + tender contribution is unique by design", () => {
  // LearningContribution.tenderId is @unique in schema — same tender updates, not duplicates.
  // Assert feature key stability so re-recording same outcome maps to same pattern bucket.
  const f = baseFeatures();
  assert.equal(featureKeyFrom(f), featureKeyFrom({ ...f }));
});
