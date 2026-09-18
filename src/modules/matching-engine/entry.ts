import {
  countNewRelevantMatches,
  dismissRecommendation,
  generateMatchRecommendations,
  getCompanyMatchingPreferences,
  getCompanyMatchingProfile,
  getDashboardMatchedStrip,
  getMatchRecommendationForCompany,
  getMatchingCompanyAnalytics,
  getMatchingHealthAnalytics,
  getMatchingOpportunityPublic,
  getMatchingPlatformAnalytics,
  getOpportunityAnalyticsRollups,
  impressionIdempotencyKey,
  engagementIdempotencyKey,
  listMatchRecommendations,
  markRecommendationRead,
  rebuildCompanyMatchingPreferences,
  rebuildCompanyMatchingProfile,
  previewCompanyMatchingProfile,
  reconcileExpiredMatchingOpportunities,
  recordMatchingBehaviorEvent,
  transitionOpportunityStatus,
  upsertMatchingOpportunity,
  upsertMatchingOpportunityBatch,
} from "./internal";
import {
  createSponsorship,
  listSponsorships,
  reconcileMatchingSponsorships,
  transitionSponsorship,
} from "./internal/sponsorship";
import {
  createSponsorshipPricingRequest,
  listActiveSponsorshipPricingPlansForCompany,
  listSponsorshipPricingRequestsForCompany,
} from "./internal/sponsorship-pricing";
import type { UpsertOpportunityInput } from "./internal/types";
import type { MatchingOpportunityStatus } from "@prisma/client";

export async function rebuildMatchingProfileForCompany(companyId: string) {
  return rebuildCompanyMatchingProfile(companyId);
}

/** Read-only derive — does not write CompanyMatchingProfile. */
export async function previewMatchingProfileForCompany(companyId: string) {
  return previewCompanyMatchingProfile(companyId);
}

export async function generateRecommendationsForCompany(
  companyId: string,
  options?: { rebuildProfile?: boolean; enableAiRefine?: boolean },
) {
  return generateMatchRecommendations(companyId, options);
}

export async function listRecommendationsForCompany(
  companyId: string,
  options?: { limit?: number; offset?: number; status?: "ACTIVE" | "READ" | "DISMISSED" | "VISIBLE" },
) {
  return listMatchRecommendations(companyId, options);
}

export async function getMatchedStripForCompany(
  companyId: string,
  limit?: number,
) {
  return getDashboardMatchedStrip(companyId, limit);
}

export async function getRecommendationForCompany(
  companyId: string,
  recommendationId: string,
) {
  return getMatchRecommendationForCompany(companyId, recommendationId);
}

export async function markRecommendationReadForCompany(
  companyId: string,
  recommendationId: string,
) {
  return markRecommendationRead(companyId, recommendationId);
}

export async function dismissRecommendationForCompany(
  companyId: string,
  recommendationId: string,
  actorUserId?: string | null,
) {
  return dismissRecommendation(companyId, recommendationId, actorUserId);
}

export async function getPublicOpportunity(opportunityId: string) {
  return getMatchingOpportunityPublic(opportunityId);
}

export async function upsertOpportunity(input: UpsertOpportunityInput) {
  return upsertMatchingOpportunity(input);
}

export async function upsertOpportunityBatch(inputs: UpsertOpportunityInput[]) {
  return upsertMatchingOpportunityBatch(inputs);
}

export async function getMatchingProfileForCompany(companyId: string) {
  return getCompanyMatchingProfile(companyId);
}

export async function transitionOpportunity(
  opportunityId: string,
  to: MatchingOpportunityStatus,
) {
  return transitionOpportunityStatus({ opportunityId, to });
}

export async function reconcileMatchingOpportunityLifecycle(limit?: number) {
  return reconcileExpiredMatchingOpportunities(limit);
}

export async function recordBehaviorEventForCompany(
  input: Parameters<typeof recordMatchingBehaviorEvent>[0],
) {
  return recordMatchingBehaviorEvent(input);
}

export async function getCompanyMatchingAnalytics(
  companyId: string,
  range?: { from?: Date; to?: Date },
) {
  return getMatchingCompanyAnalytics(companyId, range);
}

export async function getPlatformMatchingAnalytics(range?: {
  from?: Date;
  to?: Date;
  opportunityId?: string;
}) {
  return getMatchingPlatformAnalytics(range);
}

export async function getOpportunityMatchingRollups(range?: {
  from?: Date;
  to?: Date;
  limit?: number;
  sort?: "interest" | "impressions" | "engagement";
}) {
  return getOpportunityAnalyticsRollups(range);
}

export async function rebuildMatchingPreferencesForCompany(companyId: string) {
  return rebuildCompanyMatchingPreferences(companyId);
}

export async function getMatchingPreferencesForCompany(companyId: string) {
  return getCompanyMatchingPreferences(companyId);
}

export async function getMatchingEngineHealthAnalytics(range?: {
  from?: Date;
  to?: Date;
}) {
  return getMatchingHealthAnalytics(range);
}

export async function countNewMatchesForCompany(companyId: string) {
  return countNewRelevantMatches(companyId);
}

export async function listCompanySponsorships(companyId: string) {
  return listSponsorships({ sponsorCompanyId: companyId, limit: 50 });
}

export async function createCompanySponsorship(input: {
  companyId: string;
  opportunityId: string;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  campaignMeta?: unknown;
}) {
  return createSponsorship({
    opportunityId: input.opportunityId,
    sponsorCompanyId: input.companyId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    campaignMeta: input.campaignMeta,
    assertSponsorCompanyId: input.companyId,
  });
}

export async function transitionCompanySponsorship(input: {
  companyId: string;
  sponsorshipId: string;
  to: "ACTIVE" | "PAUSED" | "ENDED";
}) {
  return transitionSponsorship({
    sponsorshipId: input.sponsorshipId,
    to: input.to,
    assertSponsorCompanyId: input.companyId,
  });
}

export async function reconcileMatchingSponsorshipLifecycle(limit?: number) {
  return reconcileMatchingSponsorships(limit);
}

/** Active Sponsored Matching price plans — company request flow only. */
export async function listActiveSponsoredMatchingPlansForCompany(
  companyId: string,
  opts?: { segment?: string | null },
) {
  return listActiveSponsorshipPricingPlansForCompany(companyId, opts);
}

/** Company sponsorship pricing REQUEST / ORDER intent (NoOp billing). */
export async function requestSponsoredMatchingPlanForCompany(input: {
  companyId: string;
  planId: string;
  notes?: string | null;
}) {
  return createSponsorshipPricingRequest(input);
}

export async function listSponsoredMatchingPlanRequestsForCompany(
  companyId: string,
  limit?: number,
) {
  return listSponsorshipPricingRequestsForCompany(companyId, limit);
}

export { impressionIdempotencyKey, engagementIdempotencyKey };
