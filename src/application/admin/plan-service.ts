import { planStatusSchema, planTranslationsUpdateSchema, planUpsertSchema } from "@/domain/schemas/admin";
import { ADMIN_ENTITLEMENT_KEYS } from "@/domain/billing/entitlement-catalog";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { writeAdminAudit } from "@/services/admin/audit";
import type { SuperAdminContext } from "@/auth/super-admin-session";
import { Prisma } from "@prisma/client";
import { revalidatePublicPlanSurfaces } from "@/application/admin/revalidate-plans";
import {
  mergePlanTranslations,
  parsePlanTranslations,
} from "@/services/billing/plan-i18n";
import {
  setPlanFeature,
  syncSubscribersToPlanLimits,
} from "@/services/entitlements";
import { applyFreeWorkspaceCheckoutGuard } from "@/services/billing/free-plan-guard";
import { shouldRejectDuplicateFreeWorkspacePlan } from "@/services/billing/free-workspace-identity";
import {
  blankToNull,
  enforceNonCheckoutGatewayFlags,
  normalizePlanGatewayWrite,
} from "@/services/billing/plan-gateway-ids";

export async function listPlansForAdmin() {
  return prisma.plan.findMany({
    include: {
      planFeatures: { include: { feature: true } },
      _count: { select: { subscriptions: true, overrides: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

async function syncPlanFeatureKeys(planId: string, featureKeys: string[]) {
  const enabled = new Set(featureKeys);
  // Sync sellable catalog keys only (tender_analysis is internal/admin-only).
  for (const key of ADMIN_ENTITLEMENT_KEYS) {
    await setPlanFeature(planId, key, enabled.has(key));
  }
  // Ensure internal module stays off plan entitlements even if legacy rows exist.
  await setPlanFeature(planId, "tender_analysis", false);
  // Legacy alerts mirrors smart_alerts
  if (enabled.has("smart_alerts")) {
    await setPlanFeature(planId, "alerts", true);
  } else {
    await setPlanFeature(planId, "alerts", false);
  }
}

export async function upsertPlanForAdmin(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = applyFreeWorkspaceCheckoutGuard(planUpsertSchema.parse(raw));
  const previous = data.id
    ? await prisma.plan.findUnique({ where: { id: data.id } })
    : await prisma.plan.findUnique({ where: { slug: data.slug } });

  // Creating a plan must not silently overwrite an existing slug.
  if (!data.id && previous) {
    throw new AppError(
      ErrorCode.CONFLICT,
      `Slug "${data.slug}" is already used. Pick a unique slug for the new plan.`,
      409,
      { slug: data.slug, existingPlanId: previous.id },
    );
  }

  // Renaming slug on update must not collide with another plan.
  if (data.id && previous && previous.slug !== data.slug) {
    const clash = await prisma.plan.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (clash && clash.id !== data.id) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Slug "${data.slug}" is already used by another plan.`,
        409,
        { slug: data.slug, existingPlanId: clash.id },
      );
    }
  }

  await assertUniqueDesignatedFreeWorkspace(
    { slug: data.slug, isFree: data.isFree ?? false, id: data.id },
    previous,
  );

  const guarded = enforceNonCheckoutGatewayFlags(applyFreeWorkspaceCheckoutGuard(data));
  const gatewayWrite = normalizePlanGatewayWrite({
    name: guarded.name,
    slug: guarded.slug,
    isFree: Boolean(guarded.isFree),
    monthlyEnabled: guarded.monthlyEnabled,
    annualEnabled: guarded.annualEnabled,
    stripeEnabled: guarded.stripeEnabled ?? previous?.stripeEnabled ?? true,
    paypalEnabled: guarded.paypalEnabled ?? previous?.paypalEnabled ?? true,
    stripePriceMonthly:
      guarded.stripePriceMonthly !== undefined
        ? blankToNull(guarded.stripePriceMonthly)
        : blankToNull(previous?.stripePriceMonthly),
    stripePriceAnnual:
      guarded.stripePriceAnnual !== undefined
        ? blankToNull(guarded.stripePriceAnnual)
        : blankToNull(previous?.stripePriceAnnual),
    paypalPlanMonthly:
      guarded.paypalPlanMonthly !== undefined
        ? blankToNull(guarded.paypalPlanMonthly)
        : blankToNull(previous?.paypalPlanMonthly),
    paypalPlanAnnual:
      guarded.paypalPlanAnnual !== undefined
        ? blankToNull(guarded.paypalPlanAnnual)
        : blankToNull(previous?.paypalPlanAnnual),
  });
  if (gatewayWrite.errors.length > 0) {
    throw new AppError(ErrorCode.VALIDATION, gatewayWrite.errors.join(" "), 400);
  }

  let plan;
  try {
    plan = await prisma.plan.upsert({
      where: data.id ? { id: data.id } : { slug: data.slug },
      create: {
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
        monthlyPriceCents: data.monthlyPriceCents,
        annualPriceCents: data.annualPriceCents ?? null,
        annualMonths: data.annualMonths,
        monthlyEnabled: data.monthlyEnabled,
        annualEnabled: data.annualEnabled,
        analysesLimit: data.analysesLimit,
        analysesLimitYearly: data.analysesLimitYearly ?? null,
        aiTokensLimit: data.aiTokensLimit ?? null,
        storageMbLimit: data.storageMbLimit ?? null,
        seatsLimit: data.seatsLimit,
        seatsLimitYearly: data.seatsLimitYearly ?? null,
        trialEligible: data.trialEligible,
        trialDays: data.trialDays ?? null,
        graceDays: data.graceDays ?? null,
        isFree: guarded.isFree ?? false,
        visibleToPublic: data.visibleToPublic ?? true,
        stripeEnabled: gatewayWrite.stripeEnabled,
        paypalEnabled: gatewayWrite.paypalEnabled,
        stripePriceMonthly: gatewayWrite.stripePriceMonthly,
        stripePriceAnnual: gatewayWrite.stripePriceAnnual,
        paypalPlanMonthly: gatewayWrite.paypalPlanMonthly,
        paypalPlanAnnual: gatewayWrite.paypalPlanAnnual,
        currency: data.currency ?? "usd",
        status: data.status,
        highlighted: data.highlighted,
        sortOrder: data.sortOrder,
        featureList: data.featureList,
        preferEntitlementLabels: data.preferEntitlementLabels ?? true,
        legacyEnum: data.legacyEnum ?? null,
        ...(data.translations !== undefined
          ? {
              translations:
                data.translations === null
                  ? Prisma.DbNull
                  : (data.translations as Prisma.InputJsonValue),
            }
          : {}),
      },
      update: {
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
        monthlyPriceCents: data.monthlyPriceCents,
        annualPriceCents: data.annualPriceCents ?? null,
        annualMonths: data.annualMonths,
        monthlyEnabled: data.monthlyEnabled,
        annualEnabled: data.annualEnabled,
        analysesLimit: data.analysesLimit,
        analysesLimitYearly:
          data.analysesLimitYearly === undefined
            ? undefined
            : data.analysesLimitYearly,
        aiTokensLimit: data.aiTokensLimit ?? null,
        storageMbLimit: data.storageMbLimit ?? null,
        seatsLimit: data.seatsLimit,
        seatsLimitYearly:
          data.seatsLimitYearly === undefined ? undefined : data.seatsLimitYearly,
        trialEligible: data.trialEligible,
        trialDays: data.trialDays === undefined ? undefined : data.trialDays,
        graceDays: data.graceDays === undefined ? undefined : data.graceDays,
        ...(guarded.isFree !== undefined ? { isFree: guarded.isFree } : {}),
        ...(data.visibleToPublic !== undefined
          ? { visibleToPublic: data.visibleToPublic }
          : {}),
        stripeEnabled: gatewayWrite.stripeEnabled,
        paypalEnabled: gatewayWrite.paypalEnabled,
        stripePriceMonthly: gatewayWrite.stripePriceMonthly,
        stripePriceAnnual: gatewayWrite.stripePriceAnnual,
        paypalPlanMonthly: gatewayWrite.paypalPlanMonthly,
        paypalPlanAnnual: gatewayWrite.paypalPlanAnnual,
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        status: data.status,
        highlighted: data.highlighted,
        sortOrder: data.sortOrder,
        featureList: data.featureList,
        preferEntitlementLabels: data.preferEntitlementLabels ?? true,
        legacyEnum: data.legacyEnum ?? null,
        ...(data.translations !== undefined
          ? {
              translations:
                data.translations === null
                  ? Prisma.DbNull
                  : (data.translations as Prisma.InputJsonValue),
            }
          : {}),
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Slug "${data.slug}" is already used. Pick a unique slug.`,
        409,
        { slug: data.slug },
      );
    }
    throw err;
  }

  // featureKeys always applied when provided (including empty = strip entitlements)
  if (Array.isArray(data.featureKeys)) {
    await syncPlanFeatureKeys(plan.id, data.featureKeys);
  }

  const sync = await syncSubscribersToPlanLimits(plan.id);

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: previous ? "PLAN_UPDATED" : "PLAN_CREATED",
    targetType: "plan",
    targetId: plan.id,
    previousValue: previous
      ? {
          slug: previous.slug,
          monthlyPriceCents: previous.monthlyPriceCents,
          annualPriceCents: previous.annualPriceCents,
          analysesLimit: previous.analysesLimit,
          seatsLimit: previous.seatsLimit,
          status: previous.status,
        }
      : undefined,
    newValue: {
      slug: plan.slug,
      monthlyPriceCents: plan.monthlyPriceCents,
      annualPriceCents: plan.annualPriceCents,
      annualMonths: plan.annualMonths,
      analysesLimit: plan.analysesLimit,
      analysesLimitYearly: plan.analysesLimitYearly,
      seatsLimit: plan.seatsLimit,
      seatsLimitYearly: plan.seatsLimitYearly,
      featureKeys: data.featureKeys,
      subscribersSynced: sync.updated,
      status: plan.status,
    },
    ipHash,
  });

  revalidatePublicPlanSurfaces();
  return plan;
}

export async function updatePlanTranslationsForAdmin(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = planTranslationsUpdateSchema.parse(raw);
  const previous = await prisma.plan.findUnique({ where: { id: data.planId } });
  if (!previous) throw new AppError(ErrorCode.NOT_FOUND, "Plan not found.", 404);

  const translations =
    data.translations === null
      ? Prisma.DbNull
      : (mergePlanTranslations(
          previous.translations,
          parsePlanTranslations(data.translations),
        ) as Prisma.InputJsonValue);

  const plan = await prisma.plan.update({
    where: { id: data.planId },
    data: { translations },
  });

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "PLAN_TRANSLATIONS_UPDATED",
    targetType: "plan",
    targetId: plan.id,
    previousValue: { translations: previous.translations },
    newValue: { translations: plan.translations },
    ipHash,
  });

  revalidatePublicPlanSurfaces();
  return plan;
}

export async function setPlanStatusForAdmin(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = planStatusSchema.parse(raw);
  const previous = await prisma.plan.findUnique({ where: { id: data.planId } });
  if (!previous) throw new AppError(ErrorCode.NOT_FOUND, "Plan not found.", 404);

  const plan = await prisma.plan.update({
    where: { id: data.planId },
    data: { status: data.status },
  });

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "PLAN_STATUS_CHANGED",
    targetType: "plan",
    targetId: plan.id,
    previousValue: { status: previous.status },
    newValue: { status: plan.status },
    ipHash,
  });

  revalidatePublicPlanSurfaces();
  return plan;
}

async function assertUniqueDesignatedFreeWorkspace(
  incoming: { id?: string; slug: string; isFree: boolean },
  previous: { id: string; slug: string; isFree: boolean } | null,
) {
  const existingCandidates = await prisma.plan.findMany({
    where: { OR: [{ slug: "free" }, { isFree: true }] },
    select: { id: true, slug: true, name: true, isFree: true },
  });
  if (
    !shouldRejectDuplicateFreeWorkspacePlan({
      incoming,
      previous,
      existingCandidates,
    })
  ) {
    return;
  }
  throw new AppError(
    ErrorCode.CONFLICT,
    "Only one Free Workspace system plan can exist. Edit the existing Free Workspace plan instead of creating another.",
    409,
    { duplicates: existingCandidates.filter((plan) => plan.id !== previous?.id) },
  );
}

export async function listSubscriptionsForAdmin() {
  return prisma.subscription.findMany({
    include: {
      company: { select: { id: true, name: true, slug: true, status: true } },
      billingPlan: true,
      events: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });
}

export async function archivePlan(
  ctx: SuperAdminContext,
  planId: string,
  ipHash?: string | null,
) {
  return setPlanStatusForAdmin(ctx, { planId, status: "ARCHIVED" }, ipHash);
}
