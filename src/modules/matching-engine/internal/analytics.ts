import { prisma } from "@/lib/db";
import type { MatchingBehaviorEventType } from "@prisma/client";
import {
  computeMatchingRates,
  utcDayStart,
  type MatchingAnalyticsRates,
} from "@/domain/matching-engine";

export type MatchingAnalyticsBucket = {
  impressions: number;
  views: number;
  clicks: number;
  interest: number;
  dismissals: number;
};

export type MatchingAnalyticsTotals = MatchingAnalyticsBucket & {
  rates: MatchingAnalyticsRates;
  byType: {
    ORGANIC: MatchingAnalyticsBucket & { rates: MatchingAnalyticsRates };
    SPONSORED: MatchingAnalyticsBucket & { rates: MatchingAnalyticsRates };
  };
};

export type OpportunityAnalyticsRollup = MatchingAnalyticsBucket & {
  opportunityId: string;
  title: string;
  category: string | null;
  sponsored: boolean;
  rates: MatchingAnalyticsRates;
};

function emptyBucket(): MatchingAnalyticsBucket {
  return {
    impressions: 0,
    views: 0,
    clicks: 0,
    interest: 0,
    dismissals: 0,
  };
}

function withRates(
  b: MatchingAnalyticsBucket,
): MatchingAnalyticsBucket & { rates: MatchingAnalyticsRates } {
  return { ...b, rates: computeMatchingRates(b) };
}

function addCount(
  totals: MatchingAnalyticsBucket,
  bucket: MatchingAnalyticsBucket | null,
  eventType: MatchingBehaviorEventType,
  n: number,
) {
  const apply = (b: MatchingAnalyticsBucket) => {
    switch (eventType) {
      case "IMPRESSION":
        b.impressions += n;
        break;
      case "VIEW":
        b.views += n;
        break;
      case "CLICK":
        b.clicks += n;
        break;
      case "INTEREST":
        b.interest += n;
        break;
      case "DISMISS":
        b.dismissals += n;
        break;
    }
  };
  apply(totals);
  if (bucket) apply(bucket);
}

async function aggregateFromGroupBy(where: {
  companyId?: string;
  opportunityId?: string;
  createdAt?: { gte?: Date; lte?: Date };
}): Promise<MatchingAnalyticsTotals> {
  const rows = await prisma.matchingBehaviorEvent.groupBy({
    by: ["eventType", "recommendationType"],
    where,
    _count: { _all: true },
  });

  const organic = emptyBucket();
  const sponsored = emptyBucket();
  const base = emptyBucket();

  for (const row of rows) {
    const n = row._count._all;
    if (row.recommendationType === "SPONSORED") {
      addCount(base, sponsored, row.eventType, n);
    } else if (row.recommendationType === "ORGANIC") {
      addCount(base, organic, row.eventType, n);
    } else {
      addCount(base, null, row.eventType, n);
    }
  }

  return {
    ...base,
    rates: computeMatchingRates(base),
    byType: {
      ORGANIC: withRates(organic),
      SPONSORED: withRates(sponsored),
    },
  };
}

function sumRollupRows(
  rows: {
    impressions: number;
    views: number;
    clicks: number;
    interest: number;
    dismissals: number;
    organicImpressions: number;
    sponsoredImpressions: number;
    organicInterest: number;
    sponsoredInterest: number;
  }[],
): MatchingAnalyticsTotals {
  const base = emptyBucket();
  const organic = emptyBucket();
  const sponsored = emptyBucket();
  for (const r of rows) {
    base.impressions += r.impressions;
    base.views += r.views;
    base.clicks += r.clicks;
    base.interest += r.interest;
    base.dismissals += r.dismissals;
    organic.impressions += r.organicImpressions;
    organic.interest += r.organicInterest;
    sponsored.impressions += r.sponsoredImpressions;
    sponsored.interest += r.sponsoredInterest;
  }
  return {
    ...base,
    rates: computeMatchingRates(base),
    byType: {
      ORGANIC: withRates(organic),
      SPONSORED: withRates(sponsored),
    },
  };
}

/** Prefer platform daily rollups when a date window is provided; else event groupBy. */
export async function getMatchingPlatformAnalytics(input?: {
  from?: Date;
  to?: Date;
  opportunityId?: string;
  preferRollups?: boolean;
}): Promise<MatchingAnalyticsTotals & { source: "rollups" | "events" }> {
  const preferRollups = input?.preferRollups !== false;
  if (preferRollups && !input?.opportunityId && (input?.from || input?.to)) {
    const dayWhere: { gte?: Date; lte?: Date } = {};
    if (input.from) dayWhere.gte = utcDayStart(input.from);
    if (input.to) dayWhere.lte = utcDayStart(input.to);
    const rows = await prisma.matchingPlatformDailyStats.findMany({
      where: Object.keys(dayWhere).length ? { day: dayWhere } : undefined,
    });
    if (rows.length > 0) {
      return { ...sumRollupRows(rows), source: "rollups" };
    }
  }

  const where: {
    opportunityId?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {};
  if (input?.opportunityId) where.opportunityId = input.opportunityId;
  if (input?.from || input?.to) {
    where.createdAt = {};
    if (input.from) where.createdAt.gte = input.from;
    if (input.to) where.createdAt.lte = input.to;
  }
  const totals = await aggregateFromGroupBy(where);
  return { ...totals, source: "events" };
}

/** Company-scoped aggregates — only the requesting company's events. */
export async function getMatchingCompanyAnalytics(
  companyId: string,
  input?: { from?: Date; to?: Date },
): Promise<MatchingAnalyticsTotals & { source: "events" }> {
  const where: {
    companyId: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = { companyId };
  if (input?.from || input?.to) {
    where.createdAt = {};
    if (input.from) where.createdAt.gte = input.from;
    if (input.to) where.createdAt.lte = input.to;
  }
  const totals = await aggregateFromGroupBy(where);
  return { ...totals, source: "events" };
}

/** Opportunity-level rollups from daily stats (fast path). */
export async function getOpportunityAnalyticsRollups(input?: {
  from?: Date;
  to?: Date;
  limit?: number;
  sort?: "interest" | "impressions" | "engagement";
}): Promise<OpportunityAnalyticsRollup[]> {
  const limit = Math.min(Math.max(input?.limit ?? 20, 1), 100);
  const dayWhere: { gte?: Date; lte?: Date } = {};
  if (input?.from) dayWhere.gte = utcDayStart(input.from);
  if (input?.to) dayWhere.lte = utcDayStart(input.to);

  const rows = await prisma.matchingOpportunityDailyStats.findMany({
    where: Object.keys(dayWhere).length ? { day: dayWhere } : undefined,
    include: {
      opportunity: {
        select: {
          id: true,
          title: true,
          category: true,
          sponsored: true,
        },
      },
    },
  });

  const byOpp = new Map<
    string,
    MatchingAnalyticsBucket & {
      title: string;
      category: string | null;
      sponsored: boolean;
    }
  >();

  for (const r of rows) {
    const cur = byOpp.get(r.opportunityId) ?? {
      ...emptyBucket(),
      title: r.opportunity.title,
      category: r.opportunity.category,
      sponsored: r.opportunity.sponsored,
    };
    cur.impressions += r.impressions;
    cur.views += r.views;
    cur.clicks += r.clicks;
    cur.interest += r.interest;
    cur.dismissals += r.dismissals;
    byOpp.set(r.opportunityId, cur);
  }

  const list: OpportunityAnalyticsRollup[] = [...byOpp.entries()].map(
    ([opportunityId, b]) => ({
      opportunityId,
      title: b.title,
      category: b.category,
      sponsored: b.sponsored,
      impressions: b.impressions,
      views: b.views,
      clicks: b.clicks,
      interest: b.interest,
      dismissals: b.dismissals,
      rates: computeMatchingRates(b),
    }),
  );

  const sort = input?.sort ?? "interest";
  list.sort((a, b) => {
    if (sort === "impressions") return b.impressions - a.impressions;
    if (sort === "engagement") {
      const ae = (a.rates.engagementRate ?? 0) * a.impressions;
      const be = (b.rates.engagementRate ?? 0) * b.impressions;
      return be - ae;
    }
    return b.interest - a.interest || b.impressions - a.impressions;
  });

  return list.slice(0, limit);
}

/** Incremental write-behind for daily rollups (called from event ingest). */
export async function incrementMatchingDailyRollups(input: {
  opportunityId: string;
  eventType: MatchingBehaviorEventType;
  recommendationType?: "ORGANIC" | "SPONSORED" | null;
  at?: Date;
}): Promise<void> {
  const day = utcDayStart(input.at ?? new Date());
  const field =
    input.eventType === "IMPRESSION"
      ? "impressions"
      : input.eventType === "VIEW"
        ? "views"
        : input.eventType === "CLICK"
          ? "clicks"
          : input.eventType === "INTEREST"
            ? "interest"
            : "dismissals";

  const organicImp =
    input.eventType === "IMPRESSION" && input.recommendationType === "ORGANIC"
      ? 1
      : 0;
  const sponsoredImp =
    input.eventType === "IMPRESSION" && input.recommendationType === "SPONSORED"
      ? 1
      : 0;
  const organicInterest =
    input.eventType === "INTEREST" && input.recommendationType === "ORGANIC"
      ? 1
      : 0;
  const sponsoredInterest =
    input.eventType === "INTEREST" && input.recommendationType === "SPONSORED"
      ? 1
      : 0;

  await prisma.matchingOpportunityDailyStats.upsert({
    where: {
      opportunityId_day: {
        opportunityId: input.opportunityId,
        day,
      },
    },
    create: {
      opportunityId: input.opportunityId,
      day,
      impressions: field === "impressions" ? 1 : 0,
      views: field === "views" ? 1 : 0,
      clicks: field === "clicks" ? 1 : 0,
      interest: field === "interest" ? 1 : 0,
      dismissals: field === "dismissals" ? 1 : 0,
      organicImpressions: organicImp,
      sponsoredImpressions: sponsoredImp,
      organicInterest,
      sponsoredInterest,
    },
    update: {
      [field]: { increment: 1 },
      ...(organicImp
        ? { organicImpressions: { increment: 1 } }
        : {}),
      ...(sponsoredImp
        ? { sponsoredImpressions: { increment: 1 } }
        : {}),
      ...(organicInterest
        ? { organicInterest: { increment: 1 } }
        : {}),
      ...(sponsoredInterest
        ? { sponsoredInterest: { increment: 1 } }
        : {}),
    },
  });

  await prisma.matchingPlatformDailyStats.upsert({
    where: { day },
    create: {
      day,
      impressions: field === "impressions" ? 1 : 0,
      views: field === "views" ? 1 : 0,
      clicks: field === "clicks" ? 1 : 0,
      interest: field === "interest" ? 1 : 0,
      dismissals: field === "dismissals" ? 1 : 0,
      organicImpressions: organicImp,
      sponsoredImpressions: sponsoredImp,
      organicInterest,
      sponsoredInterest,
    },
    update: {
      [field]: { increment: 1 },
      ...(organicImp
        ? { organicImpressions: { increment: 1 } }
        : {}),
      ...(sponsoredImp
        ? { sponsoredImpressions: { increment: 1 } }
        : {}),
      ...(organicInterest
        ? { organicInterest: { increment: 1 } }
        : {}),
      ...(sponsoredInterest
        ? { sponsoredInterest: { increment: 1 } }
        : {}),
    },
  });
}
