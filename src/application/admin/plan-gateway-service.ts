import { z } from "zod";
import type { SuperAdminContext } from "@/auth/super-admin-session";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { writeAdminAudit } from "@/services/admin/audit";
import { isOfficialFreeWorkspacePaymentsPlan } from "@/application/admin/payments-plan-visibility";
import { applyFreeWorkspaceCheckoutGuard } from "@/services/billing/free-plan-guard";
import { revalidatePublicPlanSurfaces } from "@/application/admin/revalidate-plans";
import {
  enforceNonCheckoutGatewayFlags,
  normalizePlanGatewayWrite,
  planExemptFromGatewayMappings,
} from "@/services/billing/plan-gateway-ids";
import { lookupPaypalBillingPlan } from "@/services/billing/paypal";

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

async function assertPaypalMappingsMatchCurrentEnvironment(input: {
  planName: string;
  paypalEnabled: boolean;
  monthlyEnabled: boolean;
  annualEnabled: boolean;
  paypalPlanMonthly: string | null;
  paypalPlanAnnual: string | null;
}) {
  if (!input.paypalEnabled) return;
  const checks: Array<{ label: "Monthly" | "Annual"; id: string | null; required: boolean }> = [
    {
      label: "Monthly",
      id: input.paypalPlanMonthly,
      required: input.monthlyEnabled,
    },
    {
      label: "Annual",
      id: input.paypalPlanAnnual,
      required: input.annualEnabled,
    },
  ];
  for (const check of checks) {
    if (!check.required || !check.id) continue;
    try {
      await lookupPaypalBillingPlan(check.id);
    } catch (error) {
      if (error instanceof AppError) {
        throw new AppError(
          error.code,
          `${check.label} PayPal Plan ID for ${input.planName} could not be verified against the current PayPal environment. ${error.message}`,
          error.status,
        );
      }
      throw error;
    }
  }
}

export async function updatePlanGatewaysForAdmin(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = planGatewayUpdateSchema.parse(raw);
  const previous = await prisma.plan.findUnique({ where: { id: data.planId } });
  if (!previous) throw new AppError(ErrorCode.NOT_FOUND, "Plan not found.", 404);

  if (isOfficialFreeWorkspacePaymentsPlan(previous)) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Configure Free Workspace from Free Workspace settings.",
      400,
    );
  }

  const guarded = enforceNonCheckoutGatewayFlags(
    applyFreeWorkspaceCheckoutGuard({
      slug: previous.slug,
      isFree: data.isFree ?? previous.isFree,
      stripeEnabled: data.stripeEnabled,
      paypalEnabled: data.paypalEnabled,
    }),
  );
  const exempt = planExemptFromGatewayMappings({
    slug: previous.slug,
    isFree: Boolean(guarded.isFree),
  });
  const mapped = normalizePlanGatewayWrite({
    name: previous.name,
    slug: previous.slug,
    isFree: Boolean(guarded.isFree),
    monthlyEnabled: previous.monthlyEnabled,
    annualEnabled: previous.annualEnabled,
    stripeEnabled: Boolean(guarded.stripeEnabled),
    paypalEnabled: Boolean(guarded.paypalEnabled),
    stripePriceMonthly: data.stripePriceMonthly ?? null,
    stripePriceAnnual: data.stripePriceAnnual ?? null,
    paypalPlanMonthly: data.paypalPlanMonthly ?? null,
    paypalPlanAnnual: data.paypalPlanAnnual ?? null,
  });
  if (mapped.errors.length > 0) {
    throw new AppError(ErrorCode.VALIDATION, mapped.errors.join(" "), 400);
  }

  if (!exempt) {
    await assertPaypalMappingsMatchCurrentEnvironment({
      planName: previous.name,
      paypalEnabled: mapped.paypalEnabled,
      monthlyEnabled: previous.monthlyEnabled,
      annualEnabled: previous.annualEnabled,
      paypalPlanMonthly: mapped.paypalPlanMonthly,
      paypalPlanAnnual: mapped.paypalPlanAnnual,
    });
  }

  const plan = await prisma.plan.update({
    where: { id: data.planId },
    data: exempt
      ? {
          visibleToPublic: data.visibleToPublic,
          stripeEnabled: false,
          paypalEnabled: false,
          isFree: guarded.isFree,
          trialDays: data.trialDays === undefined ? previous.trialDays : data.trialDays,
        }
      : {
          visibleToPublic: data.visibleToPublic,
          stripeEnabled: mapped.stripeEnabled,
          paypalEnabled: mapped.paypalEnabled,
          isFree: guarded.isFree,
          trialDays: data.trialDays === undefined ? previous.trialDays : data.trialDays,
          stripePriceMonthly: mapped.stripePriceMonthly,
          stripePriceAnnual: mapped.stripePriceAnnual,
          paypalPlanMonthly: mapped.paypalPlanMonthly,
          paypalPlanAnnual: mapped.paypalPlanAnnual,
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
      stripePriceMonthly: previous.stripePriceMonthly,
      stripePriceAnnual: previous.stripePriceAnnual,
      paypalPlanMonthly: previous.paypalPlanMonthly,
      paypalPlanAnnual: previous.paypalPlanAnnual,
    },
    newValue: {
      visibleToPublic: plan.visibleToPublic,
      stripeEnabled: plan.stripeEnabled,
      paypalEnabled: plan.paypalEnabled,
      stripePriceMonthly: plan.stripePriceMonthly,
      stripePriceAnnual: plan.stripePriceAnnual,
      paypalPlanMonthly: plan.paypalPlanMonthly,
      paypalPlanAnnual: plan.paypalPlanAnnual,
    },
    ipHash,
  });

  revalidatePublicPlanSurfaces();
  return plan;
}
