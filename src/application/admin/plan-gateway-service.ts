import { z } from "zod";
import type { SuperAdminContext } from "@/auth/super-admin-session";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { writeAdminAudit } from "@/services/admin/audit";
import { applyFreeWorkspaceCheckoutGuard } from "@/services/billing/free-plan-guard";

export const planGatewayUpdateSchema = z.object({
  planId: z.string().min(1),
  visibleToPublic: z.boolean(),
  stripeEnabled: z.boolean(),
  paypalEnabled: z.boolean(),
  isFree: z.boolean().optional(),
  trialDays: z.number().int().min(0).max(365).optional().nullable(),
  stripePriceMonthly: z.string().max(200).optional().nullable(),
  stripePriceAnnual: z.string().max(200).optional().nullable(),
  paypalPlanMonthly: z.string().max(200).optional().nullable(),
  paypalPlanAnnual: z.string().max(200).optional().nullable(),
});

export async function updatePlanGatewaysForAdmin(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = planGatewayUpdateSchema.parse(raw);
  const previous = await prisma.plan.findUnique({ where: { id: data.planId } });
  if (!previous) throw new AppError(ErrorCode.NOT_FOUND, "Plan not found.", 404);

  const guarded = applyFreeWorkspaceCheckoutGuard({
    slug: previous.slug,
    isFree: data.isFree ?? previous.isFree,
    stripeEnabled: data.stripeEnabled,
    paypalEnabled: data.paypalEnabled,
  });

  const plan = await prisma.plan.update({
    where: { id: data.planId },
    data: {
      visibleToPublic: data.visibleToPublic,
      stripeEnabled: guarded.stripeEnabled,
      paypalEnabled: guarded.paypalEnabled,
      isFree: guarded.isFree,
      trialDays: data.trialDays === undefined ? previous.trialDays : data.trialDays,
      stripePriceMonthly: data.stripePriceMonthly ?? null,
      stripePriceAnnual: data.stripePriceAnnual ?? null,
      paypalPlanMonthly: data.paypalPlanMonthly ?? null,
      paypalPlanAnnual: data.paypalPlanAnnual ?? null,
    },
  });

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "PLAN_GATEWAYS_UPDATED",
    targetType: "plan",
    targetId: plan.id,
    previousValue: {
      visibleToPublic: previous.visibleToPublic,
      stripeEnabled: previous.stripeEnabled,
      paypalEnabled: previous.paypalEnabled,
    },
    newValue: {
      visibleToPublic: plan.visibleToPublic,
      stripeEnabled: plan.stripeEnabled,
      paypalEnabled: plan.paypalEnabled,
    },
    ipHash,
  });

  return plan;
}
