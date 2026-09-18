/**
 * Feature 8E — Matching Intelligence & Analytics
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  AI_REFINE_MIN_CONFIDENCE,
  assertPreferencesAreNotCapabilities,
  buildPreferenceWeightsFromEngagements,
  computeFinalRankScore,
  computeMatchingRates,
  filterAiOrderToEligible,
  geographyProximityBoost,
  MATCHING_INTENT_DIRECTIONS,
  MATCHING_MIN_RELEVANCE_SCORE,
  nextMatchQualityState,
  normalizeMatchingIntentDirection,
  preferenceAffinityScore,
  qualityStateFromEvent,
  refineEligibleWithAiAssist,
  scoreCompanyOpportunityMatch,
  type MatchingProfileSnapshot,
} from "@/domain/matching-engine";
import { prisma } from "@/lib/db";
import {
  MATCHING_ENGINE_FEATURE_KEY,
  MATCHING_SPONSORSHIP_SETTINGS_KEY,
  createCompanySponsorship,
  generateRecommendationsForCompany,
  getCompanyMatchingAnalytics,
  getMatchingEngineHealthAnalytics,
  getMatchingPreferencesForCompany,
  getPlatformMatchingAnalytics,
  rebuildMatchingPreferencesForCompany,
  recordBehaviorEventForCompany,
  setMatchingSponsorshipGloballyEnabled,
  upsertOpportunity,
} from "@/modules/matching-engine";
import { generateMatchRecommendations } from "@/modules/matching-engine/internal/service";
import { transitionSponsorship } from "@/modules/matching-engine/internal/sponsorship";
import { ENTITLEMENT_FEATURE_KEYS, UNSHIPPED_ENTITLEMENT_KEYS } from "@/domain/billing/entitlement-catalog";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PREFIX = `me8e-${Date.now().toString(36)}-`;

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const companyIds: string[] = [];
const opportunityIds: string[] = [];

async function cleanup() {
  if (companyIds.length) {
    await prisma.matchingBehaviorEvent.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.matchRecommendation.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.matchingSponsorship.deleteMany({
      where: { sponsorCompanyId: { in: companyIds } },
    });
    await prisma.companyMatchingPreferenceSnapshot.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.companyMatchingProfile.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.companyProfile.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }
  if (opportunityIds.length) {
    await prisma.matchingOpportunityDailyStats.deleteMany({
      where: { opportunityId: { in: opportunityIds } },
    });
    await prisma.matchingOpportunity.deleteMany({
      where: { id: { in: opportunityIds } },
    });
  }
  await prisma.matchingOpportunity.deleteMany({
    where: { source: { startsWith: "ME8E_" } },
  });
  await prisma.systemSetting.deleteMany({
    where: { key: MATCHING_SPONSORSHIP_SETTINGS_KEY },
  });
  companyIds.length = 0;
  opportunityIds.length = 0;
}

async function seedCompany(
  slugSuffix: string,
  opts?: { country?: string; services?: string[] },
) {
  const company = await prisma.company.create({
    data: {
      name: `ME8E ${slugSuffix}`,
      slug: `${PREFIX}${slugSuffix}`,
      country: opts?.country ?? "Morocco",
      companySize: "Medium",
      profile: {
        create: {
          industry: "Technology",
          country: opts?.country ?? "Morocco",
          companySize: "Medium",
          services: opts?.services ?? ["Cybersecurity", "Cloud"],
          geographicCoverage: [opts?.country ?? "Morocco"],
          experienceYears: 8,
          completeness: 80,
        },
      },
    },
  });
  companyIds.push(company.id);
  return company.id;
}

function cyberProfile(geo = "Morocco"): MatchingProfileSnapshot {
  return {
    services: [{ value: "Cybersecurity", trust: "strong", source: "sq" }],
    industries: [{ value: "Technology", trust: "normal", source: "profile" }],
    geographies: [{ value: geo, trust: "normal", source: "profile" }],
    certifications: [],
    size: { value: "Medium", trust: "normal", source: "profile" },
    experienceYears: { value: 8, trust: "normal", source: "profile" },
    dcmCategories: [],
    softNotes: [],
  };
}

describe("Feature 8E — domain quality & rates", () => {
  it("keeps matching_engine OFF / unshipped by default", () => {
    assert.ok(ENTITLEMENT_FEATURE_KEYS.includes("matching_engine"));
    assert.ok(UNSHIPPED_ENTITLEMENT_KEYS.includes("matching_engine"));
    assert.equal(MATCHING_ENGINE_FEATURE_KEY, "matching_engine");
  });

  it("maps events to quality states and progresses monotonically", () => {
    assert.equal(qualityStateFromEvent("IMPRESSION"), "SEEN");
    assert.equal(qualityStateFromEvent("VIEW"), "ENGAGED");
    assert.equal(qualityStateFromEvent("INTEREST"), "INTERESTED");
    assert.equal(qualityStateFromEvent("DISMISS"), "DISMISSED");
    assert.equal(nextMatchQualityState("NONE", "IMPRESSION"), "SEEN");
    assert.equal(nextMatchQualityState("SEEN", "VIEW"), "ENGAGED");
    assert.equal(nextMatchQualityState("ENGAGED", "INTEREST"), "INTERESTED");
    assert.equal(nextMatchQualityState("INTERESTED", "DISMISS"), "DISMISSED");
    assert.equal(nextMatchQualityState("DISMISSED", "INTEREST"), "DISMISSED");
    assert.equal(nextMatchQualityState("INTERESTED", "IMPRESSION"), "INTERESTED");
  });

  it("computes analytics rates from buckets", () => {
    const rates = computeMatchingRates({
      impressions: 100,
      views: 40,
      clicks: 20,
      interest: 10,
      dismissals: 5,
    });
    assert.equal(rates.viewRate, 0.4);
    assert.equal(rates.clickRate, 0.2);
    assert.equal(rates.interestRate, 0.1);
    assert.equal(rates.dismissalRate, 0.05);
    assert.equal(rates.engagementRate, 0.7);
    assert.equal(rates.clickThroughViewRate, 0.5);
    assert.equal(computeMatchingRates({
      impressions: 0,
      views: 0,
      clicks: 0,
      interest: 0,
      dismissals: 0,
    }).viewRate, null);
  });
});

describe("Feature 8E — preferences are soft only", () => {
  it("builds preference weights from public engagement dimensions", () => {
    const weights = buildPreferenceWeightsFromEngagements([
      {
        eventType: "VIEW",
        category: "Security",
        services: ["Cybersecurity"],
        industries: ["Technology"],
        geographies: ["Morocco"],
      },
      {
        eventType: "INTEREST",
        category: "Security",
        services: ["Cybersecurity"],
        industries: ["Technology"],
        geographies: ["Spain"],
      },
      {
        eventType: "DISMISS",
        services: ["Catering"],
        category: "Food",
      },
    ]);
    assert.ok((weights.services.cybersecurity ?? 0) > 0);
    assert.ok((weights.categories.security ?? 0) > 0);
    assert.ok((weights.dismissServices.catering ?? 0) > 0);
    assert.ok(
      assertPreferencesAreNotCapabilities(["Cybersecurity"], weights.services),
    );
  });

  it("preference affinity cannot unlock hard capability mismatch", () => {
    const profile = cyberProfile();
    const mismatch = scoreCompanyOpportunityMatch({
      profile,
      opportunity: {
        services: ["Catering"],
        industries: ["Hospitality"],
        geographies: ["Morocco"],
        certifications: [],
        sizeBand: "Medium",
        experienceYearsRequired: null,
        category: "Food",
        industry: "Hospitality",
      },
    });
    assert.equal(mismatch.meetsRelevanceThreshold, false);

    const weights = buildPreferenceWeightsFromEngagements([
      {
        eventType: "INTEREST",
        services: ["Catering"],
        category: "Food",
        industries: ["Hospitality"],
        geographies: ["Morocco"],
      },
    ]);
    const boost = preferenceAffinityScore(weights, {
      services: ["Catering"],
      category: "Food",
      industries: ["Hospitality"],
      geographies: ["Morocco"],
    });
    assert.ok(boost > 0);
    // Soft boost never flips the gate
    assert.equal(mismatch.meetsRelevanceThreshold, false);
    assert.ok(mismatch.score + boost < MATCHING_MIN_RELEVANCE_SCORE + 50);
  });
});

describe("Feature 8E — geography & AI refine", () => {
  it("ranks proximity without blocking cross-border", () => {
    const same = geographyProximityBoost(["Morocco"], ["Morocco"]);
    const neighbor = geographyProximityBoost(["Morocco"], ["Spain"]);
    const far = geographyProximityBoost(["Morocco"], ["Vietnam"]);
    assert.ok(same > neighbor);
    assert.ok(neighbor > far);
    assert.equal(far, 0);

    const profile = cyberProfile("Morocco");
    const vietnamOpp = scoreCompanyOpportunityMatch({
      profile,
      opportunity: {
        services: ["Cybersecurity"],
        industries: ["Technology"],
        geographies: ["Vietnam"],
        certifications: [],
        sizeBand: null,
        experienceYearsRequired: null,
        category: "Security",
        industry: "Technology",
      },
    });
    assert.equal(vietnamOpp.meetsRelevanceThreshold, true);
  });

  it("AI refine only reorders eligible IDs; low confidence falls back", async () => {
    const eligible = [
      {
        opportunityId: "a",
        title: "Cyber SOC",
        summary: "Security operations",
        services: ["Cybersecurity"],
        category: "Security",
        relevanceScore: 70,
      },
      {
        opportunityId: "b",
        title: "Cloud hardening",
        summary: "Cloud security",
        services: ["Cloud"],
        category: "Cloud",
        relevanceScore: 65,
      },
    ];

    const low = await refineEligibleWithAiAssist({
      companyServices: ["Cybersecurity"],
      candidates: eligible,
      enableAi: true,
      aiReorder: async () => ({
        order: ["b", "a", "ineligible-injected"],
        confidence: 0.1,
      }),
    });
    assert.equal(low.usedAi, false);
    assert.equal(low.reason, "low_confidence_fallback");
    assert.ok(low.confidence < AI_REFINE_MIN_CONFIDENCE);

    const high = await refineEligibleWithAiAssist({
      companyServices: ["Cybersecurity"],
      candidates: eligible,
      enableAi: true,
      aiReorder: async () => ({
        order: ["b", "a", "evil-new-id"],
        confidence: 0.9,
      }),
    });
    assert.equal(high.usedAi, true);
    assert.ok(!("evil-new-id" in high.boosts));
    assert.deepEqual(
      filterAiOrderToEligible(["b", "evil", "a"], new Set(["a", "b"])),
      ["b", "a"],
    );

    const final = computeFinalRankScore({
      relevanceScore: 70,
      preferenceBoost: 2,
      geographyBoost: 5,
      aiRefineBoost: 1,
    });
    assert.equal(final, 78);
  });

  it("supports two-sided intent seams without marketplace", () => {
    assert.ok(MATCHING_INTENT_DIRECTIONS.includes("LOOKING_FOR_SUPPLIER"));
    assert.ok(MATCHING_INTENT_DIRECTIONS.includes("OFFERING_SERVICE"));
    assert.equal(normalizeMatchingIntentDirection("LOOKING_FOR_PARTNER"), "LOOKING_FOR_PARTNER");
    assert.equal(normalizeMatchingIntentDirection("marketplace"), "UNSPECIFIED");
    const schema = readSrc("prisma/schema.prisma");
    assert.ok(schema.includes("MatchingIntentDirection"));
    assert.ok(schema.includes("LOOKING_FOR_CUSTOMER"));
    assert.ok(!readSrc("src/modules/matching-engine/index.ts").includes("marketplace"));
  });
});

describe("Feature 8E — integration", () => {
  before(async () => {
    await cleanup();
  });
  after(async () => {
    await cleanup();
  });

  it("persists preference snapshot with tenant isolation", async () => {
    const a = await seedCompany("prefs-a");
    const b = await seedCompany("prefs-b", {
      services: ["Logistics"],
    });

    const opp = await upsertOpportunity({
      title: "Cyber defense RFP",
      source: "ME8E_PREF",
      externalRef: `${PREFIX}pref-opp`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      category: "Security",
      geographies: ["Morocco"],
      intentDirection: "LOOKING_FOR_SUPPLIER",
    });
    opportunityIds.push(opp.id);

    await generateRecommendationsForCompany(a, { rebuildProfile: true });
    const rec = await prisma.matchRecommendation.findFirst({
      where: { companyId: a, opportunityId: opp.id },
    });
    assert.ok(rec);

    await recordBehaviorEventForCompany({
      companyId: a,
      opportunityId: opp.id,
      recommendationId: rec.id,
      eventType: "VIEW",
    });
    await recordBehaviorEventForCompany({
      companyId: a,
      opportunityId: opp.id,
      recommendationId: rec.id,
      eventType: "INTEREST",
      idempotencyKey: `interest:${a}:${rec.id}`,
    });

    const snap = await rebuildMatchingPreferencesForCompany(a);
    assert.ok((snap.weights.services.cybersecurity ?? 0) > 0);
    assert.equal(opp.intentDirection, "LOOKING_FOR_SUPPLIER");

    const other = await getMatchingPreferencesForCompany(b);
    assert.equal(other, null);

    const updated = await prisma.matchRecommendation.findUnique({
      where: { id: rec.id },
    });
    assert.equal(updated?.qualityState, "INTERESTED");
    assert.equal(updated?.isNew, false);
  });

  it("increments daily rollups and returns rates + SA health", async () => {
    await setMatchingSponsorshipGloballyEnabled(true);
    const companyId = await seedCompany("rollups");
    const opp = await upsertOpportunity({
      title: "Cloud SOC Morocco-Spain",
      source: "ME8E_ROLL",
      externalRef: `${PREFIX}roll-opp`,
      status: "ACTIVE",
      services: ["Cybersecurity", "Cloud"],
      industries: ["Technology"],
      category: "Security",
      geographies: ["Spain"],
    });
    opportunityIds.push(opp.id);

    const sponsorship = await createCompanySponsorship({
      companyId,
      opportunityId: opp.id,
      endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    await transitionSponsorship({
      sponsorshipId: sponsorship.id,
      to: "ACTIVE",
      actorAdminId: "sa-test",
    });

    await generateMatchRecommendations(companyId, { rebuildProfile: true });
    const rec = await prisma.matchRecommendation.findFirst({
      where: { companyId, opportunityId: opp.id },
    });
    assert.ok(rec);
    assert.equal(rec!.isNew, true);
    assert.ok((rec!.finalRankScore ?? 0) >= rec!.score);

    for (let i = 0; i < 3; i++) {
      await recordBehaviorEventForCompany({
        companyId,
        opportunityId: opp.id,
        recommendationId: rec!.id,
        eventType: "IMPRESSION",
        idempotencyKey: `imp:${companyId}:${rec!.id}:${i}`,
      });
    }
    await recordBehaviorEventForCompany({
      companyId,
      opportunityId: opp.id,
      recommendationId: rec!.id,
      eventType: "CLICK",
      idempotencyKey: `click:${companyId}:${rec!.id}`,
    });

    const companyAnalytics = await getCompanyMatchingAnalytics(companyId);
    assert.ok(companyAnalytics.impressions >= 3);
    assert.ok(companyAnalytics.rates.clickRate != null);
    assert.ok(companyAnalytics.byType.SPONSORED.impressions >= 1);

    const dayStats = await prisma.matchingOpportunityDailyStats.findFirst({
      where: { opportunityId: opp.id },
    });
    assert.ok(dayStats);
    assert.ok(dayStats!.impressions >= 3);

    const platform = await getPlatformMatchingAnalytics({
      from: new Date(Date.now() - 86400000),
      to: new Date(),
    });
    assert.ok(platform.impressions >= 1);
    assert.ok(platform.source === "rollups" || platform.source === "events");

    const health = await getMatchingEngineHealthAnalytics();
    assert.ok(health.opportunities.active >= 1);
    assert.ok(typeof health.eligibleCompanies === "number");
    assert.ok(health.funnel.rates);
  });

  it("does not let AI/preferences bypass hard gate; soft prefs reorder eligible", async () => {
    const companyId = await seedCompany("gate", {
      country: "Morocco",
      services: ["Cybersecurity"],
    });

    const goodLocal = await upsertOpportunity({
      title: "Local cyber",
      source: "ME8E_GATE",
      externalRef: `${PREFIX}gate-local`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      category: "Security",
    });
    const goodFar = await upsertOpportunity({
      title: "Vietnam cyber",
      source: "ME8E_GATE",
      externalRef: `${PREFIX}gate-far`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Vietnam"],
      category: "Security",
    });
    const bad = await upsertOpportunity({
      title: "Catering only",
      source: "ME8E_GATE",
      externalRef: `${PREFIX}gate-bad`,
      status: "ACTIVE",
      services: ["Catering"],
      industries: ["Hospitality"],
      geographies: ["Morocco"],
      category: "Food",
    });
    opportunityIds.push(goodLocal.id, goodFar.id, bad.id);

    // Seed preference toward Vietnam via fake engagement on a prior Vietnam-like pattern
    await prisma.companyMatchingPreferenceSnapshot.create({
      data: {
        companyId,
        contentHash: "test-pref",
        weightsJson: {
          services: { cybersecurity: 10 },
          categories: { security: 5 },
          industries: { technology: 5 },
          geographies: { vietnam: 20 },
          dismissServices: {},
        },
      },
    });

    const recs = await generateMatchRecommendations(companyId, {
      rebuildProfile: true,
      enableAiRefine: false,
    });
    const ids = recs.map((r) => r.opportunity.id);
    assert.ok(ids.includes(goodLocal.id));
    assert.ok(ids.includes(goodFar.id));
    assert.ok(!ids.includes(bad.id));

    const local = recs.find((r) => r.opportunity.id === goodLocal.id)!;
    const far = recs.find((r) => r.opportunity.id === goodFar.id)!;
    assert.ok(local.geographyBoost >= far.geographyBoost);
    assert.ok((far.preferenceBoost ?? 0) >= 0);
    // Cross-border still present
    assert.ok(far.score >= MATCHING_MIN_RELEVANCE_SCORE);
  });

  it("retention: new match flag and batch size unchanged for performance", async () => {
    const lifecycle = readSrc("src/domain/matching-engine/lifecycle.ts");
    assert.ok(lifecycle.includes("MATCHING_OPPORTUNITY_BATCH_SIZE = 200"));
    const service = readSrc("src/modules/matching-engine/internal/service.ts");
    assert.ok(service.includes("meetsRelevanceThreshold"));
    assert.ok(service.includes("refineEligibleWithAiAssist"));
    assert.ok(service.includes("preferenceAffinityScore"));
    // No AI on dashboard strip
    const strip = readSrc("src/modules/matching-engine/ui/matched-strip.tsx");
    assert.ok(!strip.includes("refineEligibleWithAiAssist"));
    assert.ok(!strip.includes("groupBy"));
  });

  it("score.ts capability gate file unchanged in contract", () => {
    const score = readSrc("src/domain/matching-engine/score.ts");
    assert.ok(score.includes("hardCapabilityMatch"));
    assert.ok(score.includes("meetsRelevanceThreshold"));
    assert.ok(score.includes('CAPABILITY_KEYS'));
  });
});
