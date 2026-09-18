import { BRAND_MARK_SRC } from "@/components/brand/brand-logo";
import { PricingGrid } from "@/components/marketing/pricing-grid";
import {
  PRICING_FEATURE_GROUPS,
  planHasFeature,
} from "@/components/marketing/pricing-feature-groups";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { listPublicPricingPlans } from "@/services/billing/catalog";
import { buildPageMetadata } from "@/seo/metadata";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return buildPageMetadata({
    path: "/pricing",
    title: t.pricing.title,
    description: t.pricing.body,
  });
}

export default async function PricingPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const p = t.pricing;
  const plans = await listPublicPricingPlans(locale);

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl text-center animate-fade-up">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
          {p.eyebrow}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{p.title}</h1>
        <p className="mt-4 text-lg text-muted">{p.body}</p>
      </div>

      <div className="mt-10">
        <PricingGrid plans={plans} labels={p} />
      </div>

      <p className="mt-6 text-center text-sm text-muted">{p.yearlyNote}</p>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {[
          { title: p.valueTitle1, body: p.valueBody1 },
          { title: p.valueTitle2, body: p.valueBody2 },
          { title: p.valueTitle3, body: p.valueBody3 },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
          >
            <h2 className="font-semibold text-foreground">{item.title}</h2>
            <p className="mt-2 text-sm text-muted">{item.body}</p>
          </div>
        ))}
      </div>

      {plans.length > 0 ? (
        <section className="mt-16">
          <h2 className="text-center text-xl font-semibold tracking-tight">
            {p.comparisonTitle}
          </h2>
          <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="px-4 py-3 font-semibold text-muted">{p.comparisonFeature}</th>
                  {plans.map((plan) => (
                    <th
                      key={plan.id}
                      className={`px-4 py-3 font-semibold ${plan.highlighted ? "text-primary" : "text-foreground"}`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Image
                          src={BRAND_MARK_SRC}
                          alt=""
                          width={20}
                          height={20}
                          className="object-contain"
                          aria-hidden
                        />
                        {plan.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRICING_FEATURE_GROUPS.map((group) => {
                  const visibleKeys = group.keys.filter((key) =>
                    plans.some((plan) => planHasFeature(plan.enabledFeatureKeys, key)),
                  );
                  if (visibleKeys.length === 0) return null;
                  return (
                    <Fragment key={group.id}>
                      <tr className="border-b border-border bg-background/70">
                        <td
                          className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted"
                          colSpan={plans.length + 1}
                        >
                          {p.groups[group.id]}
                        </td>
                      </tr>
                      {visibleKeys.map((key) => (
                        <tr key={key} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 text-muted">{p.features[key]}</td>
                          {plans.map((plan) => (
                            <td key={`${plan.id}-${key}`} className="px-4 py-3">
                              {planHasFeature(plan.enabledFeatureKeys, key) ? (
                                <span className="text-primary" aria-hidden>
                                  ✓
                                </span>
                              ) : (
                                <span className="text-muted" aria-hidden>
                                  —
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mt-16 max-w-3xl mx-auto">
        <h2 className="text-center text-xl font-semibold tracking-tight">{t.faq.title}</h2>
        <div className="mt-6 divide-y divide-border border-y border-border">
          {t.faq.items.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <span className="flex justify-between gap-4">
                  {item.q}
                  <span className="text-muted transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-16 rounded-xl border border-border bg-ink px-6 py-10 text-center text-white sm:px-10">
        <h2 className="text-2xl font-semibold tracking-tight">{p.ctaTitle}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-white/70">{p.ctaBody}</p>
        <Link
          href="/signup"
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-6 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {p.startFreeWorkspace}
        </Link>
      </div>
    </div>
  );
}
