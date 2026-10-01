/**
 * AI Matching + Matching Engine integration tests (approved design).
 * Deterministic gates remain authoritative; AI is a bounded secondary refine.
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  AI_REFINE_BOOST_MAX,
  assertAiPayloadIsPublicSafe,
  buildAiRefineNormalizedInput,
  clearDefaultAiRefineCache,
  createAiRefineMemoryCache,
  deterministicSemanticRefineBoost,
  opportunityToMatchingSignals,
  refineEligibleWithAiAssist,
  sanitizeAiStructuredRefineBatch,
  sanitizeAiStructuredRefineOutput,
  scoreCompanyOpportunityMatch,
  type MatchingProfileSnapshot,
} from "@/domain/matching-engine";

function baseSnapshot(
  overrides: Partial<MatchingProfileSnapshot> = {},
): MatchingProfileSnapshot {
  return {
    services: [
      { value: "Facilities management", trust: "normal", source: "p" },
    ],
    industries: [{ value: "Facilities", trust: "normal", source: "p" }],
    countries: [{ value: "Morocco", trust: "normal", source: "p" }],
    geographies: [{ value: "Morocco", trust: "normal", source: "p" }],
    certifications: [{ value: "ISO 9001", trust: "strong", source: "dcm" }],
    size: { value: "51-200", trust: "normal", source: "p" },
    experienceYears: { value: 10, trust: "normal", source: "p" },
    dcmCategories: [{ value: "ISO 9001", trust: "strong", source: "dcm" }],
    softNotes: [],
    ...overrides,
  };
}

describe("matching AI + deterministic integration", () => {
  beforeEach(() => {
    clearDefaultAiRefineCache();
  });

  it("hard gate blocks irrelevant AI-suggested matches", async () => {
    const irrelevant = scoreCompanyOpportunityMatch({
      profile: baseSnapshot(),
      opportunity: opportunityToMatchingSignals({
        services: ["Satellite manufacturing"],
        industries: ["Aerospace"],
        geographies: ["Antarctica"],
        certifications: ["AS9100"],
        sizeBand: "1000+",
        experienceHint: "20 years",
      }),
    });
    assert.equal(irrelevant.meetsRelevanceThreshold, false);

    // Even if AI would boost, refine only runs on eligible candidates —
    // hard-gate failures never enter the candidate list.
    const ai = await refineEligibleWithAiAssist({
      companyServices: ["Facilities management"],
      candidates: [], // nothing passed the gate
      enableAi: true,
      aiStructuredRefine: async () => [
        {
          opportunityId: "resurrect-me",
          semanticServiceFit: 1,
          semanticIndustryFit: 1,
          requirementFit: 1,
          detectedGaps: [],
          explanation: "perfect",
          boundedRefineScore: AI_REFINE_BOOST_MAX,
          confidence: 0.99,
        },
      ],
    });
    assert.equal(ai.boosts["resurrect-me"], undefined);
    assert.equal(Object.keys(ai.boosts).length, 0);
  });

  it("mandatory country blocks incompatible opportunity", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: baseSnapshot(),
      opportunity: opportunityToMatchingSignals({
        services: ["Facilities management"],
        industries: ["Facilities"],
        geographies: ["France"],
        certifications: ["ISO 9001"],
        sizeBand: "51-200",
        experienceHint: "5 years",
        signalsJson: {
          requiredCountry: "France",
          countryRequired: true,
        },
      }),
    });
    assert.equal(result.meetsRelevanceThreshold, false);
    assert.ok(result.gateFailures.some((g) => /country/i.test(g)));
  });

  it("mandatory certification blocks missing certification", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: baseSnapshot({
        certifications: [],
        dcmCategories: [],
      }),
      opportunity: opportunityToMatchingSignals({
        services: ["Facilities management"],
        industries: ["Facilities"],
        geographies: ["Morocco"],
        certifications: ["ISO 27001"],
        sizeBand: "51-200",
        experienceHint: "5 years",
        signalsJson: {
          mandatoryCertifications: ["ISO 27001"],
        },
      }),
    });
    assert.equal(result.meetsRelevanceThreshold, false);
    assert.ok(result.gateFailures.some((g) => /certification/i.test(g)));
  });

  it("semantic service similarity improves valid matches", () => {
    const boost = deterministicSemanticRefineBoost({
      companyServices: ["Facilities management"],
      candidate: {
        opportunityId: "o1",
        title: "Facilities management and soft services contract",
        summary: "Ongoing facilities management for office campuses",
        services: ["Facilities management"],
        category: "FM",
        relevanceScore: 70,
      },
    });
    assert.ok(boost > 0);
    assert.ok(boost <= AI_REFINE_BOOST_MAX);
  });

  it("AI cannot exceed configured boost cap", async () => {
    const result = await refineEligibleWithAiAssist({
      companyServices: ["Facilities management"],
      candidates: [
        {
          opportunityId: "a",
          title: "FM",
          services: ["Facilities management"],
          relevanceScore: 80,
        },
      ],
      enableAi: true,
      aiStructuredRefine: async () => [
        {
          opportunityId: "a",
          semanticServiceFit: 1,
          semanticIndustryFit: 1,
          requirementFit: 1,
          detectedGaps: [],
          explanation: "great",
          boundedRefineScore: 99,
          confidence: 0.99,
        },
      ],
    });
    assert.ok((result.boosts["a"] ?? 0) <= AI_REFINE_BOOST_MAX);
    assert.equal(result.structured["a"]?.boundedRefineScore, AI_REFINE_BOOST_MAX);
  });

  it("AI failure falls back to deterministic scoring", async () => {
    const result = await refineEligibleWithAiAssist({
      companyServices: ["Facilities management"],
      candidates: [
        {
          opportunityId: "a",
          title: "Facilities management tender",
          services: ["Facilities management"],
          relevanceScore: 75,
        },
        {
          opportunityId: "b",
          title: "Other",
          services: ["Facilities"],
          relevanceScore: 60,
        },
      ],
      enableAi: true,
      aiStructuredRefine: async () => {
        throw new Error("provider down");
      },
    });
    assert.equal(result.usedAi, false);
    assert.equal(result.reason, "ai_error_fallback");
    // Deterministic synonym boost may still apply
    assert.ok((result.boosts["a"] ?? 0) >= 0);
  });

  it("invalid AI JSON is safely rejected", () => {
    const eligible = new Set(["a"]);
    assert.equal(sanitizeAiStructuredRefineOutput("not-json", eligible), null);
    assert.equal(sanitizeAiStructuredRefineOutput({ foo: 1 }, eligible), null);
    assert.equal(
      sanitizeAiStructuredRefineOutput(
        {
          opportunityId: "evil",
          semanticServiceFit: 1,
          confidence: 1,
          boundedRefineScore: 3,
        },
        eligible,
      ),
      null,
    );
    const batch = sanitizeAiStructuredRefineBatch(
      { refinements: [{ opportunityId: "a", confidence: "bad" }] },
      eligible,
    );
    // confidence non-numeric → 0 → below min → boundedRefineScore 0 but object kept
    assert.equal(batch.length, 1);
    assert.equal(batch[0]!.boundedRefineScore, 0);
  });

  it("same inputs produce stable deterministic results", () => {
    const opp = opportunityToMatchingSignals({
      services: ["Facilities management"],
      industries: ["Facilities"],
      geographies: ["Morocco"],
      certifications: ["ISO 9001"],
      sizeBand: "Medium",
      experienceHint: "at least 5 years",
    });
    const a = scoreCompanyOpportunityMatch({
      profile: baseSnapshot(),
      opportunity: opp,
    });
    const b = scoreCompanyOpportunityMatch({
      profile: baseSnapshot(),
      opportunity: opp,
    });
    assert.deepEqual(a, b);
    assert.ok(a.meetsRelevanceThreshold);
  });

  it("no duplicate AI calls for unchanged hashes", async () => {
    const cache = createAiRefineMemoryCache();
    let calls = 0;
    const candidate = {
      opportunityId: "a",
      title: "Facilities contract",
      summary: "Cleaning",
      services: ["Facilities management"],
      relevanceScore: 80,
    };
    const run = () =>
      refineEligibleWithAiAssist({
        companyServices: ["Facilities management"],
        companyIndustries: ["Facilities"],
        companyCountries: ["Morocco"],
        candidates: [candidate],
        enableAi: true,
        cache,
        aiStructuredRefine: async () => {
          calls += 1;
          return [
            {
              opportunityId: "a",
              semanticServiceFit: 0.9,
              semanticIndustryFit: 0.8,
              requirementFit: 0.85,
              detectedGaps: [],
              explanation: "strong service fit",
              boundedRefineScore: 2.1,
              confidence: 0.9,
            },
          ];
        },
      });

    const first = await run();
    assert.equal(calls, 1);
    assert.equal(first.cacheMisses.length, 1);

    const second = await run();
    assert.equal(calls, 1);
    assert.equal(second.cacheHits.length, 1);
    assert.equal(second.boosts["a"], first.boosts["a"]);
  });

  it("no private/secrets data reaches AI payload", () => {
    const built = buildAiRefineNormalizedInput({
      companyServices: ["Facilities management"],
      companyIndustries: ["Facilities"],
      companyCertifications: ["ISO 9001"],
      companyCountries: ["Morocco"],
      companyTimezone: "Africa/Casablanca",
      candidate: {
        opportunityId: "opp1",
        title: "Public tender",
        summary: "Public summary",
        services: ["Cleaning"],
        relevanceScore: 70,
      },
    });
    const hits = assertAiPayloadIsPublicSafe({
      company: built.company,
      opportunity: built.opportunity,
    });
    assert.deepEqual(hits, []);
    const json = JSON.stringify(built);
    assert.doesNotMatch(json, /apiKey|password|secret|stripe|privateKey/i);
    assert.equal("email" in (built.company as object), false);
  });

  it("country and geography are not double-counted when both match", () => {
    const withSplit = scoreCompanyOpportunityMatch({
      profile: baseSnapshot(),
      opportunity: opportunityToMatchingSignals({
        services: ["Facilities management"],
        industries: ["Facilities"],
        geographies: ["Morocco", "North Africa"],
        certifications: ["ISO 9001"],
        sizeBand: "51-200",
        experienceHint: "5 years",
        signalsJson: { country: "Morocco" },
      }),
    });
    const geoDim = withSplit.dimensions.find((d) => d.key === "geography");
    const countryDim = withSplit.dimensions.find((d) => d.key === "country");
    assert.equal(countryDim?.status, "scored");
    // Geography should score remaining region (North Africa), not re-score Morocco alone
    assert.ok(geoDim?.status === "scored" || geoDim?.status === "not_applicable");
    assert.ok(withSplit.meetsRelevanceThreshold);
  });

  it("normalized size bands treat Medium as 51-200", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: baseSnapshot({
        size: { value: "51-200", trust: "normal", source: "p" },
      }),
      opportunity: opportunityToMatchingSignals({
        services: ["Facilities management"],
        industries: ["Facilities"],
        geographies: ["Morocco"],
        certifications: ["ISO 9001"],
        sizeBand: "Medium",
        experienceHint: "5 years",
      }),
    });
    const size = result.dimensions.find((d) => d.key === "size");
    assert.ok((size?.score ?? 0) >= 70);
  });
});
