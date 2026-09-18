import { prisma } from "@/lib/db";
import {
  getBillingGatewaySettings,
  type BillingGatewaySettings,
} from "@/services/billing/settings";
import {
  localizePlanMarketingBundle,
  type PlanMarketingCopy,
} from "@/services/billing/plan-i18n";
import {
  canonicalFeatureKey,
  isCommerciallyAvailableFeature,
  planDefaultFeatureKeys,
} from "@/domain/billing/entitlement-catalog";
import { marketingLabelsForPlan } from "@/services/entitlements";
import { resolvePlanTrialDays } from "@/services/billing/trial-checkout";
import type { Locale } from "@/i18n/config";
import type { BillingInterval, Plan, PlanStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cache } from "react";

export type PublicBillingPlan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  monthlyPriceCents: number;
  annualPriceCents: number | null;
  annualMonths: number;
  monthlyEnabled: boolean;
  annualEnabled: boolean;
  currency: string;
  analysesLimit: number;
  seatsLimit: number;
  isFree: boolean;
  trialEligible: boolean;
  trialDays: number | null;
  highlighted: boolean;
  featureList: string[];
  /** Commercially available entitlement keys only — never Matching Engine when off. */
  enabledFeatureKeys: string[];
  /** Stripe-native trial offer for public UI. Null when trial is not available. */
  stripeTrialDays: number | null;
  copy: {
    month: PlanMarketingCopy;
    year: PlanMarketingCopy;
  };
  legacyEnum: Plan["legacyEnum"];
  gateways: Array<"stripe" | "paypal">;
};

type PlanWithFeatures = Plan & {
  planFeatures?: Array<{ enabled: boolean; feature: { key: string } }>;
};

function planGateways(
  plan: Plan,
  global: { stripeEnabled: boolean; paypalEnabled: boolean },
): Array<"stripe" | "paypal"> {
  const out: Array<"stripe" | "paypal"> = [];
  if (global.stripeEnabled && plan.stripeEnabled) out.push("stripe");
  if (global.paypalEnabled && plan.paypalEnabled) out.push("paypal");
  return out;
}

function entitlementLabelsForPlan(plan: PlanWithFeatures, interval: "month" | "year") {
  const analyses =
    interval === "year" && plan.analysesLimitYearly != null
      ? plan.analysesLimitYearly
      : plan.analysesLimit;
  const seats =
    interval === "year" && plan.seatsLimitYearly != null
      ? plan.seatsLimitYearly
      : plan.seatsLimit;
  const enabledKeys =
    plan.planFeatures
      ?.filter((pf) => pf.enabled)
      .map((pf) => pf.feature.key) ?? [];
  return sanitizeFreeMarketingLabels(
    plan,
    marketingLabelsForPlan({
      analysesLimit: analyses,
      seatsLimit: seats,
      enabledKeys,
      featureList: plan.featureList,
      preferEntitlementLabels: plan.preferEntitlementLabels ?? true,
      interval,
    }),
  );
}

export function publicEnabledFeatureKeys(plan: PlanWithFeatures): string[] {
  const mapped =
    plan.planFeatures
      ?.filter((pf) => pf.enabled)
      .map((pf) => canonicalFeatureKey(pf.feature.key)) ?? [];
  const keys = mapped.length > 0 ? mapped : planDefaultFeatureKeys(plan.slug);
  return [...new Set(keys)].filter((key) => isCommerciallyAvailableFeature(key));
}

export function publicStripeTrialDays(
  plan: Pick<
    PublicBillingPlan,
    "isFree" | "slug" | "trialEligible" | "trialDays" | "gateways"
  >,
  settings: Pick<
    BillingGatewaySettings,
    "trialEnabled" | "trialDays" | "requirePaymentMethodForTrial" | "defaultGateway"
  >,
): number | null {
  if (plan.isFree || plan.slug === "trial" || plan.slug === "free") return null;
  if (settings.defaultGateway !== "stripe") return null;
  if (!plan.gateways.includes("stripe")) return null;
  if (!settings.requirePaymentMethodForTrial) return null;
  const days = resolvePlanTrialDays(
    {
      trialDays: plan.trialDays,
      trialEligible: plan.trialEligible,
      isFree: plan.isFree,
      slug: plan.slug,
    },
    settings,
  );
  return days > 0 ? days : null;
}

export function sanitizeFreeMarketingLabels(plan: Pick<Plan, "isFree" | "slug">, labels: string[]): string[] {
  if (!plan.isFree && plan.slug !== "free") return labels;
  return labels.filter((line) => !/unlimited analyses/i.test(line));
}

function toPublicBillingPlan(
  plan: PlanWithFeatures,
  settings: BillingGatewaySettings,
  locale: Locale,
): PublicBillingPlan {
  const monthLabels = entitlementLabelsForPlan(plan, "month");
  const yearLabels = entitlementLabelsForPlan(plan, "year");

  const localized = localizePlanMarketingBundle({
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    featureList: monthLabels,
    translations: plan.translations,
    locale,
  });

  const yearLocalized = localizePlanMarketingBundle({
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    featureList: yearLabels,
    translations: plan.translations,
    locale,
  });

  const monthCopy: PlanMarketingCopy = {
    name: localized.month.name,
    description: localized.month.description,
    featureList: localized.month.featureList,
  };
  const yearCopy: PlanMarketingCopy = {
    name: yearLocalized.year.name,
    description: yearLocalized.year.description,
    featureList: yearLocalized.year.featureList,
  };

  const publicPlan: PublicBillingPlan = {
    id: plan.id,
    slug: plan.slug,
    name: monthCopy.name,
    description: monthCopy.description,
    monthlyPriceCents: plan.monthlyPriceCents,
    annualPriceCents: plan.annualPriceCents,
    annualMonths: plan.annualMonths,
    monthlyEnabled: plan.monthlyEnabled,
    annualEnabled: plan.annualEnabled,
    currency: plan.currency,
    analysesLimit: plan.analysesLimit,
    seatsLimit: plan.seatsLimit,
    isFree: plan.isFree,
    trialEligible: plan.trialEligible,
    trialDays: plan.trialDays,
    highlighted: plan.highlighted,
    featureList: monthCopy.featureList,
    enabledFeatureKeys: publicEnabledFeatureKeys(plan),
    stripeTrialDays: null,
    copy: { month: monthCopy, year: yearCopy },
    legacyEnum: plan.legacyEnum,
    gateways: planGateways(plan, settings),
  };
  publicPlan.stripeTrialDays = publicStripeTrialDays(publicPlan, settings);
  return publicPlan;
}

/**
 * Marketing + Paywall display source: ACTIVE public plans from Super Admin,
 * localized with Plan.translations (same Languages editor).
 *
 * Non-tenant catalog: request-scoped React.cache + short unstable_cache
 * (layout upgrade CTA + settings share one load under concurrency).
 */
async function loadPublicMarketingPlans(
  locale: Locale,
): Promise<PublicBillingPlan[]> {
  const settings = await getBillingGatewaySettings();
  const plans = await prisma.plan.findMany({
    where: {
      status: "ACTIVE",
      visibleToPublic: true,
    },
    include: { planFeatures: { include: { feature: true } } },
    orderBy: [{ sortOrder: "asc" }, { monthlyPriceCents: "asc" }],
  });
  return plans.map((plan) => toPublicBillingPlan(plan, settings, locale));
}

const cachedPublicMarketingPlans = unstable_cache(
  loadPublicMarketingPlans,
  ["public-marketing-plans-v1"],
  { revalidate: 120, tags: ["public-billing-plans"] },
);

export const listPublicMarketingPlans = cache(
  async (locale: Locale = "en"): Promise<PublicBillingPlan[]> =>
    cachedPublicMarketingPlans(locale),
);

/**
 * Public pricing page: paid visible plans + Free Workspace.
 * Legacy credit-trial plan is never shown as a product.
 */
export async function listPublicPricingPlans(
  locale: Locale = "en",
): Promise<PublicBillingPlan[]> {
  const settings = await getBillingGatewaySettings();
  const plans = await prisma.plan.findMany({
    where: {
      status: "ACTIVE",
      slug: { not: "trial" },
      OR: [{ visibleToPublic: true }, { isFree: true, slug: "free" }],
    },
    include: { planFeatures: { include: { feature: true } } },
    orderBy: [{ sortOrder: "asc" }, { monthlyPriceCents: "asc" }],
  });
  return plans.map((plan) => toPublicBillingPlan(plan, settings, locale));
}

/** Paid checkout cards (gateways required). Same localization as marketing. */
export const listPublicCheckoutPlans = cache(
  async (locale: Locale = "en"): Promise<PublicBillingPlan[]> => {
    const plans = await listPublicMarketingPlans(locale);
    return plans.filter(
      (p) =>
        !p.isFree &&
        (p.monthlyEnabled || p.annualEnabled) &&
        p.gateways.length > 0,
    );
  },
);

export async function getCheckoutPlanOrThrow(planIdOrSlug: string) {
  const plan = await prisma.plan.findFirst({
    where: {
      OR: [{ id: planIdOrSlug }, { slug: planIdOrSlug }],
    },
  });
  if (!plan) {
    throw Object.assign(new Error("PLAN_UNAVAILABLE"), { code: "PLAN_UNAVAILABLE" });
  }
  if (plan.status !== ("ACTIVE" satisfies PlanStatus) || !plan.visibleToPublic) {
    throw Object.assign(new Error("PLAN_UNAVAILABLE"), { code: "PLAN_UNAVAILABLE" });
  }
  if (plan.isFree || plan.slug === "trial" || plan.slug === "free") {
    throw Object.assign(new Error("PLAN_UNAVAILABLE"), { code: "PLAN_UNAVAILABLE" });
  }
  return plan;
}

export async function assertPlanAllowsCheckout(input: {
  plan: Plan;
  gateway: "stripe" | "paypal";
  interval: BillingInterval;
}) {
  const settings = await getBillingGatewaySettings();
  if (input.gateway === "stripe" && (!settings.stripeEnabled || !input.plan.stripeEnabled)) {
    throw Object.assign(new Error("GATEWAY_DISABLED"), { code: "GATEWAY_DISABLED" });
  }
  if (input.gateway === "paypal" && (!settings.paypalEnabled || !input.plan.paypalEnabled)) {
    throw Object.assign(new Error("GATEWAY_DISABLED"), { code: "GATEWAY_DISABLED" });
  }
  if (input.interval === "MONTH" && !input.plan.monthlyEnabled) {
    throw Object.assign(new Error("PLAN_UNAVAILABLE"), { code: "PLAN_UNAVAILABLE" });
  }
  if (input.interval === "YEAR" && !input.plan.annualEnabled) {
    throw Object.assign(new Error("PLAN_UNAVAILABLE"), { code: "PLAN_UNAVAILABLE" });
  }
  if (
    input.plan.status !== "ACTIVE" ||
    !input.plan.visibleToPublic ||
    input.plan.isFree ||
    input.plan.slug === "free"
  ) {
    throw Object.assign(new Error("PLAN_UNAVAILABLE"), { code: "PLAN_UNAVAILABLE" });
  }
}

export function resolvePlanAmountCents(plan: Plan, interval: BillingInterval): number {
  if (interval === "YEAR") {
    const annual = plan.annualPriceCents;
    if (annual == null || annual <= 0) {
      throw Object.assign(new Error("PLAN_UNAVAILABLE"), { code: "PLAN_UNAVAILABLE" });
    }
    return annual;
  }
  if (plan.monthlyPriceCents <= 0) {
    throw Object.assign(new Error("PLAN_UNAVAILABLE"), { code: "PLAN_UNAVAILABLE" });
  }
  return plan.monthlyPriceCents;
}

export function resolveStripePriceId(plan: Plan, interval: BillingInterval): string | null {
  if (interval === "YEAR") {
    return plan.stripePriceAnnual || null;
  }
  return (
    plan.stripePriceMonthly ||
    (plan.stripePriceEnv ? process.env[plan.stripePriceEnv] ?? null : null)
  );
}

/** When Super Admin configured a Stripe Price ID, checkout/activation must use it exclusively. */
export function planRequiresStripePriceId(plan: Plan, interval: BillingInterval): boolean {
  return resolveStripePriceId(plan, interval) != null;
}

export function assertStripePriceIdConfigured(plan: Plan, interval: BillingInterval) {
  const priceId = resolveStripePriceId(plan, interval);
  if (!priceId) {
    throw Object.assign(
      new Error("STRIPE_PRICE_NOT_CONFIGURED"),
      { code: "STRIPE_PRICE_NOT_CONFIGURED" },
    );
  }
  return priceId;
}

export function resolvePaypalPlanId(plan: Plan, interval: BillingInterval): string | null {
  if (interval === "YEAR") {
    return plan.paypalPlanAnnual || null;
  }
  return (
    plan.paypalPlanMonthly ||
    (plan.paypalPlanIdEnv ? process.env[plan.paypalPlanIdEnv] ?? null : null)
  );
}
