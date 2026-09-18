/**
 * Feature 8F — Sponsorship eligibility & ranking helpers.
 * Never bypasses 8C relevance / trust / lifecycle gates.
 */

export const MATCHING_SPONSORSHIP_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "ENDED",
  "EXPIRED",
] as const;

export type MatchingSponsorshipStatus =
  (typeof MATCHING_SPONSORSHIP_STATUSES)[number];

export type SponsorshipCampaignMeta = {
  name?: string;
  budgetCents?: number | null;
  currency?: string | null;
  externalCampaignId?: string | null;
};

export type SponsorshipEligibilityInput = {
  globalEnabled: boolean;
  opportunityStatus: string;
  opportunityDeadline?: Date | null;
  sponsorshipStatus: MatchingSponsorshipStatus | string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  now?: Date;
};

export type SponsorshipEligibilityResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

/** Soft secondary signal only — never added to relevance score. */
export const SPONSORSHIP_RANK_TIEBREAK = 0;

/**
 * Live sponsorship window check (status + dates). Does not imply relevance.
 */
export function isSponsorshipWindowLive(input: {
  status: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  now?: Date;
}): boolean {
  if (input.status !== "ACTIVE") return false;
  const now = input.now ?? new Date();
  if (input.startsAt && input.startsAt.getTime() > now.getTime()) return false;
  if (input.endsAt && input.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

/**
 * Deterministic validation before activating / treating as sponsored.
 * Passing here does NOT waive the 8C capability gate for recommendations.
 */
export function validateSponsorshipEligibility(
  input: SponsorshipEligibilityInput,
): SponsorshipEligibilityResult {
  const reasons: string[] = [];
  const now = input.now ?? new Date();

  if (!input.globalEnabled) {
    reasons.push("Sponsorship is globally disabled.");
  }
  if (input.opportunityStatus !== "ACTIVE") {
    reasons.push("Opportunity must be ACTIVE to run sponsorship.");
  }
  if (
    input.opportunityDeadline &&
    input.opportunityDeadline.getTime() <= now.getTime()
  ) {
    reasons.push("Opportunity deadline has passed.");
  }
  if (input.startsAt && input.endsAt && input.startsAt >= input.endsAt) {
    reasons.push("startsAt must be before endsAt.");
  }
  if (input.endsAt && input.endsAt.getTime() <= now.getTime()) {
    reasons.push("Sponsorship end date is already in the past.");
  }
  if (
    input.sponsorshipStatus === "ENDED" ||
    input.sponsorshipStatus === "EXPIRED"
  ) {
    reasons.push(`Sponsorship is ${input.sponsorshipStatus} and cannot activate.`);
  }

  return reasons.length ? { ok: false, reasons } : { ok: true };
}

/**
 * Whether an opportunity should be labeled SPONSORED at generate time.
 * Requires global enable + denormalized flag (synced from live sponsorship).
 */
export function isOpportunitySponsoredForMatching(input: {
  globalEnabled: boolean;
  opportunitySponsored: boolean;
}): boolean {
  return input.globalEnabled && input.opportunitySponsored;
}

/**
 * Ranking comparator: relevance first; sponsored is secondary only.
 * Higher score wins. On equal score/confidence, ORGANIC ranks above SPONSORED.
 * Never promotes an irrelevant sponsored item (those never enter this list).
 */
export function compareMatchRank(a: {
  score: number;
  confidence: number;
  finalRankScore?: number | null;
  type: "ORGANIC" | "SPONSORED";
  id?: string;
}, b: {
  score: number;
  confidence: number;
  finalRankScore?: number | null;
  type: "ORGANIC" | "SPONSORED";
  id?: string;
}): number {
  const ar = a.finalRankScore ?? a.score;
  const br = b.finalRankScore ?? b.score;
  if (br !== ar) return br - ar;
  if (b.score !== a.score) return b.score - a.score;
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  if (a.type !== b.type) {
    if (a.type === "ORGANIC") return -1;
    if (b.type === "ORGANIC") return 1;
  }
  if (a.id && b.id) return a.id.localeCompare(b.id);
  return 0;
}

export function sanitizeSponsorshipCampaignMeta(
  raw: unknown,
): SponsorshipCampaignMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: SponsorshipCampaignMeta = {};
  if (typeof o.name === "string" && o.name.trim()) {
    out.name = o.name.trim().slice(0, 120);
  }
  if (typeof o.budgetCents === "number" && Number.isFinite(o.budgetCents) && o.budgetCents >= 0) {
    out.budgetCents = Math.floor(o.budgetCents);
  } else if (o.budgetCents === null) {
    out.budgetCents = null;
  }
  if (typeof o.currency === "string" && o.currency.trim()) {
    out.currency = o.currency.trim().toUpperCase().slice(0, 8);
  }
  if (typeof o.externalCampaignId === "string" && o.externalCampaignId.trim()) {
    out.externalCampaignId = o.externalCampaignId.trim().slice(0, 64);
  }
  return Object.keys(out).length ? out : null;
}
