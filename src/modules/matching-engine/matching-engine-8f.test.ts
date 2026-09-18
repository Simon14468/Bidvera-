/**
 * Feature 8F — Sponsorship & monetization foundation tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  compareMatchRank,
  isOpportunitySponsoredForMatching,
  scoreCompanyOpportunityMatch,
  validateSponsorshipEligibility,
  type MatchingProfileSnapshot,
} from "@/domain/matching-engine";
import { ENTITLEMENT_FEATURE_KEYS, UNSHIPPED_ENTITLEMENT_KEYS } from "@/domain/billing/entitlement-catalog";
import { prisma } from "@/lib/db";
import {
  MATCHING_ENGINE_FEATURE_KEY,
  createCompanySponsorship,
  generateRecommendationsForCompany,
  listCompanySponsorships,
  recordBehaviorEventForCompany,
  reconcileMatchingSponsorshipLifecycle,
  transitionCompanySponsorship,
  upsertOpportunity,
} from "@/modules/matching-engine";
import { transitionSponsorship } from "@/modules/matching-engine/internal/sponsorship";
import {
  setMatchingSponsorshipGloballyEnabled,
  MATCHING_SPONSORSHIP_SETTINGS_KEY,
} from "@/modules/matching-engine/internal/sponsorship-settings";
import { generateMatchRecommendations } from "@/modules/matching-engine/internal/service";
import { AppError } from "@/lib/errors";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PREFIX = `me8f-${Date.now().toString(36)}-`;

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const companyIds: string[] = [];
const opportunityIds: string[] = [];
const sponsorshipIds: string[] = [];

async function cleanup() {
  if (sponsorshipIds.length) {
    await prisma.matchingSponsorship.deleteMany({
      where: { id: { in: sponsorshipIds } },
    });
  }
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
    where: { source: { startsWith: "ME8F_" } },
  });
  await prisma.systemSetting.deleteMany({
    where: { key: MATCHING_SPONSORSHIP_SETTINGS_KEY },
  });
  companyIds.length = 0;
  opportunityIds.length = 0;
  sponsorshipIds.length = 0;
}

async function seedCompany(suffix: string, services = ["Cybersecurity"]) {
  const company = await prisma.company.create({
    data: {
      name: `ME8F ${suffix}`,
      slug: `${PREFIX}${suffix}`,
      country: "Morocco",
      companySize: "Medium",
      profile: {
        create: {
          industry: "Technology",
          country: "Morocco",
          companySize: "Medium",
          services,
          geographicCoverage: ["Morocco"],
          experienceYears: 8,
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

describe("Feature 8F — domain sponsorship rules", () => {
  it("keeps matching_engine OFF / unshipped by default", () => {
    assert.ok(ENTITLEMENT_FEATURE_KEYS.includes("matching_engine"));
    assert.ok(UNSHIPPED_ENTITLEMENT_KEYS.includes("matching_engine"));
    assert.equal(MATCHING_ENGINE_FEATURE_KEY, "matching_engine");
  });

  it("rejects activating sponsorship when global off or opportunity not live", () => {
    const off = validateSponsorshipEligibility({
      globalEnabled: false,
      opportunityStatus: "ACTIVE",
      sponsorshipStatus: "DRAFT",
    });
    assert.equal(off.ok, false);

    const draftOpp = validateSponsorshipEligibility({
      globalEnabled: true,
      opportunityStatus: "DRAFT",
      sponsorshipStatus: "DRAFT",
    });
    assert.equal(draftOpp.ok, false);

    const ok = validateSponsorshipEligibility({
      globalEnabled: true,
      opportunityStatus: "ACTIVE",
      sponsorshipStatus: "DRAFT",
      endsAt: new Date(Date.now() + 86400000),
    });
    assert.equal(ok.ok, true);
  });

  it("organic beats sponsored on equal relevance; sponsored never bypasses 8C", () => {
    assert.ok(
      compareMatchRank(
        { score: 80, confidence: 90, type: "ORGANIC", id: "a" },
        { score: 80, confidence: 90, type: "SPONSORED", id: "b" },
      ) < 0,
    );
    assert.ok(
      compareMatchRank(
        { score: 70, confidence: 80, type: "SPONSORED", id: "s" },
        { score: 90, confidence: 80, type: "ORGANIC", id: "o" },
      ) > 0,
      "higher organic relevance must rank above lower sponsored",
    );

    const mismatch = scoreCompanyOpportunityMatch({
      profile: cyberProfile,
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
    assert.equal(
      isOpportunitySponsoredForMatching({
        globalEnabled: true,
        opportunitySponsored: true,
      }),
      true,
    );
    // Labeling sponsored does not flip relevance
    assert.equal(mismatch.meetsRelevanceThreshold, false);
  });

  it("does not add sponsorship boost into score.ts / final relevance", () => {
    const score = readSrc("src/domain/matching-engine/score.ts");
    assert.ok(!score.includes("sponsored"));
    assert.ok(score.includes("meetsRelevanceThreshold"));
    const geo = readSrc("src/domain/matching-engine/geography-rank.ts");
    assert.ok(!geo.includes("sponsored"));
  });
});

describe("Feature 8F — integration", () => {
  before(async () => {
    await cleanup();
  });
  after(async () => {
    await cleanup();
  });

  it("activates eligible sponsorship; rejects irrelevant sponsored from recommendations", async () => {
    await setMatchingSponsorshipGloballyEnabled(true);
    const viewer = await seedCompany("viewer");
    const sponsor = await seedCompany("sponsor", ["Catering"]);

    const relevant = await upsertOpportunity({
      title: "Cyber SOC sponsored",
      source: "ME8F_REL",
      externalRef: `${PREFIX}rel`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      category: "Security",
    });
    const irrelevant = await upsertOpportunity({
      title: "Catering only sponsored",
      source: "ME8F_IRR",
      externalRef: `${PREFIX}irr`,
      status: "ACTIVE",
      services: ["Catering"],
      industries: ["Hospitality"],
      geographies: ["Morocco"],
      category: "Food",
    });
    opportunityIds.push(relevant.id, irrelevant.id);

    const s1 = await createCompanySponsorship({
      companyId: sponsor,
      opportunityId: relevant.id,
      campaignMeta: { name: "Cyber boost", budgetCents: 1000, currency: "USD" },
    });
    sponsorshipIds.push(s1.id);
    const activated = await transitionSponsorship({ sponsorshipId: s1.id, to: "ACTIVE", actorAdminId: "sa-test" });
    assert.equal(activated.status, "ACTIVE");
    assert.equal(activated.billingStatus, "NOT_REQUIRED");

    const s2 = await createCompanySponsorship({
      companyId: sponsor,
      opportunityId: irrelevant.id,
    });
    sponsorshipIds.push(s2.id);
    await transitionSponsorship({ sponsorshipId: s2.id, to: "ACTIVE", actorAdminId: "sa-test" });

    const recs = await generateMatchRecommendations(viewer, {
      rebuildProfile: true,
      enableAiRefine: false,
    });
    const ids = recs.map((r) => r.opportunity.id);
    assert.ok(ids.includes(relevant.id));
    assert.ok(!ids.includes(irrelevant.id), "irrelevant sponsored must not appear");

    const sponsoredRec = recs.find((r) => r.opportunity.id === relevant.id);
    assert.equal(sponsoredRec?.type, "SPONSORED");

    // Analytics still use existing event types
    await recordBehaviorEventForCompany({
      companyId: viewer,
      opportunityId: relevant.id,
      recommendationId: sponsoredRec!.id,
      eventType: "IMPRESSION",
      idempotencyKey: `imp8f:${viewer}:${sponsoredRec!.id}`,
    });
  });

  it("organic outranks sponsored when relevance is higher", async () => {
    await setMatchingSponsorshipGloballyEnabled(true);
    const viewer = await seedCompany("rank-v");
    const sponsor = await seedCompany("rank-s");

    const organicStrong = await upsertOpportunity({
      title: "Organic strong cyber",
      source: "ME8F_ORG",
      externalRef: `${PREFIX}org`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      certifications: [],
      geographies: ["Morocco"],
      sizeBand: "Medium",
      experienceHint: "8 years",
      category: "Security",
    });
    const sponsoredWeaker = await upsertOpportunity({
      title: "Sponsored weaker cyber",
      source: "ME8F_SPW",
      externalRef: `${PREFIX}spw`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      industries: ["Other"],
      geographies: ["Vietnam"],
      category: "Security",
    });
    opportunityIds.push(organicStrong.id, sponsoredWeaker.id);

    const sp = await createCompanySponsorship({
      companyId: sponsor,
      opportunityId: sponsoredWeaker.id,
    });
    sponsorshipIds.push(sp.id);
    await transitionSponsorship({ sponsorshipId: sp.id, to: "ACTIVE", actorAdminId: "sa-test" });

    const recs = await generateRecommendationsForCompany(viewer, {
      rebuildProfile: true,
      enableAiRefine: false,
    });
    const organic = recs.find((r) => r.opportunity.id === organicStrong.id);
    const sponsored = recs.find((r) => r.opportunity.id === sponsoredWeaker.id);
    assert.ok(organic);
    assert.ok(sponsored);
    assert.equal(sponsored!.type, "SPONSORED");
    assert.ok(
      (organic!.finalRankScore ?? organic!.score) >=
        (sponsored!.finalRankScore ?? sponsored!.score),
    );
    if (
      (organic!.finalRankScore ?? organic!.score) ===
      (sponsored!.finalRankScore ?? sponsored!.score)
    ) {
      assert.ok(
        compareMatchRank(
          {
            score: organic!.score,
            confidence: organic!.confidence,
            finalRankScore: organic!.finalRankScore,
            type: organic!.type,
            id: organic!.id,
          },
          {
            score: sponsored!.score,
            confidence: sponsored!.confidence,
            finalRankScore: sponsored!.finalRankScore,
            type: sponsored!.type,
            id: sponsored!.id,
          },
        ) <= 0,
      );
    }
  });

  it("enforces tenant isolation and sponsorship authorization", async () => {
    await setMatchingSponsorshipGloballyEnabled(true);
    const a = await seedCompany("auth-a");
    const b = await seedCompany("auth-b");
    const opp = await upsertOpportunity({
      title: "Auth sponsorship opp",
      source: "ME8F_AUTH",
      externalRef: `${PREFIX}auth`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
    });
    opportunityIds.push(opp.id);

    const s = await createCompanySponsorship({
      companyId: a,
      opportunityId: opp.id,
    });
    sponsorshipIds.push(s.id);

    const mine = await listCompanySponsorships(a);
    assert.ok(mine.some((x) => x.id === s.id));
    const theirs = await listCompanySponsorships(b);
    assert.ok(!theirs.some((x) => x.id === s.id));

    await assert.rejects(
      () =>
        transitionCompanySponsorship({
          companyId: a,
          sponsorshipId: s.id,
          to: "ACTIVE",
        }),
      (err: unknown) =>
        err instanceof AppError &&
        err.status === 403 &&
        /Super Admin approval/i.test(err.message),
    );

    await assert.rejects(
      () =>
        transitionCompanySponsorship({
          companyId: b,
          sponsorshipId: s.id,
          to: "ACTIVE",
        }),
      (err: unknown) => err instanceof AppError && err.status === 403,
    );
  });

  it("expires sponsorships past endsAt and clears sponsored flag", async () => {
    await setMatchingSponsorshipGloballyEnabled(true);
    const sponsor = await seedCompany("exp");
    const opp = await upsertOpportunity({
      title: "Expiring sponsorship",
      source: "ME8F_EXP",
      externalRef: `${PREFIX}exp`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
    });
    opportunityIds.push(opp.id);

    const s = await createCompanySponsorship({
      companyId: sponsor,
      opportunityId: opp.id,
      endsAt: new Date(Date.now() - 60_000),
    });
    sponsorshipIds.push(s.id);

    // Force ACTIVE with past end via prisma (bypass activate validation)
    await prisma.matchingSponsorship.update({
      where: { id: s.id },
      data: { status: "ACTIVE", activatedAt: new Date(), endsAt: new Date(Date.now() - 60_000) },
    });
    await prisma.matchingOpportunity.update({
      where: { id: opp.id },
      data: { sponsored: true },
    });

    const result = await reconcileMatchingSponsorshipLifecycle(20);
    assert.ok(result.expired >= 1);
    const updated = await prisma.matchingSponsorship.findUnique({
      where: { id: s.id },
    });
    assert.equal(updated?.status, "EXPIRED");
    const oppRow = await prisma.matchingOpportunity.findUnique({
      where: { id: opp.id },
    });
    assert.equal(oppRow?.sponsored, false);
  });

  it("rejects client/SA upsert sponsored without a live MatchingSponsorship", async () => {
    await setMatchingSponsorshipGloballyEnabled(true);
    const companyId = await seedCompany("integrity");
    const forged = await upsertOpportunity({
      title: "Forged sponsored flag",
      source: "ME8F_INT",
      externalRef: `${PREFIX}int`,
      status: "ACTIVE",
      sponsored: true,
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
    });
    opportunityIds.push(forged.id);
    assert.equal(forged.sponsored, false);

    const row = await prisma.matchingOpportunity.findUnique({
      where: { id: forged.id },
    });
    assert.equal(row?.sponsored, false);

    const sp = await createCompanySponsorship({
      companyId,
      opportunityId: forged.id,
      endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    sponsorshipIds.push(sp.id);
    await transitionSponsorship({
      sponsorshipId: sp.id,
      to: "ACTIVE",
      actorAdminId: "sa-test",
    });
    const live = await prisma.matchingOpportunity.findUnique({
      where: { id: forged.id },
    });
    assert.equal(live?.sponsored, true);

    // Upsert again with sponsored:false cannot clear a live sponsorship flag
    // (sync owns the denormalized bit).
    const again = await upsertOpportunity({
      id: forged.id,
      title: "Forged sponsored flag",
      source: "ME8F_INT",
      externalRef: `${PREFIX}int`,
      status: "ACTIVE",
      sponsored: false,
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
    });
    assert.equal(again.sponsored, true);
  });

  it("billing port is no-op foundation only", () => {
    const billing = readSrc(
      "src/modules/matching-engine/internal/sponsorship-billing.ts",
    );
    assert.ok(billing.includes("NoOpMatchingSponsorshipBilling"));
    assert.ok(billing.includes("MatchingSponsorshipBillingPort"));
    assert.ok(!billing.includes("stripe"));
    assert.ok(!billing.includes("paypal"));
  });
});
