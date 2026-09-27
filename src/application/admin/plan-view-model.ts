import {
  parsePlanTranslations,
  type PlanTranslations,
} from "@/services/billing/plan-i18n";

export type AdminPlanRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  monthlyPriceCents: number;
  annualPriceCents: number | null;
  annualMonths: number;
  monthlyEnabled: boolean;
  annualEnabled: boolean;
  analysesLimit: number;
  analysesLimitYearly: number | null;
  seatsLimit: number;
  seatsLimitYearly: number | null;
  aiTokensLimit: number | null;
  storageMbLimit: number | null;
  isFree: boolean;
  visibleToPublic: boolean;
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  trialEligible: boolean;
  trialDays: number | null;
  graceDays: number | null;
  currency: string;
  sortOrder: number;
  highlighted: boolean;
  preferEntitlementLabels: boolean;
  featureList: string[];
  featureKeys: string[];
  translations: PlanTranslations | null;
  subscriptionsCount: number;
};

export function mapPlanToAdminRow(
  p: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    monthlyPriceCents: number;
    annualPriceCents: number | null;
    annualMonths: number;
    monthlyEnabled: boolean;
    annualEnabled: boolean;
    analysesLimit: number;
    analysesLimitYearly: number | null;
    seatsLimit: number;
    seatsLimitYearly: number | null;
    aiTokensLimit: number | null;
    storageMbLimit: number | null;
    isFree: boolean;
    visibleToPublic: boolean;
    stripeEnabled: boolean;
    paypalEnabled: boolean;
    trialEligible: boolean;
    trialDays: number | null;
    graceDays: number | null;
    currency: string;
    sortOrder: number;
    highlighted: boolean;
    preferEntitlementLabels: boolean;
    status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
    featureList: string[];
    translations: unknown;
    planFeatures: Array<{ enabled: boolean; feature: { key: string } }>;
    _count: { subscriptions: number };
  },
  entitlementKeys: readonly string[],
): AdminPlanRow {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    monthlyPriceCents: p.monthlyPriceCents,
    annualPriceCents: p.annualPriceCents,
    annualMonths: p.annualMonths,
    monthlyEnabled: p.monthlyEnabled,
    annualEnabled: p.annualEnabled,
    analysesLimit: p.analysesLimit,
    analysesLimitYearly: p.analysesLimitYearly,
    seatsLimit: p.seatsLimit,
    seatsLimitYearly: p.seatsLimitYearly,
    aiTokensLimit: p.aiTokensLimit,
    storageMbLimit: p.storageMbLimit,
    isFree: p.isFree,
    visibleToPublic: p.visibleToPublic,
    stripeEnabled: p.stripeEnabled,
    paypalEnabled: p.paypalEnabled,
    trialEligible: p.trialEligible,
    trialDays: p.trialDays,
    graceDays: p.graceDays,
    currency: p.currency,
    sortOrder: p.sortOrder,
    highlighted: p.highlighted,
    preferEntitlementLabels: p.preferEntitlementLabels,
    status: p.status,
    featureList: p.featureList,
    featureKeys: p.planFeatures
      .filter((pf) => pf.enabled)
      .map((pf) => pf.feature.key)
      .filter((k) => entitlementKeys.includes(k)),
    translations: parsePlanTranslations(p.translations),
    subscriptionsCount: p._count.subscriptions,
  };
}

export function pickExistingFreeWorkspacePlan(
  plans: readonly AdminPlanRow[],
): AdminPlanRow | null {
  return (
    plans.find((p) => p.slug === "free" && p.isFree) ??
    plans.find((p) => p.slug === "free") ??
    plans.find((p) => p.isFree) ??
    null
  );
}

export type FreeWorkspaceSettingsPatch = {
  trialEligible: boolean;
  trialDays: number | null;
  featureKeys: readonly string[];
  seatsLimit: number;
  aiTokensLimit: number | null;
  storageMbLimit: number | null;
};

/** Preserve commercial fields and update only trial / features / limits on the existing plan. */
export function buildFreeWorkspaceSettingsPayload(
  plan: AdminPlanRow,
  patch: FreeWorkspaceSettingsPatch,
  entitlementKeys: readonly string[] = [],
): Record<string, unknown> {
  const allowed = new Set(entitlementKeys);
  const featureKeys = patch.featureKeys.filter(
    (key) => allowed.has(key) && key !== "tender_analysis",
  );
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    monthlyPriceCents: plan.monthlyPriceCents,
    annualPriceCents: plan.annualPriceCents,
    annualMonths: plan.annualMonths,
    monthlyEnabled: plan.monthlyEnabled,
    annualEnabled: plan.annualEnabled,
    analysesLimit: plan.analysesLimit,
    analysesLimitYearly: plan.analysesLimitYearly,
    seatsLimit: patch.seatsLimit,
    seatsLimitYearly: plan.seatsLimitYearly,
    aiTokensLimit: patch.aiTokensLimit,
    storageMbLimit: patch.storageMbLimit,
    trialEligible: patch.trialEligible,
    trialDays: patch.trialDays,
    graceDays: plan.graceDays,
    isFree: true,
    visibleToPublic: plan.visibleToPublic,
    stripeEnabled: false,
    paypalEnabled: false,
    currency: plan.currency,
    sortOrder: plan.sortOrder,
    highlighted: plan.highlighted,
    preferEntitlementLabels: plan.preferEntitlementLabels,
    status: plan.status,
    featureList: plan.featureList,
    featureKeys,
    ...(plan.translations ? { translations: plan.translations } : {}),
  };
}
