/**
 * Project-centric Matching Engine tests:
 * hard requirements, capability precision, gaps, dedup, determinism, AI fallback.
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  AI_REFINE_BOOST_MAX,
  buildProjectIdentityKey,
  clearDefaultAiRefineCache,
  createAiRefineMemoryCache,
  normalizeProjectTitle,
  opportunityToMatchingSignals,
  PROJECT_NEAR_DUPLICATE_THRESHOLD,
  projectContentSimilarity,
  refineEligibleWithAiAssist,
  scoreCompanyOpportunityMatch,
  withProjectIdentityKey,
  type MatchingProfileSnapshot,
} from "@/domain/matching-engine";

function fmProfile(
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

describe("project-centric matching — hard vs soft", () => {
  it("blocks on mandatory country even with strong service fit", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: fmProfile(),
      opportunity: opportunityToMatchingSignals({
        services: ["Facilities management"],
        industries: ["Facilities"],
        geographies: ["France"],
        certifications: ["ISO 9001"],
        sizeBand: "51-200",
        experienceHint: "5 years",
        signalsJson: { requiredCountry: "France", countryRequired: true },
      }),
    });
    assert.equal(result.meetsRelevanceThreshold, false);
    assert.ok(result.gateFailures.some((g) => /country/i.test(g)));
  });

  it("blocks on mandatory certification", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: fmProfile({ certifications: [], dcmCategories: [] }),
      opportunity: opportunityToMatchingSignals({
        services: ["Facilities management"],
        industries: ["Facilities"],
        geographies: ["Morocco"],
        certifications: ["ISO 27001"],
        signalsJson: { mandatoryCertifications: ["ISO 27001"] },
      }),
    });
    assert.equal(result.meetsRelevanceThreshold, false);
    assert.ok(result.gateFailures.some((g) => /certification/i.test(g)));
  });

  it("blocks on mandatory capability even if industry aligns", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: fmProfile(),
      opportunity: opportunityToMatchingSignals({
        services: ["Cybersecurity"],
        industries: ["Facilities"],
        geographies: ["Morocco"],
        signalsJson: { mandatoryServices: ["Cybersecurity"] },
      }),
    });
    assert.equal(result.meetsRelevanceThreshold, false);
    assert.ok(result.gateFailures.some((g) => /capability/i.test(g)));
  });

  it("industry+geography alone cannot recommend when project lists services", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: fmProfile({
        services: [{ value: "Catering", trust: "normal", source: "p" }],
      }),
      opportunity: opportunityToMatchingSignals({
        services: ["Software development"],
        industries: ["Facilities"],
        geographies: ["Morocco"],
        category: "IT",
      }),
    });
    assert.equal(result.meetsRelevanceThreshold, false);
    assert.ok(result.gateFailures.some((g) => /service|capability/i.test(g)));
  });

  it("semantic capability groups improve service fit on valid projects", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: fmProfile({
        services: [
          { value: "Facilities management", trust: "normal", source: "p" },
        ],
      }),
      opportunity: opportunityToMatchingSignals({
        services: ["Facilities management"],
        industries: ["Facilities"],
        geographies: ["Morocco"],
        certifications: ["ISO 9001"],
        sizeBand: "51-200",
        experienceHint: "5 years",
        category: "FM",
      }),
    });
    assert.equal(result.meetsRelevanceThreshold, true);
    assert.ok(result.matchedDimensions.some((d) => d.key === "service"));
    assert.ok(result.score >= 40);
  });

  it("exposes matched and gap dimensions with a concise why explanation", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: fmProfile({
        size: { value: "1-10", trust: "normal", source: "p" },
      }),
      opportunity: opportunityToMatchingSignals({
        services: ["Facilities management"],
        industries: ["Facilities"],
        geographies: ["Morocco"],
        certifications: ["ISO 9001"],
        sizeBand: "1000+",
        experienceHint: "5 years",
      }),
    });
    assert.ok(result.matchedDimensions.length > 0);
    assert.ok(result.gapDimensions.some((d) => d.key === "size"));
    assert.match(result.explanation, /Gaps:|Service|Experience|Size/i);
  });

  it("same inputs produce stable deterministic results", () => {
    const opp = opportunityToMatchingSignals({
      services: ["Facilities management"],
      industries: ["Facilities"],
      geographies: ["Morocco"],
      certifications: ["ISO 9001"],
      sizeBand: "51-200",
      experienceHint: "at least 5 years",
    });
    const a = scoreCompanyOpportunityMatch({
      profile: fmProfile(),
      opportunity: opp,
    });
    const b = scoreCompanyOpportunityMatch({
      profile: fmProfile(),
      opportunity: opp,
    });
    assert.deepEqual(a, b);
  });
});

describe("project identity deduplication", () => {
  it("same source+externalRef produce identical identity keys", () => {
    const a = buildProjectIdentityKey({
      title: "Hospital FM contract",
      source: "TED",
      externalRef: "177486-2024",
      geographies: ["Germany"],
    });
    const b = buildProjectIdentityKey({
      title: "Completely different title",
      source: "TED",
      externalRef: "177486-2024",
      geographies: ["France"],
    });
    assert.equal(a, b);
  });

  it("normalized title+location+deadline fingerprint collisions for same project", () => {
    const deadline = "2026-12-01T12:00:00.000Z";
    const a = buildProjectIdentityKey({
      title: "The Facilities Management Contract for Hospital Campus",
      source: "INTERNAL",
      geographies: ["Morocco"],
      category: "FM",
      deadline,
      signalsJson: { authority: "Ministry of Health" },
    });
    const b = buildProjectIdentityKey({
      title: "Facilities management contract hospital campus",
      source: "INTERNAL",
      geographies: ["Morocco"],
      category: "FM",
      deadline,
      signalsJson: { authority: "Ministry of Health" },
    });
    assert.equal(a, b);
    assert.equal(normalizeProjectTitle("The FM Tender Contract"), normalizeProjectTitle("FM contract"));
  });

  it("near-duplicate content similarity merges equivalent projects", () => {
    const a = {
      title: "Cybersecurity SOC managed services Morocco",
      source: "INTERNAL",
      geographies: ["Morocco"],
      deadline: "2026-11-15T00:00:00.000Z",
    };
    const b = {
      title: "Cybersecurity SOC managed services Morocco",
      source: "INTERNAL",
      geographies: ["Morocco"],
      deadline: "2026-11-15T00:00:00.000Z",
    };
    assert.ok(projectContentSimilarity(a, b) >= PROJECT_NEAR_DUPLICATE_THRESHOLD);
  });

  it("withProjectIdentityKey preserves existing public signals", () => {
    const merged = withProjectIdentityKey(
      { ted: { cpv: ["72000000"] }, country: "France" },
      "abc123",
    );
    assert.equal(merged.projectIdentityKey, "abc123");
    assert.deepEqual(merged.ted, { cpv: ["72000000"] });
    assert.equal(merged.country, "France");
  });
});

describe("AI fallback stays post-gate", () => {
  beforeEach(() => clearDefaultAiRefineCache());

  it("AI failure does not block deterministic refine boosts", async () => {
    const result = await refineEligibleWithAiAssist({
      companyServices: ["Facilities management"],
      candidates: [
        {
          opportunityId: "a",
          title: "Facilities management tender",
          services: ["Facilities management"],
          relevanceScore: 80,
        },
      ],
      enableAi: true,
      cache: createAiRefineMemoryCache(),
      aiStructuredRefine: async () => {
        throw new Error("timeout");
      },
    });
    assert.equal(result.usedAi, false);
    assert.equal(result.reason, "ai_error_fallback");
    assert.ok((result.boosts["a"] ?? 0) <= AI_REFINE_BOOST_MAX);
  });

  it("AI cannot resurrect non-eligible opportunity ids", async () => {
    const result = await refineEligibleWithAiAssist({
      companyServices: ["Facilities management"],
      candidates: [
        {
          opportunityId: "eligible",
          title: "FM",
          services: ["Facilities management"],
          relevanceScore: 75,
        },
      ],
      enableAi: true,
      aiStructuredRefine: async () => [
        {
          opportunityId: "rejected-by-gate",
          semanticServiceFit: 1,
          semanticIndustryFit: 1,
          requirementFit: 1,
          detectedGaps: [],
          explanation: "invented",
          boundedRefineScore: 3,
          confidence: 0.99,
        },
      ],
    });
    assert.equal(result.boosts["rejected-by-gate"], undefined);
    assert.equal(result.structured["rejected-by-gate"], undefined);
  });
});
