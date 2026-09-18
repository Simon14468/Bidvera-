/**
 * Decision Memory domain tests — relevance ranking without inventing data.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decisionMemoryContentHash,
  decisionMemoryLabel,
  isCorruptOrEmptyMemoryPayload,
  rankRelevantMemories,
  relevanceReasons,
} from "@/domain/decision-memory";
import type { LearningFeatures } from "@/domain/learning";

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

describe("decision memory — labels", () => {
  it("maps engine decisions to GO / CONDITIONAL GO / NO-BID", () => {
    assert.equal(decisionMemoryLabel("BID"), "GO");
    assert.equal(decisionMemoryLabel("REVIEW"), "CONDITIONAL GO");
    assert.equal(decisionMemoryLabel("NO_BID"), "NO-BID");
  });
});

describe("decision memory — relevance", () => {
  it("explains overlapping known features only", () => {
    const reasons = relevanceReasons(
      baseFeatures(),
      baseFeatures({ fitBand: "high", countryBucket: "fr" }),
    );
    assert.ok(reasons.includes("Same industry band"));
    assert.ok(!reasons.includes("Same country/region band"));
    assert.ok(!reasons.includes("Similar fit score band"));
  });

  it("ranks relevant priors and excludes current tender", () => {
    const current = baseFeatures();
    const bundle = rankRelevantMemories({
      currentFeatures: current,
      excludeTenderId: "t-current",
      candidates: [
        {
          id: "m1",
          tenderId: "t-current",
          title: "Should be excluded",
          client: null,
          decision: "BID",
          fitScore: 80,
          readinessScore: 70,
          bidScore: 60,
          reasoning: "Prior",
          features: current,
          analyzedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "m2",
          tenderId: "t-prior",
          title: "Similar AV tender",
          client: "Client A",
          decision: "REVIEW",
          fitScore: 55,
          readinessScore: 48,
          bidScore: 50,
          reasoning: "Canonical reasoning from prior analysis.",
          features: baseFeatures({ fitBand: "mid" }),
          analyzedAt: "2026-02-01T00:00:00.000Z",
        },
        {
          id: "m3",
          tenderId: "t-unrelated",
          title: "Unrelated",
          client: null,
          decision: "NO_BID",
          fitScore: 20,
          readinessScore: 10,
          bidScore: 15,
          reasoning: "Different sector",
          features: baseFeatures({
            industryBucket: "software",
            countryBucket: "us",
            sizeBand: "enterprise",
            fitBand: "low",
            readinessBand: "low",
            decisionAtAnalysis: "NO_BID",
            mandatoryGapBand: "many",
            valueBand: "high",
          }),
          analyzedAt: "2026-03-01T00:00:00.000Z",
        },
      ],
    });

    assert.equal(bundle.computed, true);
    assert.ok(bundle.matches.every((m) => m.tenderId !== "t-current"));
    assert.ok(bundle.matches.some((m) => m.memoryId === "m2"));
    assert.ok(bundle.matches[0]!.relevanceReasons.length > 0);
    assert.ok(bundle.matches[0]!.disclaimer.includes("reference only"));
    assert.ok(bundle.currentAnalysisNote.includes("authoritative"));
  });

  it("returns empty safely when nothing is relevant", () => {
    const bundle = rankRelevantMemories({
      currentFeatures: baseFeatures(),
      candidates: [],
    });
    assert.equal(bundle.matches.length, 0);
    assert.ok(bundle.emptyReason);
  });
});

describe("decision memory — integrity", () => {
  it("hashes content stably and flags empty payloads", () => {
    const snap = {
      totalRequirements: 3,
      ready: 1,
      missing: 1,
      verify: 1,
      lines: ["Req A"],
    };
    const h1 = decisionMemoryContentHash({
      decision: "REVIEW",
      fitScore: 62,
      readinessScore: 48,
      bidScore: 55,
      reasoning: "Canonical reasoning",
      requirementsSnapshot: snap,
      risksSnapshot: [],
    });
    const h2 = decisionMemoryContentHash({
      decision: "REVIEW",
      fitScore: 62,
      readinessScore: 48,
      bidScore: 55,
      reasoning: "Canonical reasoning",
      requirementsSnapshot: snap,
      risksSnapshot: [],
    });
    assert.equal(h1, h2);
    assert.equal(
      isCorruptOrEmptyMemoryPayload({
        reasoning: "   ",
        requirementsSnapshot: snap,
      }),
      true,
    );
    assert.equal(
      isCorruptOrEmptyMemoryPayload({
        reasoning: "ok",
        requirementsSnapshot: snap,
      }),
      false,
    );
  });
});
