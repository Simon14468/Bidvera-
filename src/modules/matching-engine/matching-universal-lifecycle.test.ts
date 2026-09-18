/**
 * Universal opportunity lifecycle hardening —
 * Opportunity = shared global; MatchRecommendation = company-scoped.
 * Does not change scoring / relevance floor / threshold / AI.
 */

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  isCompanyScopedRecommendationAction,
  isOpportunityLiveForMatching,
  isOpportunityOpenForNewMatches,
  MATCHING_MIN_RELEVANCE_SCORE,
  opportunityToMatchingSignals,
  scoreCompanyOpportunityMatch,
  type MatchingProfileSnapshot,
} from "@/domain/matching-engine";
import { prisma } from "@/lib/db";
import {
  MATCHING_ENGINE_FEATURE_KEY,
  MATCHING_SPONSORSHIP_SETTINGS_KEY,
  createCompanySponsorship,
  dismissRecommendationForCompany,
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
import { transitionSponsorship } from "@/modules/matching-engine/internal/sponsorship";

const PREFIX = `me-ulc-${Date.now().toString(36)}-`;

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
    await prisma.companyMatchingProfile.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.companyProfile.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }
  if (opportunityIds.length) {
    await prisma.matchingOpportunity.deleteMany({
      where: { id: { in: opportunityIds } },
    });
  }
  await prisma.matchingOpportunity.deleteMany({
    where: { source: { startsWith: "ME_ULC_" } },
  });
  await prisma.systemSetting.deleteMany({
    where: { key: MATCHING_SPONSORSHIP_SETTINGS_KEY },
  });
  companyIds.length = 0;
  opportunityIds.length = 0;
}

async function seedCompany(
  slugSuffix: string,
  opts?: { country?: string; coverage?: string[] },
) {
  const country = opts?.country ?? "Morocco";
  const company = await prisma.company.create({
    data: {
      name: `ME ULC ${slugSuffix}`,
      slug: `${PREFIX}${slugSuffix}`,
      country,
      companySize: "Medium",
      profile: {
        create: {
          industry: "Technology",
          country,
          companySize: "Medium",
          services: ["Cybersecurity", "Cloud"],
          geographicCoverage: opts?.coverage ?? [country],
          experienceYears: 8,
          completeness: 80,
        },
      },
    },
  });
  companyIds.push(company.id);
  return company.id;
}

describe("Universal opportunity lifecycle", () => {
  before(async () => {
    await cleanup();
    await prisma.feature.upsert({
      where: { key: MATCHING_ENGINE_FEATURE_KEY },
      create: {
        key: MATCHING_ENGINE_FEATURE_KEY,
        name: "Matching Engine",
        description: "Matching Engine",
        enabledGlobal: false,
      },
      update: { enabledGlobal: false },
    });
    await setMatchingSponsorshipGloballyEnabled(true);
  });

  after(async () => {
    await cleanup();
    await setMatchingSponsorshipGloballyEnabled(false);
  });

  it("documents company actions as tenant-scoped (not opportunity closure)", () => {
    assert.equal(isCompanyScopedRecommendationAction("INTEREST"), true);
    assert.equal(isCompanyScopedRecommendationAction("DISMISS"), true);
    assert.equal(
      isOpportunityOpenForNewMatches({
        status: "ACTIVE",
        deadline: null,
      }),
      true,
    );
    assert.equal(
      isOpportunityOpenForNewMatches({
        status: "EXPIRED",
        deadline: null,
      }),
      false,
    );
    assert.equal(MATCHING_MIN_RELEVANCE_SCORE, 40);
  });

  it("one opportunity matches many companies with coexisting company states", async () => {
    const a = await seedCompany("co-a");
    const b = await seedCompany("co-b");
    const c = await seedCompany("co-c");
    const d = await seedCompany("co-d");

    const opp = await upsertOpportunity({
      title: "Cybersecurity Framework — Multi-supplier",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      sizeBand: "Medium",
      experienceHint: "5 years",
      source: "ME_ULC_MULTI",
      externalRef: `${PREFIX}multi-1`,
      status: "ACTIVE",
      deadline: new Date(Date.now() + 14 * 86400000),
    });
    opportunityIds.push(opp.id);

    for (const companyId of [a, b, c, d]) {
      await generateMatchRecommendations(companyId, { rebuildProfile: true });
    }

    const recA = (
      await listMatchRecommendations(a, { status: "VISIBLE" })
    ).find((r) => r.opportunity.id === opp.id);
    const recB = (
      await listMatchRecommendations(b, { status: "VISIBLE" })
    ).find((r) => r.opportunity.id === opp.id);
    const recC = (
      await listMatchRecommendations(c, { status: "VISIBLE" })
    ).find((r) => r.opportunity.id === opp.id);
    const recD = (
      await listMatchRecommendations(d, { status: "VISIBLE" })
    ).find((r) => r.opportunity.id === opp.id);
    assert.ok(recA && recB && recC && recD);

    await recordBehaviorEventForCompany({
      companyId: a,
      opportunityId: opp.id,
      recommendationId: recA.id,
      eventType: "INTEREST",
    });
    await markRecommendationReadForCompany(b, recB.id);
    await recordBehaviorEventForCompany({
      companyId: c,
      opportunityId: opp.id,
      recommendationId: recC.id,
      eventType: "VIEW",
    });
    await dismissRecommendationForCompany(d, recD.id);

    const oppAfter = await prisma.matchingOpportunity.findUnique({
      where: { id: opp.id },
    });
    assert.equal(oppAfter?.status, "ACTIVE");

    const rowA = await prisma.matchRecommendation.findFirst({
      where: { companyId: a, opportunityId: opp.id },
    });
    const rowB = await prisma.matchRecommendation.findFirst({
      where: { companyId: b, opportunityId: opp.id },
    });
    const rowC = await prisma.matchRecommendation.findFirst({
      where: { companyId: c, opportunityId: opp.id },
    });
    const rowD = await prisma.matchRecommendation.findFirst({
      where: { companyId: d, opportunityId: opp.id },
    });
    assert.equal(rowA?.qualityState, "INTERESTED");
    assert.equal(rowB?.status, "READ");
    assert.ok(
      rowC?.qualityState === "ENGAGED" || rowC?.status === "ACTIVE" || rowC?.status === "READ",
    );
    assert.equal(rowD?.status, "DISMISSED");

    // A INTERESTED does not remove opportunity for B/C
    const visibleB = await listMatchRecommendations(b, { status: "VISIBLE" });
    const visibleC = await listMatchRecommendations(c, { status: "VISIBLE" });
    assert.ok(visibleB.some((r) => r.opportunity.id === opp.id));
    assert.ok(visibleC.some((r) => r.opportunity.id === opp.id));
    const visibleD = await listMatchRecommendations(d, { status: "VISIBLE" });
    assert.ok(!visibleD.some((r) => r.opportunity.id === opp.id));
  });

  it("INTEREST does not close multi-winner opportunity for others", async () => {
    const winnerLike = await seedCompany("win-a");
    const peer = await seedCompany("win-b");
    const opp = await upsertOpportunity({
      title: "IT Managed Services — Framework",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      sizeBand: "Medium",
      experienceHint: "5 years",
      source: "ME_ULC_FRAME",
      externalRef: `${PREFIX}frame-1`,
      status: "ACTIVE",
      deadline: new Date(Date.now() + 21 * 86400000),
    });
    opportunityIds.push(opp.id);

    await generateMatchRecommendations(winnerLike, { rebuildProfile: true });
    await generateMatchRecommendations(peer, { rebuildProfile: true });

    const rec = (
      await listMatchRecommendations(winnerLike, { status: "VISIBLE" })
    ).find((r) => r.opportunity.id === opp.id);
    assert.ok(rec);
    await recordBehaviorEventForCompany({
      companyId: winnerLike,
      opportunityId: opp.id,
      recommendationId: rec.id,
      eventType: "INTEREST",
    });

    const stillLive = await prisma.matchingOpportunity.findUnique({
      where: { id: opp.id },
    });
    assert.equal(stillLive?.status, "ACTIVE");
    assert.equal(
      isOpportunityLiveForMatching({
        status: stillLive!.status,
        deadline: stillLive!.deadline,
      }),
      true,
    );

    const peerVisible = await listMatchRecommendations(peer, {
      status: "VISIBLE",
    });
    assert.ok(peerVisible.some((r) => r.opportunity.id === opp.id));
  });

  it("expired/closed opportunity stops new matches; PAUSE soft-hides without mass dismiss", async () => {
    const companyId = await seedCompany("life");
    const peer = await seedCompany("life-peer");
    const opp = await upsertOpportunity({
      title: "Cybersecurity Services — Lifecycle",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      sizeBand: "Medium",
      experienceHint: "5 years",
      source: "ME_ULC_LIFE",
      externalRef: `${PREFIX}life-1`,
      status: "ACTIVE",
      deadline: new Date(Date.now() + 10 * 86400000),
    });
    opportunityIds.push(opp.id);

    await generateMatchRecommendations(companyId, { rebuildProfile: true });
    await generateMatchRecommendations(peer, { rebuildProfile: true });

    const rec = (
      await listMatchRecommendations(companyId, { status: "VISIBLE" })
    ).find((r) => r.opportunity.id === opp.id);
    assert.ok(rec);
    assert.equal(rec.status, "ACTIVE");

    await transitionOpportunity(opp.id, "PAUSED");
    let visible = await listMatchRecommendations(companyId, {
      status: "VISIBLE",
    });
    assert.ok(!visible.some((r) => r.opportunity.id === opp.id));

    const pausedRow = await prisma.matchRecommendation.findFirst({
      where: { companyId, opportunityId: opp.id },
    });
    // Soft-hide: unread ACTIVE must NOT become DISMISSED on PAUSE
    assert.equal(pausedRow?.status, "ACTIVE");

    const peerPaused = await prisma.matchRecommendation.findFirst({
      where: { companyId: peer, opportunityId: opp.id },
    });
    assert.equal(peerPaused?.status, "ACTIVE");

    await transitionOpportunity(opp.id, "ACTIVE");
    visible = await listMatchRecommendations(companyId, { status: "VISIBLE" });
    assert.ok(visible.some((r) => r.opportunity.id === opp.id));

    await transitionOpportunity(opp.id, "EXPIRED");
    visible = await listMatchRecommendations(companyId, { status: "VISIBLE" });
    assert.ok(!visible.some((r) => r.opportunity.id === opp.id));
    assert.equal(
      isOpportunityOpenForNewMatches({
        status: "EXPIRED",
        deadline: null,
      }),
      false,
    );

    // Existing company rows remain; opportunity not deleted
    const oppRow = await prisma.matchingOpportunity.findUnique({
      where: { id: opp.id },
    });
    assert.ok(oppRow);
    assert.equal(oppRow.status, "EXPIRED");
    const expiredRec = await prisma.matchRecommendation.findFirst({
      where: { companyId, opportunityId: opp.id },
    });
    assert.ok(expiredRec);
    assert.notEqual(expiredRec.status, "DISMISSED");
  });

  it("READ/DISMISSED remain company-specific with no cross-tenant leakage", async () => {
    const a = await seedCompany("priv-a");
    const b = await seedCompany("priv-b");
    const opp = await upsertOpportunity({
      title: "Cloud Security — Privacy",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      sizeBand: "Medium",
      experienceHint: "5 years",
      source: "ME_ULC_PRIV",
      externalRef: `${PREFIX}priv-1`,
      status: "ACTIVE",
      deadline: new Date(Date.now() + 7 * 86400000),
    });
    opportunityIds.push(opp.id);

    await generateMatchRecommendations(a, { rebuildProfile: true });
    await generateMatchRecommendations(b, { rebuildProfile: true });

    const recA = (
      await listMatchRecommendations(a, { status: "VISIBLE" })
    ).find((r) => r.opportunity.id === opp.id);
    const recB = (
      await listMatchRecommendations(b, { status: "VISIBLE" })
    ).find((r) => r.opportunity.id === opp.id);
    assert.ok(recA && recB);

    await markRecommendationReadForCompany(a, recA.id);
    await dismissRecommendationForCompany(a, recA.id);
    await recordBehaviorEventForCompany({
      companyId: a,
      opportunityId: opp.id,
      recommendationId: recA.id,
      eventType: "DISMISS",
    });

    // B still sees the opportunity; A's DISMISS did not leak
    const listB = await listMatchRecommendations(b, { status: "VISIBLE" });
    const stillB = listB.find((r) => r.opportunity.id === opp.id);
    assert.ok(stillB);
    assert.notEqual(stillB.status, "DISMISSED");
    assert.notEqual(stillB.qualityState, "INTERESTED");

    // Direct tenant isolation: B cannot load A's recommendation id
    const leaked = await prisma.matchRecommendation.findFirst({
      where: { id: recA.id, companyId: b },
    });
    assert.equal(leaked, null);

    const eventsB = await prisma.matchingBehaviorEvent.findMany({
      where: { companyId: b, opportunityId: opp.id },
    });
    assert.equal(eventsB.length, 0);

    const eventsA = await prisma.matchingBehaviorEvent.findMany({
      where: { companyId: a, opportunityId: opp.id },
    });
    assert.ok(eventsA.length >= 1);
  });

  it("cross-border matching remains possible (geo soft only)", () => {
    const sig = (value: string) =>
      ({ value, trust: "normal" as const, source: "profile" });
    const profile: MatchingProfileSnapshot = {
      services: [sig("Cybersecurity")],
      industries: [sig("Technology")],
      geographies: [sig("Morocco")],
      certifications: [],
      size: { value: "Medium", trust: "normal", source: "profile" },
      experienceYears: { value: 8, trust: "normal", source: "profile" },
      dcmCategories: [],
      softNotes: [],
    };
    const scored = scoreCompanyOpportunityMatch({
      profile,
      opportunity: opportunityToMatchingSignals({
        services: ["Cybersecurity"],
        industries: ["Technology"],
        geographies: ["Spain"],
        certifications: [],
      }),
    });
    assert.equal(scored.meetsRelevanceThreshold, true);
    assert.ok(scored.score >= MATCHING_MIN_RELEVANCE_SCORE);
  });

  it("sponsored follows same company-specific lifecycle (no global exclusivity)", async () => {
    const sponsor = await seedCompany("sp-s");
    const viewerA = await seedCompany("sp-a");
    const viewerB = await seedCompany("sp-b");

    const opp = await upsertOpportunity({
      title: "Cybersecurity Sponsored — Shared",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      sizeBand: "Medium",
      experienceHint: "5 years",
      source: "ME_ULC_SP",
      externalRef: `${PREFIX}sp-1`,
      status: "ACTIVE",
      deadline: new Date(Date.now() + 7 * 86400000),
    });
    opportunityIds.push(opp.id);

    const sp = await createCompanySponsorship({
      companyId: sponsor,
      opportunityId: opp.id,
      endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    await transitionSponsorship({ sponsorshipId: sp.id, to: "ACTIVE", actorAdminId: "sa-test" });

    await generateMatchRecommendations(viewerA, { rebuildProfile: true });
    await generateMatchRecommendations(viewerB, { rebuildProfile: true });

    const recA = (
      await listMatchRecommendations(viewerA, { status: "VISIBLE" })
    ).find((r) => r.opportunity.id === opp.id);
    const recB = (
      await listMatchRecommendations(viewerB, { status: "VISIBLE" })
    ).find((r) => r.opportunity.id === opp.id);
    assert.ok(recA && recB);
    assert.equal(recA.opportunity.sponsored, true);
    assert.equal(recB.opportunity.sponsored, true);

    await dismissRecommendationForCompany(viewerA, recA.id);

    const oppStill = await prisma.matchingOpportunity.findUnique({
      where: { id: opp.id },
    });
    assert.equal(oppStill?.status, "ACTIVE");
    assert.equal(oppStill?.sponsored, true);

    const visibleB = await listMatchRecommendations(viewerB, {
      status: "VISIBLE",
    });
    assert.ok(visibleB.some((r) => r.opportunity.id === opp.id));

    // Irrelevant sponsored agriculture must still fail relevance (no bypass)
    const bad = await upsertOpportunity({
      title: "Agricultural Equipment Sponsored",
      services: ["Agricultural Equipment"],
      industries: ["Agriculture"],
      geographies: ["Morocco"],
      source: "ME_ULC_SP_BAD",
      externalRef: `${PREFIX}sp-bad`,
      status: "ACTIVE",
    });
    opportunityIds.push(bad.id);
    const badSp = await createCompanySponsorship({
      companyId: sponsor,
      opportunityId: bad.id,
      endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    await transitionSponsorship({ sponsorshipId: badSp.id, to: "ACTIVE", actorAdminId: "sa-test" });
    await generateMatchRecommendations(viewerB, { rebuildProfile: false });
    const visibleAfter = await listMatchRecommendations(viewerB, {
      status: "VISIBLE",
    });
    assert.ok(!visibleAfter.some((r) => r.opportunity.id === bad.id));
  });
});
