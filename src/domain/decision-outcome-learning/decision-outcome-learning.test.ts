/**
 * Decision Outcome Learning — production regression tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanMutateTenderAnalysis,
  canMutateTenderAnalysis,
} from "@/auth/tender-access";
import { enrichDecisionMemoryWithOutcomes } from "@/domain/decision-memory/outcome-enrichment";
import {
  rankRelevantMemories,
} from "@/domain/decision-memory";
import {
  buildDecisionOutcomeView,
  buildOutcomeLearningInsights,
  buildOutcomeStatistics,
  evaluateDecisionSuccess,
  evaluateRecommendationAlignment,
  formatOutcomeTraceNote,
  MIN_COMPARABLE_SAMPLE,
  normalizeOutcomeForLearning,
  toOutcomeEngineContext,
  validateOutcomePayload,
  validateOutcomeTransition,
} from "@/domain/decision-outcome-learning";
import {
  buildOutcomeUserEvidence,
  outcomeEvidenceChanged,
  parseOutcomeUserEvidence,
} from "@/domain/decision-outcome-learning/evidence";
import type { LearningFeatures } from "@/domain/learning";
import type { TenderDecisionOutcome } from "@prisma/client";

const baseFeatures = (over: Partial<LearningFeatures> = {}): LearningFeatures => ({
  industryBucket: "construction",
  countryBucket: "ma",
  sizeBand: "sme",
  fitBand: "mid",
  readinessBand: "mid",
  decisionAtAnalysis: "REVIEW",
  mandatoryGapBand: "some",
  valueBand: "mid",
  ...over,
});

describe("decision outcome — lifecycle", () => {
  it("allows PENDING to any terminal state", () => {
    for (const to of ["WON", "LOST", "WITHDRAWN", "CANCELLED", "NOT_SUBMITTED"] as const) {
      const r = validateOutcomeTransition({ from: "PENDING", to });
      assert.equal(r.ok, true);
    }
  });

  it("blocks terminal → PENDING without reversal", () => {
    const r = validateOutcomeTransition({ from: "WON", to: "PENDING" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /reversal/i);
  });

  it("allows terminal → PENDING with explicit reversal", () => {
    const r = validateOutcomeTransition({
      from: "LOST",
      to: "PENDING",
      allowReversal: true,
    });
    assert.equal(r.ok, true);
  });

  it("allows terminal outcome corrections", () => {
    const r = validateOutcomeTransition({ from: "WON", to: "LOST" });
    assert.equal(r.ok, true);
  });

  it("validateOutcomePayload enforces lifecycle on update", () => {
    const bad = validateOutcomePayload({
      outcome: "PENDING",
      fromOutcome: "WON",
    });
    assert.equal(bad.ok, false);
  });
});

describe("decision outcome — validation", () => {
  it("requires outcome date for WON/LOST", () => {
    assert.equal(validateOutcomePayload({ outcome: "WON" }).ok, false);
    assert.equal(
      validateOutcomePayload({ outcome: "LOST", outcomeDate: "2026-03-01" }).ok,
      true,
    );
  });

  it("normalizes legacy outcomes for learning aggregates", () => {
    assert.equal(normalizeOutcomeForLearning("BID_SUBMITTED"), "PENDING");
    assert.equal(normalizeOutcomeForLearning("NO_BID_CONFIRMED"), "NOT_SUBMITTED");
  });
});

describe("decision outcome — recommendation evaluation", () => {
  it("does not assume GO = WON — REVIEW stays NOT_EVALUATED", () => {
    assert.equal(
      evaluateRecommendationAlignment({ decisionAtAnalysis: "REVIEW", outcome: "WON" }),
      "NOT_EVALUATED",
    );
    assert.equal(
      evaluateRecommendationAlignment({ decisionAtAnalysis: "REVIEW", outcome: "LOST" }),
      "NOT_EVALUATED",
    );
  });

  it("BID + WON is SUCCESSFUL; BID + LOST is UNSUCCESSFUL", () => {
    assert.equal(
      evaluateRecommendationAlignment({ decisionAtAnalysis: "BID", outcome: "WON" }),
      "SUCCESSFUL",
    );
    assert.equal(
      evaluateRecommendationAlignment({ decisionAtAnalysis: "BID", outcome: "LOST" }),
      "UNSUCCESSFUL",
    );
  });

  it("NO_BID + LOST is SUCCESSFUL (correct avoidance)", () => {
    assert.equal(
      evaluateRecommendationAlignment({ decisionAtAnalysis: "NO_BID", outcome: "LOST" }),
      "SUCCESSFUL",
    );
  });

  it("NO_BID + WON is UNSUCCESSFUL (missed opportunity)", () => {
    assert.equal(
      evaluateRecommendationAlignment({ decisionAtAnalysis: "NO_BID", outcome: "WON" }),
      "UNSUCCESSFUL",
    );
  });

  it("pending outcomes are NOT_EVALUATED", () => {
    assert.equal(
      evaluateRecommendationAlignment({ decisionAtAnalysis: "BID", outcome: "PENDING" }),
      "NOT_EVALUATED",
    );
  });
});

describe("decision outcome — evidence", () => {
  it("marks user evidence explicitly and never as AI", () => {
    const ev = buildOutcomeUserEvidence({
      attachmentDocumentId: "doc1",
      attachmentFileName: "award-letter.pdf",
      notes: "Client confirmed by email",
    });
    assert.equal(ev?.userProvided, true);
    const parsed = parseOutcomeUserEvidence(ev);
    assert.equal(parsed?.attachmentFileName, "award-letter.pdf");
  });

  it("detects attachment changes for audit", () => {
    const a = buildOutcomeUserEvidence({ notes: "a" });
    const b = buildOutcomeUserEvidence({ notes: "b" });
    assert.equal(outcomeEvidenceChanged(a, b), true);
    assert.equal(outcomeEvidenceChanged(a, a), false);
  });
});

describe("decision outcome — statistics and sample size", () => {
  it("returns null win rate when decisive sample is insufficient", () => {
    const stats = buildOutcomeStatistics([
      { outcome: "WON" },
      { outcome: "WITHDRAWN" },
    ]);
    assert.equal(stats?.winRatePercent, null);
    assert.equal(stats?.decisiveCount, 1);
  });

  it("computes win rate only with MIN_DECISIVE_SAMPLE", () => {
    const stats = buildOutcomeStatistics([
      { outcome: "WON" },
      { outcome: "LOST" },
      { outcome: "LOST" },
    ]);
    assert.equal(stats?.winRatePercent, 33.3);
  });

  it("uses n=X of Y summary only with sufficient comparable sample", () => {
    const candidates = Array.from({ length: MIN_COMPARABLE_SAMPLE }, (_, i) => ({
      tenderId: `t${i}`,
      title: `Tender ${i}`,
      decisionAtAnalysis: "BID" as const,
      outcome: i === 0 ? ("WON" as const) : ("LOST" as const),
      outcomeDate: "2026-01-01",
      reasonCode: i === 1 ? "price" : null,
      reasonDetail: null,
      features: baseFeatures(),
    }));

    const bundle = buildOutcomeLearningInsights({
      currentFeatures: baseFeatures(),
      excludeTenderId: "current",
      candidates,
    });

    assert.ok(bundle.statistics);
    assert.match(bundle.statistics!.summary ?? "", /1 of 3 similar tenders were won/);
    assert.equal(bundle.statistics!.sufficientSample, true);
  });

  it("does not invent win rate from unrelated candidates", () => {
    const bundle = buildOutcomeLearningInsights({
      currentFeatures: baseFeatures({
        industryBucket: "healthcare",
        countryBucket: "us",
        sizeBand: "enterprise",
        fitBand: "low",
        readinessBand: "low",
        mandatoryGapBand: "many",
        valueBand: "high",
      }),
      excludeTenderId: "current",
      candidates: [
        {
          tenderId: "other",
          title: "Unrelated",
          decisionAtAnalysis: "BID",
          outcome: "LOST",
          outcomeDate: "2026-01-01",
          reasonCode: "price",
          reasonDetail: null,
          features: baseFeatures({
            industryBucket: "finance",
            countryBucket: "jp",
            sizeBand: "micro",
            fitBand: "high",
            readinessBand: "high",
            mandatoryGapBand: "none",
            valueBand: "low",
          }),
        },
      ],
    });
    assert.equal(bundle.similarOutcomes.length, 0);
    assert.equal(bundle.winRateSummary, null);
    assert.equal(bundle.statistics, null);
  });
});

describe("decision outcome — traceability", () => {
  it("trace notes use tender title not internal ids", () => {
    const note = formatOutcomeTraceNote("AV Systems RFP 2026");
    assert.match(note, /AV Systems RFP 2026/);
    assert.doesNotMatch(note, /c[a-z0-9]{20,}/i);
  });

  it("patterns reference recorded titles only", () => {
    const bundle = buildOutcomeLearningInsights({
      currentFeatures: baseFeatures(),
      excludeTenderId: "current",
      candidates: [
        {
          tenderId: "internal-id-hidden",
          title: "Similar AV tender",
          decisionAtAnalysis: "BID",
          outcome: "WON",
          outcomeDate: "2026-01-15",
          reasonCode: null,
          reasonDetail: null,
          features: baseFeatures(),
        },
      ],
    });
    assert.match(bundle.similarOutcomes[0]!.traceNote, /Similar AV tender/);
    assert.doesNotMatch(bundle.similarOutcomes[0]!.traceNote, /internal-id-hidden/);
  });
});

describe("decision outcome — engine context (advisory only)", () => {
  it("exports reference-only signal without score fields", () => {
    const bundle = buildOutcomeLearningInsights({
      currentFeatures: baseFeatures(),
      excludeTenderId: "x",
      candidates: [],
    });
    const ctx = toOutcomeEngineContext(bundle);
    assert.equal(ctx.referenceOnly, true);
    assert.equal("score" in ctx, false);
    assert.equal("fitScore" in ctx, false);
  });
});

describe("decision outcome — Decision Memory enrichment", () => {
  it("adds outcome fields without changing ranking order", () => {
    const ranked = rankRelevantMemories({
      currentFeatures: baseFeatures(),
      excludeTenderId: "t-current",
      candidates: [
        {
          id: "m1",
          tenderId: "t-prior",
          title: "Prior tender",
          client: null,
          decision: "BID",
          fitScore: 70,
          readinessScore: 65,
          bidScore: 60,
          reasoning: "Prior reasoning.",
          features: baseFeatures(),
          analyzedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const outcomeRow = {
      id: "o1",
      companyId: "c1",
      tenderId: "t-prior",
      tenderDecisionId: "d1",
      outcome: "LOST" as const,
      outcomeDate: new Date("2026-03-01"),
      reasonCode: "price",
      reasonDetail: "Incumbent won",
      evidence: null,
      humanFinalDecision: null,
      recordedById: "u1",
      idempotencyKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies TenderDecisionOutcome;

    const enriched = enrichDecisionMemoryWithOutcomes({
      bundle: ranked,
      outcomesByTenderId: new Map([["t-prior", outcomeRow]]),
    });

    assert.deepEqual(
      ranked.matches.map((m) => m.similarity),
      enriched.matches.map((m) => m.similarity),
    );
    assert.equal(enriched.matches[0]!.recommendationEvaluation, "UNSUCCESSFUL");
    assert.match(enriched.matches[0]!.outcomeTraceNote ?? "", /Prior tender/);
  });
});

describe("decision outcome — permissions", () => {
  it("blocks VIEWER from recording outcomes", () => {
    assert.equal(canMutateTenderAnalysis("VIEWER"), false);
    assert.throws(() => assertCanMutateTenderAnalysis("VIEWER"), /role/i);
  });
});

describe("decision outcome — buildDecisionOutcomeView", () => {
  it("includes recommendation evaluation and user evidence disclaimer", () => {
    const view = buildDecisionOutcomeView({
      tenderId: "t1",
      bidveraDecision: "BID",
      outcome: "WON",
      outcomeDate: "2026-02-15T00:00:00.000Z",
      attachmentFileName: "award.pdf",
    });
    assert.equal(view.recommendationEvaluation, "SUCCESSFUL");
    assert.equal(view.attachmentFileName, "award.pdf");
    assert.match(view.userEvidenceDisclaimer, /company-provided/i);
  });
});

describe("decision outcome — scoring isolation", () => {
  it("rankRelevantMemories unchanged by outcome enrichment", () => {
    const input = {
      currentFeatures: baseFeatures(),
      excludeTenderId: "t-new",
      candidates: [
        {
          id: "m-high",
          tenderId: "t-high",
          title: "High similarity",
          client: null,
          decision: "BID" as const,
          fitScore: 80,
          readinessScore: 75,
          bidScore: 70,
          reasoning: "Strong fit.",
          features: baseFeatures(),
          analyzedAt: "2026-02-01T00:00:00.000Z",
        },
      ],
    };
    const ranked = rankRelevantMemories(input);
    const enriched = enrichDecisionMemoryWithOutcomes({
      bundle: ranked,
      outcomesByTenderId: new Map([
        [
          "t-high",
          {
            id: "o1",
            companyId: "c1",
            tenderId: "t-high",
            tenderDecisionId: "d1",
            outcome: "WON",
            outcomeDate: new Date(),
            reasonCode: null,
            reasonDetail: null,
            evidence: null,
            humanFinalDecision: null,
            recordedById: null,
            idempotencyKey: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      ]),
    });
    assert.equal(ranked.matches[0]?.similarity, enriched.matches[0]?.similarity);
    assert.equal(ranked.matches[0]?.recordedOutcome, undefined);
  });
});

/** @deprecated path still mapped for legacy consumers */
describe("decision outcome — legacy evaluateDecisionSuccess", () => {
  it("maps SUCCESSFUL to successful", () => {
    assert.equal(
      evaluateDecisionSuccess({ decisionAtAnalysis: "BID", outcome: "WON" }),
      "successful",
    );
  });
});
