/**
 * Company-scoped Matching Engine overview for the user dashboard.
 * Analytics/visibility only — does not generate matches, change gates, or claim business outcomes.
 */
import {
  getCompanyMatchingAnalytics,
  getMatchingProfileForCompany,
  isMatchingEngineAvailable,
  listRecommendationsForCompany,
  type MatchRecommendationDto,
} from "@/modules/matching-engine";
import { prisma } from "@/lib/db";

export type MatchingOverviewState =
  | "unavailable"
  | "not_eligible"
  | "empty"
  | "ready";

export type MatchingOverviewStats = {
  matchesFound: number;
  highlyRelevant: number;
  relevant: number;
  viewed: number;
  interested: number;
  dismissed: number;
};

export type MatchingFunnelStage = {
  id: string;
  label: string;
  value: number;
};

export type MatchingRecentItem = {
  id: string;
  title: string;
  geography: string | null;
  deadline: string | null;
  score: number;
  highlyRelevant: boolean;
  status: string;
  sponsored: boolean;
  href: string;
};

export type MatchingDashboardOverview = {
  companyId: string;
  state: MatchingOverviewState;
  globallyRelevant: boolean;
  stats: MatchingOverviewStats | null;
  funnel: MatchingFunnelStage[];
  quality: MatchingFunnelStage[];
  recent: MatchingRecentItem[];
  eventViews: number;
  eventInterest: number;
  eventDismissals: number;
};

const HIGHLY_RELEVANT_SCORE = 70;

function geographyLabel(item: MatchRecommendationDto): string | null {
  const geos = item.opportunity.geographies;
  if (geos.length > 0) return geos.slice(0, 2).join(", ");
  return null;
}

/**
 * Build Matching Engine Overview for one company (session companyId only).
 */
export async function getMatchingDashboardOverview(
  companyId: string,
): Promise<MatchingDashboardOverview> {
  if (!companyId) {
    throw new Error("companyId required");
  }

  const available = await isMatchingEngineAvailable(companyId);
  if (!available) {
    return {
      companyId,
      state: "unavailable",
      globallyRelevant: false,
      stats: null,
      funnel: [],
      quality: [],
      recent: [],
      eventViews: 0,
      eventInterest: 0,
      eventDismissals: 0,
    };
  }

  const profile = await getMatchingProfileForCompany(companyId).catch(() => null);
  if (!profile?.eligible) {
    return {
      companyId,
      state: "not_eligible",
      globallyRelevant: true,
      stats: null,
      funnel: [],
      quality: [],
      recent: [],
      eventViews: 0,
      eventInterest: 0,
      eventDismissals: 0,
    };
  }

  // Stats via bounded score/status projection (no 100-row opportunity join).
  // Recent strip still uses the module DTO path (limit 5).
  const now = new Date();
  const liveVisibleWhere = {
    companyId,
    status: { in: ["ACTIVE" as const, "READ" as const] },
    opportunity: {
      status: "ACTIVE" as const,
      OR: [{ deadline: null }, { deadline: { gt: now } }],
    },
  };

  const [statRows, dismissed, interestedCount, recentVisible, analytics] =
    await Promise.all([
      prisma.matchRecommendation.findMany({
        where: liveVisibleWhere,
        select: { status: true, score: true },
        take: 500,
        orderBy: [{ finalRankScore: "desc" }, { score: "desc" }],
      }),
      prisma.matchRecommendation.count({
        where: { companyId, status: "DISMISSED" },
      }),
      prisma.matchRecommendation.count({
        where: { companyId, qualityState: "INTERESTED" },
      }),
      listRecommendationsForCompany(companyId, {
        status: "VISIBLE",
        limit: 5,
      }),
      getCompanyMatchingAnalytics(companyId).catch(() => null),
    ]);

  const viewed = statRows.filter((m) => m.status === "READ").length;
  const highlyRelevant = statRows.filter((m) => m.score >= HIGHLY_RELEVANT_SCORE).length;
  const relevant = statRows.filter((m) => m.score < HIGHLY_RELEVANT_SCORE).length;
  const matchesFound = statRows.length;

  const stats: MatchingOverviewStats = {
    matchesFound,
    highlyRelevant,
    relevant,
    viewed,
    interested: interestedCount,
    dismissed,
  };

  // Honest funnel from recommendation lifecycle only (no outcome stage in Matching Engine).
  const funnel: MatchingFunnelStage[] = [
    { id: "matched", label: "Matched", value: matchesFound },
    { id: "viewed", label: "Viewed", value: viewed },
    { id: "interested", label: "Interested", value: interestedCount },
    { id: "dismissed", label: "Dismissed", value: dismissed },
  ];

  const quality: MatchingFunnelStage[] = [
    { id: "highly_relevant", label: "Highly relevant", value: highlyRelevant },
    { id: "relevant", label: "Relevant", value: relevant },
    { id: "dismissed", label: "Dismissed", value: dismissed },
  ];

  const recent: MatchingRecentItem[] = recentVisible.slice(0, 5).map((m) => ({
    id: m.id,
    title: m.opportunity.title,
    geography: geographyLabel(m),
    deadline: m.opportunity.deadline,
    score: m.score,
    highlyRelevant: m.score >= HIGHLY_RELEVANT_SCORE,
    status: m.status,
    sponsored: m.opportunity.sponsored || m.type === "SPONSORED",
    href: `/matched-opportunities`,
  }));

  const state: MatchingOverviewState =
    matchesFound === 0 && dismissed === 0 && interestedCount === 0
      ? "empty"
      : "ready";

  return {
    companyId,
    state,
    globallyRelevant: true,
    stats,
    funnel,
    quality,
    recent,
    eventViews: analytics?.views ?? 0,
    eventInterest: analytics?.interest ?? 0,
    eventDismissals: analytics?.dismissals ?? 0,
  };
}
