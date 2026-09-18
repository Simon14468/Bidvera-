"use client";

import {
  saSetPlanStatus,
  saUpdatePlanTranslations,
  saUpsertPlan,
} from "@/app/actions/super-admin";
import {
  ENTITLEMENT_CATALOG,
  buildEntitlementMarketingLabels,
  planEditorCanonicalFeatures,
} from "@/domain/billing/entitlement-catalog";
import { localeLabels } from "@/i18n/config";
import {
  buildPlanLanguagesDraft,
  MARKETING_LOCALES,
  parsePlanTranslations,
  suggestLocaleFeatures,
  suggestLocalePlanName,
  type PlanTranslations,
} from "@/services/billing/plan-i18n";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const inputClass =
  "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100";

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

function dollarsToCents(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export function PlansManager({
  plans,
  entitlementKeys,
}: {
  plans: AdminPlanRow[];
  entitlementKeys: string[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<AdminPlanRow | null>(null);
  const [langPlan, setLangPlan] = useState<AdminPlanRow | null>(null);

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
            <tr>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Monthly</th>
              <th className="px-3 py-2">Annual</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Analyses</th>
              <th className="px-3 py-2">AI</th>
              <th className="px-3 py-2">Seats</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Subs</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-b border-slate-800/70">
                <td className="px-3 py-2">
                  <p className="font-medium text-white">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.slug}</p>
                </td>
                <td className="px-3 py-2">
                  {p.isFree || p.slug === "free" ? (
                    <span className="rounded bg-emerald-900/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                      Free Workspace
                    </span>
                  ) : (
                    <span className="text-slate-400">Paid</span>
                  )}
                  <p className="mt-1 text-[11px] text-slate-500">
                    {p.visibleToPublic ? "Public" : "Hidden"}
                    {p.stripeEnabled ? " · Stripe" : ""}
                    {p.paypalEnabled ? " · PayPal" : ""}
                  </p>
                </td>
                <td className="px-3 py-2">
                  {p.monthlyEnabled ? `$${centsToDollars(p.monthlyPriceCents)}` : (
                    <span className="text-slate-500">off</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {p.annualEnabled && p.annualPriceCents != null ? (
                    `$${centsToDollars(p.annualPriceCents)}`
                  ) : (
                    <span className="text-slate-500">off</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-300">
                  {p.annualEnabled ? `${p.annualMonths} mo` : "—"}
                </td>
                <td className="px-3 py-2">{p.analysesLimit}</td>
                <td className="px-3 py-2 text-slate-300">
                  {p.aiTokensLimit == null ? "Unlimited" : p.aiTokensLimit}
                </td>
                <td className="px-3 py-2">{p.seatsLimit}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      p.status === "ACTIVE"
                        ? "text-emerald-400"
                        : p.status === "INACTIVE"
                          ? "text-amber-400"
                          : "text-slate-500"
                    }
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-2">{p.subscriptionsCount}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                      onClick={() => {
                        setLangPlan(null);
                        setEditing(p);
                      }}
                    >
                      Edit price
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                      onClick={() => {
                        setEditing(null);
                        setLangPlan(p);
                      }}
                    >
                      Languages
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
                      onClick={() =>
                        start(async () => {
                          const next =
                            p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                          const r = await saSetPlanStatus({
                            planId: p.id,
                            status: next,
                          });
                          setMsg(
                            r.ok
                              ? `${p.name} → ${next}`
                              : r.error.message,
                          );
                          if (r.ok) router.refresh();
                        })
                      }
                    >
                      {p.status === "ACTIVE" ? "Disable" : "Enable"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {langPlan ? (
        <PlanLanguagesEditor
          key={`lang-${langPlan.id}`}
          plan={langPlan}
          pending={pending}
          onClose={() => setLangPlan(null)}
          onSave={(translations) => {
            start(async () => {
              const r = await saUpdatePlanTranslations({
                planId: langPlan.id,
                translations,
              });
              if (!r.ok) {
                setMsg(r.error.message);
                return;
              }
              setLangPlan((prev) =>
                prev
                  ? {
                      ...prev,
                      translations: parsePlanTranslations(translations),
                    }
                  : prev,
              );
              setMsg(
                "Published — live now on /pricing and /upgrade (refresh those tabs).",
              );
              router.refresh();
            });
          }}
        />
      ) : (
        <PlanEditor
          key={editing?.id ?? "new"}
          initial={editing}
          pending={pending}
          entitlementKeys={entitlementKeys}
          onClear={() => setEditing(null)}
          onSave={(payload, form) => {
            start(async () => {
              const r = await saUpsertPlan(payload);
              setMsg(
                r.ok
                  ? "Plan + entitlements saved — subscribers synced; live on Paywall."
                  : r.error.message,
              );
              if (r.ok) {
                setEditing(null);
                form?.reset();
                router.refresh();
              }
            });
          }}
        />
      )}

      {msg ? <p className="text-sm text-emerald-300/90">{msg}</p> : null}
    </div>
  );
}

function PlanLanguagesEditor({
  plan,
  pending,
  onClose,
  onSave,
}: {
  plan: AdminPlanRow;
  pending: boolean;
  onClose: () => void;
  onSave: (translations: PlanTranslations) => void;
}) {
  type IntervalTab = "month" | "year";

  const enMonthFeatures = useMemo(
    () =>
      planEditorCanonicalFeatures({
        analysesLimit: plan.analysesLimit,
        analysesLimitYearly: plan.analysesLimitYearly,
        seatsLimit: plan.seatsLimit,
        seatsLimitYearly: plan.seatsLimitYearly,
        featureKeys: plan.featureKeys,
        featureList: plan.featureList,
        preferEntitlementLabels: plan.preferEntitlementLabels,
        interval: "month",
      }),
    [plan],
  );

  const enYearFeatures = useMemo(
    () =>
      planEditorCanonicalFeatures({
        analysesLimit: plan.analysesLimit,
        analysesLimitYearly: plan.analysesLimitYearly,
        seatsLimit: plan.seatsLimit,
        seatsLimitYearly: plan.seatsLimitYearly,
        featureKeys: plan.featureKeys,
        featureList: plan.featureList,
        preferEntitlementLabels: plan.preferEntitlementLabels,
        interval: "year",
      }),
    [plan],
  );

  const initialDraft = useMemo(
    () =>
      buildPlanLanguagesDraft({
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        featureList: enMonthFeatures,
        yearlyFeatureList: enYearFeatures,
        translations: plan.translations,
      }),
    [plan, enMonthFeatures, enYearFeatures],
  );
  const [locale, setLocale] = useState<(typeof MARKETING_LOCALES)[number]>("ar");
  const [interval, setInterval] = useState<IntervalTab>("month");
  const [draft, setDraft] = useState<PlanTranslations>(initialDraft);
  const [dirty, setDirty] = useState(false);

  const enCanonicalFeatures =
    interval === "year" ? enYearFeatures : enMonthFeatures;

  function bucketFeatures(loc: (typeof MARKETING_LOCALES)[number], iv: IntervalTab) {
    const entry = draft[loc];
    if (iv === "year") {
      return (entry?.yearly?.features ?? entry?.features ?? []).join("\n");
    }
    return (entry?.monthly?.features ?? entry?.features ?? []).join("\n");
  }

  function bucketName(loc: (typeof MARKETING_LOCALES)[number], iv: IntervalTab) {
    const entry = draft[loc];
    if (iv === "year") {
      return entry?.yearly?.name ?? entry?.name ?? "";
    }
    return entry?.monthly?.name ?? entry?.name ?? "";
  }

  function bucketDescription(loc: (typeof MARKETING_LOCALES)[number], iv: IntervalTab) {
    const entry = draft[loc];
    if (iv === "year") {
      return entry?.yearly?.description ?? entry?.description ?? "";
    }
    return entry?.monthly?.description ?? entry?.description ?? "";
  }

  const [featuresText, setFeaturesText] = useState(() =>
    bucketFeatures("ar", "month"),
  );

  const previewName = (bucketName(locale, interval).trim() || plan.name).trim();
  const previewFeatures = useMemo(() => {
    const list = featuresText
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    return list.length > 0 ? list : enCanonicalFeatures;
  }, [featuresText, enCanonicalFeatures]);

  function flushCurrentIntoDraft(
    nextLocale = locale,
    nextInterval = interval,
  ): PlanTranslations {
    const features = featuresText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const name = bucketName(locale, interval);
    const description = bucketDescription(locale, interval);
    const prev = draft[locale] ?? {};
    const monthly = { ...prev.monthly };
    const yearly = { ...prev.yearly };
    if (interval === "month") {
      monthly.name = name;
      monthly.description = description || null;
      monthly.features = features;
    } else {
      yearly.name = name;
      yearly.description = description || null;
      yearly.features = features;
    }
    const flushed: PlanTranslations = {
      ...draft,
      [locale]: {
        ...prev,
        name: monthly.name ?? prev.name,
        description: monthly.description ?? prev.description,
        features: monthly.features ?? prev.features,
        monthly,
        yearly,
      },
    };
    setDraft(flushed);
    setLocale(nextLocale);
    setInterval(nextInterval);
    setFeaturesText(
      (() => {
        const entry = flushed[nextLocale];
        if (nextInterval === "year") {
          return (entry?.yearly?.features ?? []).join("\n");
        }
        return (entry?.monthly?.features ?? entry?.features ?? []).join("\n");
      })(),
    );
    return flushed;
  }

  function patchCurrent(patch: {
    name?: string;
    description?: string | null;
  }) {
    setDirty(true);
    setDraft((d) => {
      const prev = d[locale] ?? {};
      const monthly = { ...prev.monthly };
      const yearly = { ...prev.yearly };
      if (interval === "month") {
        if (patch.name !== undefined) monthly.name = patch.name;
        if (patch.description !== undefined) monthly.description = patch.description;
      } else {
        if (patch.name !== undefined) yearly.name = patch.name;
        if (patch.description !== undefined) yearly.description = patch.description;
      }
      return {
        ...d,
        [locale]: {
          ...prev,
          name: monthly.name ?? prev.name,
          description: monthly.description ?? prev.description,
          features: monthly.features ?? prev.features,
          monthly,
          yearly,
        },
      };
    });
  }

  const displayName = bucketName(locale, interval);
  const displayDescription = bucketDescription(locale, interval) ?? "";
  const priceLabel =
    interval === "year" && plan.annualPriceCents != null
      ? `$${(plan.annualPriceCents / 100).toFixed(plan.annualPriceCents % 100 === 0 ? 0 : 2)}/year`
      : plan.monthlyPriceCents <= 0
        ? "$0"
        : `$${(plan.monthlyPriceCents / 100).toFixed(plan.monthlyPriceCents % 100 === 0 ? 0 : 2)}/month`;

  return (
    <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
      <div className="grid gap-3 rounded-xl border border-slate-800 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-medium text-white">Languages: {plan.name}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Translate Plan Editor name, description, and entitlement bullets for
              each app language (same locales as the language switcher). English
              stays canonical in Plan Editor.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white"
          >
            Close
          </button>
        </div>

        <div
          className="inline-flex w-fit rounded-xl border border-slate-700 bg-slate-950 p-1"
          role="group"
          aria-label="Billing interval"
        >
          {(["month", "year"] as const).map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => {
                if (iv === interval) return;
                setDirty(true);
                flushCurrentIntoDraft(locale, iv);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                interval === iv
                  ? "bg-emerald-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {iv === "month" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Language">
          {MARKETING_LOCALES.map((loc) => (
            <button
              key={loc}
              type="button"
              role="tab"
              aria-selected={locale === loc}
              onClick={() => {
                if (loc === locale) return;
                flushCurrentIntoDraft(loc, interval);
              }}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                locale === loc
                  ? "border-emerald-600 bg-emerald-900/40 text-emerald-200"
                  : "border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {localeLabels[loc].short} · {localeLabels[loc].native}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-slate-500">
          Editing{" "}
          <span className="text-slate-300">
            {interval === "month" ? "Monthly" : "Yearly"}
          </span>{" "}
          · {localeLabels[locale].native}. EN from Plan Editor:{" "}
          <span className="text-slate-300">
            {plan.name}
            {plan.description ? ` — ${plan.description}` : ""}
          </span>
        </p>

        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-[11px] text-slate-400">
          <p className="font-medium text-slate-300">
            EN entitlement bullets ({interval === "month" ? "month" : "year"})
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {enCanonicalFeatures.length === 0 ? (
              <li>—</li>
            ) : (
              enCanonicalFeatures.map((f) => <li key={f}>{f}</li>)
            )}
          </ul>
          <button
            type="button"
            className="mt-2 text-emerald-400 hover:underline"
            onClick={() => {
              setDirty(true);
              const suggested = suggestLocaleFeatures(enCanonicalFeatures, locale);
              const suggestedName =
                suggestLocalePlanName(plan.slug, locale) || plan.name;
              setFeaturesText(suggested.join("\n"));
              setDraft((d) => {
                const prev = d[locale] ?? {};
                const monthly = { ...prev.monthly };
                const yearly = { ...prev.yearly };
                if (interval === "month") {
                  monthly.name = suggestedName;
                  monthly.description = plan.description;
                  monthly.features = suggested;
                } else {
                  yearly.name = suggestedName;
                  yearly.description = plan.description;
                  yearly.features = suggested;
                }
                return {
                  ...d,
                  [locale]: {
                    ...prev,
                    name: monthly.name ?? prev.name ?? suggestedName,
                    description: monthly.description ?? prev.description,
                    features: monthly.features ?? prev.features,
                    monthly,
                    yearly,
                  },
                };
              });
            }}
          >
            Fill {localeLabels[locale].native} from Plan Editor entitlements
          </button>
        </div>

        <label className="text-xs text-slate-400">
          Name (translation of Plan Editor display name)
          <input
            value={displayName}
            onChange={(e) => patchCurrent({ name: e.target.value })}
            className={`mt-1 w-full ${inputClass}`}
            dir={locale === "ar" ? "rtl" : "ltr"}
            placeholder={plan.name}
          />
        </label>

        <label className="text-xs text-slate-400">
          Description / tagline (translation)
          <textarea
            rows={2}
            value={displayDescription}
            onChange={(e) => patchCurrent({ description: e.target.value })}
            className={`mt-1 w-full ${inputClass}`}
            dir={locale === "ar" ? "rtl" : "ltr"}
            placeholder={plan.description ?? ""}
          />
        </label>

        <label className="text-xs text-slate-400">
          Features (one per line) — translate Plan Editor entitlements for{" "}
          {interval === "month" ? "Monthly" : "Yearly"}
          <textarea
            rows={6}
            value={featuresText}
            onChange={(e) => {
              setDirty(true);
              setFeaturesText(e.target.value);
            }}
            className={`mt-1 w-full ${inputClass}`}
            dir={locale === "ar" ? "rtl" : "ltr"}
            placeholder={enCanonicalFeatures.join("\n")}
          />
        </label>

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const flushed = flushCurrentIntoDraft(locale, interval);
            const cleaned: PlanTranslations = {};
            for (const loc of MARKETING_LOCALES) {
              const entry = flushed[loc] ?? initialDraft[loc];
              if (!entry) continue;
              const monthlyFeatures = (
                entry.monthly?.features ??
                entry.features ??
                initialDraft[loc]?.monthly?.features ??
                suggestLocaleFeatures(enMonthFeatures, loc)
              )
                .map((f) => f.trim())
                .filter(Boolean);
              const yearlyFeatures = (
                entry.yearly?.features ??
                initialDraft[loc]?.yearly?.features ??
                suggestLocaleFeatures(enYearFeatures, loc)
              )
                .map((f) => f.trim())
                .filter(Boolean);
              const monthName =
                entry.monthly?.name?.trim() ||
                entry.name?.trim() ||
                plan.name;
              const yearName =
                entry.yearly?.name?.trim() || monthName;
              cleaned[loc] = {
                name: monthName,
                description:
                  entry.monthly?.description?.trim() ||
                  entry.description?.trim() ||
                  null,
                features: monthlyFeatures,
                monthly: {
                  name: monthName,
                  description:
                    entry.monthly?.description?.trim() ||
                    entry.description?.trim() ||
                    null,
                  features: monthlyFeatures,
                },
                yearly: {
                  name: yearName,
                  description:
                    entry.yearly?.description?.trim() ||
                    entry.monthly?.description?.trim() ||
                    null,
                  features: yearlyFeatures,
                },
              };
            }
            onSave(cleaned);
            setDirty(false);
          }}
          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm disabled:opacity-50"
        >
          {pending ? "Publishing…" : dirty ? "Save & publish live" : "Save languages"}
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Live preview · {interval === "month" ? "Monthly" : "Yearly"} ·{" "}
          {localeLabels[locale].native}
        </p>
        <article
          className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-4"
          dir={locale === "ar" ? "rtl" : "ltr"}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-white">{previewName}</h3>
            <span className="rounded-md border border-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {interval === "month" ? "Monthly" : "Yearly"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {plan.analysesLimit} analyses · {plan.seatsLimit} seats
          </p>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-white">
            {priceLabel}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-300">
            {previewFeatures.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-emerald-400" aria-hidden>
                  ✓
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </article>
        <p className="mt-3 text-xs text-slate-500">
          Switching Monthly/Yearly on /upgrade and /pricing loads this interval&apos;s
          feature list from the database.
        </p>
      </div>
    </div>
  );
}

function PlanEditor({
  initial,
  pending,
  entitlementKeys,
  onClear,
  onSave,
}: {
  initial: AdminPlanRow | null;
  pending: boolean;
  entitlementKeys: string[];
  onClear: () => void;
  onSave: (
    payload: Record<string, unknown>,
    form: HTMLFormElement | null,
  ) => void;
}) {
  const [monthlyEnabled, setMonthlyEnabled] = useState(initial?.monthlyEnabled ?? true);
  const [annualEnabled, setAnnualEnabled] = useState(initial?.annualEnabled ?? true);
  const [preferLabels, setPreferLabels] = useState(
    initial?.preferEntitlementLabels ?? true,
  );
  const [featureKeys, setFeatureKeys] = useState<string[]>(
    () =>
      initial?.featureKeys ?? ["advanced_decision_engine", "company_profile"],
  );
  const [analysesLimit, setAnalysesLimit] = useState(initial?.analysesLimit ?? 3);
  const [seatsLimit, setSeatsLimit] = useState(initial?.seatsLimit ?? 1);
  const [isFree, setIsFree] = useState(initial?.isFree ?? initial?.slug === "free");
  const [visibleToPublic, setVisibleToPublic] = useState(initial?.visibleToPublic ?? true);
  const [stripeEnabled, setStripeEnabled] = useState(initial?.stripeEnabled ?? true);
  const [paypalEnabled, setPaypalEnabled] = useState(initial?.paypalEnabled ?? true);
  const [sourceKey, setSourceKey] = useState(initial?.id ?? "new");
  const nextKey = initial?.id ?? "new";
  if (nextKey !== sourceKey) {
    setSourceKey(nextKey);
    setMonthlyEnabled(initial?.monthlyEnabled ?? true);
    setAnnualEnabled(initial?.annualEnabled ?? true);
    setPreferLabels(initial?.preferEntitlementLabels ?? true);
    setFeatureKeys(
      initial?.featureKeys ?? [
        "advanced_decision_engine",
        "company_profile",
      ],
    );
    setAnalysesLimit(initial?.analysesLimit ?? 3);
    setSeatsLimit(initial?.seatsLimit ?? 1);
    setIsFree(initial?.isFree ?? initial?.slug === "free");
    setVisibleToPublic(initial?.visibleToPublic ?? true);
    setStripeEnabled(initial?.stripeEnabled ?? true);
    setPaypalEnabled(initial?.paypalEnabled ?? true);
  }

  const previewLabels = useMemo(() => {
    const { labels, displayOnly } = buildEntitlementMarketingLabels({
      analysesLimit,
      seatsLimit,
      enabledKeys: featureKeys,
    });
    return { labels, displayOnly };
  }, [analysesLimit, seatsLimit, featureKeys]);

  const catalog = ENTITLEMENT_CATALOG.filter(
    (e) => entitlementKeys.includes(e.key) && !e.hiddenInAdmin,
  );

  return (
    <form
      className="grid max-w-2xl gap-3 rounded-xl border border-slate-800 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const monthlyDollars = String(fd.get("monthlyDollars") ?? "0");
        const annualDollars = String(fd.get("annualDollars") ?? "");
        const yearlyAnalyses = String(fd.get("analysesLimitYearly") ?? "");
        const yearlySeats = String(fd.get("seatsLimitYearly") ?? "");
        onSave(
          {
            id: initial?.id,
            slug: String(fd.get("slug")),
            name: String(fd.get("name")),
            description: String(fd.get("description") || "") || null,
            monthlyPriceCents: dollarsToCents(monthlyDollars),
            annualPriceCents: annualDollars
              ? dollarsToCents(annualDollars)
              : null,
            annualMonths: Number(fd.get("annualMonths") || 12),
            monthlyEnabled,
            annualEnabled,
            analysesLimit: Number(fd.get("analysesLimit") || 0),
            analysesLimitYearly: yearlyAnalyses ? Number(yearlyAnalyses) : null,
            seatsLimit: Number(fd.get("seatsLimit") || 1),
            seatsLimitYearly: yearlySeats ? Number(yearlySeats) : null,
            trialEligible: isFree ? false : fd.get("trialEligible") === "on",
            trialDays: Number(fd.get("trialDays") || 0) || null,
            isFree,
            visibleToPublic,
            stripeEnabled: isFree ? false : stripeEnabled,
            paypalEnabled: isFree ? false : paypalEnabled,
            aiTokensLimit: (() => {
              const raw = String(fd.get("aiTokensLimit") ?? "").trim();
              if (raw === "") return null;
              const n = Number(raw);
              return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
            })(),
            storageMbLimit: (() => {
              const raw = String(fd.get("storageMbLimit") ?? "").trim();
              if (raw === "") return null;
              const n = Number(raw);
              return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
            })(),
            graceDays: (() => {
              const raw = String(fd.get("graceDays") ?? "").trim();
              if (!raw) return null;
              const n = Number(raw);
              return Number.isFinite(n) ? n : null;
            })(),
            currency: String(fd.get("currency") || "usd"),
            sortOrder: Number(fd.get("sortOrder") || 0),
            highlighted: fd.get("highlighted") === "on",
            preferEntitlementLabels: preferLabels,
            status: String(fd.get("status") || "ACTIVE"),
            featureList: String(fd.get("featureList") || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            featureKeys,
            ...(initial?.translations
              ? { translations: initial.translations }
              : {}),
          },
          form,
        );
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-white">
          {initial ? `Edit: ${initial.name}` : "Create plan"}
        </h2>
        {initial ? (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-slate-400 hover:text-white"
          >
            New plan instead
          </button>
        ) : null}
      </div>

      <p className="text-xs text-amber-200/80">
        Entitlements below are enforced by the backend. Display-only lines are
        never used for authorization. Matching Engine stays commercially off.
      </p>

      <div className="rounded-lg border border-slate-700 p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Plan settings
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={isFree}
            onChange={(e) => setIsFree(e.target.checked)}
          />
          Free Workspace (not a paid checkout product)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={visibleToPublic}
            onChange={(e) => setVisibleToPublic(e.target.checked)}
          />
          Visible on public pricing
        </label>
        <div className="flex flex-wrap gap-4 text-sm text-slate-300">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!isFree && stripeEnabled}
              disabled={isFree}
              onChange={(e) => setStripeEnabled(e.target.checked)}
            />
            Stripe checkout
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!isFree && paypalEnabled}
              disabled={isFree}
              onChange={(e) => setPaypalEnabled(e.target.checked)}
            />
            PayPal checkout
          </label>
        </div>
        {isFree ? (
          <p className="text-xs text-slate-500">
            Free Workspace cannot be sold through Stripe or PayPal. Checkout stays blocked.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          name="slug"
          required
          readOnly={Boolean(initial)}
          defaultValue={initial?.slug ?? ""}
          placeholder="slug (starter)"
          className={`${inputClass} ${initial ? "opacity-70" : ""}`}
        />
        <input
          name="name"
          required
          defaultValue={initial?.name ?? ""}
          placeholder="Display name"
          className={inputClass}
        />
      </div>

      <textarea
        name="description"
        rows={2}
        defaultValue={initial?.description ?? ""}
        placeholder="Description"
        className={inputClass}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-400">
          Monthly price (USD)
          <input
            name="monthlyDollars"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={
              initial ? centsToDollars(initial.monthlyPriceCents) : ""
            }
            className={`mt-1 w-full ${inputClass}`}
          />
        </label>
        <label className="text-xs text-slate-400">
          Yearly price (USD)
          <input
            name="annualDollars"
            type="number"
            step="0.01"
            min="0"
            defaultValue={
              initial?.annualPriceCents != null
                ? centsToDollars(initial.annualPriceCents)
                : ""
            }
            className={`mt-1 w-full ${inputClass}`}
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-slate-400">
          Annual months
          <input
            name="annualMonths"
            type="number"
            min={1}
            max={36}
            defaultValue={initial?.annualMonths ?? 12}
            className={`mt-1 w-full ${inputClass}`}
          />
        </label>
        <label className="text-xs text-slate-400">
          Currency
          <input
            name="currency"
            defaultValue={initial?.currency ?? "usd"}
            className={`mt-1 w-full ${inputClass}`}
          />
        </label>
        <label className="text-xs text-slate-400">
          Sort order
          <input
            name="sortOrder"
            type="number"
            defaultValue={initial?.sortOrder ?? 0}
            className={`mt-1 w-full ${inputClass}`}
          />
        </label>
      </div>

      <div className="rounded-lg border border-slate-700 p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Real limits (enforced)
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-400">
            Analyses / month
            <input
              name="analysesLimit"
              type="number"
              min={0}
              required
              value={analysesLimit}
              onChange={(e) => setAnalysesLimit(Number(e.target.value) || 0)}
              className={`mt-1 w-full ${inputClass}`}
            />
          </label>
          <label className="text-xs text-slate-400">
            Analyses / year billing (optional)
            <input
              name="analysesLimitYearly"
              type="number"
              min={0}
              defaultValue={initial?.analysesLimitYearly ?? ""}
              placeholder="same as monthly"
              className={`mt-1 w-full ${inputClass}`}
            />
          </label>
          <label className="text-xs text-slate-400">
            Seats (monthly)
            <input
              name="seatsLimit"
              type="number"
              min={1}
              required
              value={seatsLimit}
              onChange={(e) => setSeatsLimit(Number(e.target.value) || 1)}
              className={`mt-1 w-full ${inputClass}`}
            />
          </label>
          <label className="text-xs text-slate-400">
            Seats / year billing (optional)
            <input
              name="seatsLimitYearly"
              type="number"
              min={1}
              defaultValue={initial?.seatsLimitYearly ?? ""}
              placeholder="same as monthly"
              className={`mt-1 w-full ${inputClass}`}
            />
          </label>
          <label className="text-xs text-slate-400">
            AI token limit (empty = unlimited, 0 = blocked)
            <input
              name="aiTokensLimit"
              type="number"
              min={0}
              defaultValue={initial?.aiTokensLimit ?? ""}
              placeholder="unlimited"
              className={`mt-1 w-full ${inputClass}`}
            />
          </label>
          <label className="text-xs text-slate-400">
            Storage MB (empty = unlimited, 0 = blocked)
            <input
              name="storageMbLimit"
              type="number"
              min={0}
              defaultValue={initial?.storageMbLimit ?? ""}
              placeholder="unlimited"
              className={`mt-1 w-full ${inputClass}`}
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Entitlements (backend gates)
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {catalog.map((def) => (
            <label
              key={def.key}
              className="flex items-start gap-2 text-sm text-slate-200"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={featureKeys.includes(def.key)}
                onChange={(e) => {
                  setFeatureKeys((prev) =>
                    e.target.checked
                      ? [...prev, def.key]
                      : prev.filter((k) => k !== def.key),
                  );
                }}
              />
              <span>
                <span className="font-medium">{def.adminLabel}</span>
                <span className="block text-[11px] text-slate-500">
                  {def.enforced ? "Enforced" : "Catalog flag"} · {def.key}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950/80 p-2 text-xs text-slate-400">
          <p className="font-medium text-slate-300">Paywall bullets (from entitlements)</p>
          <ul className="mt-1 space-y-0.5">
            {previewLabels.labels.map((l) => (
              <li key={l}>✓ {l}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-slate-300">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={monthlyEnabled}
            onChange={(e) => setMonthlyEnabled(e.target.checked)}
          />
          Offer monthly
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={annualEnabled}
            onChange={(e) => setAnnualEnabled(e.target.checked)}
          />
          Offer annual
        </label>
        <label className="flex items-center gap-2">
          <input
            name="trialEligible"
            type="checkbox"
            disabled={isFree}
            defaultChecked={!isFree && (initial?.trialEligible ?? false)}
          />
          Trial eligible
        </label>
        <label className="flex items-center gap-2">
          <input
            name="highlighted"
            type="checkbox"
            defaultChecked={initial?.highlighted ?? false}
          />
          Highlighted
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferLabels}
            onChange={(e) => setPreferLabels(e.target.checked)}
          />
          Prefer entitlement labels on Paywall
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-slate-400">
          Trial days
          <input
            name="trialDays"
            type="number"
            min={0}
            defaultValue={initial?.trialDays ?? ""}
            className={`mt-1 w-full ${inputClass}`}
          />
        </label>
        <label className="text-xs text-slate-400">
          Grace days (payment fail)
          <input
            name="graceDays"
            type="number"
            min={0}
            max={90}
            placeholder="Global default"
            defaultValue={initial?.graceDays ?? ""}
            className={`mt-1 w-full ${inputClass}`}
          />
        </label>
        <label className="text-xs text-slate-400">
          Status
          <select
            name="status"
            defaultValue={initial?.status ?? "ACTIVE"}
            className={`mt-1 w-full ${inputClass}`}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </label>
      </div>

      <label className="text-xs text-slate-400">
        Display-only extras (comma) — NOT entitlements
        <input
          name="featureList"
          defaultValue={initial?.featureList.join(", ") ?? ""}
          placeholder="Optional marketing-only lines"
          className={`mt-1 w-full ${inputClass}`}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-700 px-3 py-2 text-sm disabled:opacity-50"
      >
        {initial ? "Update plan & sync subscribers" : "Create plan"}
      </button>
    </form>
  );
}

