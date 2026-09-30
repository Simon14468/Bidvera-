"use client";

import { BRAND_MARK_SRC } from "@/components/brand/brand-logo";
import { cn } from "@/lib/cn";
import { planQualifiesForPremiumPricingHover } from "@/domain/billing/entitlement-catalog";
import type { PublicBillingPlan } from "@/services/billing/catalog";
import { isPublicCommercialPricingPlan } from "@/services/billing/free-workspace-identity";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatPlanMoney } from "@/i18n/format-money";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type BillingCycle = "monthly" | "yearly";
type PricingCopy = Dictionary["pricing"];

function priceLabel(
  plan: PublicBillingPlan,
  cycle: BillingCycle,
  labels: PricingCopy,
  locale: Locale,
): { amount: string; suffix: string } {
  const money = (cents: number) =>
    formatPlanMoney(cents, plan.currency, locale, plan.currencyLabel);
  if (plan.isFree || plan.slug === "free" || plan.monthlyPriceCents <= 0) {
    return { amount: money(0), suffix: "" };
  }
  if (cycle === "yearly" && plan.annualEnabled && plan.annualPriceCents != null) {
    const perMonth = Math.round(plan.annualPriceCents / Math.max(plan.annualMonths, 1));
    return {
      amount: money(perMonth),
      suffix: labels.perMonthYearly,
    };
  }
  return {
    amount: money(plan.monthlyPriceCents),
    suffix: labels.perMonth,
  };
}

function ctaForPlan(plan: PublicBillingPlan, labels: PricingCopy): {
  href: string;
  label: string;
} {
  if (plan.isFree || plan.slug === "free") {
    return { href: "/signup", label: labels.startFreeWorkspace };
  }
  if (plan.stripeTrialDays) {
    return { href: `/signup?plan=${encodeURIComponent(plan.slug)}`, label: labels.startTrial };
  }
  return { href: `/signup?plan=${encodeURIComponent(plan.slug)}`, label: labels.startSubscription };
}

function PlanMark({ name }: { name: string }) {
  return (
    <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
      <Image
        src={BRAND_MARK_SRC}
        alt=""
        width={28}
        height={28}
        unoptimized
        className="object-contain"
        aria-hidden
      />
      {name}
    </h2>
  );
}

export function PricingGrid({
  plans,
  labels,
  locale = "en",
}: {
  plans: PublicBillingPlan[];
  labels: PricingCopy;
  locale?: Locale;
}) {
  const commercialPlans = plans.filter(isPublicCommercialPricingPlan);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const yearlyAvailable = commercialPlans.some(
    (p) => p.annualEnabled && p.annualPriceCents != null && p.annualPriceCents > 0,
  );

  return (
    <div>
      {yearlyAvailable ? (
        <div className="flex justify-center">
          <div
            className="inline-flex rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-soft)]"
            role="group"
            aria-label={labels.monthly}
          >
            {(["monthly", "yearly"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={cn(
                  "rounded-[10px] px-4 py-2 text-sm font-medium transition-colors",
                  cycle === c
                    ? "bg-primary text-white shadow-[var(--shadow-soft)]"
                    : "text-muted hover:text-foreground",
                )}
                aria-pressed={cycle === c}
              >
                {c === "monthly" ? labels.monthly : labels.yearly}
                {c === "yearly" ? (
                  <span
                    className={cn(
                      "ms-2 text-xs font-semibold",
                      cycle === "yearly" ? "text-white/90" : "text-primary",
                    )}
                  >
                    {labels.save}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "mt-10 grid gap-4 sm:grid-cols-2",
          commercialPlans.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        {commercialPlans.map((plan, i) => {
          const price = priceLabel(plan, cycle, labels, locale);
          const marketing = cycle === "yearly" ? plan.copy.year : plan.copy.month;
          const cta = ctaForPlan(plan, labels);
          const isFree = plan.isFree || plan.slug === "free";
          const usageLine = isFree
            ? labels.freeLimitedNote
            : labels.seatsOnly.replace("{seats}", String(plan.seatsLimit));
          // Glass hover: full commercial modules (Pro suite) or admin Recommended.
          const premiumHover =
            plan.highlighted ||
            planQualifiesForPremiumPricingHover({
              enabledKeys: plan.enabledFeatureKeys,
              slug: plan.slug,
            });
          return (
            <article
              id={plan.slug}
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)] animate-fade-up",
                premiumHover ? "pricing-card-premium-hover" : null,
                plan.highlighted
                  ? "border-emerald-500/40 ring-1 ring-emerald-500/20 lg:scale-[1.02]"
                  : "border-border",
              )}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {plan.highlighted ? (
                <span className="absolute -top-2.5 start-5 rounded-lg bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
                  {labels.recommended}
                </span>
              ) : null}
              <PlanMark name={marketing.name} />
              {isFree ? (
                <p className="mt-3 text-sm font-medium text-foreground">{labels.freeHeadline}</p>
              ) : plan.highlighted ? (
                <p className="mt-3 text-sm text-muted">{labels.mostPopular}</p>
              ) : null}
              <p className="mt-3 text-sm text-muted">{usageLine}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">
                  {price.amount}
                </span>
                {price.suffix ? (
                  <span className="text-sm font-normal text-muted">{price.suffix}</span>
                ) : null}
              </p>
              {plan.stripeTrialDays ? (
                <div className="mt-3 space-y-1 text-xs leading-relaxed text-muted">
                  <p className="font-semibold text-foreground">{labels.trialBadge}</p>
                  <p>{labels.noChargeToday}</p>
                  <p>{labels.paymentMethodRequired}</p>
                  <p>{labels.cancelBeforeTrial}</p>
                </div>
              ) : null}
              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-muted">
                {marketing.featureList.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-0.5 text-primary" aria-hidden>
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={cta.href}
                className={cn(
                  "mt-6 inline-flex h-10 w-full items-center justify-center rounded-xl text-sm font-medium transition active:scale-[0.98]",
                  plan.highlighted
                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                    : "border border-border hover:bg-background",
                )}
              >
                {cta.label}
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
