/**
 * Sponsored Matching company pricing — catalog + request intent.
 * Does not change Matching Engine scoring / relevance / ranking.
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
  scoreCompanyOpportunityMatch,
  opportunityToMatchingSignals,
  type MatchingProfileSnapshot,
} from "@/domain/matching-engine";
import { prisma } from "@/lib/db";
import {
  createSponsorshipPricingRequest,
  listActiveSponsorshipPricingPlansForCompany,
  listSponsorshipPricingPlansForAdmin,
  reorderSponsorshipPricingPlans,
  setSponsorshipPricingPlanStatus,
  upsertSponsorshipPricingPlan,
} from "@/modules/matching-engine/internal/sponsorship-pricing";
import {
  isMatchingSponsorshipGloballyEnabled,
  setMatchingSponsorshipGloballyEnabled,
} from "@/modules/matching-engine/internal/sponsorship-settings";
import { AppError } from "@/lib/errors";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PREFIX = `me-sp-price-${Date.now().toString(36)}-`;

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const companyIds: string[] = [];
const planIds: string[] = [];

async function cleanup() {
  if (companyIds.length) {
    await prisma.matchingSponsorshipPricingRequest.deleteMany({
      where: { companyId: { in: companyIds } },
    });
  }
  if (planIds.length) {
    await prisma.matchingSponsorshipPricingRequest.deleteMany({
      where: { planId: { in: planIds } },
    });
    await prisma.matchingSponsorshipPricingPlan.deleteMany({
      where: { id: { in: planIds } },
    });
  }
  await prisma.matchingSponsorshipPricingPlan.deleteMany({
    where: { name: { startsWith: "ME SP Price" } },
  });
  if (companyIds.length) {
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }
  companyIds.length = 0;
  planIds.length = 0;
}

async function seedCompany(suffix: string) {
  const company = await prisma.company.create({
    data: {
      name: `ME SP Price ${suffix}`,
      slug: `${PREFIX}${suffix}`,
      country: "Morocco",
      companySize: "Medium",
    },
  });
  companyIds.push(company.id);
  return company.id;
}

describe("Sponsored Matching pricing", () => {
  before(async () => {
    await cleanup();
  });

  after(async () => {
    await cleanup();
    await setMatchingSponsorshipGloballyEnabled(false);
  });

  it("SA can create, edit, activate/deactivate, reorder, and change price/currency", async () => {
    const a = await upsertSponsorshipPricingPlan({
      name: "ME SP Price Starter",
      description: "Starter catalog",
      priceCents: 4900,
      currency: "usd",
      billingPeriod: "ONE_TIME",
      campaignDurationDays: 14,
      maxCampaigns: 1,
      status: "INACTIVE",
      displayOrder: 1,
      benefits: ["Relevant sponsored label only"],
    });
    planIds.push(a.id);

    const b = await upsertSponsorshipPricingPlan({
      name: "ME SP Price Growth",
      priceCents: 9900,
      currency: "eur",
      billingPeriod: "MONTHLY",
      campaignDurationDays: 30,
      status: "INACTIVE",
      displayOrder: 0,
    });
    planIds.push(b.id);

    const updated = await upsertSponsorshipPricingPlan({
      id: a.id,
      name: "ME SP Price Starter",
      priceCents: 5900,
      currency: "gbp",
      billingPeriod: "ONE_TIME",
      campaignDurationDays: 21,
      status: "ACTIVE",
      displayOrder: 2,
      benefits: ["Relevant sponsored label only", "No relevance bypass"],
    });
    assert.equal(updated.priceCents, 5900);
    assert.equal(updated.currency, "gbp");
    assert.equal(updated.status, "ACTIVE");

    await setSponsorshipPricingPlanStatus({
      planId: b.id,
      status: "ACTIVE",
    });
    const reordered = await reorderSponsorshipPricingPlans([b.id, a.id]);
    assert.equal(reordered.find((p) => p.id === b.id)?.displayOrder, 0);
    assert.equal(reordered.find((p) => p.id === a.id)?.displayOrder, 1);

    const adminList = await listSponsorshipPricingPlansForAdmin();
    assert.ok(adminList.some((p) => p.id === a.id && p.status === "ACTIVE"));
    assert.ok(adminList.some((p) => p.id === b.id));
  });

  it("inactive plans hidden from companies; active visible in request flow API layer", async () => {
    await setMatchingSponsorshipGloballyEnabled(true);
    const companyId = await seedCompany("vis");
    const active = await upsertSponsorshipPricingPlan({
      name: "ME SP Price Active Vis",
      priceCents: 1000,
      currency: "usd",
      status: "ACTIVE",
      displayOrder: 0,
    });
    const inactive = await upsertSponsorshipPricingPlan({
      name: "ME SP Price Inactive Vis",
      priceCents: 2000,
      currency: "usd",
      status: "INACTIVE",
      displayOrder: 1,
    });
    planIds.push(active.id, inactive.id);

    const visible = await listActiveSponsorshipPricingPlansForCompany(companyId);
    assert.ok(visible.some((p) => p.id === active.id));
    assert.ok(!visible.some((p) => p.id === inactive.id));
  });

  it("company-specific custom pricing is tenant-isolated", async () => {
    await setMatchingSponsorshipGloballyEnabled(true);
    const a = await seedCompany("custom-a");
    const b = await seedCompany("custom-b");
    const customA = await upsertSponsorshipPricingPlan({
      name: "ME SP Price Custom A",
      priceCents: 12300,
      currency: "usd",
      status: "ACTIVE",
      companyId: a,
      displayOrder: 0,
    });
    planIds.push(customA.id);

    const forA = await listActiveSponsorshipPricingPlansForCompany(a);
    const forB = await listActiveSponsorshipPricingPlansForCompany(b);
    assert.ok(forA.some((p) => p.id === customA.id));
    assert.ok(!forB.some((p) => p.id === customA.id));

    await assert.rejects(
      () =>
        createSponsorshipPricingRequest({
          companyId: b,
          planId: customA.id,
        }),
      (err: unknown) => err instanceof AppError && err.status === 403,
    );
  });

  it("company can submit request intent via NoOp billing; cannot mutate plans", async () => {
    await setMatchingSponsorshipGloballyEnabled(true);
    const companyId = await seedCompany("req");
    const plan = await upsertSponsorshipPricingPlan({
      name: "ME SP Price Requestable",
      priceCents: 7700,
      currency: "usd",
      status: "ACTIVE",
      campaignDurationDays: 30,
      benefits: ["Secondary to organic at equal relevance"],
    });
    planIds.push(plan.id);

    const request = await createSponsorshipPricingRequest({
      companyId,
      planId: plan.id,
      notes: "Please contact us",
    });
    assert.equal(request.status, "REQUESTED");
    assert.equal(request.companyId, companyId);
    assert.ok(request.billingRef?.startsWith("noop:"));
    assert.equal(request.billingStatus, "NOT_REQUIRED");

    // Company surface has no upsert export path in public module entry for pricing CRUD.
    const entry = readSrc("src/modules/matching-engine/entry.ts");
    assert.match(entry, /requestSponsoredMatchingPlanForCompany/);
    assert.doesNotMatch(entry, /upsertSponsorshipPricingPlan/);
  });

  it("hides company sponsored pricing when sponsorship is globally OFF", async () => {
    await setMatchingSponsorshipGloballyEnabled(false);
    const companyId = await seedCompany("off");
    const plan = await upsertSponsorshipPricingPlan({
      name: "ME SP Price Off Gate",
      priceCents: 1500,
      currency: "usd",
      status: "ACTIVE",
    });
    planIds.push(plan.id);

    const visible = await listActiveSponsorshipPricingPlansForCompany(companyId);
    assert.equal(visible.length, 0);
    await assert.rejects(
      () =>
        createSponsorshipPricingRequest({
          companyId,
          planId: plan.id,
        }),
      (err: unknown) => err instanceof AppError && err.status === 403,
    );
    assert.equal(await isMatchingSponsorshipGloballyEnabled(), false);
  });

  it("normal Matching page gates sponsored CTA and clarifies match meaning", () => {
    const matched = readSrc(
      "src/app/(app)/matched-opportunities/page.tsx",
    );
    const client = readSrc(
      "src/modules/matching-engine/ui/matched-opportunities-client.tsx",
    );
    const sponsoredPage = readSrc(
      "src/app/(app)/matched-opportunities/sponsored/page.tsx",
    );
    assert.match(matched, /isMatchingSponsorshipGloballyEnabled/);
    assert.match(matched, /Request Sponsored Matching/);
    assert.match(matched, /not a won contract/i);
    assert.doesNotMatch(matched, /priceCents|sponsorship-pricing/);
    assert.doesNotMatch(client, /priceCents|Sponsored Pricing|\$\d/);
    assert.match(sponsoredPage, /isMatchingSponsorshipGloballyEnabled/);
    assert.match(sponsoredPage, /SponsoredMatchingRequestClient/);
    assert.match(
      readSrc("src/components/super-admin/sa-shell.tsx"),
      /matching-sponsored-pricing/,
    );
  });

  it("sponsorship relevance / ranking rules remain unchanged", () => {
    const score = readSrc("src/domain/matching-engine/score.ts");
    assert.match(score, /MATCHING_MIN_RELEVANCE_SCORE/);
    assert.doesNotMatch(score, /priceCents|PricingPlan/);

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
        geographies: ["Morocco"],
        certifications: [],
      }),
    });
    assert.equal(scored.meetsRelevanceThreshold, true);
    assert.ok(scored.score >= MATCHING_MIN_RELEVANCE_SCORE);

    assert.equal(
      isOpportunitySponsoredForMatching({
        globalEnabled: true,
        opportunitySponsored: true,
      }),
      true,
    );

    const organic = {
      score: 80,
      confidence: 90,
      type: "ORGANIC" as const,
    };
    const sponsored = {
      score: 80,
      confidence: 90,
      type: "SPONSORED" as const,
    };
    assert.ok(compareMatchRank(organic, sponsored) < 0);
  });
});
