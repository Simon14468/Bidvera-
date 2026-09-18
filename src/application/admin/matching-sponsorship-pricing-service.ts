/**
 * Super Admin — Sponsored Matching pricing catalog.
 */

import type { SuperAdminContext } from "@/auth/super-admin-session";
import { writeAdminAudit } from "@/services/admin/audit";
import {
  listSponsorshipPricingPlansForAdmin,
  listSponsorshipPricingRequestsForAdmin,
  reorderSponsorshipPricingPlans,
  setSponsorshipPricingPlanStatus,
  upsertSponsorshipPricingPlan,
  type MatchingSponsorshipPricingPlanDto,
} from "@/modules/matching-engine/internal/sponsorship-pricing";
import { z } from "zod";

const billingPeriodSchema = z.enum([
  "ONE_TIME",
  "THREE_DAYS",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
]);

const upsertSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  priceCents: z.number().int().min(0).max(100_000_000),
  currency: z.string().min(3).max(8).optional(),
  billingPeriod: billingPeriodSchema.optional(),
  campaignDurationDays: z.number().int().min(1).max(3650).nullable().optional(),
  maxCampaigns: z.number().int().min(1).max(10_000).nullable().optional(),
  maxImpressions: z.number().int().min(1).max(100_000_000).nullable().optional(),
  segment: z.string().max(64).nullable().optional(),
  companyId: z.string().min(1).nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  displayOrder: z.number().int().min(0).max(10_000).optional(),
  benefits: z.array(z.string().max(200)).max(20).optional(),
});

const statusSchema = z.object({
  planId: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(200),
});

export async function getMatchingSponsorshipPricingAdminSnapshot() {
  const [plans, requests] = await Promise.all([
    listSponsorshipPricingPlansForAdmin(100),
    listSponsorshipPricingRequestsForAdmin(50),
  ]);
  return { plans, requests };
}

export async function saUpsertMatchingSponsorshipPricingPlan(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
): Promise<MatchingSponsorshipPricingPlanDto> {
  const input = upsertSchema.parse(raw);
  const before = input.id
    ? (await listSponsorshipPricingPlansForAdmin(200)).find(
        (p) => p.id === input.id,
      )
    : undefined;
  const row = await upsertSponsorshipPricingPlan(input);
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: before
      ? "MATCHING_SPONSORSHIP_PRICING_PLAN_UPDATED"
      : "MATCHING_SPONSORSHIP_PRICING_PLAN_CREATED",
    targetType: "matching_sponsorship_pricing_plan",
    targetId: row.id,
    previousValue: before
      ? {
          name: before.name,
          priceCents: before.priceCents,
          currency: before.currency,
          status: before.status,
          displayOrder: before.displayOrder,
        }
      : undefined,
    newValue: {
      name: row.name,
      priceCents: row.priceCents,
      currency: row.currency,
      status: row.status,
      displayOrder: row.displayOrder,
      billingPeriod: row.billingPeriod,
    },
    ipHash,
  });
  return row;
}

export async function saSetMatchingSponsorshipPricingPlanStatus(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
): Promise<MatchingSponsorshipPricingPlanDto> {
  const input = statusSchema.parse(raw);
  const before = (await listSponsorshipPricingPlansForAdmin(200)).find(
    (p) => p.id === input.planId,
  );
  const row = await setSponsorshipPricingPlanStatus(input);
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "MATCHING_SPONSORSHIP_PRICING_PLAN_STATUS",
    targetType: "matching_sponsorship_pricing_plan",
    targetId: row.id,
    previousValue: before ? { status: before.status } : undefined,
    newValue: { status: row.status },
    ipHash,
  });
  return row;
}

export async function saReorderMatchingSponsorshipPricingPlans(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
): Promise<MatchingSponsorshipPricingPlanDto[]> {
  const { orderedIds } = reorderSchema.parse(raw);
  const plans = await reorderSponsorshipPricingPlans(orderedIds);
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "MATCHING_SPONSORSHIP_PRICING_PLAN_REORDERED",
    targetType: "matching_sponsorship_pricing_plan",
    targetId: "catalog",
    newValue: { orderedIds },
    ipHash,
  });
  return plans;
}
