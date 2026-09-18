/**
 * Matching Engine activation readiness — corpus advisory for real-data go-live.
 * Super Admin may enable Matching Engine freely; threshold is informational only.
 */

import { prisma } from "@/lib/db";
import {
  countEligibleMatchingCompanies,
  getMatchingEngineMinEligibleCompanies,
  isMatchingEngineGloballyEnabled,
} from "../access";
import { isMatchingSponsorshipGloballyEnabled } from "./sponsorship-settings";
import { getMatchingAiRuntimeConfig } from "./ai-config";

export type MatchingActivationReadiness = {
  matchingEnabledGlobal: boolean;
  sponsorshipEnabledGlobal: boolean;
  aiRefineEnabled: boolean;
  aiRefineReady: boolean;
  eligibleCompanies: number;
  eligibleThreshold: number;
  thresholdMet: boolean;
  activeOpportunities: number;
  liveOpportunities: number;
  recommendationsVisible: number;
  recommendationsOrganic: number;
  recommendationsSponsored: number;
  /** Always true — SA may enable Matching Engine at any time. */
  canEnableMatching: boolean;
  /** Corpus advisories only (not hard enable blockers). */
  blockers: string[];
};

export async function getMatchingActivationReadiness(): Promise<MatchingActivationReadiness> {
  const now = new Date();
  const [
    matchingEnabledGlobal,
    sponsorshipEnabledGlobal,
    aiRuntime,
    eligibleCompanies,
    eligibleThreshold,
    activeOpportunities,
    liveOpportunities,
    recGroups,
  ] = await Promise.all([
    isMatchingEngineGloballyEnabled(),
    isMatchingSponsorshipGloballyEnabled(),
    getMatchingAiRuntimeConfig(),
    countEligibleMatchingCompanies(),
    getMatchingEngineMinEligibleCompanies(),
    prisma.matchingOpportunity.count({ where: { status: "ACTIVE" } }),
    prisma.matchingOpportunity.count({
      where: {
        status: "ACTIVE",
        OR: [{ deadline: null }, { deadline: { gt: now } }],
      },
    }),
    prisma.matchRecommendation.groupBy({
      by: ["type"],
      where: {
        status: { in: ["ACTIVE", "READ"] },
        opportunity: {
          status: "ACTIVE",
          OR: [{ deadline: null }, { deadline: { gt: now } }],
        },
      },
      _count: { _all: true },
    }),
  ]);

  let recommendationsOrganic = 0;
  let recommendationsSponsored = 0;
  for (const g of recGroups) {
    if (g.type === "ORGANIC") recommendationsOrganic = g._count._all;
    if (g.type === "SPONSORED") recommendationsSponsored = g._count._all;
  }
  const recommendationsVisible =
    recommendationsOrganic + recommendationsSponsored;

  const thresholdMet = eligibleCompanies >= eligibleThreshold;
  const blockers: string[] = [];
  if (!thresholdMet) {
    blockers.push(
      `Corpus advisory: eligible companies (${eligibleCompanies}) below recommended threshold (${eligibleThreshold}). Super Admin may still enable Matching Engine freely.`,
    );
  }

  return {
    matchingEnabledGlobal,
    sponsorshipEnabledGlobal,
    aiRefineEnabled: aiRuntime?.enabled === true,
    aiRefineReady: aiRuntime?.ready === true,
    eligibleCompanies,
    eligibleThreshold,
    thresholdMet,
    activeOpportunities,
    liveOpportunities,
    recommendationsVisible,
    recommendationsOrganic,
    recommendationsSponsored,
    canEnableMatching: true,
    blockers,
  };
}

/**
 * Retained for API compatibility. Super Admin enable is free — no hard gate.
 */
export async function assertMatchingEngineCanEnableGlobally(): Promise<void> {
  return;
}
