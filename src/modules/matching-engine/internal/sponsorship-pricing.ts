/**
 * Sponsored Matching pricing catalog + company request intent.
 * Commercial layer only — never touches scoring, relevance, or ranking.
 */

import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import type {
  MatchingSponsorshipPricingBillingPeriod,
  MatchingSponsorshipPricingPlanStatus,
  MatchingSponsorshipPricingRequestStatus,
} from "@prisma/client";
import { getMatchingSponsorshipBillingPort } from "./sponsorship-billing";
import { isMatchingSponsorshipGloballyEnabled } from "./sponsorship-settings";

export type MatchingSponsorshipPricingPlanDto = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingPeriod: MatchingSponsorshipPricingBillingPeriod;
  campaignDurationDays: number | null;
  maxCampaigns: number | null;
  maxImpressions: number | null;
  segment: string | null;
  companyId: string | null;
  status: MatchingSponsorshipPricingPlanStatus;
  displayOrder: number;
  benefits: string[];
  createdAt: string;
  updatedAt: string;
};

export type MatchingSponsorshipPricingRequestDto = {
  id: string;
  companyId: string;
  planId: string;
  status: MatchingSponsorshipPricingRequestStatus;
  planSnapshot: unknown;
  billingRef: string | null;
  billingStatus: string | null;
  notes: string | null;
  createdAt: string;
  plan?: MatchingSponsorshipPricingPlanDto;
};

function toPlanDto(row: {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingPeriod: MatchingSponsorshipPricingBillingPeriod;
  campaignDurationDays: number | null;
  maxCampaigns: number | null;
  maxImpressions: number | null;
  segment: string | null;
  companyId: string | null;
  status: MatchingSponsorshipPricingPlanStatus;
  displayOrder: number;
  benefits: string[];
  createdAt: Date;
  updatedAt: Date;
}): MatchingSponsorshipPricingPlanDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.priceCents,
    currency: row.currency,
    billingPeriod: row.billingPeriod,
    campaignDurationDays: row.campaignDurationDays,
    maxCampaigns: row.maxCampaigns,
    maxImpressions: row.maxImpressions,
    segment: row.segment,
    companyId: row.companyId,
    status: row.status,
    displayOrder: row.displayOrder,
    benefits: row.benefits ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRequestDto(row: {
  id: string;
  companyId: string;
  planId: string;
  status: MatchingSponsorshipPricingRequestStatus;
  planSnapshot: unknown;
  billingRef: string | null;
  billingStatus: string | null;
  notes: string | null;
  createdAt: Date;
  plan?: Parameters<typeof toPlanDto>[0];
}): MatchingSponsorshipPricingRequestDto {
  return {
    id: row.id,
    companyId: row.companyId,
    planId: row.planId,
    status: row.status,
    planSnapshot: row.planSnapshot,
    billingRef: row.billingRef,
    billingStatus: row.billingStatus,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    plan: row.plan ? toPlanDto(row.plan) : undefined,
  };
}

function snapshotPlan(plan: MatchingSponsorshipPricingPlanDto) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    priceCents: plan.priceCents,
    currency: plan.currency,
    billingPeriod: plan.billingPeriod,
    campaignDurationDays: plan.campaignDurationDays,
    maxCampaigns: plan.maxCampaigns,
    maxImpressions: plan.maxImpressions,
    segment: plan.segment,
    benefits: plan.benefits,
  };
}

export type UpsertMatchingSponsorshipPricingPlanInput = {
  id?: string;
  name: string;
  description?: string | null;
  priceCents: number;
  currency?: string;
  billingPeriod?: MatchingSponsorshipPricingBillingPeriod;
  campaignDurationDays?: number | null;
  maxCampaigns?: number | null;
  maxImpressions?: number | null;
  segment?: string | null;
  companyId?: string | null;
  status?: MatchingSponsorshipPricingPlanStatus;
  displayOrder?: number;
  benefits?: string[];
};

/** SA: list all pricing plans (including inactive). */
export async function listSponsorshipPricingPlansForAdmin(limit = 100) {
  const rows = await prisma.matchingSponsorshipPricingPlan.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    take: Math.min(Math.max(limit, 1), 200),
  });
  return rows.map(toPlanDto);
}

/** SA: create or update a pricing plan. */
export async function upsertSponsorshipPricingPlan(
  input: UpsertMatchingSponsorshipPricingPlanInput,
): Promise<MatchingSponsorshipPricingPlanDto> {
  const name = input.name.trim();
  if (!name) {
    throw new AppError(ErrorCode.VALIDATION, "Plan name is required.", 400);
  }
  if (!Number.isFinite(input.priceCents) || input.priceCents < 0) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "priceCents must be a non-negative integer.",
      400,
    );
  }
  const currency = (input.currency ?? "usd").trim().toLowerCase() || "usd";
  const data = {
    name,
    description: input.description?.trim() || null,
    priceCents: Math.floor(input.priceCents),
    currency,
    billingPeriod: input.billingPeriod ?? "ONE_TIME",
    campaignDurationDays:
      input.campaignDurationDays == null
        ? null
        : Math.max(1, Math.floor(input.campaignDurationDays)),
    maxCampaigns:
      input.maxCampaigns == null
        ? null
        : Math.max(1, Math.floor(input.maxCampaigns)),
    maxImpressions:
      input.maxImpressions == null
        ? null
        : Math.max(1, Math.floor(input.maxImpressions)),
    segment: input.segment?.trim() || null,
    companyId: input.companyId?.trim() || null,
    status: input.status ?? "INACTIVE",
    displayOrder: Math.floor(input.displayOrder ?? 0),
    benefits: (input.benefits ?? [])
      .map((b) => b.trim())
      .filter(Boolean)
      .slice(0, 20),
  };

  if (input.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true },
    });
    if (!company) {
      throw new AppError(ErrorCode.NOT_FOUND, "Company not found.", 404);
    }
  }

  if (input.id) {
    const existing = await prisma.matchingSponsorshipPricingPlan.findUnique({
      where: { id: input.id },
    });
    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, "Pricing plan not found.", 404);
    }
    const row = await prisma.matchingSponsorshipPricingPlan.update({
      where: { id: input.id },
      data,
    });
    return toPlanDto(row);
  }

  const row = await prisma.matchingSponsorshipPricingPlan.create({ data });
  return toPlanDto(row);
}

export async function setSponsorshipPricingPlanStatus(input: {
  planId: string;
  status: MatchingSponsorshipPricingPlanStatus;
}): Promise<MatchingSponsorshipPricingPlanDto> {
  const existing = await prisma.matchingSponsorshipPricingPlan.findUnique({
    where: { id: input.planId },
  });
  if (!existing) {
    throw new AppError(ErrorCode.NOT_FOUND, "Pricing plan not found.", 404);
  }
  const row = await prisma.matchingSponsorshipPricingPlan.update({
    where: { id: input.planId },
    data: { status: input.status },
  });
  return toPlanDto(row);
}

export async function reorderSponsorshipPricingPlans(
  orderedIds: string[],
): Promise<MatchingSponsorshipPricingPlanDto[]> {
  const ids = orderedIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    throw new AppError(ErrorCode.VALIDATION, "orderedIds required.", 400);
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.matchingSponsorshipPricingPlan.update({
        where: { id },
        data: { displayOrder: index },
      }),
    ),
  );
  return listSponsorshipPricingPlansForAdmin();
}

/**
 * Company-facing: active plans only, scoped to catalog + optional custom plans.
 * Inactive / other-company custom plans are never returned.
 */
export async function listActiveSponsorshipPricingPlansForCompany(
  companyId: string,
  opts?: { segment?: string | null },
): Promise<MatchingSponsorshipPricingPlanDto[]> {
  if (!(await isMatchingSponsorshipGloballyEnabled())) {
    return [];
  }
  const segment = opts?.segment?.trim() || null;
  const segmentFilter = segment
    ? [{ OR: [{ segment: null }, { segment }] }]
    : [];
  const rows = await prisma.matchingSponsorshipPricingPlan.findMany({
    where: {
      status: "ACTIVE",
      AND: [{ OR: [{ companyId: null }, { companyId }] }, ...segmentFilter],
    },
    orderBy: [{ displayOrder: "asc" }, { priceCents: "asc" }],
    take: 100,
  });
  return rows.map(toPlanDto);
}

export async function createSponsorshipPricingRequest(input: {
  companyId: string;
  planId: string;
  notes?: string | null;
}): Promise<MatchingSponsorshipPricingRequestDto> {
  if (!(await isMatchingSponsorshipGloballyEnabled())) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Sponsored Matching is not available.",
      403,
    );
  }
  const plan = await prisma.matchingSponsorshipPricingPlan.findUnique({
    where: { id: input.planId },
  });
  if (!plan || plan.status !== "ACTIVE") {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "Active pricing plan not found.",
      404,
    );
  }
  if (plan.companyId && plan.companyId !== input.companyId) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "This pricing plan is not available for your company.",
      403,
    );
  }

  const dto = toPlanDto(plan);
  const row = await prisma.matchingSponsorshipPricingRequest.create({
    data: {
      companyId: input.companyId,
      planId: plan.id,
      status: "REQUESTED",
      planSnapshot: snapshotPlan(dto),
      notes: input.notes?.trim() || null,
    },
    include: { plan: true },
  });

  // NoOp billing seam — request/order intent only; no real charge.
  const billing = await getMatchingSponsorshipBillingPort().prepareSponsorshipBilling(
    {
      sponsorshipId: row.id,
      sponsorCompanyId: input.companyId,
      opportunityId: "pricing-request",
      amountCents: plan.priceCents,
      currency: plan.currency,
    },
  );

  const updated = await prisma.matchingSponsorshipPricingRequest.update({
    where: { id: row.id },
    data: {
      billingRef: billing.billingRef,
      billingStatus: billing.billingStatus,
    },
    include: { plan: true },
  });

  return toRequestDto(updated);
}

export async function listSponsorshipPricingRequestsForCompany(
  companyId: string,
  limit = 20,
): Promise<MatchingSponsorshipPricingRequestDto[]> {
  const rows = await prisma.matchingSponsorshipPricingRequest.findMany({
    where: { companyId },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return rows.map(toRequestDto);
}

/** SA: recent pricing requests across companies. */
export async function listSponsorshipPricingRequestsForAdmin(limit = 50) {
  const rows = await prisma.matchingSponsorshipPricingRequest.findMany({
    include: {
      plan: true,
      company: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
  return rows.map((row) => ({
    ...toRequestDto(row),
    companyName: row.company.name,
    companySlug: row.company.slug,
  }));
}
