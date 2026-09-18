/**
 * Feature 8C — Real Matching Engine validation.
 * Uses production derive/score/recommendation services. Isolated fixtures only.
 * Restores feature flags; never permanently enables matching_engine for users.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildMatchingProfileRecord,
  deriveMatchingProfileSnapshot,
  opportunityToMatchingSignals,
  scoreCompanyOpportunityMatch,
  type MatchScoreResult,
} from "@/domain/matching-engine";
import { prisma } from "@/lib/db";
import {
  MATCHING_ENGINE_FEATURE_KEY,
  MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY,
  MATCHING_SPONSORSHIP_SETTINGS_KEY,
  countEligibleMatchingCompanies,
  createCompanySponsorship,
  getMatchingEngineMinEligibleCompanies,
  isMatchingEngineAvailable,
  isMatchingEngineGloballyEnabled,
  isMatchingEngineThresholdMet,
  setMatchingSponsorshipGloballyEnabled,
} from "@/modules/matching-engine";
import { transitionSponsorship } from "@/modules/matching-engine/internal/sponsorship";
import {
  generateMatchRecommendations,
  getDashboardMatchedStrip,
  listMatchRecommendations,
  rebuildCompanyMatchingProfile,
  upsertMatchingOpportunity,
} from "@/modules/matching-engine/internal/service";
import {
  ME8C_COMPANIES,
  ME8C_EXPECTED_MATRIX,
  ME8C_OPPORTUNITIES,
  ME8C_SOURCE,
  ME8C_SLUG_PREFIX,
  classifyMatchResult,
  type Me8cCompanyKey,
  type Me8cExpectation,
  type Me8cOpportunityKey,
} from "./fixtures/validation-8c-fixtures";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

type MatrixRow = {
  company: Me8cCompanyKey;
  opportunity: Me8cOpportunityKey;
  expected: Me8cExpectation;
  actual: string;
  score: number;
  confidence: number;
  meets: boolean;
  pass: boolean;
};

const matrixRows: MatrixRow[] = [];
const scenarioResults: Array<{ name: string; pass: boolean; detail?: string }> =
  [];

function recordScenario(name: string, pass: boolean, detail?: string) {
  scenarioResults.push({ name, pass, detail });
  if (!pass) {
    assert.fail(detail ?? name);
  }
}

function scorePair(
  companyKey: Me8cCompanyKey,
  opportunityKey: Me8cOpportunityKey,
): MatchScoreResult {
  const company = ME8C_COMPANIES.find((c) => c.key === companyKey)!;
  const opportunity = ME8C_OPPORTUNITIES.find((o) => o.key === opportunityKey)!;
  const snapshot = deriveMatchingProfileSnapshot(company.sourceInput);
  return scoreCompanyOpportunityMatch({
    profile: snapshot,
    opportunity: opportunityToMatchingSignals(opportunity),
  });
}

function expectationPass(
  expected: Me8cExpectation,
  result: MatchScoreResult,
): { actual: string; pass: boolean } {
  const qualitative = classifyMatchResult(result);
  if (expected === "strong") {
    return {
      actual: qualitative,
      pass: qualitative === "strong" && result.meetsRelevanceThreshold,
    };
  }
  if (expected === "partial") {
    return {
      actual: qualitative,
      pass:
        qualitative === "partial" &&
        result.meetsRelevanceThreshold &&
        result.score < 85,
    };
  }
  if (expected === "irrelevant" || expected === "no_recommendation") {
    return {
      actual: result.meetsRelevanceThreshold ? qualitative : "irrelevant",
      pass: !result.meetsRelevanceThreshold,
    };
  }
  return { actual: qualitative, pass: false };
}

/** Isolated DB state for persistence / gate / tenant checks. */
const dbIds = {
  companyIds: [] as string[],
  opportunityIds: [] as string[],
  featurePrev: null as boolean | null,
  settingPrev: null as unknown,
  overridesCreated: [] as string[],
};

async function cleanupMe8cDb() {
  const companies = await prisma.company.findMany({
    where: { slug: { startsWith: ME8C_SLUG_PREFIX } },
    select: { id: true },
  });
  const companyIds = companies.map((c) => c.id);
  if (companyIds.length) {
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
  await prisma.matchingOpportunity.deleteMany({
    where: { source: ME8C_SOURCE },
  });
  await prisma.systemSetting.deleteMany({
    where: { key: MATCHING_SPONSORSHIP_SETTINGS_KEY },
  });
}

async function restoreGateState() {
  if (dbIds.featurePrev != null) {
    await prisma.feature.updateMany({
      where: { key: MATCHING_ENGINE_FEATURE_KEY },
      data: { enabledGlobal: dbIds.featurePrev },
    });
  }
  if (dbIds.settingPrev !== null) {
    await prisma.systemSetting.upsert({
      where: { key: MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY },
      create: {
        key: MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY,
        value: dbIds.settingPrev as object,
        description: "Matching Engine eligible-company threshold",
      },
      update: { value: dbIds.settingPrev as object },
    });
  }
  if (dbIds.overridesCreated.length) {
    await prisma.companyFeatureOverride.deleteMany({
      where: { id: { in: dbIds.overridesCreated } },
    });
  }
}

async function seedMe8cCompaniesAndOpportunities() {
  await cleanupMe8cDb();

  for (const c of ME8C_COMPANIES) {
    const company = await prisma.company.create({
      data: {
        name: c.name,
        slug: c.slug,
        country: c.sourceInput.company.country,
        companySize: c.sourceInput.company.companySize,
        profile: {
          create: {
            industry: c.sourceInput.profile!.industry,
            country: c.sourceInput.profile!.country,
            companySize: c.sourceInput.profile!.companySize,
            experienceLevel: c.sourceInput.profile!.experienceLevel,
            services: c.sourceInput.profile!.services,
            certifications: c.sourceInput.profile!.certifications,
            experienceYears: c.sourceInput.profile!.experienceYears,
            geographicCoverage: c.sourceInput.profile!.geographicCoverage,
            completeness: 80,
          },
        },
      },
    });
    dbIds.companyIds.push(company.id);
  }

  for (const o of ME8C_OPPORTUNITIES) {
    const opp = await upsertMatchingOpportunity({
      title: o.title,
      summary: o.summary,
      category: o.category,
      industry: o.industry,
      services: o.services,
      industries: o.industries,
      geographies: o.geographies,
      certifications: o.certifications,
      sizeBand: o.sizeBand,
      experienceHint: o.experienceHint,
      source: ME8C_SOURCE,
      externalRef: o.externalRef,
      status: "ACTIVE",
      sponsored: Boolean(o.sponsored),
    });
    dbIds.opportunityIds.push(opp.id);
  }
}

describe("Feature 8C — Matching Engine real validation", () => {
  before(async () => {
    const feature = await prisma.feature.findUnique({
      where: { key: MATCHING_ENGINE_FEATURE_KEY },
    });
    dbIds.featurePrev = feature?.enabledGlobal ?? false;
    const setting = await prisma.systemSetting.findUnique({
      where: { key: MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY },
    });
    dbIds.settingPrev = setting?.value ?? { n: 45 };

    // Ensure feature stays OFF for normal path after suite (restored in after).
    await prisma.feature.upsert({
      where: { key: MATCHING_ENGINE_FEATURE_KEY },
      create: {
        key: MATCHING_ENGINE_FEATURE_KEY,
        name: "Matching Engine",
        description: "Matching Engine",
        enabledGlobal: false,
      },
      update: {},
    });
  });

  after(async () => {
    try {
      await restoreGateState();
      // Force OFF after validation — do not leave Feature 8 enabled.
      await prisma.feature.updateMany({
        where: { key: MATCHING_ENGINE_FEATURE_KEY },
        data: { enabledGlobal: false },
      });
      await prisma.systemSetting.upsert({
        where: { key: MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY },
        create: {
          key: MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY,
          value: { n: 45 },
          description: "Matching Engine eligible-company threshold",
        },
        update: { value: { n: 45 } },
      });
      await cleanupMe8cDb();
    } catch (err) {
      console.error("[me8c] cleanup warning", err);
    }
  });

  it("scores the expected company×opportunity matrix with production matcher", () => {
    const seenPairs = new Set<string>();
    for (const row of ME8C_EXPECTED_MATRIX) {
      seenPairs.add(`${row.company}:${row.opportunity}`);

      const result = scorePair(row.company, row.opportunity);
      const { actual, pass } = expectationPass(row.expected, result);
      matrixRows.push({
        company: row.company,
        opportunity: row.opportunity,
        expected: row.expected,
        actual:
          row.expected === "no_recommendation"
            ? result.meetsRelevanceThreshold
              ? "recommendation"
              : "no_recommendation"
            : actual,
        score: result.score,
        confidence: result.confidence,
        meets: result.meetsRelevanceThreshold,
        pass,
      });
      assert.equal(
        pass,
        true,
        `${row.company}×${row.opportunity}: expected ${row.expected}, got ${actual} (score=${result.score}, meets=${result.meetsRelevanceThreshold})`,
      );
    }
    recordScenario("match_matrix", true);
  });

  it("validates trust: missing / soft / VERIFY-style signals", () => {
    const missing = deriveMatchingProfileSnapshot({
      company: { country: null, companySize: null },
      profile: null,
      sq: null,
      verifiedEvidence: [],
      dcmValidCategories: [],
      approvedQuestionnaireHints: [],
    });
    const missingRecord = buildMatchingProfileRecord(missing);
    assert.equal(missingRecord.eligible, false);
    assert.equal(missing.services.length, 0);

    const missingScore = scoreCompanyOpportunityMatch({
      profile: missing,
      opportunity: opportunityToMatchingSignals(ME8C_OPPORTUNITIES[0]!),
    });
    assert.equal(missingScore.meetsRelevanceThreshold, false);
    assert.ok(
      missingScore.dimensions.every(
        (d) => d.status === "unknown" || d.status === "not_applicable",
      ),
    );

    // VERIFY / unverified questionnaire text is never approved → not ingested as profile signal.
    const verifyOnly = deriveMatchingProfileSnapshot({
      company: { country: "Morocco", companySize: "Large" },
      profile: {
        industry: "Technology",
        country: "Morocco",
        companySize: "Large",
        experienceLevel: null,
        services: [],
        certifications: [],
        experienceYears: null,
        geographicCoverage: ["Morocco"],
        employeeRange: null,
      },
      sq: null,
      verifiedEvidence: [],
      dcmValidCategories: [],
      // Only APPROVED/EDITED hints are passed by production loadSourceInput —
      // VERIFY drafts must not appear here.
      approvedQuestionnaireHints: [],
    });
    assert.equal(verifyOnly.services.length, 0);
    assert.ok(!verifyOnly.services.some((s) => /fabricat/i.test(s.value)));

    const softOnly = deriveMatchingProfileSnapshot({
      company: { country: "Morocco", companySize: null },
      profile: null,
      sq: {
        country: "Morocco",
        businessSectors: [],
        servicesProducts: ["Cybersecurity"],
        certifications: [],
        geographicCoverage: ["Morocco"],
        employeeCount: null,
        yearEstablished: null,
      },
      verifiedEvidence: [],
      dcmValidCategories: [],
      approvedQuestionnaireHints: ["We also do quantum satellite defense"],
    });
    assert.ok(softOnly.services.some((s) => s.trust === "soft"));
    const softScore = scoreCompanyOpportunityMatch({
      profile: softOnly,
      opportunity: opportunityToMatchingSignals(ME8C_OPPORTUNITIES[0]!),
    });
    const softService = softScore.dimensions.find((d) => d.key === "service");
    // Soft-only service contribution is capped when trust is soft; SQ servicesProducts are normal.
    const softQa = softOnly.services.find((s) => s.trust === "soft");
    assert.ok(softQa);
    assert.ok((softService?.score ?? 0) <= 92);

    const softCapProfile = deriveMatchingProfileSnapshot({
      company: { country: "Morocco", companySize: null },
      profile: null,
      sq: null,
      verifiedEvidence: [],
      dcmValidCategories: [],
      approvedQuestionnaireHints: ["Cybersecurity managed SOC"],
    });
    softCapProfile.geographies.push({
      value: "Morocco",
      trust: "soft",
      source: "soft",
    });
    const capped = scoreCompanyOpportunityMatch({
      profile: softCapProfile,
      opportunity: opportunityToMatchingSignals(ME8C_OPPORTUNITIES[0]!),
    });
    const svc = capped.dimensions.find((d) => d.key === "service");
    assert.ok((svc?.score ?? 100) <= 35, "soft service score must be capped");
    assert.ok(capped.confidence < 90 || !capped.meetsRelevanceThreshold);

    recordScenario("trust_behavior", true);
  });

  it("validates sponsored cannot bypass relevance; tie-break prefers organic", () => {
    const a = ME8C_COMPANIES.find((c) => c.key === "A")!;
    const snapshot = deriveMatchingProfileSnapshot(a.sourceInput);

    const relevant = scoreCompanyOpportunityMatch({
      profile: snapshot,
      opportunity: opportunityToMatchingSignals(ME8C_OPPORTUNITIES[0]!),
    });
    assert.equal(relevant.meetsRelevanceThreshold, true);

    const irrelevant = scoreCompanyOpportunityMatch({
      profile: snapshot,
      opportunity: opportunityToMatchingSignals(ME8C_OPPORTUNITIES[6]!), // O7
    });
    assert.equal(irrelevant.meetsRelevanceThreshold, false);

    // Production generator assigns SPONSORED only after relevance — assert service contract.
    const service = readSrc("src/modules/matching-engine/internal/service.ts");
    assert.match(service, /meetsRelevanceThreshold/);
    assert.match(service, /isOpportunitySponsoredForMatching/);
    assert.match(service, /compareMatchRank/);
    const sponsorship = readSrc("src/domain/matching-engine/sponsorship.ts");
    assert.match(sponsorship, /a\.type === "ORGANIC"/);

    recordScenario("sponsored_behavior", true);
  });

  it("validates feature gate A/B/C/D without permanently enabling Feature 8", async () => {
    await seedMe8cCompaniesAndOpportunities();

    for (const companyId of dbIds.companyIds) {
      await rebuildCompanyMatchingProfile(companyId);
    }

    const feature = await prisma.feature.findUniqueOrThrow({
      where: { key: MATCHING_ENGINE_FEATURE_KEY },
    });

    // A — global OFF
    await prisma.feature.update({
      where: { id: feature.id },
      data: { enabledGlobal: false },
    });
    const companyA = dbIds.companyIds[0]!;
    assert.equal(await isMatchingEngineGloballyEnabled(), false);
    assert.equal(await isMatchingEngineAvailable(companyA), false);
    recordScenario("gate_A_global_off", true);

    // B — global ON, entitlement unavailable
    await prisma.feature.update({
      where: { id: feature.id },
      data: { enabledGlobal: true },
    });
    await prisma.systemSetting.upsert({
      where: { key: MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY },
      create: {
        key: MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY,
        value: { n: 1 },
        description: "temp me8c",
      },
      update: { value: { n: 1 } },
    });
    // No override / plan feature → hasFeature false when not entitled
    assert.equal(await isMatchingEngineAvailable(companyA), false);
    recordScenario("gate_B_entitlement_off", true);

    // C — entitled below recommended corpus threshold: still available (threshold advisory)
    const override = await prisma.companyFeatureOverride.create({
      data: {
        companyId: companyA,
        featureId: feature.id,
        enabled: true,
      },
    });
    dbIds.overridesCreated.push(override.id);
    await prisma.systemSetting.update({
      where: { key: MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY },
      data: { value: { n: 45 } },
    });
    const eligible = await countEligibleMatchingCompanies();
    const min = await getMatchingEngineMinEligibleCompanies();
    assert.ok(eligible < min, `eligible ${eligible} should be < min ${min}`);
    assert.equal(await isMatchingEngineThresholdMet(), false);
    assert.equal(await isMatchingEngineAvailable(companyA), true);
    recordScenario("gate_C_below_threshold_advisory_still_available", true);

    // D — threshold reached (temp min = eligible count) + global + entitlement
    await prisma.systemSetting.update({
      where: { key: MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY },
      data: { value: { n: Math.max(1, eligible) } },
    });
    assert.equal(await isMatchingEngineThresholdMet(), true);
    assert.equal(await isMatchingEngineAvailable(companyA), true);
    recordScenario("gate_D_threshold_met", true);

    // Restore OFF immediately after D
    await prisma.feature.update({
      where: { id: feature.id },
      data: { enabledGlobal: false },
    });
    await prisma.systemSetting.update({
      where: { key: MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY },
      data: { value: { n: 45 } },
    });
    assert.equal(await isMatchingEngineGloballyEnabled(), false);
    recordScenario("gate_restored_off", true);
  });

  it("runs production recommendation generation, persistence, idempotency, tenant isolation", async () => {
    if (!dbIds.companyIds.length) {
      await seedMe8cCompaniesAndOpportunities();
    }

    await setMatchingSponsorshipGloballyEnabled(true);

    // Live sponsorships only — denormalized sponsored cannot be set by hand.
    const o1 = await prisma.matchingOpportunity.findFirst({
      where: { source: ME8C_SOURCE, externalRef: `${ME8C_SLUG_PREFIX}o1` },
    });
    assert.ok(o1);
    const o7 = await prisma.matchingOpportunity.findFirst({
      where: { source: ME8C_SOURCE, externalRef: `${ME8C_SLUG_PREFIX}o7` },
    });
    assert.ok(o7);

    const companyByKey = new Map<Me8cCompanyKey, string>();
    for (let i = 0; i < ME8C_COMPANIES.length; i++) {
      companyByKey.set(ME8C_COMPANIES[i]!.key, dbIds.companyIds[i]!);
    }

    const companyA = companyByKey.get("A")!;
    for (const opportunityId of [o1.id, o7.id]) {
      const sp = await createCompanySponsorship({
        companyId: companyA,
        opportunityId,
        endsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      });
      await transitionSponsorship({ sponsorshipId: sp.id, to: "ACTIVE", actorAdminId: "sa-test" });
    }

    const first = await generateMatchRecommendations(companyA);
    const second = await generateMatchRecommendations(companyA, {
      rebuildProfile: false,
    });

    const active = await prisma.matchRecommendation.findMany({
      where: { companyId: companyA, status: "ACTIVE" },
    });
    const uniqueOpp = new Set(active.map((r) => r.opportunityId));
    assert.equal(uniqueOpp.size, active.length, "no duplicate recommendations");
    assert.equal(first.length, second.length);

    const o1Rec = active.find((r) => r.opportunityId === o1.id);
    assert.ok(o1Rec, "O1 should recommend for A");
    assert.equal(o1Rec.type, "SPONSORED");
    assert.ok(o1Rec.score >= 40);

    const o7Rec = active.find((r) => r.opportunityId === o7.id);
    assert.equal(o7Rec, undefined, "sponsored O7 must not bypass relevance");

    // Dashboard strip must read persisted rows (not recompute) — same ids
    const strip = await getDashboardMatchedStrip(companyA, 2);
    assert.ok(strip.length > 0);
    assert.ok(strip.every((s) => s.opportunity.title.length > 0));
    assert.ok(strip.every((s) => !("knowledgeJson" in s.opportunity)));

    const page = await listMatchRecommendations(companyA, {
      limit: 10,
      offset: 0,
    });
    const page2 = await listMatchRecommendations(companyA, {
      limit: 10,
      offset: 10,
    });
    assert.ok(page.length <= 10);
    if (page2.length > 0) {
      const pageIds = new Set(page.map((p) => p.id));
      assert.ok(page2.every((r) => !pageIds.has(r.id)));
    }

    // Tenant isolation: B must not see A's recommendation row ids
    const companyB = companyByKey.get("B")!;
    await generateMatchRecommendations(companyB);
    const aOnly = await prisma.matchRecommendation.findMany({
      where: { companyId: companyA },
    });
    const bSeesA = await prisma.matchRecommendation.findMany({
      where: {
        companyId: companyB,
        id: { in: aOnly.map((r) => r.id) },
      },
    });
    assert.equal(bSeesA.length, 0);

    // Public opportunity DTO shape — no private company fields
    for (const r of page) {
      const keys = Object.keys(r.opportunity);
      assert.ok(!keys.includes("knowledgeJson"));
      assert.ok(!keys.includes("draftText"));
      assert.ok(!keys.includes("storageKey"));
    }

    // Strong matches for B–F
    for (const [key, oppKey] of [
      ["B", "o2"],
      ["C", "o3"],
      ["D", "o4"],
      ["E", "o5"],
      ["F", "o6"],
    ] as const) {
      const cid = companyByKey.get(key)!;
      const recs = await generateMatchRecommendations(cid);
      const ref = `${ME8C_SLUG_PREFIX}${oppKey}`;
      const opp = await prisma.matchingOpportunity.findFirst({
        where: { source: ME8C_SOURCE, externalRef: ref },
      });
      assert.ok(opp);
      assert.ok(
        recs.some((r) => r.opportunity.id === opp.id && r.score >= 40),
        `${key} should match ${oppKey}`,
      );
    }

    recordScenario("persistence_idempotency_tenant", true);
  });

  it("validates MATCHED UI identity (not ADS) and user-flow wiring", () => {
    const strip = readSrc("src/modules/matching-engine/ui/matched-strip.tsx");
    assert.match(strip, /MATCHED/);
    assert.doesNotMatch(strip, /\bADS\b|ADVERTISEMENT/);
    assert.match(strip, /Why it matches/);
    assert.match(strip, /Sponsored/);

    const page = readSrc("src/app/(app)/matched-opportunities/page.tsx");
    assert.match(page, /MATCHED/);
    assert.match(page, /requireMatchingEngineModule/);
    assert.match(page, /Sponsored|Organic/);
    assert.doesNotMatch(page, /\bADS\b|ADVERTISEMENT/);

    const dash = readSrc("src/app/(app)/dashboard/page.tsx");
    assert.match(dash, /getMatchedStripForCompany/);
    assert.match(dash, /MatchedOpportunitiesStrip/);
    assert.doesNotMatch(dash, /generateMatchRecommendations|generateRecommendationsForCompany/);

    const sidebar = readSrc("src/components/app/app-sidebar.tsx");
    assert.match(sidebar, /hideWhenDisabled:\s*true/);
    assert.match(sidebar, /matchedOpportunities/);

    recordScenario("ui_flow_matched_identity", true);
  });

  it("performance: generation uses batched reads; dashboard is lightweight", () => {
    const service = readSrc("src/modules/matching-engine/internal/service.ts");
    assert.match(service, /liveOpportunityWhere/);
    assert.match(service, /MATCHING_OPPORTUNITY_BATCH_SIZE/);
    assert.match(service, /getDashboardMatchedStrip/);
    assert.match(service, /listMatchRecommendations/);
    assert.match(service, /Promise\.all/);
    recordScenario("performance_patterns", true);
  });

  it("prints Feature 8C validation report", () => {
    console.log("\n=== Feature 8C Match Matrix ===");
    console.log(
      "Company | Opportunity | Expected | Actual | Score | Confidence | Pass/Fail",
    );
    for (const row of matrixRows) {
      console.log(
        `${row.company} | ${row.opportunity} | ${row.expected} | ${row.actual} | ${row.score} | ${row.confidence} | ${row.pass ? "PASS" : "FAIL"}`,
      );
    }
    const passed = scenarioResults.filter((s) => s.pass).length;
    const failed = scenarioResults.filter((s) => !s.pass).length;
    console.log(
      `\nScenarios: ${scenarioResults.length} | passed: ${passed} | failed: ${failed}`,
    );
    assert.equal(failed, 0);
  });
});
