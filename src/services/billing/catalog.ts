import { prisma } from "@/lib/db";
import {
  getBillingGatewaySettings,
  type BillingGatewaySettings,
} from "@/services/billing/settings";
import {
  localizePlanMarketingBundle,
  parsePlanTranslations,
  type PlanMarketingCopy,
} from "@/services/billing/plan-i18n";
import {
  canonicalFeatureKey,
  isCommerciallyAvailableFeature,
  isObsoleteAnalysesQuotaLabel,
  isPublicCatalogFeature,
  planDefaultFeatureKeys,
} from "@/domain/billing/entitlement-catalog";
import { marketingLabelsForPlan } from "@/services/entitlements";
import { resolvePlanTrialDays } from "@/services/billing/trial-checkout";
import { isPublicCommercialPricingPlan } from "@/services/billing/free-workspace-identity";
import {
  allowStripeInlinePriceData,
  isUsablePaypalBillingPlanId,
  isUsableStripePriceId,
  paypalPlanIdForEnvironment,
  type PaypalCheckoutEnvironment,
} from "@/services/billing/plan-gateway-ids";
import { resolvePaypalEnvironmentAsync } from "@/services/billing/provider-credentials";
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
  /**
   * Locale-specific currency display from Plan Languages (e.g. "دولار").
   * Null for English / when unset — formatPlanMoney falls back to $ / code.
   */
  currencyLabel: string | null;
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
  /** Gateways that can actually charge the selected interval. */
  gatewaysByInterval: {
    month: Array<"stripe" | "paypal">;
    year: Array<"stripe" | "paypal">;
  };
};

type PlanWithFeatures = Plan & {
  planFeatures?: Array<{ enabled: boolean; feature: { key: string } }>;
};

export function configuredGatewaysForInterval(
  plan: Plan,
  interval: BillingInterval,
  global: { stripeEnabled: boolean; paypalEnabled: boolean },
  paypalEnvironment: PaypalCheckoutEnvironment = "live",
): Array<"stripe" | "paypal"> {
  if (plan.isFree || plan.slug === "free" || plan.slug === "trial") return [];
  if (interval === "MONTH" && !plan.monthlyEnabled) return [];
  if (interval === "YEAR" && !plan.annualEnabled) return [];
  const out: Array<"stripe" | "paypal"> = [];
  if (
    global.stripeEnabled &&
    plan.stripeEnabled &&
    isUsableStripePriceId(resolveStripePriceId(plan, interval))
  ) {
    out.push("stripe");
  }
  if (
    global.paypalEnabled &&
    plan.paypalEnabled &&
    isUsablePaypalBillingPlanId(resolvePaypalPlanId(plan, interval, paypalEnvironment))
  ) {
    out.push("paypal");
  }
  return out;
}

function unionGateways(
  month: Array<"stripe" | "paypal">,
  year: Array<"stripe" | "paypal">,
): Array<"stripe" | "paypal"> {
  const out: Array<"stripe" | "paypal"> = [];
  if (month.includes("stripe") || year.includes("stripe")) out.push("stripe");
  if (month.includes("paypal") || year.includes("paypal")) out.push("paypal");
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
  return [...new Set(keys)].filter((key) => isPublicCatalogFeature(key));
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
  const withoutAnalyses = labels.filter((line) => !isObsoleteAnalysesQuotaLabel(line));
  if (!plan.isFree && plan.slug !== "free") return withoutAnalyses;
  return withoutAnalyses.filter((line) => !/unlimited analyses/i.test(line));
}

/** Locale currency display from Plan Languages; English / unset → null ($ fallback). */
export function resolvePublicCurrencyLabel(
  translations: unknown,
  locale: Locale,
): string | null {
  if (locale === "en") return null;
  const stored = parsePlanTranslations(translations)[locale];
  const label = stored?.currencyLabel?.trim();
  return label || null;
}

function toPublicBillingPlan(
  plan: PlanWithFeatures,
  settings: BillingGatewaySettings,
  locale: Locale,
  paypalEnvironment: PaypalCheckoutEnvironment,
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
    currencyLabel: resolvePublicCurrencyLabel(plan.translations, locale),
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
    gateways: unionGateways(
      configuredGatewaysForInterval(plan, "MONTH", settings, paypalEnvironment),
      configuredGatewaysForInterval(plan, "YEAR", settings, paypalEnvironment),
    ),
    gatewaysByInterval: {
      month: configuredGatewaysForInterval(plan, "MONTH", settings, paypalEnvironment),
      year: configuredGatewaysForInterval(plan, "YEAR", settings, paypalEnvironment),
    },
  };
  publicPlan.stripeTrialDays = publicStripeTrialDays(
    {
      ...publicPlan,
      gateways: publicPlan.gatewaysByInterval.month,
    },
    settings,
  );
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
  paypalEnvironment: PaypalCheckoutEnvironment,
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
  return plans.map((plan) =>
    toPublicBillingPlan(plan, settings, locale, paypalEnvironment),
  );
}

const cachedPublicMarketingPlans = unstable_cache(
  loadPublicMarketingPlans,
  ["public-marketing-plans-v3"],
  { revalidate: 120, tags: ["public-billing-plans"] },
);

export const listPublicMarketingPlans = cache(
  async (locale: Locale = "en"): Promise<PublicBillingPlan[]> => {
    const paypalEnvironment = await resolvePaypalEnvironmentAsync();
    return cachedPublicMarketingPlans(locale, paypalEnvironment);
  },
);

/**
 * Public pricing page: paid commercial plans only.
 * Free Workspace is a first-signup trial, not a checkout product.
 */
export async function listPublicPricingPlans(
  locale: Locale = "en",
): Promise<PublicBillingPlan[]> {
  const [settings, paypalEnvironment] = await Promise.all([
    getBillingGatewaySettings(),
    resolvePaypalEnvironmentAsync(),
  ]);
  const plans = await prisma.plan.findMany({
    where: {
      status: "ACTIVE",
      visibleToPublic: true,
      isFree: false,
      slug: { notIn: ["trial", "free"] },
    },
    include: { planFeatures: { include: { feature: true } } },
    orderBy: [{ sortOrder: "asc" }, { monthlyPriceCents: "asc" }],
  });
  return plans
    .filter(isPublicCommercialPricingPlan)
    .map((plan) => toPublicBillingPlan(plan, settings, locale, paypalEnvironment));
}

export function isPublicCheckoutPlan(plan: {
  isFree: boolean;
  monthlyEnabled: boolean;
  annualEnabled: boolean;
  gateways: Array<"stripe" | "paypal">;
}): boolean {
  return (
    !plan.isFree &&
    (plan.monthlyEnabled || plan.annualEnabled) &&
    plan.gateways.length > 0
  );
}

/** Paid checkout cards (gateways required). Same localization as marketing. */
export const listPublicCheckoutPlans = cache(
  async (locale: Locale = "en"): Promise<PublicBillingPlan[]> => {
    const plans = await listPublicMarketingPlans(locale);
    return plans.filter(isPublicCheckoutPlan);
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
  const paypalEnvironment =
    input.gateway === "paypal" ? await resolvePaypalEnvironmentAsync() : "live";
  assertIntervalGatewayMapping(
    input.plan,
    input.gateway,
    input.interval,
    process.env.NODE_ENV,
    paypalEnvironment,
  );
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

export function assertIntervalGatewayMapping(
  plan: Plan,
  gateway: "stripe" | "paypal",
  interval: BillingInterval,
  nodeEnv: string | undefined = process.env.NODE_ENV,
  paypalEnvironment: PaypalCheckoutEnvironment = "live",
) {
  if (
    gateway === "paypal" &&
    !isUsablePaypalBillingPlanId(resolvePaypalPlanId(plan, interval, paypalEnvironment))
  ) {
    throw Object.assign(new Error("PAYPAL_PLAN_NOT_CONFIGURED"), {
      code: "PAYPAL_PLAN_NOT_CONFIGURED",
    });
  }
  if (
    gateway === "stripe" &&
    !allowStripeInlinePriceData(nodeEnv) &&
    !isUsableStripePriceId(resolveStripePriceId(plan, interval))
  ) {
    throw Object.assign(new Error("STRIPE_PRICE_NOT_CONFIGURED"), {
      code: "STRIPE_PRICE_NOT_CONFIGURED",
    });
  }
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

export function resolvePaypalPlanId(
  plan: Plan,
  interval: BillingInterval,
  environment: PaypalCheckoutEnvironment = "live",
): string | null {
  return paypalPlanIdForEnvironment(plan, interval, environment);
}
