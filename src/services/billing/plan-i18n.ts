/**
 * Plan marketing copy for Paywall / PricingGrid.
 *
 * Source of truth:
 * 1. English Plan.name / description / featureList (canonical — Admin "Edit price")
 * 2. Plan.translations[locale].monthly | .yearly (Admin "Languages")
 *
 * Legacy: translations[locale].features ≡ monthly.features
 */

import type { Locale } from "@/i18n/config";
import { z } from "zod";

export const planIntervalCopySchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  features: z.array(z.string().max(200)).max(50).optional(),
});

export const planLocaleCopySchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  /** @deprecated Prefer monthly.features — kept for backward compatibility */
  features: z.array(z.string().max(200)).max(50).optional(),
  monthly: planIntervalCopySchema.optional(),
  yearly: planIntervalCopySchema.optional(),
});

export const planTranslationsSchema = z
  .object({
    ar: planLocaleCopySchema.optional(),
    es: planLocaleCopySchema.optional(),
    zh: planLocaleCopySchema.optional(),
    fr: planLocaleCopySchema.optional(),
  })
  .passthrough();

export type PlanIntervalCopy = z.infer<typeof planIntervalCopySchema>;
export type PlanLocaleCopy = z.infer<typeof planLocaleCopySchema>;
export type PlanTranslations = z.infer<typeof planTranslationsSchema>;

export type BillingMarketingInterval = "month" | "year";

export type PlanMarketingCopy = {
  name: string;
  description: string | null;
  featureList: string[];
};

export const MARKETING_LOCALES = ["ar", "es", "zh", "fr"] as const;
export type MarketingLocale = (typeof MARKETING_LOCALES)[number];

export function parsePlanTranslations(raw: unknown): PlanTranslations {
  if (!raw || typeof raw !== "object") return {};
  const parsed = planTranslationsSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

/** Editor suggestions only — not a silent public override after Admin publish. */
const FEATURE_I18N: Record<string, Partial<Record<MarketingLocale, string>>> = {
  "3 free tender analyses": {
    ar: "٣ تحليلات مناقصات مجانية",
    es: "3 análisis de licitaciones gratis",
    zh: "3 次免费招标分析",
    fr: "3 analyses d’AO gratuites",
  },
  "Full decision workspace": {
    ar: "مساحة قرار كاملة",
    es: "Espacio de decisión completo",
    zh: "完整决策工作区",
    fr: "Espace de décision complet",
  },
  "Tender analysis workspace": {
    ar: "مساحة تحليل المناقصات",
    es: "Espacio de análisis de licitaciones",
    zh: "招标分析工作区",
    fr: "Espace d’analyse d’AO",
  },
  "Company profile": {
    ar: "ملف الشركة",
    es: "Perfil de empresa",
    zh: "公司资料",
    fr: "Profil entreprise",
  },
  "Decision Memory": {
    ar: "ذاكرة القرار",
    es: "Memoria de decisiones",
    zh: "决策记忆",
    fr: "Mémoire de décision",
  },
  "Deadline & Smart Alerts": {
    ar: "تنبيهات المواعيد والتنبيهات الذكية",
    es: "Alertas de plazos e inteligentes",
    zh: "截止日期与智能提醒",
    fr: "Alertes échéances & Smart Alerts",
  },
  "Deadline alerts": {
    ar: "تنبيهات المواعيد",
    es: "Alertas de plazos",
    zh: "截止日期提醒",
    fr: "Alertes d’échéances",
  },
  "Team Decision Workflow": {
    ar: "سير عمل قرار الفريق",
    es: "Flujo de decisión del equipo",
    zh: "团队决策工作流",
    fr: "Workflow décision d’équipe",
  },
  "PDF decision reports": {
    ar: "تقارير قرار PDF",
    es: "Informes de decisión en PDF",
    zh: "PDF 决策报告",
    fr: "Rapports de décision PDF",
  },
  "PDF export": {
    ar: "تصدير PDF",
    es: "Exportación PDF",
    zh: "PDF 导出",
    fr: "Export PDF",
  },
  "Email support": {
    ar: "دعم بالبريد",
    es: "Soporte por email",
    zh: "邮件支持",
    fr: "Support par e-mail",
  },
  "Priority processing": {
    ar: "معالجة ذات أولوية",
    es: "Procesamiento prioritario",
    zh: "优先处理",
    fr: "Traitement prioritaire",
  },
  "Exportable decision packs": {
    ar: "حزم قرار قابلة للتصدير",
    es: "Paquetes de decisión exportables",
    zh: "可导出的决策包",
    fr: "Dossiers de décision exportables",
  },
  Analytics: {
    ar: "التحليلات",
    es: "Analíticas",
    zh: "分析",
    fr: "Analytique",
  },
  "Proposal assistance": {
    ar: "مساعدة العروض",
    es: "Asistencia de propuestas",
    zh: "投标协助",
    fr: "Aide à la proposition",
  },
  "Tender discovery": {
    ar: "اكتشاف المناقصات",
    es: "Descubrimiento de licitaciones",
    zh: "招标发现",
    fr: "Découverte d’AO",
  },
  "1 seat": {
    ar: "مقعد واحد",
    es: "1 asiento",
    zh: "1 个席位",
    fr: "1 siège",
  },
  "Unlimited analyses / month": {
    ar: "تحليلات غير محدودة / شهر",
    es: "Análisis ilimitados / mes",
    zh: "无限分析 / 月",
    fr: "Analyses illimitées / mois",
  },
  "Unlimited analyses / year": {
    ar: "تحليلات غير محدودة / سنة",
    es: "Análisis ilimitados / año",
    zh: "无限分析 / 年",
    fr: "Analyses illimitées / an",
  },
  "SSO-ready roles": {
    ar: "أدوار جاهزة لـ SSO",
    es: "Roles listos para SSO",
    zh: "支持 SSO 的角色",
    fr: "Rôles prêts pour le SSO",
  },
  "Priority support": {
    ar: "دعم ذو أولوية",
    es: "Soporte prioritario",
    zh: "优先支持",
    fr: "Support prioritaire",
  },
};

const YEARLY_SAVE_LINE: Record<MarketingLocale | "en", string> = {
  en: "Save ~2 months vs monthly billing",
  ar: "وفّر نحو شهرين مقارنة بالدفع الشهري",
  es: "Ahorra ~2 meses frente al pago mensual",
  zh: "相较月付约省 2 个月",
  fr: "Économisez ~2 mois vs mensuel",
};

const PLAN_NAME_I18N: Record<string, Partial<Record<MarketingLocale, string>>> = {
  trial: { ar: "تجريبي", es: "Prueba", zh: "试用", fr: "Essai" },
  starter: { ar: "المبتدئ", es: "Starter", zh: "入门", fr: "Starter" },
  pro: { ar: "برو", es: "Pro", zh: "专业版", fr: "Pro" },
  business: { ar: "أعمال", es: "Business", zh: "企业版", fr: "Business" },
};

function toLocaleDigits(n: number, locale: MarketingLocale): string {
  const s = String(n);
  if (locale !== "ar") return s;
  return s.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
}

/** Translate one Plan Editor / entitlement marketing line into a locale. */
export function translateMarketingFeatureLine(
  line: string,
  locale: MarketingLocale,
): string {
  const trimmed = line.trim();
  if (!trimmed) return trimmed;
  const exact = FEATURE_I18N[trimmed]?.[locale];
  if (exact) return exact;

  const analysesMonth = trimmed.match(/^(\d+)\s+analyses\s*\/\s*month$/i);
  if (analysesMonth) {
    const n = Number(analysesMonth[1]);
    const d = toLocaleDigits(n, locale);
    if (locale === "ar") return `${d} تحليلًا / شهر`;
    if (locale === "es") return `${d} análisis / mes`;
    if (locale === "zh") return `每月 ${d} 次分析`;
    if (locale === "fr") return `${d} analyses / mois`;
  }

  const analysesYear = trimmed.match(/^(\d+)\s+analyses\s*\/\s*year$/i);
  if (analysesYear) {
    const n = Number(analysesYear[1]);
    const d = toLocaleDigits(n, locale);
    if (locale === "ar") return `${d} تحليلًا / سنة`;
    if (locale === "es") return `${d} análisis / año`;
    if (locale === "zh") return `每年 ${d} 次分析`;
    if (locale === "fr") return `${d} analyses / an`;
  }

  const seats = trimmed.match(/^Up to\s+(\d+)\s+seats$/i);
  if (seats) {
    const n = Number(seats[1]);
    const d = toLocaleDigits(n, locale);
    if (locale === "ar") return `حتى ${d} مقاعد`;
    if (locale === "es") return `Hasta ${d} asientos`;
    if (locale === "zh") return `最多 ${d} 个席位`;
    if (locale === "fr") return `Jusqu’à ${d} sièges`;
  }

  return trimmed;
}

export function suggestLocaleFeatures(
  featureList: string[],
  locale: MarketingLocale,
): string[] {
  return featureList.map((f) => translateMarketingFeatureLine(f, locale));
}

export function suggestYearlyFeatures(
  featureList: string[],
  locale: MarketingLocale | "en",
): string[] {
  const base =
    locale === "en"
      ? [...featureList]
      : suggestLocaleFeatures(featureList, locale);
  const save = YEARLY_SAVE_LINE[locale];
  if (base.some((f) => f === save)) return base;
  return [...base, save];
}

export function suggestLocalePlanName(
  slug: string,
  locale: MarketingLocale,
): string | null {
  return PLAN_NAME_I18N[slug.toLowerCase()]?.[locale] ?? null;
}

function trimFeatures(list: string[] | undefined | null): string[] {
  if (!Array.isArray(list)) return [];
  return list.map((f) => f.trim()).filter(Boolean);
}

function intervalBucket(
  copy: PlanLocaleCopy | undefined,
  interval: BillingMarketingInterval,
): PlanIntervalCopy | undefined {
  if (!copy) return undefined;
  if (interval === "month") {
    return (
      copy.monthly ??
      (copy.features || copy.name || copy.description
        ? {
            name: copy.name,
            description: copy.description,
            features: copy.features,
          }
        : undefined)
    );
  }
  return copy.yearly;
}

function localeHasPublishedCopy(copy: PlanLocaleCopy | undefined): boolean {
  if (!copy) return false;
  if (copy.name?.trim()) return true;
  if (copy.description?.trim()) return true;
  if (trimFeatures(copy.features).length > 0) return true;
  if (Array.isArray(copy.features)) return true;
  for (const bucket of [copy.monthly, copy.yearly]) {
    if (!bucket) continue;
    if (bucket.name?.trim()) return true;
    if (bucket.description?.trim()) return true;
    if (trimFeatures(bucket.features).length > 0) return true;
    if (Array.isArray(bucket.features)) return true;
  }
  return false;
}

function resolveIntervalCopy(input: {
  slug: string;
  name: string;
  description: string | null;
  featureList: string[];
  translations: unknown;
  locale: Locale;
  interval: BillingMarketingInterval;
}): PlanMarketingCopy {
  const { locale, interval } = input;

  if (locale === "en") {
    const features =
      interval === "year"
        ? suggestYearlyFeatures(input.featureList, "en")
        : input.featureList;
    return {
      name: input.name,
      description: input.description,
      featureList: features,
    };
  }

  const stored = parsePlanTranslations(input.translations)[locale];
  const bucket = intervalBucket(stored, interval);
  const monthBucket = intervalBucket(stored, "month");

  if (localeHasPublishedCopy(stored)) {
    const name =
      bucket?.name?.trim() ||
      stored?.name?.trim() ||
      input.name;
    const description =
      (bucket?.description !== undefined && bucket.description !== null
        ? bucket.description.trim() || null
        : null) ??
      (stored?.description !== undefined && stored.description !== null
        ? stored.description.trim() || null
        : input.description);

    let features = trimFeatures(bucket?.features);
    if (features.length === 0 && interval === "year") {
      features = trimFeatures(monthBucket?.features);
    }
    if (features.length === 0) {
      features = trimFeatures(stored?.features);
    }
    if (features.length === 0) {
      features =
        interval === "year"
          ? suggestYearlyFeatures(input.featureList, locale)
          : input.featureList;
    }

    return { name, description, featureList: features };
  }

  // Unpublished → temporary suggestions
  return {
    name: suggestLocalePlanName(input.slug, locale) || input.name,
    description: input.description,
    featureList:
      interval === "year"
        ? suggestYearlyFeatures(input.featureList, locale)
        : suggestLocaleFeatures(input.featureList, locale),
  };
}

/** Localized copy for both billing intervals (Paywall Monthly/Yearly toggle). */
export function localizePlanMarketingBundle(input: {
  slug: string;
  name: string;
  description: string | null;
  featureList: string[];
  translations: unknown;
  locale: Locale;
}): { month: PlanMarketingCopy; year: PlanMarketingCopy } {
  return {
    month: resolveIntervalCopy({ ...input, interval: "month" }),
    year: resolveIntervalCopy({ ...input, interval: "year" }),
  };
}

/** @deprecated Prefer localizePlanMarketingBundle — defaults to monthly. */
export function localizePlanMarketing(input: {
  slug: string;
  name: string;
  description: string | null;
  featureList: string[];
  translations: unknown;
  locale: Locale;
}): PlanMarketingCopy {
  return resolveIntervalCopy({ ...input, interval: "month" });
}

/** Full Languages editor draft with monthly + yearly per locale.
 * featureList / yearlyFeatureList should be Plan Editor entitlement bullets (EN canonical).
 */
export function buildPlanLanguagesDraft(input: {
  slug: string;
  name: string;
  description: string | null;
  featureList: string[];
  yearlyFeatureList?: string[];
  translations: unknown;
}): PlanTranslations {
  const stored = parsePlanTranslations(input.translations);
  const next: PlanTranslations = {};
  const monthCanonical = input.featureList;
  const yearCanonical =
    input.yearlyFeatureList && input.yearlyFeatureList.length > 0
      ? input.yearlyFeatureList
      : input.featureList;

  for (const loc of MARKETING_LOCALES) {
    const existing = stored[loc];
    const legacyFeatures = trimFeatures(existing?.features);
    const monthExisting = existing?.monthly;
    const yearExisting = existing?.yearly;

    const monthName =
      monthExisting?.name?.trim() ||
      existing?.name?.trim() ||
      suggestLocalePlanName(input.slug, loc) ||
      input.name;
    const monthDesc =
      monthExisting?.description !== undefined
        ? monthExisting.description
        : existing?.description !== undefined
          ? existing.description
          : input.description;
    const monthFeatures =
      trimFeatures(monthExisting?.features).length > 0
        ? trimFeatures(monthExisting?.features)
        : legacyFeatures.length > 0
          ? legacyFeatures
          : suggestLocaleFeatures(monthCanonical, loc);

    const yearName = yearExisting?.name?.trim() || monthName;
    const yearDesc =
      yearExisting?.description !== undefined
        ? yearExisting.description
        : monthDesc;
    const yearlyResolved =
      trimFeatures(yearExisting?.features).length > 0
        ? trimFeatures(yearExisting?.features)
        : (() => {
            const suggested = suggestLocaleFeatures(yearCanonical, loc);
            const save = YEARLY_SAVE_LINE[loc];
            return suggested.includes(save)
              ? suggested
              : [...suggested, save];
          })();

    next[loc] = {
      name: monthName,
      description: monthDesc,
      features: monthFeatures,
      monthly: {
        name: monthName,
        description: monthDesc,
        features: monthFeatures,
      },
      yearly: {
        name: yearName,
        description: yearDesc,
        features: yearlyResolved,
      },
    };
  }

  return next;
}

/** Merge incoming locale copy onto previous DB translations (deep per interval). */
export function mergePlanTranslations(
  previous: unknown,
  incoming: PlanTranslations | null,
): PlanTranslations | null {
  if (incoming === null) return null;
  const base = parsePlanTranslations(previous);
  const next: PlanTranslations = { ...base };
  for (const loc of MARKETING_LOCALES) {
    const patch = incoming[loc];
    if (!patch) continue;
    const prev = base[loc];
    next[loc] = {
      ...prev,
      ...patch,
      features:
        patch.features !== undefined ? patch.features : prev?.features,
      monthly:
        patch.monthly || prev?.monthly
          ? {
              ...prev?.monthly,
              ...patch.monthly,
              features:
                patch.monthly?.features !== undefined
                  ? patch.monthly.features
                  : prev?.monthly?.features,
            }
          : undefined,
      yearly:
        patch.yearly || prev?.yearly
          ? {
              ...prev?.yearly,
              ...patch.yearly,
              features:
                patch.yearly?.features !== undefined
                  ? patch.yearly.features
                  : prev?.yearly?.features,
            }
          : undefined,
    };
  }
  return next;
}
