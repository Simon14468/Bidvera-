/**
 * Opportunity lifecycle helpers (Feature 8D).
 * Does not change scoring / relevance algorithm.
 *
 * UNIVERSAL SEMANTICS (all sectors / countries / match scenarios):
 * - MatchingOpportunity is a shared global corpus object.
 * - MatchRecommendation (+ quality / events) is company-tenant scoped.
 * - Company INTEREST / READ / DISMISS / future deal intent NEVER changes
 *   MatchingOpportunity.status and NEVER deletes the opportunity.
 * - New matches are gated only by isOpportunityLiveForMatching
 *   (ACTIVE + non-past deadline) — not by how many companies interacted,
 *   industry, country, winner count, or sponsorship.
 * - Same-country is NOT required; geography is a soft relevance signal only.
 */

import { createHash } from "crypto";
import type { MatchingOpportunityStatus } from "@prisma/client";

export const MATCHING_OPPORTUNITY_BATCH_SIZE = 200;

export type OpportunityMatchingContent = {
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
};

export function hashOpportunityMatchingContent(
  input: OpportunityMatchingContent,
): string {
  const deadline =
    input.deadline instanceof Date
      ? input.deadline.toISOString()
      : input.deadline ?? null;
  const payload = JSON.stringify({
    title: input.title.trim(),
    summary: input.summary?.trim() || null,
    category: input.category?.trim() || null,
    industry: input.industry?.trim() || null,
    services: input.services ?? [],
    industries: input.industries ?? [],
    geographies: input.geographies ?? [],
    certifications: input.certifications ?? [],
    sizeBand: input.sizeBand?.trim() || null,
    experienceHint: input.experienceHint?.trim() || null,
    deadline,
    signalsJson: input.signalsJson ?? null,
    sponsored: Boolean(input.sponsored),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

/**
 * Eligible for new matching / visible recommendations.
 * Sector-, country-, and winner-count agnostic.
 */
export function isOpportunityLiveForMatching(input: {
  status: MatchingOpportunityStatus | string;
  deadline?: Date | string | null;
  now?: Date;
}): boolean {
  if (input.status !== "ACTIVE") return false;
  if (input.deadline == null || input.deadline === "") return true;
  const deadline =
    input.deadline instanceof Date
      ? input.deadline
      : new Date(input.deadline);
  if (Number.isNaN(deadline.getTime())) return true;
  const now = input.now ?? new Date();
  return deadline.getTime() > now.getTime();
}

/** Alias — authoritative open/closed gate for NEW matches worldwide. */
export const isOpportunityOpenForNewMatches = isOpportunityLiveForMatching;

export function canTransitionOpportunityStatus(
  from: MatchingOpportunityStatus | string,
  to: MatchingOpportunityStatus | string,
): boolean {
  if (from === to) return true;
  const edges: Record<string, string[]> = {
    DRAFT: ["ACTIVE", "ARCHIVED"],
    ACTIVE: ["PAUSED", "EXPIRED", "ARCHIVED"],
    PAUSED: ["ACTIVE", "EXPIRED", "ARCHIVED"],
    EXPIRED: ["ACTIVE", "DRAFT", "ARCHIVED"],
    ARCHIVED: [],
  };
  return (edges[from] ?? []).includes(to);
}

/**
 * Invariant helper for tests/docs: company recommendation actions are
 * tenant-scoped and must never be treated as opportunity closure.
 */
export function isCompanyScopedRecommendationAction(
  action:
    | "READ"
    | "DISMISS"
    | "INTEREST"
    | "VIEW"
    | "CLICK"
    | "IMPRESSION",
): true {
  void action;
  return true;
}
