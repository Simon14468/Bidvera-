import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  canTransitionOpportunityStatus,
  hashOpportunityMatchingContent,
  isOpportunityLiveForMatching,
} from "@/domain/matching-engine";
import type { MatchingOpportunityStatus } from "@prisma/client";
import type { PublicOpportunityDto } from "./types";

function toPublicOpportunity(row: {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  industry: string | null;
  services: string[];
  industries: string[];
  geographies: string[];
  certifications: string[];
  sizeBand: string | null;
  experienceHint: string | null;
  deadline: Date | null;
  source: string;
  externalRef: string | null;
  status: PublicOpportunityDto["status"];
  sponsored: boolean;
  intentDirection?: PublicOpportunityDto["intentDirection"] | null;
}): PublicOpportunityDto {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    industry: row.industry,
    services: row.services,
    industries: row.industries,
    geographies: row.geographies,
    certifications: row.certifications,
    sizeBand: row.sizeBand,
    experienceHint: row.experienceHint,
    deadline: row.deadline?.toISOString() ?? null,
    source: row.source,
    externalRef: row.externalRef,
    status: row.status,
    sponsored: row.sponsored,
    intentDirection: row.intentDirection ?? "UNSPECIFIED",
  };
}

/**
 * Hide recommendations from VISIBLE lists when an opportunity leaves live matching.
 *
 * IMPORTANT (universal multi-tenant semantics):
 * - Does NOT delete MatchingOpportunity.
 * - Does NOT permanently DISMISS all companies' recommendations on PAUSE/EXPIRY.
 * - Visibility is enforced by liveOpportunityWhere on list/generate (ACTIVE + deadline).
 * - User DISMISS remains company-specific; PAUSE must be reversible without wiping
 *   other tenants' ACTIVE/READ states (multi-winner / framework / recurring safe).
 * - Sponsored and organic recommendations follow the same rule.
 *
 * Kept as a named hook for transition/reconcile callers (compat); returns 0.
 */
export async function invalidateRecommendationsForOpportunity(
  opportunityId: string,
): Promise<number> {
  // Soft-hide only — no cross-tenant ACTIVE→DISMISSED write.
  // opportunityId retained for caller compatibility / future audit hooks.
  void opportunityId;
  return 0;
}

export async function transitionOpportunityStatus(input: {
  opportunityId: string;
  to: MatchingOpportunityStatus;
}): Promise<PublicOpportunityDto> {
  const existing = await prisma.matchingOpportunity.findUnique({
    where: { id: input.opportunityId },
  });
  if (!existing) {
    throw new AppError(ErrorCode.NOT_FOUND, "Opportunity not found.", 404);
  }
  if (!canTransitionOpportunityStatus(existing.status, input.to)) {
    throw new AppError(
      ErrorCode.VALIDATION,
      `Cannot transition opportunity from ${existing.status} to ${input.to}.`,
      400,
    );
  }

  const now = new Date();
  const data: {
    status: MatchingOpportunityStatus;
    publishedAt?: Date | null;
    pausedAt?: Date | null;
    expiredAt?: Date | null;
  } = { status: input.to };

  if (input.to === "ACTIVE") {
    data.publishedAt = existing.publishedAt ?? now;
    data.pausedAt = null;
    data.expiredAt = null;
  } else if (input.to === "PAUSED") {
    data.pausedAt = now;
  } else if (input.to === "EXPIRED") {
    data.expiredAt = now;
  }

  const row = await prisma.matchingOpportunity.update({
    where: { id: input.opportunityId },
    data,
  });

  // Soft-hide via live filter; do not mutate tenant recommendation statuses.
  if (!isOpportunityLiveForMatching(row)) {
    await invalidateRecommendationsForOpportunity(row.id);
  }

  return toPublicOpportunity(row);
}

/**
 * Expire ACTIVE/PAUSED opportunities past deadline.
 * Returns count expired. Safe for worker reconcile loops.
 * Does not invent single-winner closure; deadline is source-authoritative.
 * Tenant recommendation statuses are not mass-dismissed (soft-hide only).
 */
export async function reconcileExpiredMatchingOpportunities(
  limit = 100,
): Promise<{ expired: number; invalidated: number }> {
  const now = new Date();
  const due = await prisma.matchingOpportunity.findMany({
    where: {
      status: { in: ["ACTIVE", "PAUSED"] },
      deadline: { lte: now },
    },
    select: { id: true },
    take: Math.min(Math.max(limit, 1), 500),
    orderBy: { deadline: "asc" },
  });

  let expired = 0;
  let invalidated = 0;
  for (const opp of due) {
    await prisma.matchingOpportunity.update({
      where: { id: opp.id },
      data: { status: "EXPIRED", expiredAt: now },
    });
    // Soft-hide hook (no cross-tenant DISMISS writes).
    invalidated += await invalidateRecommendationsForOpportunity(opp.id);
    expired += 1;
  }
  return { expired, invalidated };
}

export function computeOpportunityContentHash(fields: {
  title: string;
  summary?: string | null;
  category?: string | null;
  industry?: string | null;
  services?: string[];
  industries?: string[];
  geographies?: string[];
  certifications?: string[];
  sizeBand?: string | null;
  experienceHint?: string | null;
  deadline?: Date | string | null;
  signalsJson?: unknown;
  sponsored?: boolean;
}): string {
  return hashOpportunityMatchingContent(fields);
}

export { toPublicOpportunity, isOpportunityLiveForMatching };
