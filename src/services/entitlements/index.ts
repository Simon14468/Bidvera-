/**
 * Centralized entitlements — backend authorization for plans.
 * Marketing featureList is never used for authorization.
 */

import {
  ADMIN_ENTITLEMENT_KEYS,
  ENTITLEMENT_CATALOG,
  ENTITLEMENT_FEATURE_KEYS,
  PLAN_ENTITLEMENT_DEFAULTS,
  UNSHIPPED_ENTITLEMENT_KEYS,
  buildEntitlementMarketingLabels,
  canonicalFeatureKey,
  entitlementDef,
  filterCommerciallyHonestLabels,
  isCommerciallyAvailableFeature,
  isFeatureEnabledInMap,
  isIsolatedInternalFeatureKey,
  isPublicCatalogFeature,
  planDefaultFeatureKeys,
  planHasAllCommercialModules,
  planQualifiesForPremiumPricingHover,
  upgradeMessageForFeature,
  type EntitlementFeatureKey,
} from "@/domain/billing/entitlement-catalog";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import type { BillingInterval, Plan } from "@prisma/client";
import { cache } from "react";

export const FEATURE_KEYS = ENTITLEMENT_FEATURE_KEYS;
export type FeatureKey = EntitlementFeatureKey;

export {
  ADMIN_ENTITLEMENT_KEYS,
  ENTITLEMENT_CATALOG,
  PLAN_ENTITLEMENT_DEFAULTS,
  UNSHIPPED_ENTITLEMENT_KEYS,
  buildEntitlementMarketingLabels,
  entitlementDef,
  filterCommerciallyHonestLabels,
  isCommerciallyAvailableFeature,
  isFeatureEnabledInMap,
  isIsolatedInternalFeatureKey,
  isPublicCatalogFeature,
  planDefaultFeatureKeys,
  planHasAllCommercialModules,
  planQualifiesForPremiumPricingHover,
  upgradeMessageForFeature,
};

export type EffectiveEntitlements = {
  companyId: string;
  planId: string | null;
  planSlug: string;
  planName: string;
  billingInterval: BillingInterval;
  analysesLimit: number;
  seatsLimit: number;
  aiTokensLimit: number | null;
  storageMbLimit: number | null;
  monthlyPriceCents: number;
  annualPriceCents: number | null;
  currency: string;
  features: Record<string, boolean>;
  source: "override" | "billing_plan" | "legacy_enum" | "default";
};

function resolveIntervalLimit(
  monthly: number,
  yearly: number | null | undefined,
  interval: BillingInterval,
): number {
  if (interval === "YEAR" && yearly != null) return yearly;
  return monthly;
}

export function analysesLimitForPlan(
  plan: Pick<Plan, "analysesLimit" | "analysesLimitYearly">,
  interval: BillingInterval | null | undefined,
): number {
  return resolveIntervalLimit(
    plan.analysesLimit,
    plan.analysesLimitYearly,
    interval ?? "MONTH",
  );
}

export function seatsLimitForPlan(
  plan: Pick<Plan, "seatsLimit" | "seatsLimitYearly">,
  interval: BillingInterval | null | undefined,
): number {
  return resolveIntervalLimit(
    plan.seatsLimit,
    plan.seatsLimitYearly,
    interval ?? "MONTH",
  );
}

/** One in-flight / completed seed per process — layout fires many parallel hasFeature calls. */
let featureRowsReady: Promise<void> | null = null;

/**
 * Matching ships ON for company accounts (catalog defaultEnabledGlobal).
 * Super Admin kill switch sticks via SystemSetting — tests/jobs that flip
 * enabledGlobal without setFeatureGlobal are overwritten back ON on next boot.
 */
const MATCHING_ENGINE_SA_KILL_SWITCH_KEY = "matching.engine.sa_kill_switch";

async function ensureMatchingEngineCommercialShip() {
  const def = entitlementDef("matching_engine");
  if (!def || def.defaultEnabledGlobal === false) return;
  if (!isCommerciallyAvailableFeature("matching_engine")) return;

  const feature = await prisma.feature.findUnique({
    where: { key: "matching_engine" },
    select: { id: true },
  });
  if (!feature) return;

  const saKilled = await prisma.systemSetting.findUnique({
    where: { key: MATCHING_ENGINE_SA_KILL_SWITCH_KEY },
    select: { key: true },
  });
  if (!saKilled) {
    await prisma.feature.updateMany({
      where: { key: "matching_engine", enabledGlobal: false },
      data: { enabledGlobal: true },
    });
  }

  // Create-if-missing on every plan so custom / Free Workspace plans get Matching
  // without overwriting an explicit Super Admin Plan Editor disable.
  const plans = await prisma.plan.findMany({ select: { id: true } });
  for (const plan of plans) {
    await prisma.planFeature.upsert({
      where: {
        planId_featureId: { planId: plan.id, featureId: feature.id },
      },
      create: {
        planId: plan.id,
        featureId: feature.id,
        enabled: true,
      },
      update: {},
    });
  }
}

async function ensureFeatureRows() {
  if (!featureRowsReady) {
    featureRowsReady = (async () => {
      // Single interactive batch on one connection — avoids N parallel upserts
      // exhausting the Neon pool when many entitlement checks run together.
      await prisma.$transaction(
        ENTITLEMENT_CATALOG.map((def) =>
          prisma.feature.upsert({
            where: { key: def.key },
            create: {
              key: def.key,
              name: def.name,
              description: def.description,
              enabledGlobal: def.defaultEnabledGlobal !== false,
            },
            update: {
              name: def.name,
              description: def.description,
            },
          }),
        ),
      );
      await ensureMatchingEngineCommercialShip();
    })().catch((error) => {
      // Allow a later request to retry after a transient pool/capacity failure.
      featureRowsReady = null;
      throw error;
    });
  }
  await featureRowsReady;
}

/**
 * Resolve live entitlements for a company from DB plan + interval.
 * Never trusts client-supplied limits or prices.
 * Request-scoped via React.cache — layout + page share one load per companyId.
 */
async function loadEffectiveEntitlements(
  companyId: string,
): Promise<EffectiveEntitlements> {
  await ensureFeatureRows();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      planOverride: {
        include: {
          plan: { include: { planFeatures: { include: { feature: true } } } },
        },
      },
      subscription: {
        include: {
          billingPlan: {
            include: { planFeatures: { include: { feature: true } } },
          },
        },
      },
      usage: true,
    },
  });

  const emptyFeatures = Object.fromEntries(
    ENTITLEMENT_FEATURE_KEYS.map((k) => [k, false]),
  ) as Record<string, boolean>;

  if (!company) {
    return {
      companyId,
      planId: null,
      planSlug: "trial",
      planName: "Trial",
      billingInterval: "MONTH",
      analysesLimit: 3,
      seatsLimit: 1,
      aiTokensLimit: null,
      storageMbLimit: null,
      monthlyPriceCents: 0,
      annualPriceCents: null,
      currency: "usd",
      features: {
        ...emptyFeatures,
        advanced_decision_engine: true,
        company_profile: true,
      },
      source: "default",
    };
  }

  const interval =
    company.subscription?.billingInterval === "YEAR" ? "YEAR" : "MONTH";

  const override = company.planOverride;
  if (override?.active && (!override.expiresAt || override.expiresAt > new Date())) {
    const base = override.plan;
    const features = { ...emptyFeatures };
    if (override.features.length > 0) {
      for (const key of override.features) {
        if (!isCommerciallyAvailableFeature(key)) continue;
        features[canonicalFeatureKey(key)] = true;
        features[key] = true;
      }
    } else if (base?.planFeatures?.length) {
      // PlanFeature rows are authoritative — no slug-default backfill.
      for (const pf of base.planFeatures) {
        if (pf.enabled && isCommerciallyAvailableFeature(pf.feature.key)) {
          features[canonicalFeatureKey(pf.feature.key)] = true;
          features[pf.feature.key] = true;
        }
      }
    } else {
      features.advanced_decision_engine = true;
      features.company_profile = true;
      features.matching_engine = true;
    }

    return {
      companyId,
      planId: base?.id ?? null,
      planSlug: base?.slug ?? "custom",
      planName: override.customName ?? base?.name ?? "Custom",
      billingInterval: interval,
      analysesLimit:
        override.analysesLimit ??
        (base
          ? analysesLimitForPlan(base, interval)
          : (company.usage?.analysesLimit ?? 3)),
      seatsLimit:
        override.seatsLimit ??
        (base ? seatsLimitForPlan(base, interval) : 1),
      aiTokensLimit: override.aiTokensLimit ?? base?.aiTokensLimit ?? null,
      storageMbLimit: override.storageMbLimit ?? base?.storageMbLimit ?? null,
      monthlyPriceCents: override.monthlyPriceCents ?? base?.monthlyPriceCents ?? 0,
      annualPriceCents: base?.annualPriceCents ?? null,
      currency: base?.currency ?? "usd",
      features,
      source: "override",
    };
  }

  const plan = company.subscription?.billingPlan;
  if (plan) {
    const features = { ...emptyFeatures };
    const mapped = plan.planFeatures ?? [];
    if (mapped.length > 0) {
      // PlanFeature rows are authoritative (Plan Editor / seed). Do not re-enable
      // unchecked keys from slug defaults — that leaked modules into the user nav.
      for (const pf of mapped) {
        if (pf.enabled && isCommerciallyAvailableFeature(pf.feature.key)) {
          features[canonicalFeatureKey(pf.feature.key)] = true;
          features[pf.feature.key] = true;
        }
      }
    } else {
      // Unmapped plan: core gates until Admin configures entitlements
      features.advanced_decision_engine = true;
      features.company_profile = true;
      features.matching_engine = true;
    }

    return {
      companyId,
      planId: plan.id,
      planSlug: plan.slug,
      planName: plan.name,
      billingInterval: interval,
      analysesLimit: analysesLimitForPlan(plan, interval),
      seatsLimit: seatsLimitForPlan(plan, interval),
      aiTokensLimit: plan.aiTokensLimit,
      storageMbLimit: plan.storageMbLimit,
      monthlyPriceCents: plan.monthlyPriceCents,
      annualPriceCents: plan.annualPriceCents,
      currency: plan.currency,
      features,
      source: "billing_plan",
    };
  }

  return {
    companyId,
    planId: null,
    planSlug: "trial",
    planName: "Trial",
    billingInterval: "MONTH",
    analysesLimit: company.usage?.analysesLimit ?? 3,
    seatsLimit: 1,
    aiTokensLimit: null,
    storageMbLimit: null,
    monthlyPriceCents: 0,
    annualPriceCents: null,
    currency: "usd",
    features: {
      ...emptyFeatures,
      advanced_decision_engine: true,
      company_profile: true,
      matching_engine: true,
    },
    source: "legacy_enum",
  };
}

/** Dedupes entitlement loads within a single RSC/request (layout + page + KPI gates). */
export const getEffectiveEntitlements = cache(loadEffectiveEntitlements);

type FeatureGateContext = {
  featureByKey: Map<string, { id: string; enabledGlobal: boolean }>;
  overrideByFeatureId: Map<string, boolean>;
  accessAllowed: boolean;
  entitlements: EffectiveEntitlements;
};

/**
 * One DB round-trip batch per companyId per request for repeated hasFeature calls
 * (app layout alone issues ~11 feature gates).
 */
const getFeatureGateContext = cache(async (companyId: string): Promise<FeatureGateContext> => {
  await ensureFeatureRows();
  const [features, overrides, sub, entitlements] = await Promise.all([
    prisma.feature.findMany({
      select: { id: true, key: true, enabledGlobal: true },
    }),
    prisma.companyFeatureOverride.findMany({
      where: { companyId },
      select: { featureId: true, enabled: true },
    }),
    prisma.subscription.findUnique({ where: { companyId } }),
    getEffectiveEntitlements(companyId),
  ]);

  const { evaluateSubscriptionAccess } = await import(
    "@/services/billing/lifecycle"
  );
  const access = evaluateSubscriptionAccess(sub);

  return {
    featureByKey: new Map(
      features.map((f) => [f.key, { id: f.id, enabledGlobal: f.enabledGlobal }]),
    ),
    overrideByFeatureId: new Map(
      overrides.map((o) => [o.featureId, o.enabled]),
    ),
    accessAllowed: access.allowed,
    entitlements,
  };
});

/**
 * Deny-by-default feature check. Uses structured PlanFeature / overrides only.
 * Subscription lifecycle must allow access — plan selection alone is not enough.
 */
export async function hasFeature(
  companyId: string,
  featureKey: string,
): Promise<boolean> {
  const key = canonicalFeatureKey(featureKey);
  const ctx = await getFeatureGateContext(companyId);

  const feature = ctx.featureByKey.get(key);
  const legacy =
    key === "smart_alerts" ? ctx.featureByKey.get("alerts") : undefined;
  const target = feature ?? legacy;
  if (!target) return false;

  const overrideIds = [target.id, legacy?.id].filter(Boolean) as string[];
  let override: boolean | undefined;
  if (!isIsolatedInternalFeatureKey(key)) {
    for (const id of overrideIds) {
      if (ctx.overrideByFeatureId.has(id)) {
        override = Boolean(ctx.overrideByFeatureId.get(id));
        break;
      }
    }
  }

  const entitled =
    Boolean(ctx.entitlements.features[key]) ||
    (featureKey === "alerts" && Boolean(ctx.entitlements.features.smart_alerts)) ||
    (key === "smart_alerts" && Boolean(ctx.entitlements.features.alerts));

  return resolveCommercialFeatureAccess({
    isolated: isIsolatedInternalFeatureKey(key),
    override,
    enabledGlobal: target.enabledGlobal,
    accessAllowed: ctx.accessAllowed,
    entitled,
  });
}

/**
 * Commercial feature access cannot survive a denied subscription via override.
 * Isolated internal keys never use company override.
 */
export function resolveCommercialFeatureAccess(input: {
  isolated: boolean;
  override?: boolean;
  enabledGlobal: boolean;
  accessAllowed: boolean;
  entitled: boolean;
}): boolean {
  if (input.isolated) {
    if (!input.enabledGlobal || !input.accessAllowed) return false;
    return input.entitled;
  }
  if (input.override === false) return false;
  if (!input.accessAllowed) return false;
  if (!input.enabledGlobal) return false;
  if (input.override === true) return true;
  return input.entitled;
}

export async function assertFeature(
  companyId: string,
  featureKey: string,
  message?: string,
) {
  const ok = await hasFeature(companyId, featureKey);
  if (!ok) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      message ?? upgradeMessageForFeature(featureKey),
      403,
    );
  }
}

export async function countCompanySeats(companyId: string): Promise<number> {
  return prisma.user.count({ where: { companyId } });
}

export async function assertCanAddSeat(companyId: string) {
  const { evaluateSubscriptionAccess } = await import(
    "@/services/billing/lifecycle"
  );
  const sub = await prisma.subscription.findUnique({ where: { companyId } });
  const access = evaluateSubscriptionAccess(sub);
  if (!access.allowed) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Your subscription does not allow adding seats. Update billing or upgrade.",
      403,
    );
  }

  const entitlements = await getEffectiveEntitlements(companyId);
  const used = await countCompanySeats(companyId);
  if (used >= entitlements.seatsLimit) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      `Seat limit reached (${entitlements.seatsLimit}). Upgrade your plan to add teammates.`,
      403,
    );
  }
}

export async function listFeatures() {
  await ensureFeatureRows();
  return prisma.feature.findMany({ orderBy: { key: "asc" } });
}

export async function setFeatureGlobal(featureKey: string, enabled: boolean) {
  const key = canonicalFeatureKey(featureKey);
  // Record SA Matching kill switch before ensureFeatureRows so commercial ship
  // does not immediately flip enabledGlobal back ON.
  if (key === "matching_engine") {
    if (enabled) {
      await prisma.systemSetting.deleteMany({
        where: { key: MATCHING_ENGINE_SA_KILL_SWITCH_KEY },
      });
    } else {
      await prisma.systemSetting.upsert({
        where: { key: MATCHING_ENGINE_SA_KILL_SWITCH_KEY },
        create: {
          key: MATCHING_ENGINE_SA_KILL_SWITCH_KEY,
          value: { disabledAt: new Date().toISOString() },
          description:
            "Super Admin explicitly disabled Matching Engine (kill switch)",
        },
        update: {
          value: { disabledAt: new Date().toISOString() },
        },
      });
    }
  }

  await ensureFeatureRows();
  return prisma.feature.update({
    where: { key: featureKey },
    data: { enabledGlobal: enabled },
  });
}

export async function setPlanFeature(
  planId: string,
  featureKey: string,
  enabled: boolean,
) {
  await ensureFeatureRows();
  const persistEnabled = isIsolatedInternalFeatureKey(featureKey) ? false : enabled;
  const feature = await prisma.feature.findUniqueOrThrow({
    where: { key: featureKey },
  });
  return prisma.planFeature.upsert({
    where: { planId_featureId: { planId, featureId: feature.id } },
    create: { planId, featureId: feature.id, enabled: persistEnabled },
    update: { enabled: persistEnabled },
  });
}

export async function setCompanyFeature(
  companyId: string,
  featureKey: string,
  enabled: boolean,
) {
  await ensureFeatureRows();
  const persistEnabled = isIsolatedInternalFeatureKey(featureKey) ? false : enabled;
  const feature = await prisma.feature.findUniqueOrThrow({
    where: { key: featureKey },
  });
  return prisma.companyFeatureOverride.upsert({
    where: { companyId_featureId: { companyId, featureId: feature.id } },
    create: { companyId, featureId: feature.id, enabled: persistEnabled },
    update: { enabled: persistEnabled },
  });
}

/** Sync CompanyUsage.analysesLimit for every subscriber of a plan. */
export async function syncSubscribersToPlanLimits(planId: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) return { updated: 0 };

  const subs = await prisma.subscription.findMany({
    where: { planId },
    select: { companyId: true, billingInterval: true },
  });

  let updated = 0;
  for (const sub of subs) {
    const limit = analysesLimitForPlan(plan, sub.billingInterval);
    await prisma.companyUsage.upsert({
      where: { companyId: sub.companyId },
      create: {
        companyId: sub.companyId,
        analysesUsed: 0,
        analysesLimit: limit,
      },
      update: { analysesLimit: limit },
    });
    updated += 1;
  }
  return { updated };
}

export function marketingLabelsForPlan(input: {
  analysesLimit: number;
  seatsLimit: number;
  enabledKeys: string[];
  featureList: string[];
  preferEntitlementLabels: boolean;
  interval?: "month" | "year";
}): string[] {
  const commercialKeys = input.enabledKeys.filter((k) =>
    isCommerciallyAvailableFeature(k),
  );
  if (!input.preferEntitlementLabels) {
    const list =
      input.featureList.length > 0
        ? filterCommerciallyHonestLabels(input.featureList)
        : buildEntitlementMarketingLabels({
            analysesLimit: input.analysesLimit,
            seatsLimit: input.seatsLimit,
            enabledKeys: commercialKeys,
            interval: input.interval,
          }).labels;
    return list;
  }
  const { labels, displayOnly } = buildEntitlementMarketingLabels({
    analysesLimit: input.analysesLimit,
    seatsLimit: input.seatsLimit,
    enabledKeys: commercialKeys,
    displayOnlyExtras: input.featureList,
    interval: input.interval,
  });
  return [...labels, ...displayOnly];
}
