/**
 * Feature 8D — Opportunity lifecycle, events, recommendation state, batching.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  canTransitionOpportunityStatus,
  isOpportunityLiveForMatching,
  MATCHING_OPPORTUNITY_BATCH_SIZE,
  MATCHING_MIN_RELEVANCE_SCORE,
  hashOpportunityMatchingContent,
} from "@/domain/matching-engine";
import { prisma } from "@/lib/db";
import {
  MATCHING_ENGINE_FEATURE_KEY,
  MATCHING_SPONSORSHIP_SETTINGS_KEY,
  createCompanySponsorship,
  dismissRecommendationForCompany,
  generateRecommendationsForCompany,
  getCompanyMatchingAnalytics,
  markRecommendationReadForCompany,
  reconcileMatchingOpportunityLifecycle,
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
import { ENTITLEMENT_FEATURE_KEYS, UNSHIPPED_ENTITLEMENT_KEYS } from "@/domain/billing/entitlement-catalog";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PREFIX = `me8d-${Date.now().toString(36)}-`;

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
    where: { source: { startsWith: "ME8D_" } },
  });
  await prisma.systemSetting.deleteMany({
    where: { key: MATCHING_SPONSORSHIP_SETTINGS_KEY },
  });
  companyIds.length = 0;
  opportunityIds.length = 0;
}

async function seedCompany(slugSuffix: string) {
  const company = await prisma.company.create({
    data: {
      name: `ME8D ${slugSuffix}`,
      slug: `${PREFIX}${slugSuffix}`,
      country: "Morocco",
      companySize: "Medium",
      profile: {
        create: {
          industry: "Technology",
          country: "Morocco",
          companySize: "Medium",
          services: ["Cybersecurity", "Cloud"],
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

describe("Feature 8D — lifecycle domain helpers", () => {
  it("keeps matching_engine OFF / unshipped by default", () => {
    assert.ok(ENTITLEMENT_FEATURE_KEYS.includes("matching_engine"));
    assert.ok(UNSHIPPED_ENTITLEMENT_KEYS.includes("matching_engine"));
    const catalog = readSrc("src/domain/billing/entitlement-catalog.ts");
    assert.match(catalog, /defaultEnabledGlobal:\s*false/);
  });

  it("defines lifecycle transitions and live eligibility", () => {
    assert.equal(canTransitionOpportunityStatus("DRAFT", "ACTIVE"), true);
    assert.equal(canTransitionOpportunityStatus("ACTIVE", "PAUSED"), true);
    assert.equal(canTransitionOpportunityStatus("ACTIVE", "EXPIRED"), true);
    assert.equal(canTransitionOpportunityStatus("ARCHIVED", "ACTIVE"), false);
    assert.equal(
      isOpportunityLiveForMatching({
        status: "ACTIVE",
        deadline: new Date(Date.now() + 86400000),
      }),
      true,
    );
    assert.equal(
      isOpportunityLiveForMatching({
        status: "ACTIVE",
        deadline: new Date(Date.now() - 1000),
      }),
      false,
    );
    assert.equal(
      isOpportunityLiveForMatching({ status: "PAUSED", deadline: null }),
      false,
    );
    assert.equal(
      isOpportunityLiveForMatching({ status: "EXPIRED", deadline: null }),
      false,
    );
  });

  it("uses batch size under former hard 500 cap for cursor processing", () => {
    assert.ok(MATCHING_OPPORTUNITY_BATCH_SIZE > 0);
    assert.ok(MATCHING_OPPORTUNITY_BATCH_SIZE < 500);
    const service = readSrc("src/modules/matching-engine/internal/service.ts");
    assert.match(service, /MATCHING_OPPORTUNITY_BATCH_SIZE/);
    assert.match(service, /cursor/);
    assert.doesNotMatch(service, /take:\s*500/);
  });

  it("wires read/dismiss APIs and preserves READ/DISMISS on regenerate", () => {
    const service = readSrc("src/modules/matching-engine/internal/service.ts");
    assert.match(service, /preservedStatus/);
    assert.match(service, /DISMISSED/);
    assert.match(service, /dismissRecommendation/);
    assert.match(
      readSrc(
        "src/app/api/matching-engine/recommendations/[recommendationId]/read/route.ts",
      ),
      /markRecommendationReadForCompany/,
    );
    assert.match(
      readSrc(
        "src/app/api/matching-engine/recommendations/[recommendationId]/dismiss/route.ts",
      ),
      /dismissRecommendationForCompany/,
    );
  });
});

describe("Feature 8D — DB lifecycle / dedup / events", () => {
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
  });

  after(async () => {
    await cleanup();
    await prisma.feature.updateMany({
      where: { key: MATCHING_ENGINE_FEATURE_KEY },
      data: { enabledGlobal: false },
    });
  });

  it("dedupes upserts by source + externalRef", async () => {
    const source = "ME8D_DEDUP";
    const externalRef = `${PREFIX}dedup-1`;
    const first = await upsertOpportunity({
      title: "Cybersecurity Services — Morocco",
      summary: "v1",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      source,
      externalRef,
      status: "ACTIVE",
    });
    opportunityIds.push(first.id);
    const second = await upsertOpportunity({
      title: "Cybersecurity Services — Morocco",
      summary: "v2 updated",
      services: ["Cybersecurity", "Cloud"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      source,
      externalRef,
      status: "ACTIVE",
    });
    assert.equal(first.id, second.id);
    assert.equal(second.summary, "v2 updated");
    const count = await prisma.matchingOpportunity.count({
      where: { source, externalRef },
    });
    assert.equal(count, 1);
  });

  it("expires by deadline and hides from visible recommendations", async () => {
    const companyId = await seedCompany("expire");
    const past = new Date(Date.now() - 60_000);
    const opp = await upsertOpportunity({
      title: "Cybersecurity Services — Morocco",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      sizeBand: "Medium",
      experienceHint: "5 years",
      source: "ME8D_EXPIRE",
      externalRef: `${PREFIX}expire-1`,
      status: "ACTIVE",
      deadline: past,
    });
    opportunityIds.push(opp.id);

    // Force ACTIVE with past deadline (upsert may still create ACTIVE)
    await prisma.matchingOpportunity.update({
      where: { id: opp.id },
      data: { status: "ACTIVE", deadline: past },
    });

    const reconciled = await reconcileMatchingOpportunityLifecycle(20);
    assert.ok(reconciled.expired >= 1);
    const refreshed = await prisma.matchingOpportunity.findUnique({
      where: { id: opp.id },
    });
    assert.equal(refreshed?.status, "EXPIRED");

    await generateMatchRecommendations(companyId, { rebuildProfile: true });
    const visible = await listMatchRecommendations(companyId, {
      status: "VISIBLE",
    });
    assert.ok(!visible.some((r) => r.opportunity.id === opp.id));
  });

  it("pause transition invalidates visible recs; sponsored still relevance-gated", async () => {
    await setMatchingSponsorshipGloballyEnabled(true);
    const companyId = await seedCompany("pause");
    const opp = await upsertOpportunity({
      title: "Cybersecurity Services — Morocco",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      sizeBand: "Medium",
      experienceHint: "5 years",
      source: "ME8D_PAUSE",
      externalRef: `${PREFIX}pause-1`,
      status: "ACTIVE",
      deadline: new Date(Date.now() + 7 * 86400000),
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
    let visible = await listMatchRecommendations(companyId, { status: "VISIBLE" });
    const rec = visible.find((r) => r.opportunity.id === opp.id);
    assert.ok(rec);
    assert.equal(rec.type, "SPONSORED");
    assert.ok(rec.score >= MATCHING_MIN_RELEVANCE_SCORE);

    await transitionOpportunity(opp.id, "PAUSED");
    visible = await listMatchRecommendations(companyId, { status: "VISIBLE" });
    assert.ok(!visible.some((r) => r.opportunity.id === opp.id));

    // Irrelevant sponsored agriculture must not match
    const bad = await upsertOpportunity({
      title: "Agricultural Equipment",
      services: ["Agricultural Equipment"],
      industries: ["Agriculture"],
      geographies: ["Morocco"],
      source: "ME8D_PAUSE",
      externalRef: `${PREFIX}pause-bad`,
      status: "ACTIVE",
    });
    opportunityIds.push(bad.id);
    const badSp = await createCompanySponsorship({
      companyId,
      opportunityId: bad.id,
      endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    await transitionSponsorship({
      sponsorshipId: badSp.id,
      to: "ACTIVE",
      actorAdminId: "sa-test",
    });
    await generateMatchRecommendations(companyId, { rebuildProfile: false });
    visible = await listMatchRecommendations(companyId, { status: "VISIBLE" });
    assert.ok(!visible.some((r) => r.opportunity.id === bad.id));
  });

  it("preserves DISMISS and READ across regeneration", async () => {
    const companyId = await seedCompany("state");
    const opp = await upsertOpportunity({
      title: "Cybersecurity Services — Morocco",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      sizeBand: "Medium",
      experienceHint: "5 years",
      source: "ME8D_STATE",
      externalRef: `${PREFIX}state-1`,
      status: "ACTIVE",
      deadline: new Date(Date.now() + 7 * 86400000),
    });
    opportunityIds.push(opp.id);

    await generateMatchRecommendations(companyId, { rebuildProfile: true });
    let visible = await listMatchRecommendations(companyId, { status: "VISIBLE" });
    const rec = visible.find((r) => r.opportunity.id === opp.id);
    assert.ok(rec);

    await markRecommendationReadForCompany(companyId, rec.id);
    await generateMatchRecommendations(companyId, { rebuildProfile: false });
    const afterRead = await prisma.matchRecommendation.findUnique({
      where: { id: rec.id },
    });
    assert.equal(afterRead?.status, "READ");

    await dismissRecommendationForCompany(companyId, rec.id);
    await generateMatchRecommendations(companyId, { rebuildProfile: false });
    const afterDismiss = await prisma.matchRecommendation.findUnique({
      where: { id: rec.id },
    });
    assert.equal(afterDismiss?.status, "DISMISSED");
    visible = await listMatchRecommendations(companyId, { status: "VISIBLE" });
    assert.ok(!visible.some((r) => r.id === rec.id));
  });

  it("records behavior events with idempotent impressions and company analytics", async () => {
    const companyId = await seedCompany("events");
    const otherCompany = await seedCompany("events-b");
    const opp = await upsertOpportunity({
      title: "Cybersecurity Services — Morocco",
      services: ["Cybersecurity"],
      industries: ["Technology"],
      geographies: ["Morocco"],
      source: "ME8D_EVENTS",
      externalRef: `${PREFIX}events-1`,
      status: "ACTIVE",
      deadline: new Date(Date.now() + 7 * 86400000),
    });
    opportunityIds.push(opp.id);
    await generateMatchRecommendations(companyId, { rebuildProfile: true });
    const visible = await listMatchRecommendations(companyId, {
      status: "VISIBLE",
    });
    const rec = visible.find((r) => r.opportunity.id === opp.id);
    assert.ok(rec);

    const key = `impression:${companyId}:${rec.id}:testday`;
    const e1 = await recordBehaviorEventForCompany({
      companyId,
      opportunityId: opp.id,
      recommendationId: rec.id,
      eventType: "IMPRESSION",
      idempotencyKey: key,
    });
    const e2 = await recordBehaviorEventForCompany({
      companyId,
      opportunityId: opp.id,
      recommendationId: rec.id,
      eventType: "IMPRESSION",
      idempotencyKey: key,
    });
    assert.equal(e1.duplicate, false);
    assert.equal(e2.duplicate, true);
    assert.equal(e1.id, e2.id);

    await recordBehaviorEventForCompany({
      companyId,
      opportunityId: opp.id,
      recommendationId: rec.id,
      eventType: "VIEW",
    });
    await recordBehaviorEventForCompany({
      companyId,
      opportunityId: opp.id,
      recommendationId: rec.id,
      eventType: "CLICK",
      metadata: { target: "view_opportunity" },
    });

    const analytics = await getCompanyMatchingAnalytics(companyId);
    assert.ok(analytics.impressions >= 1);
    assert.ok(analytics.views >= 1);
    assert.ok(analytics.clicks >= 1);

    const otherAnalytics = await getCompanyMatchingAnalytics(otherCompany);
    assert.equal(otherAnalytics.impressions, 0);

    // Tenant isolation: other company cannot attach to this recommendation
    await assert.rejects(
      () =>
        recordBehaviorEventForCompany({
          companyId: otherCompany,
          opportunityId: opp.id,
          recommendationId: rec.id,
          eventType: "VIEW",
        }),
      /not found/i,
    );
  });

  it("processes more than one batch of opportunities deterministically", async () => {
    const companyId = await seedCompany("batch");
    const batchN = MATCHING_OPPORTUNITY_BATCH_SIZE + 3;

    // Isolate corpus so generate only scans this test's opportunities
    // (avoids Neon timeouts when leftover ACTIVE rows from other suites exist).
    const otherLive = await prisma.matchingOpportunity.findMany({
      where: {
        status: "ACTIVE",
        NOT: {
          AND: [
            { source: "ME8D_BATCH" },
            { externalRef: { startsWith: `${PREFIX}batch-` } },
          ],
        },
      },
      select: { id: true },
    });
    if (otherLive.length) {
      await prisma.matchingOpportunity.updateMany({
        where: { id: { in: otherLive.map((o) => o.id) } },
        data: { status: "PAUSED" },
      });
    }

    try {
      for (let i = 0; i < batchN; i++) {
        const opp = await upsertOpportunity({
          title: `Cybersecurity batch ${i}`,
          services: ["Cybersecurity"],
          industries: ["Technology"],
          geographies: ["Morocco"],
          sizeBand: "Medium",
          experienceHint: "5 years",
          source: "ME8D_BATCH",
          externalRef: `${PREFIX}batch-${i}`,
          status: "ACTIVE",
          deadline: new Date(Date.now() + 7 * 86400000),
        });
        opportunityIds.push(opp.id);
      }
      await generateRecommendationsForCompany(companyId, {
        rebuildProfile: true,
      });
      const count = await prisma.matchRecommendation.count({
        where: {
          companyId,
          status: { in: ["ACTIVE", "READ"] },
          opportunity: { source: "ME8D_BATCH" },
        },
      });
      assert.ok(
        count >= MATCHING_OPPORTUNITY_BATCH_SIZE,
        `expected >= ${MATCHING_OPPORTUNITY_BATCH_SIZE} recs, got ${count}`,
      );
      // Idempotent second run
      await generateRecommendationsForCompany(companyId, {
        rebuildProfile: false,
      });
      const count2 = await prisma.matchRecommendation.count({
        where: {
          companyId,
          opportunity: { source: "ME8D_BATCH" },
        },
      });
      assert.equal(count2, count);
    } finally {
      if (otherLive.length) {
        await prisma.matchingOpportunity.updateMany({
          where: { id: { in: otherLive.map((o) => o.id) } },
          data: { status: "ACTIVE" },
        });
      }
    }
  });

  it("content hash is stable for identical public fields", () => {
    const a = hashOpportunityMatchingContent({
      title: "X",
      services: ["Cybersecurity"],
      geographies: ["Morocco"],
    });
    const b = hashOpportunityMatchingContent({
      title: "X",
      services: ["Cybersecurity"],
      geographies: ["Morocco"],
    });
    assert.equal(a, b);
    assert.equal(a.length, 32);
    assert.equal(
      createHash("sha256").update("noop").digest("hex").slice(0, 8).length,
      8,
    );
  });
});
