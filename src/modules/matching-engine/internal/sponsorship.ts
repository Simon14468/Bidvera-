/**
 * Matching sponsorship lifecycle & authorization (Feature 8F).
 */

import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  isOpportunityLiveForMatching,
  isSponsorshipWindowLive,
  sanitizeSponsorshipCampaignMeta,
  validateSponsorshipEligibility,
  type MatchingSponsorshipStatus,
} from "@/domain/matching-engine";
import type { Prisma } from "@prisma/client";
import { getMatchingSponsorshipBillingPort } from "./sponsorship-billing";
import {
  getMatchingSponsorshipSettings,
  isMatchingSponsorshipGloballyEnabled,
  setMatchingSponsorshipGloballyEnabled,
} from "./sponsorship-settings";

export type MatchingSponsorshipDto = {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  sponsorCompanyId: string;
  sponsorCompanyName: string;
  status: MatchingSponsorshipStatus;
  startsAt: string | null;
  endsAt: string | null;
  campaignMeta: unknown;
  billingRef: string | null;
  billingStatus: string | null;
  activatedAt: string | null;
  pausedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function toDto(row: {
  id: string;
  opportunityId: string;
  sponsorCompanyId: string;
  status: MatchingSponsorshipStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  campaignMeta: unknown;
  billingRef: string | null;
  billingStatus: string | null;
  activatedAt: Date | null;
  pausedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  opportunity: { title: string };
  sponsorCompany: { name: string };
}): MatchingSponsorshipDto {
  return {
    id: row.id,
    opportunityId: row.opportunityId,
    opportunityTitle: row.opportunity.title,
    sponsorCompanyId: row.sponsorCompanyId,
    sponsorCompanyName: row.sponsorCompany.name,
    status: row.status,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    campaignMeta: row.campaignMeta,
    billingRef: row.billingRef,
    billingStatus: row.billingStatus,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    pausedAt: row.pausedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const include = {
  opportunity: { select: { title: true, status: true, deadline: true, sponsored: true } },
  sponsorCompany: { select: { name: true } },
} as const;

async function syncOpportunitySponsoredFlag(opportunityId: string): Promise<boolean> {
  const globalOn = await isMatchingSponsorshipGloballyEnabled();
  const now = new Date();
  const live = await prisma.matchingSponsorship.findFirst({
    where: {
      opportunityId,
      status: "ACTIVE",
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    select: { id: true },
  });
  const sponsored = Boolean(globalOn && live);
  await prisma.matchingOpportunity.update({
    where: { id: opportunityId },
    data: { sponsored },
  });
  return sponsored;
}

/** Public: recompute denormalized sponsored from live sponsorship only. */
export async function reconcileOpportunitySponsoredFlag(
  opportunityId: string,
): Promise<boolean> {
  return syncOpportunitySponsoredFlag(opportunityId);
}

/**
 * Clear sponsored=true rows that have no live ACTIVE sponsorship window.
 * Used by reconcile + global-off paths for denormalized integrity.
 */
export async function clearOrphanedSponsoredOpportunityFlags(
  limit = 100,
): Promise<number> {
  const now = new Date();
  const orphans = await prisma.matchingOpportunity.findMany({
    where: {
      sponsored: true,
      sponsorships: {
        none: {
          status: "ACTIVE",
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          ],
        },
      },
    },
    select: { id: true },
    take: Math.min(Math.max(limit, 1), 500),
  });
  if (!orphans.length) return 0;
  await prisma.matchingOpportunity.updateMany({
    where: { id: { in: orphans.map((o) => o.id) } },
    data: { sponsored: false },
  });
  return orphans.length;
}

export async function getSponsorshipGlobalSettings() {
  return getMatchingSponsorshipSettings();
}

export async function setSponsorshipGlobalEnabled(enabled: boolean) {
  const settings = await setMatchingSponsorshipGloballyEnabled(enabled);
  if (!enabled) {
    await prisma.matchingOpportunity.updateMany({
      where: { sponsored: true },
      data: { sponsored: false },
    });
    return settings;
  }
  // Re-sync denormalized flags for active sponsorships; clear any orphans first.
  await clearOrphanedSponsoredOpportunityFlags(500);
  const actives = await prisma.matchingSponsorship.findMany({
    where: { status: "ACTIVE" },
    select: { opportunityId: true },
  });
  const unique = [...new Set(actives.map((a) => a.opportunityId))];
  for (const opportunityId of unique) {
    await syncOpportunitySponsoredFlag(opportunityId);
  }
  return settings;
}

export async function listSponsorships(input?: {
  sponsorCompanyId?: string;
  status?: MatchingSponsorshipStatus;
  limit?: number;
}): Promise<MatchingSponsorshipDto[]> {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 100);
  const rows = await prisma.matchingSponsorship.findMany({
    where: {
      ...(input?.sponsorCompanyId
        ? { sponsorCompanyId: input.sponsorCompanyId }
        : {}),
      ...(input?.status ? { status: input.status } : {}),
    },
    include,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: limit,
  });
  return rows.map(toDto);
}

export async function getSponsorshipForCompany(
  sponsorshipId: string,
  companyId: string,
): Promise<MatchingSponsorshipDto | null> {
  const row = await prisma.matchingSponsorship.findFirst({
    where: { id: sponsorshipId, sponsorCompanyId: companyId },
    include,
  });
  return row ? toDto(row) : null;
}

export async function createSponsorship(input: {
  opportunityId: string;
  sponsorCompanyId: string;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  campaignMeta?: unknown;
  actorAdminId?: string | null;
  /** When set, enforces tenant ownership (company self-serve). */
  assertSponsorCompanyId?: string;
}): Promise<MatchingSponsorshipDto> {
  if (
    input.assertSponsorCompanyId &&
    input.assertSponsorCompanyId !== input.sponsorCompanyId
  ) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Cannot create sponsorship for another company.",
      403,
    );
  }

  const opportunity = await prisma.matchingOpportunity.findUnique({
    where: { id: input.opportunityId },
  });
  if (!opportunity) {
    throw new AppError(ErrorCode.NOT_FOUND, "Opportunity not found.", 404);
  }
  const company = await prisma.company.findUnique({
    where: { id: input.sponsorCompanyId },
    select: { id: true },
  });
  if (!company) {
    throw new AppError(ErrorCode.NOT_FOUND, "Sponsor company not found.", 404);
  }

  const startsAt = parseDate(input.startsAt);
  const endsAt = parseDate(input.endsAt);
  const campaignMeta = sanitizeSponsorshipCampaignMeta(input.campaignMeta);

  const row = await prisma.matchingSponsorship.create({
    data: {
      opportunityId: input.opportunityId,
      sponsorCompanyId: input.sponsorCompanyId,
      status: "DRAFT",
      startsAt,
      endsAt,
      campaignMeta: campaignMeta
        ? (campaignMeta as Prisma.InputJsonValue)
        : undefined,
      createdByAdminId: input.actorAdminId ?? null,
      updatedByAdminId: input.actorAdminId ?? null,
      billingStatus: "NOT_REQUIRED",
    },
    include,
  });
  return toDto(row);
}

export async function transitionSponsorship(input: {
  sponsorshipId: string;
  to: "ACTIVE" | "PAUSED" | "ENDED";
  actorAdminId?: string | null;
  /** Company self-serve — must own the sponsorship. */
  assertSponsorCompanyId?: string;
}): Promise<MatchingSponsorshipDto> {
  const existing = await prisma.matchingSponsorship.findUnique({
    where: { id: input.sponsorshipId },
    include: {
      opportunity: true,
      sponsorCompany: { select: { name: true } },
    },
  });
  if (!existing) {
    throw new AppError(ErrorCode.NOT_FOUND, "Sponsorship not found.", 404);
  }
  if (
    input.assertSponsorCompanyId &&
    existing.sponsorCompanyId !== input.assertSponsorCompanyId
  ) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Cannot modify another company's sponsorship.",
      403,
    );
  }

  const now = new Date();
  if (input.to === "ACTIVE") {
    // While billing is NoOp, live ACTIVE sponsorship is an SA/ops privilege.
    // Company self-serve may create DRAFT and request pricing — not activate.
    if (input.assertSponsorCompanyId && !input.actorAdminId) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        "Sponsorship activation requires Super Admin approval while payment is not integrated.",
        403,
      );
    }
    const globalEnabled = await isMatchingSponsorshipGloballyEnabled();
    const eligibility = validateSponsorshipEligibility({
      globalEnabled,
      opportunityStatus: existing.opportunity.status,
      opportunityDeadline: existing.opportunity.deadline,
      sponsorshipStatus: existing.status,
      startsAt: existing.startsAt,
      endsAt: existing.endsAt,
      now,
    });
    if (!eligibility.ok) {
      throw new AppError(
        ErrorCode.VALIDATION,
        eligibility.reasons.join(" "),
        400,
      );
    }
    if (!isOpportunityLiveForMatching({ ...existing.opportunity, now })) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Opportunity is not live for matching.",
        400,
      );
    }

    const billing = await getMatchingSponsorshipBillingPort().prepareSponsorshipBilling(
      {
        sponsorshipId: existing.id,
        sponsorCompanyId: existing.sponsorCompanyId,
        opportunityId: existing.opportunityId,
        amountCents:
          typeof (existing.campaignMeta as { budgetCents?: number } | null)
            ?.budgetCents === "number"
            ? (existing.campaignMeta as { budgetCents: number }).budgetCents
            : null,
        currency:
          typeof (existing.campaignMeta as { currency?: string } | null)
            ?.currency === "string"
            ? (existing.campaignMeta as { currency: string }).currency
            : null,
      },
    );

    const row = await prisma.matchingSponsorship.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        activatedAt: now,
        pausedAt: null,
        endedAt: null,
        billingRef: billing.billingRef,
        billingStatus: billing.billingStatus,
        updatedByAdminId: input.actorAdminId ?? null,
      },
      include,
    });
    await syncOpportunitySponsoredFlag(existing.opportunityId);
    return toDto(row);
  }

  if (input.to === "PAUSED") {
    if (existing.status !== "ACTIVE" && existing.status !== "PAUSED") {
      throw new AppError(
        ErrorCode.VALIDATION,
        `Cannot pause sponsorship from ${existing.status}.`,
        400,
      );
    }
    const row = await prisma.matchingSponsorship.update({
      where: { id: existing.id },
      data: {
        status: "PAUSED",
        pausedAt: now,
        updatedByAdminId: input.actorAdminId ?? null,
      },
      include,
    });
    await syncOpportunitySponsoredFlag(existing.opportunityId);
    return toDto(row);
  }

  // ENDED
  const row = await prisma.matchingSponsorship.update({
    where: { id: existing.id },
    data: {
      status: "ENDED",
      endedAt: now,
      updatedByAdminId: input.actorAdminId ?? null,
    },
    include,
  });
  await syncOpportunitySponsoredFlag(existing.opportunityId);
  return toDto(row);
}

/** Expire past-end ACTIVE sponsorships; sync opportunity.sponsored flags. */
export async function reconcileMatchingSponsorships(
  limit = 50,
): Promise<{ expired: number; clearedOrphans: number }> {
  const now = new Date();
  const due = await prisma.matchingSponsorship.findMany({
    where: {
      status: "ACTIVE",
      endsAt: { lte: now },
    },
    take: limit,
    select: { id: true, opportunityId: true },
  });
  for (const s of due) {
    await prisma.matchingSponsorship.update({
      where: { id: s.id },
      data: { status: "EXPIRED", endedAt: now },
    });
    await syncOpportunitySponsoredFlag(s.opportunityId);
  }
  const clearedOrphans = await clearOrphanedSponsoredOpportunityFlags(limit);
  return { expired: due.length, clearedOrphans };
}

export function sponsorshipIsLiveNow(row: {
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
}): boolean {
  return isSponsorshipWindowLive(row);
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
