/**
 * Feature 8G — End-to-end production readiness flows.
 * Integration tests over production matching services (no architecture rewrite).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  compareMatchRank,
  isOpportunitySponsoredForMatching,
  MATCHING_MIN_RELEVANCE_SCORE,
  refineEligibleWithAiAssist,
  scoreCompanyOpportunityMatch,
  opportunityToMatchingSignals,
  type MatchingProfileSnapshot,
} from "@/domain/matching-engine";
import { ENTITLEMENT_FEATURE_KEYS, UNSHIPPED_ENTITLEMENT_KEYS } from "@/domain/billing/entitlement-catalog";
import { prisma } from "@/lib/db";
import {
  MATCHING_ENGINE_FEATURE_KEY,
  MATCHING_SPONSORSHIP_SETTINGS_KEY,
  createCompanySponsorship,
  dismissRecommendationForCompany,
  generateRecommendationsForCompany,
  getPublicOpportunity,
  markRecommendationReadForCompany,
  recordBehaviorEventForCompany,
  setMatchingSponsorshipGloballyEnabled,
  transitionOpportunity,
  upsertOpportunity,
} from "@/modules/matching-engine";
import {
  generateMatchRecommendations,
  listMatchRecommendations,
} from "@/modules/matching-engine/internal/service";
import {
  getSponsorshipGlobalSettings,
  setSponsorshipGlobalEnabled,
  transitionSponsorship,
} from "@/modules/matching-engine/internal/sponsorship";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PREFIX = `me8g-${Date.now().toString(36)}-`;

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const companyIds: string[] = [];
const opportunityIds: string[] = [];
const sponsorshipIds: string[] = [];

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
    where: { source: { startsWith: "ME8G_" } },
  });
  await prisma.systemSetting.deleteMany({
    where: {
      OR: [
        { key: MATCHING_SPONSORSHIP_SETTINGS_KEY },
        { key: { startsWith: "matching.generate.lock:" } },
      ],
    },
  });
  companyIds.length = 0;
  opportunityIds.length = 0;
  sponsorshipIds.length = 0;
}

async function seedCompany(
  suffix: string,
  opts?: { country?: string; services?: string[]; experienceYears?: number },
) {
  const company = await prisma.company.create({
    data: {
      name: `ME8G ${suffix}`,
      slug: `${PREFIX}${suffix}`,
      country: opts?.country ?? "Morocco",
      companySize: "Medium",
      profile: {
        create: {
          industry: "Technology",
          country: opts?.country ?? "Morocco",
          companySize: "Medium",
          services: opts?.services ?? ["Cybersecurity", "Cloud"],
          geographicCoverage: [opts?.country ?? "Morocco"],
          experienceYears: opts?.experienceYears ?? 8,
          completeness: 80,
        },
      },
    },
  });
  companyIds.push(company.id);
  return company.id;
}

const cyberProfile: MatchingProfileSnapshot = {
  services: [{ value: "Cybersecurity", trust: "strong", source: "sq" }],
  industries: [{ value: "Technology", trust: "normal", source: "p" }],
  geographies: [{ value: "Morocco", trust: "normal", source: "p" }],
  certifications: [],
  size: { value: "Medium", trust: "normal", source: "p" },
  experienceYears: { value: 8, trust: "normal", source: "p" },
  dcmCategories: [],
  softNotes: [],
};

describe("Feature 8G — production readiness defaults", () => {
  it("keeps matching_engine OFF / unshipped by default", () => {
    assert.ok(ENTITLEMENT_FEATURE_KEYS.includes("matching_engine"));
    assert.ok(UNSHIPPED_ENTITLEMENT_KEYS.includes("matching_engine"));
    assert.equal(MATCHING_ENGINE_FEATURE_KEY, "matching_engine");
    const catalog = readSrc("src/domain/billing/entitlement-catalog.ts");
    assert.match(catalog, /defaultEnabledGlobal:\s*false/);
  });

  it("wires SA opportunity audit and sponsorship company gate in source", () => {
    const opp = readSrc("src/app/api/matching-engine/opportunities/route.ts");
    assert.match(opp, /writeAdminAudit/);
    assert.match(opp, /MATCHING_OPPORTUNITY_UPSERTED/);
    const status = readSrc(
      "src/app/api/matching-engine/opportunities/[opportunityId]/status/route.ts",
    );
    assert.match(status, /writeAdminAudit/);
    const sponsorships = readSrc(
      "src/app/api/matching-engine/sponsorships/route.ts",
    );
    assert.match(sponsorships, /isMatchingSponsorshipGloballyEnabled/);
    const lifecycle = readSrc(
      "src/modules/matching-engine/internal/lifecycle.ts",
    );
    // Soft-hide on leave-live: must not mass-DISMISS company recommendations
    assert.match(lifecycle, /Soft-hide/);
    assert.doesNotMatch(lifecycle, /updateMany/);
    assert.doesNotMatch(
      lifecycle,
      /status: \{ in: \["ACTIVE", "READ"\] \}/,
    );
  });
});

describe("Feature 8G — end-to-end flows", () => {
  before(async () => {
    try {
      await cleanup();
    } catch (err) {
      console.warn("[me8g] pre-cleanup warning", err);
    }
  });
  after(async () => {
    try {
      await cleanup();
    } catch (err) {
      console.warn("[me8g] post-cleanup warning", err);
    }
  });

  it("eligible company receives valid matches; below-threshold and irrelevant never recommended", async () => {
    const eligible = await seedCompany("eligible");
    const thin = await seedCompany("thin", {
      services: ["Legal Translation"],
      country: "Iceland",
      experienceYears: 1,
    });
    // Force thin company industry away from Technology
    await prisma.companyProfile.update({
      where: { companyId: thin },
      data: {
        industry: "Agriculture",
        services: ["Legal Translation"],
        geographicCoverage: ["Iceland"],
      },
    });

    const relevant = await upsertOpportunity({
      title: "Cybersecurity SOC Morocco",
      source: "ME8G_FLOW",
      externalRef: `${PREFIX}rel`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      sizeBand: "Medium",
      experienceHint: "5 years",
      deadline: new Date(Date.now() + 14 * 86400000),
    });
    opportunityIds.push(relevant.id);

    const irrelevant = await upsertOpportunity({
      title: "Agricultural Irrigation",
      source: "ME8G_FLOW",
      externalRef: `${PREFIX}irr`,
      status: "ACTIVE",
      services: ["Irrigation"],
      industries: ["Agriculture"],
      geographies: ["Morocco"],
      deadline: new Date(Date.now() + 14 * 86400000),
    });
    opportunityIds.push(irrelevant.id);

    const matches = await generateMatchRecommendations(eligible, {
      rebuildProfile: true,
      enableAiRefine: false,
    });
    assert.ok(matches.some((m) => m.opportunity.id === relevant.id));
    assert.ok(matches.every((m) => m.score >= MATCHING_MIN_RELEVANCE_SCORE));
    assert.ok(!matches.some((m) => m.opportunity.id === irrelevant.id));

    const thinMatches = await generateMatchRecommendations(thin, {
      rebuildProfile: true,
      enableAiRefine: false,
    });
    assert.ok(!thinMatches.some((m) => m.opportunity.id === relevant.id));
    assert.ok(!thinMatches.some((m) => m.opportunity.id === irrelevant.id));

    const below = scoreCompanyOpportunityMatch({
      profile: {
        ...cyberProfile,
        services: [{ value: "Legal Translation", trust: "normal", source: "p" }],
        industries: [{ value: "Agriculture", trust: "normal", source: "p" }],
        geographies: [{ value: "Iceland", trust: "normal", source: "p" }],
      },
      opportunity: opportunityToMatchingSignals({
        services: ["Cybersecurity"],
        industries: ["Technology"],
        geographies: ["Morocco"],
        certifications: [],
      }),
    });
    assert.equal(below.meetsRelevanceThreshold, false);
  });

  it("organic outranks weaker sponsored; sponsored irrelevant rejected; sponsorship OFF labels organic", async () => {
    await setMatchingSponsorshipGloballyEnabled(false);
    assert.equal(
      isOpportunitySponsoredForMatching({
        globalEnabled: false,
        opportunitySponsored: true,
      }),
      false,
    );

    await setMatchingSponsorshipGloballyEnabled(true);
    const companyId = await seedCompany("rank");
    const organicStrong = await upsertOpportunity({
      title: "Full Cybersecurity Program Morocco",
      source: "ME8G_RANK",
      externalRef: `${PREFIX}org`,
      status: "ACTIVE",
      services: ["Cybersecurity", "Cloud"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      sizeBand: "Medium",
      experienceHint: "8 years",
      deadline: new Date(Date.now() + 14 * 86400000),
    });
    opportunityIds.push(organicStrong.id);

    const sponsoredWeak = await upsertOpportunity({
      title: "Partial Cloud Advisory Spain",
      source: "ME8G_RANK",
      externalRef: `${PREFIX}spw`,
      status: "ACTIVE",
      services: ["Cloud"],
      industries: ["Technology"],
      geographies: ["Spain"],
      sizeBand: "Medium",
      experienceHint: "3 years",
      deadline: new Date(Date.now() + 14 * 86400000),
    });
    opportunityIds.push(sponsoredWeak.id);

    const sponsoredBad = await upsertOpportunity({
      title: "Farm Equipment Lease",
      source: "ME8G_RANK",
      externalRef: `${PREFIX}spb`,
      status: "ACTIVE",
      services: ["Farm Equipment"],
      industries: ["Agriculture"],
      geographies: ["Morocco"],
      deadline: new Date(Date.now() + 14 * 86400000),
    });
    opportunityIds.push(sponsoredBad.id);

    const sp1 = await createCompanySponsorship({
      companyId,
      opportunityId: sponsoredWeak.id,
      endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    sponsorshipIds.push(sp1.id);
    await transitionSponsorship({
      sponsorshipId: sp1.id,
      to: "ACTIVE",
      actorAdminId: "sa-test",
    });

    const sp2 = await createCompanySponsorship({
      companyId,
      opportunityId: sponsoredBad.id,
      endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    sponsorshipIds.push(sp2.id);
    await transitionSponsorship({
      sponsorshipId: sp2.id,
      to: "ACTIVE",
      actorAdminId: "sa-test",
    });

    const list = await generateMatchRecommendations(companyId, {
      rebuildProfile: true,
      enableAiRefine: false,
    });
    assert.ok(!list.some((r) => r.opportunity.id === sponsoredBad.id));

    const org = list.find((r) => r.opportunity.id === organicStrong.id);
    const spw = list.find((r) => r.opportunity.id === sponsoredWeak.id);
    assert.ok(org);
    if (spw) {
      assert.ok(
        (org.finalRankScore ?? org.score) >= (spw.finalRankScore ?? spw.score),
      );
      if ((org.score === spw.score) || (org.finalRankScore === spw.finalRankScore)) {
        assert.ok(
          compareMatchRank(
            {
              score: org.score,
              confidence: org.confidence,
              finalRankScore: org.finalRankScore,
              type: org.type,
              id: org.id,
            },
            {
              score: spw.score,
              confidence: spw.confidence,
              finalRankScore: spw.finalRankScore,
              type: spw.type,
              id: spw.id,
            },
          ) <= 0,
        );
      }
    }
  });

  it("opportunity expiry hides recommendations; READ survives pause/reactivate; dismiss survives regen", async () => {
    const companyId = await seedCompany("life");
    const opp = await upsertOpportunity({
      title: "Cybersecurity Lifecycle Morocco",
      source: "ME8G_LIFE",
      externalRef: `${PREFIX}life`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      sizeBand: "Medium",
      experienceHint: "5 years",
      deadline: new Date(Date.now() + 10 * 86400000),
    });
    opportunityIds.push(opp.id);

    await generateMatchRecommendations(companyId, {
      rebuildProfile: true,
      enableAiRefine: false,
    });
    let visible = await listMatchRecommendations(companyId, {
      status: "VISIBLE",
    });
    const rec = visible.find((r) => r.opportunity.id === opp.id);
    assert.ok(rec);

    await markRecommendationReadForCompany(companyId, rec.id);
    await transitionOpportunity(opp.id, "PAUSED");
    visible = await listMatchRecommendations(companyId, { status: "VISIBLE" });
    assert.ok(!visible.some((r) => r.opportunity.id === opp.id));

    const pausedRow = await prisma.matchRecommendation.findFirst({
      where: { companyId, opportunityId: opp.id },
    });
    assert.equal(pausedRow?.status, "READ");

    await transitionOpportunity(opp.id, "ACTIVE");
    visible = await listMatchRecommendations(companyId, { status: "VISIBLE" });
    const restored = visible.find((r) => r.opportunity.id === opp.id);
    assert.ok(restored);
    assert.equal(restored.status, "READ");

    await dismissRecommendationForCompany(companyId, restored.id);
    await generateRecommendationsForCompany(companyId, {
      rebuildProfile: false,
      enableAiRefine: false,
    });
    visible = await listMatchRecommendations(companyId, { status: "VISIBLE" });
    assert.ok(!visible.some((r) => r.opportunity.id === opp.id));
    const dismissed = await prisma.matchRecommendation.findFirst({
      where: { companyId, opportunityId: opp.id },
    });
    assert.equal(dismissed?.status, "DISMISSED");

    await prisma.matchingOpportunity.update({
      where: { id: opp.id },
      data: { deadline: new Date(Date.now() - 3600_000), status: "EXPIRED" },
    });
    visible = await listMatchRecommendations(companyId, { status: "VISIBLE" });
    assert.ok(!visible.some((r) => r.opportunity.id === opp.id));
  });

  it("AI failure falls back to deterministic; cross-border relevant allowed; private fields never on public DTO", async () => {
    const scored = scoreCompanyOpportunityMatch({
      profile: cyberProfile,
      opportunity: opportunityToMatchingSignals({
        services: ["Cybersecurity"],
        industries: ["Technology"],
        geographies: ["Spain"],
        certifications: [],
      }),
    });
    assert.equal(scored.meetsRelevanceThreshold, true);

    const fallback = await refineEligibleWithAiAssist({
      companyServices: ["Cybersecurity"],
      candidates: [
        {
          opportunityId: "a",
          title: "A",
          summary: null,
          services: ["Cybersecurity"],
          category: null,
          relevanceScore: 90,
        },
        {
          opportunityId: "b",
          title: "B",
          summary: null,
          services: ["Cybersecurity"],
          category: null,
          relevanceScore: 80,
        },
      ],
      enableAi: true,
      aiReorder: async () => {
        throw new Error("provider down");
      },
    });
    assert.equal(fallback.usedAi, false);
    assert.equal(fallback.reason, "ai_error_fallback");

    const injected = await refineEligibleWithAiAssist({
      companyServices: ["Cybersecurity"],
      candidates: [
        {
          opportunityId: "a",
          title: "A",
          summary: null,
          services: ["Cybersecurity"],
          category: null,
          relevanceScore: 90,
        },
        {
          opportunityId: "b",
          title: "B",
          summary: null,
          services: ["Cybersecurity"],
          category: null,
          relevanceScore: 80,
        },
      ],
      enableAi: true,
      aiReorder: async () => ({
        order: ["a", "evil-injected", "b"],
        confidence: 0.99,
      }),
    });
    assert.equal(injected.usedAi, true);
    assert.ok(injected.boosts["a"] != null);
    assert.equal(injected.boosts["evil-injected"], undefined);

    const pub = readSrc("src/modules/matching-engine/internal/service.ts");
    assert.match(pub, /function toPublicOpportunity/);
    assert.doesNotMatch(
      pub.slice(
        pub.indexOf("function toPublicOpportunity"),
        pub.indexOf("function toRecommendationDto"),
      ),
      /knowledgeJson|draftText|storageKey|snapshotJson/,
    );
    const dtoSrc = readSrc("src/modules/matching-engine/internal/types.ts");
    assert.doesNotMatch(dtoSrc, /knowledgeJson|draftText|storageKey/);
  });

  it("tenant isolation + Super Admin sponsorship global settings + analytics require owned recommendation", async () => {
    const a = await seedCompany("ten-a");
    const b = await seedCompany("ten-b");
    const opp = await upsertOpportunity({
      title: "Cybersecurity Tenant Isolation",
      source: "ME8G_TEN",
      externalRef: `${PREFIX}ten`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      sizeBand: "Medium",
      experienceHint: "5 years",
      deadline: new Date(Date.now() + 14 * 86400000),
    });
    opportunityIds.push(opp.id);

    await generateMatchRecommendations(a, {
      rebuildProfile: true,
      enableAiRefine: false,
    });
    await generateMatchRecommendations(b, {
      rebuildProfile: true,
      enableAiRefine: false,
    });

    const aRec = await prisma.matchRecommendation.findFirst({
      where: { companyId: a, opportunityId: opp.id },
    });
    assert.ok(aRec);

    await assert.rejects(
      () =>
        recordBehaviorEventForCompany({
          companyId: b,
          opportunityId: opp.id,
          recommendationId: aRec.id,
          eventType: "VIEW",
        }),
      /not found/i,
    );

    await assert.rejects(
      () =>
        recordBehaviorEventForCompany({
          companyId: a,
          opportunityId: opp.id,
          eventType: "CLICK",
        }),
      /recommendationId is required/i,
    );

    const before = await getSponsorshipGlobalSettings();
    const off = await setSponsorshipGlobalEnabled(false);
    assert.equal(off.enabledGlobal, false);
    const on = await setSponsorshipGlobalEnabled(true);
    assert.equal(on.enabledGlobal, true);
    assert.notEqual(before.enabledGlobal, undefined);

    const saService = readSrc(
      "src/application/admin/matching-sponsorship-service.ts",
    );
    assert.match(saService, /saSetMatchingSponsorshipGlobal/);
    assert.match(saService, /writeAdminAudit/);
    assert.match(saService, /MATCHING_SPONSORSHIP_GLOBAL_UPDATED/);

    // Restore sponsorship OFF default for suite hygiene
    await setSponsorshipGlobalEnabled(false);
  });

  it("idempotent generation and impression events", async () => {
    const companyId = await seedCompany("idem");
    const opp = await upsertOpportunity({
      title: "Cybersecurity Idempotency Morocco",
      source: "ME8G_IDEM",
      externalRef: `${PREFIX}idem`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      sizeBand: "Medium",
      experienceHint: "5 years",
      deadline: new Date(Date.now() + 14 * 86400000),
    });
    opportunityIds.push(opp.id);

    const first = await generateMatchRecommendations(companyId, {
      rebuildProfile: true,
      enableAiRefine: false,
    });
    const second = await generateMatchRecommendations(companyId, {
      rebuildProfile: false,
      enableAiRefine: false,
    });
    assert.equal(first.length, second.length);
    const rec = first.find((r) => r.opportunity.id === opp.id);
    assert.ok(rec);

    const e1 = await recordBehaviorEventForCompany({
      companyId,
      opportunityId: opp.id,
      recommendationId: rec.id,
      eventType: "IMPRESSION",
      idempotencyKey: `imp:${companyId}:${rec.id}:8g`,
    });
    const e2 = await recordBehaviorEventForCompany({
      companyId,
      opportunityId: opp.id,
      recommendationId: rec.id,
      eventType: "IMPRESSION",
      idempotencyKey: `imp:${companyId}:${rec.id}:8g`,
    });
    assert.equal(e1.duplicate, false);
    assert.equal(e2.duplicate, true);
    assert.equal(e1.id, e2.id);

    const publicOpp = await getPublicOpportunity(opp.id);
    assert.ok(publicOpp);
    assert.equal(
      Object.keys(publicOpp).includes("knowledgeJson"),
      false,
    );
  });
});
