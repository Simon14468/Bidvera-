"use client";

import { BRAND_MARK_SRC } from "@/components/brand/brand-logo";
import { cn } from "@/lib/cn";
import { planQualifiesForPremiumPricingHover } from "@/domain/billing/entitlement-catalog";
import type { PublicBillingPlan } from "@/services/billing/catalog";
import { isPublicCommercialPricingPlan } from "@/services/billing/free-workspace-identity";
import { resolvePaidPlanCtaKind } from "@/services/billing/plan-cta";
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

function ctaForPlan(
  plan: PublicBillingPlan,
  labels: PricingCopy,
  opts: {
    signedIn: boolean;
    ctaKind: "activated" | "upgrade" | "get_plan";
  },
): { href: string | null; label: string; disabled: boolean } {
  if (opts.ctaKind === "activated") {
    return { href: null, label: labels.activated, disabled: true };
  }
  if (plan.isFree || plan.slug === "free") {
    return {
      href: opts.signedIn ? "/upgrade" : "/signup",
      label: labels.startFreeWorkspace,
      disabled: false,
    };
  }
  const label =
    opts.ctaKind === "upgrade" ? labels.upgrade : labels.getPlan;
  if (opts.signedIn) {
    return { href: "/upgrade", label, disabled: false };
  }
  if (plan.stripeTrialDays && opts.ctaKind !== "upgrade") {
    return {
      href: `/signup?plan=${encodeURIComponent(plan.slug)}`,
      label: labels.startTrial,
      disabled: false,
    };
  }
  return {
    href: `/signup?plan=${encodeURIComponent(plan.slug)}`,
    label,
    disabled: false,
  };
}

/** Symbol-prefixed amounts ($49) stay LTR; word labels (13 دولار) follow the page. */
function amountDirection(amount: string): "ltr" | "auto" {
  return /^[0-9\u0660-\u0669]/.test(amount.trim()) ? "auto" : "ltr";
}

function FeatureCheck() {
  return (
    <svg className="pricing-card__check" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13.2 4.3a.75.75 0 0 1 0 1.06l-6.1 6.1a.75.75 0 0 1-1.06 0L2.8 8.22a.75.75 0 1 1 1.06-1.06l2.71 2.71 5.57-5.57a.75.75 0 0 1 1.06 0Z"
      />
    </svg>
  );
}

function PlanMark({ name }: { name: string }) {
  return (
    <h2 className="pricing-card__name">
      <Image
        src={BRAND_MARK_SRC}
        alt=""
        width={28}
        height={28}
        unoptimized
        className="pricing-card__mark"
        aria-hidden
      />
      <span>{name}</span>
    </h2>
  );
}

export function PricingGrid({
  plans,
  labels,
  locale = "en",
  signedIn = false,
  currentPlanId = null,
  currentPlanSlug = null,
  currentMonthlyPriceCents = null,
  hasActivePaidPlan = false,
}: {
  plans: PublicBillingPlan[];
  labels: PricingCopy;
  locale?: Locale;
  signedIn?: boolean;
  currentPlanId?: string | null;
  currentPlanSlug?: string | null;
  currentMonthlyPriceCents?: number | null;
  hasActivePaidPlan?: boolean;
}) {
  const commercialPlans = plans.filter(isPublicCommercialPricingPlan);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const yearlyAvailable = commercialPlans.some(
    (p) => p.annualEnabled && p.annualPriceCents != null && p.annualPriceCents > 0,
  );
  const showLede = commercialPlans.some((plan) => {
    const marketing = cycle === "yearly" ? plan.copy.year : plan.copy.month;
    return Boolean(marketing.description?.trim());
  });
  const showKickerRow = commercialPlans.some(
    (plan) => plan.highlighted || plan.isFree || plan.slug === "free",
  );
  const columnClass =
    commercialPlans.length >= 4
      ? "lg:grid-cols-4"
      : commercialPlans.length === 3
        ? "lg:grid-cols-3"
        : commercialPlans.length === 2
          ? "mx-auto w-full max-w-4xl lg:grid-cols-2"
          : "mx-auto w-full max-w-md sm:grid-cols-1";

  return (
    <div>
      {yearlyAvailable ? (
        <div className="flex justify-center">
          <div
            className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-soft)]"
            role="group"
            aria-label={labels.monthly}
          >
            {(["monthly", "yearly"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-medium transition-colors",
                  cycle === c
                    ? "bg-primary text-white shadow-[var(--shadow-soft)]"
                    : "text-muted hover:text-foreground",
                )}
                aria-pressed={cycle === c}
              >
                <span className="whitespace-nowrap">
                  {c === "monthly" ? labels.monthly : labels.yearly}
                </span>
                {c === "yearly" ? (
                  <span
                    className={cn(
                      "whitespace-nowrap text-xs font-semibold",
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
          "mt-8 grid grid-cols-1 items-stretch gap-5 pt-3 sm:grid-cols-2 sm:gap-4 lg:gap-5",
          columnClass,
        )}
      >
        {commercialPlans.map((plan, i) => {
          const price = priceLabel(plan, cycle, labels, locale);
          const marketing = cycle === "yearly" ? plan.copy.year : plan.copy.month;
          const isCurrentPlan =
            Boolean(currentPlanId && plan.id === currentPlanId) ||
            Boolean(
              currentPlanSlug &&
                plan.slug.toLowerCase() === currentPlanSlug.toLowerCase(),
            );
          const ctaKind = resolvePaidPlanCtaKind({
            plan,
            currentPlanId,
            currentPlanSlug,
            currentMonthlyPriceCents,
            hasActivePaidPlan,
          });
          const cta = ctaForPlan(plan, labels, {
            signedIn,
            ctaKind,
          });
          const isFree = plan.isFree || plan.slug === "free";
          const usageLine = isFree
            ? labels.freeLimitedNote
            : labels.seatsOnly.replace("{seats}", String(plan.seatsLimit));
          const lede = marketing.description?.trim() || "";
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
                "pricing-card animate-fade-up",
                premiumHover ? "pricing-card-premium-hover" : null,
                plan.highlighted || isCurrentPlan ? "pricing-card--highlighted" : null,
              )}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {isCurrentPlan ? (
                <span className="pricing-card__badge">{labels.currentPlan}</span>
              ) : plan.highlighted ? (
                <span className="pricing-card__badge">{labels.recommended}</span>
              ) : null}
              <header className="pricing-card__header">
                <PlanMark name={marketing.name} />
                {showLede ? <p className="pricing-card__lede">{lede || "\u00a0"}</p> : null}
                {showKickerRow ? (
                  <p className="pricing-card__kicker">
                    {plan.highlighted
                      ? labels.mostPopular
                      : isFree
                        ? labels.freeHeadline
                        : "\u00a0"}
                  </p>
                ) : null}
                <p className="pricing-card__limits">{usageLine}</p>
              </header>
              <p className="pricing-card__price">
                <span
                  className="pricing-card__price-cluster"
                  dir={amountDirection(price.amount) === "ltr" ? "ltr" : locale === "ar" ? "rtl" : "ltr"}
                >
                  <span className="pricing-card__amount" dir={amountDirection(price.amount)}>
                    {price.amount}
                  </span>
                  {price.suffix ? (
                    <span className="pricing-card__period" dir="ltr">
                      {price.suffix}
                    </span>
                  ) : null}
                </span>
              </p>
              {plan.stripeTrialDays ? (
                <div className="pricing-card__trial">
                  <p className="pricing-card__trial-title">{labels.trialBadge}</p>
                  <p>{labels.noChargeToday}</p>
                  <p>{labels.paymentMethodRequired}</p>
                  <p>{labels.cancelBeforeTrial}</p>
                </div>
              ) : null}
              <ul className="pricing-card__features">
                {marketing.featureList.map((f) => (
                  <li key={f}>
                    <FeatureCheck />
                    <span className="pricing-card__feature-text">{f}</span>
                  </li>
                ))}
              </ul>
              {cta.disabled || !cta.href ? (
                <span
                  className={cn("pricing-card__cta", "pricing-card__cta--frozen")}
                  aria-disabled="true"
                >
                  {cta.label}
                </span>
              ) : (
                <Link
                  href={cta.href}
                  className={cn(
                    "pricing-card__cta",
                    plan.highlighted || ctaKind === "upgrade"
                      ? "pricing-card__cta--solid"
                      : "pricing-card__cta--quiet",
                  )}
                >
                  {cta.label}
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
