/**
 * Matching Engine — real-data activation preparation tests.
 * Does not enable matching_engine globally as a lasting state.
 */

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  hashOpportunityMatchingContent,
  isMatchingProfileEligible,
  validateOpportunityIngest,
  type MatchingProfileSnapshot,
} from "@/domain/matching-engine";
import { prisma } from "@/lib/db";
import {
  MATCHING_ENGINE_FEATURE_KEY,
  MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY,
  assertMatchingEngineCanEnableGlobally,
  countEligibleMatchingCompanies,
  generateRecommendationsForCompany,
  getMatchingActivationReadiness,
  getMatchingEngineMinEligibleCompanies,
  isMatchingEngineThresholdMet,
  listRecommendationsForCompany,
  upsertOpportunity,
  upsertOpportunityBatch,
} from "@/modules/matching-engine";
import { setFeatureGlobal } from "@/services/entitlements";
import { setSetting } from "@/services/settings";
import { generateMatchRecommendations } from "@/modules/matching-engine/internal/service";

const PREFIX = `me-act-${Date.now().toString(36)}-`;
const companyIds: string[] = [];
const opportunityIds: string[] = [];
let prevThresholdValue: object | null = null;
let prevFeatureGlobal = false;

const eligibleSnapshot: MatchingProfileSnapshot = {
  services: [{ value: "Cybersecurity", trust: "strong", source: "sq" }],
  industries: [{ value: "Technology", trust: "normal", source: "p" }],
  geographies: [{ value: "Morocco", trust: "normal", source: "p" }],
  certifications: [],
  size: { value: "Medium", trust: "normal", source: "p" },
  experienceYears: { value: 5, trust: "normal", source: "p" },
  dcmCategories: [],
  softNotes: [],
};

async function cleanup() {
  if (companyIds.length) {
    await prisma.matchRecommendation.deleteMany({
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
    await prisma.matchingOpportunity.deleteMany({
      where: { id: { in: opportunityIds } },
    });
  }
  await prisma.matchingOpportunity.deleteMany({
    where: { source: { startsWith: "ME_ACT_" } },
  });
  companyIds.length = 0;
  opportunityIds.length = 0;
}

/** Neon pooler occasionally drops mid-suite; retry transient connectivity errors. */
async function withDbRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!/Can't reach database|P1001|timed out/i.test(msg) || i === attempts - 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

async function seedEligibleCompany(suffix: string) {
  const company = await prisma.company.create({
    data: {
      name: `ME ACT ${suffix}`,
      slug: `${PREFIX}${suffix}`,
      country: "Morocco",
      companySize: "Medium",
      profile: {
        create: {
          industry: "Technology",
          country: "Morocco",
          companySize: "Medium",
          services: ["Cybersecurity"],
          geographicCoverage: ["Morocco"],
          experienceYears: 5,
          completeness: 80,
        },
      },
    },
  });
  companyIds.push(company.id);
  await prisma.companyMatchingProfile.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      snapshotJson: eligibleSnapshot,
      eligible: true,
      completeness: 80,
      contentHash: `act-${suffix}`,
      version: 1,
      trustSummary: { strong: 1, normal: 3, soft: 0 },
      builtAt: new Date(),
    },
    update: {
      snapshotJson: eligibleSnapshot,
      eligible: true,
      completeness: 80,
    },
  });
  return company.id;
}

describe("Matching activation — eligibility & ingest rules", () => {
  it("documents exact eligibility: hard capability + geography; soft alone never enough", () => {
    assert.equal(isMatchingProfileEligible(eligibleSnapshot), true);
    assert.equal(
      isMatchingProfileEligible({
        ...eligibleSnapshot,
        services: [{ value: "hint", trust: "soft", source: "q" }],
        certifications: [],
        dcmCategories: [],
      }),
      false,
    );
    assert.equal(
      isMatchingProfileEligible({
        ...eligibleSnapshot,
        geographies: [],
      }),
      false,
    );
  });

  it("rejects malformed ACTIVE opportunities and private payloads", () => {
    const missing = validateOpportunityIngest({
      title: "X",
      status: "ACTIVE",
      services: [],
      geographies: [],
    });
    assert.equal(missing.ok, false);

    const privateLeak = validateOpportunityIngest({
      title: "X",
      status: "ACTIVE",
      services: ["Cybersecurity"],
      geographies: ["Morocco"],
      signalsJson: { knowledgeJson: { secret: true } },
    });
    assert.equal(privateLeak.ok, false);

    const ok = validateOpportunityIngest({
      title: "SOC Morocco",
      status: "ACTIVE",
      services: ["Cybersecurity"],
      geographies: ["Morocco"],
    });
    assert.equal(ok.ok, true);

    const draftOk = validateOpportunityIngest({
      title: "Draft incomplete",
      status: "DRAFT",
    });
    assert.equal(draftOk.ok, true);
  });

  it("contentHash changes when public fields change", () => {
    const a = hashOpportunityMatchingContent({
      title: "A",
      services: ["Cybersecurity"],
      geographies: ["Morocco"],
    });
    const b = hashOpportunityMatchingContent({
      title: "A",
      services: ["Cybersecurity", "Cloud"],
      geographies: ["Morocco"],
    });
    assert.notEqual(a, b);
  });
});

describe("Matching activation — corpus gate & fail-closed", () => {
  before(async () => {
    await cleanup();
    const setting = await prisma.systemSetting.findUnique({
      where: { key: MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY },
    });
    prevThresholdValue =
      setting?.value != null && typeof setting.value === "object"
        ? (setting.value as object)
        : null;
    const feature = await prisma.feature.findUnique({
      where: { key: MATCHING_ENGINE_FEATURE_KEY },
    });
    prevFeatureGlobal = feature?.enabledGlobal ?? false;
    await prisma.feature.updateMany({
      where: { key: MATCHING_ENGINE_FEATURE_KEY },
      data: { enabledGlobal: false },
    });
  });

  after(async () => {
    await cleanup();
    await prisma.feature.updateMany({
      where: { key: MATCHING_ENGINE_FEATURE_KEY },
      data: { enabledGlobal: prevFeatureGlobal },
    });
    if (prevThresholdValue) {
      await prisma.systemSetting.update({
        where: { key: MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY },
        data: { value: prevThresholdValue },
      });
    } else {
      await setSetting(MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY, { n: 45 });
    }
  });

  it("default threshold setting remains 45 when restored to catalog default", async () => {
    await setSetting(MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY, { n: 45 });
    assert.equal(await getMatchingEngineMinEligibleCompanies(), 45);
  });

  it("44-vs-45 equivalent: threshold advisory; SA enable remains free", async () => {
    await withDbRetry(async () => {
      const baseline = await countEligibleMatchingCompanies();
      await setSetting(MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY, {
        n: baseline + 2,
      });
      assert.equal(await isMatchingEngineThresholdMet(), false);

      await seedEligibleCompany("one");
      assert.equal(await isMatchingEngineThresholdMet(), false);
      // Free enable — assert is a no-op even below threshold.
      await assertMatchingEngineCanEnableGlobally();

      await seedEligibleCompany("two");
      assert.equal(await isMatchingEngineThresholdMet(), true);
      await assertMatchingEngineCanEnableGlobally();

      const readiness = await getMatchingActivationReadiness();
      assert.equal(readiness.canEnableMatching, true);
      assert.equal(readiness.matchingEnabledGlobal, false);
      assert.equal(readiness.sponsorshipEnabledGlobal, false);
      assert.equal(readiness.aiRefineEnabled, false);
    });
  });

  it("threshold later increases → generation still runs when Matching is ON (threshold advisory)", async () => {
    const companyId = await seedEligibleCompany("failclose");
    const opp = await upsertOpportunity({
      title: "Cybersecurity Activation Morocco",
      source: "ME_ACT_FC",
      externalRef: `${PREFIX}fc`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
    });
    opportunityIds.push(opp.id);

    const baseline = await countEligibleMatchingCompanies();
    await setSetting(MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY, {
      n: Math.max(1, baseline),
    });
    assert.equal(await isMatchingEngineThresholdMet(), true);

    await setFeatureGlobal(MATCHING_ENGINE_FEATURE_KEY, true);
    const whenOk = await generateMatchRecommendations(companyId, {
      rebuildProfile: true,
      enableAiRefine: false,
    });
    assert.ok(whenOk.some((r) => r.opportunity.id === opp.id));

    await setSetting(MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY, {
      n: baseline + 10_000,
    });
    assert.equal(await isMatchingEngineThresholdMet(), false);

    const stillOk = await generateMatchRecommendations(companyId, {
      rebuildProfile: false,
      enableAiRefine: false,
    });
    assert.ok(stillOk.some((r) => r.opportunity.id === opp.id));
    const listed = await listRecommendationsForCompany(companyId, {
      status: "VISIBLE",
    });
    assert.ok(listed.some((r) => r.opportunity.id === opp.id));

    await setFeatureGlobal(MATCHING_ENGINE_FEATURE_KEY, false);
    await setSetting(MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY, { n: 45 });
  });

  it("malformed ACTIVE rejected; duplicate externalRef idempotent; contentHash updates", async () => {
    await assert.rejects(
      () =>
        upsertOpportunity({
          title: "No dims",
          source: "ME_ACT_BAD",
          externalRef: `${PREFIX}bad`,
          status: "ACTIVE",
        }),
      /geography|capability/i,
    );

    const first = await upsertOpportunity({
      title: "Idempotent SOC",
      source: "ME_ACT_IDEM",
      externalRef: `${PREFIX}idem`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      geographies: ["Morocco"],
    });
    opportunityIds.push(first.id);
    const second = await upsertOpportunity({
      title: "Idempotent SOC",
      source: "ME_ACT_IDEM",
      externalRef: `${PREFIX}idem`,
      status: "ACTIVE",
      services: ["Cybersecurity"],
      geographies: ["Morocco"],
    });
    assert.equal(first.id, second.id);

    const beforeHash = (
      await prisma.matchingOpportunity.findUnique({ where: { id: first.id } })
    )?.contentHash;
    const updated = await upsertOpportunity({
      title: "Idempotent SOC v2",
      source: "ME_ACT_IDEM",
      externalRef: `${PREFIX}idem`,
      status: "ACTIVE",
      services: ["Cybersecurity", "Cloud"],
      geographies: ["Morocco"],
    });
    assert.equal(updated.id, first.id);
    const afterHash = (
      await prisma.matchingOpportunity.findUnique({ where: { id: first.id } })
    )?.contentHash;
    assert.ok(beforeHash);
    assert.ok(afterHash);
    assert.notEqual(beforeHash, afterHash);
    assert.doesNotMatch(JSON.stringify(updated), /knowledgeJson|draftText/);
  });

  it("batch bootstrap upserts idempotently without scraping", async () => {
    const batch = await upsertOpportunityBatch([
      {
        title: "Batch A",
        source: "ME_ACT_BATCH",
        externalRef: `${PREFIX}b1`,
        status: "ACTIVE",
        services: ["Cybersecurity"],
        geographies: ["Morocco"],
      },
      {
        title: "Batch B incomplete",
        source: "ME_ACT_BATCH",
        externalRef: `${PREFIX}b2`,
        status: "ACTIVE",
        services: [],
        geographies: [],
      },
    ]);
    assert.equal(batch.upserted.length, 1);
    assert.equal(batch.errors.length, 1);
    opportunityIds.push(...batch.upserted.map((o) => o.id));

    const again = await upsertOpportunityBatch([
      {
        title: "Batch A",
        source: "ME_ACT_BATCH",
        externalRef: `${PREFIX}b1`,
        status: "ACTIVE",
        services: ["Cybersecurity"],
        geographies: ["Morocco"],
      },
    ]);
    assert.equal(again.upserted[0]?.id, batch.upserted[0]?.id);
  });

  it("ineligible company never gets recommendations", async () => {
    const company = await prisma.company.create({
      data: {
        name: "ME ACT thin",
        slug: `${PREFIX}thin`,
        country: "Iceland",
        companySize: "Small",
        profile: {
          create: {
            industry: "Legal",
            country: "Iceland",
            services: [],
            geographicCoverage: [],
            completeness: 10,
          },
        },
      },
    });
    companyIds.push(company.id);
    const recs = await generateRecommendationsForCompany(company.id, {
      rebuildProfile: true,
      enableAiRefine: false,
    });
    assert.equal(recs.length, 0);
  });
});
