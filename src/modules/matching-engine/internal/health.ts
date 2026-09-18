import { prisma } from "@/lib/db";
import {
  countEligibleMatchingCompanies,
  getMatchingEngineMinEligibleCompanies,
} from "../access";
import {
  getMatchingPlatformAnalytics,
  getOpportunityAnalyticsRollups,
} from "./analytics";
import { getMatchingActivationReadiness } from "./activation-readiness";

export type MatchingHealthAnalytics = {
  opportunities: {
    active: number;
    paused: number;
    expired: number;
    draft: number;
    archived: number;
  };
  eligibleCompanies: number;
  eligibleThreshold: number;
  recommendationsVisible: number;
  readiness: Awaited<ReturnType<typeof getMatchingActivationReadiness>>;
  funnel: Awaited<ReturnType<typeof getMatchingPlatformAnalytics>>;
  topCategories: { category: string; impressions: number; interest: number }[];
  topOpportunities: Awaited<ReturnType<typeof getOpportunityAnalyticsRollups>>;
  weakOpportunities: Awaited<ReturnType<typeof getOpportunityAnalyticsRollups>>;
};

/**
 * Super Admin aggregate health — no per-company private payloads.
 */
export async function getMatchingHealthAnalytics(input?: {
  from?: Date;
  to?: Date;
}): Promise<MatchingHealthAnalytics> {
  const from =
    input?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = input?.to ?? new Date();

  const [
    byStatus,
    eligibleCompanies,
    eligibleThreshold,
    recommendationsVisible,
    readiness,
    funnel,
    topOpportunities,
  ] = await Promise.all([
    prisma.matchingOpportunity.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    countEligibleMatchingCompanies(),
    getMatchingEngineMinEligibleCompanies(),
    prisma.matchRecommendation.count({
      where: {
        status: { in: ["ACTIVE", "READ"] },
        opportunity: {
          status: "ACTIVE",
          OR: [{ deadline: null }, { deadline: { gt: to } }],
        },
      },
    }),
    getMatchingActivationReadiness(),
    getMatchingPlatformAnalytics({ from, to, preferRollups: true }),
    getOpportunityAnalyticsRollups({
      from,
      to,
      limit: 10,
      sort: "interest",
    }),
  ]);

  const opportunities = {
    active: 0,
    paused: 0,
    expired: 0,
    draft: 0,
    archived: 0,
  };
  for (const row of byStatus) {
    const n = row._count._all;
    if (row.status === "ACTIVE") opportunities.active = n;
    else if (row.status === "PAUSED") opportunities.paused = n;
    else if (row.status === "EXPIRED") opportunities.expired = n;
    else if (row.status === "DRAFT") opportunities.draft = n;
    else if (row.status === "ARCHIVED") opportunities.archived = n;
  }

  const weakOpportunities = [...topOpportunities]
    .filter((o) => o.impressions >= 3)
    .sort((a, b) => {
      const ar = a.rates.interestRate ?? 0;
      const br = b.rates.interestRate ?? 0;
      if (ar !== br) return ar - br;
      return (b.rates.dismissalRate ?? 0) - (a.rates.dismissalRate ?? 0);
    })
    .slice(0, 10);

  // If rollups empty, still try weak from same list by dismissals
  if (weakOpportunities.length === 0 && topOpportunities.length === 0) {
    const byDismiss = await getOpportunityAnalyticsRollups({
      from,
      to,
      limit: 10,
      sort: "impressions",
    });
    weakOpportunities.push(
      ...byDismiss
        .filter((o) => o.impressions >= 3 && (o.rates.interestRate ?? 0) < 0.05)
        .slice(0, 10),
    );
  }

  const categoryMap = new Map<string, { impressions: number; interest: number }>();
  for (const o of topOpportunities) {
    const cat = o.category?.trim() || "Uncategorized";
    const cur = categoryMap.get(cat) ?? { impressions: 0, interest: 0 };
    cur.impressions += o.impressions;
    cur.interest += o.interest;
    categoryMap.set(cat, cur);
  }
  const topCategories = [...categoryMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.interest - a.interest || b.impressions - a.impressions)
    .slice(0, 10);

  return {
    opportunities,
    eligibleCompanies,
    eligibleThreshold,
    recommendationsVisible,
    readiness,
    funnel,
    topCategories,
    topOpportunities,
    weakOpportunities,
  };
}
