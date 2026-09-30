"use client";

import { startCheckoutAction } from "@/app/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TurnstileField } from "@/components/security/turnstile-field";
import type { PublicBillingPlan } from "@/services/billing/catalog";
import { resolvePaidPlanCtaKind } from "@/services/billing/plan-cta";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatPlanMoney } from "@/i18n/format-money";
import { BRAND_MARK_SRC } from "@/components/brand/brand-logo";
import { cn } from "@/lib/cn";
import Image from "next/image";
import { useMemo, useState, useTransition } from "react";

type PricingCopy = Dictionary["pricing"];

interface PaywallProps {
  plans: PublicBillingPlan[];
  defaultGateway: "stripe" | "paypal";
  locale?: Locale;
  pricingLabels: PricingCopy;
  turnstileSiteKey?: string | null;
  /** Active billing plan for this company — freezes that card as Activated. */
  currentPlanId?: string | null;
  currentPlanSlug?: string | null;
  currentMonthlyPriceCents?: number | null;
  /** True when the workspace is on a live paid plan (not free/trial surface). */
  hasActivePaidPlan?: boolean;
}

export function Paywall({
  plans,
  defaultGateway,
  locale = "en",
  pricingLabels,
  turnstileSiteKey,
  currentPlanId = null,
  currentPlanSlug = null,
  currentMonthlyPriceCents = null,
  hasActivePaidPlan = false,
}: PaywallProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [interval, setInterval] = useState<"MONTH" | "YEAR">("MONTH");
  const [gatewayByPlan, setGatewayByPlan] = useState<Record<string, "stripe" | "paypal">>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  const visiblePlans = useMemo(() => plans.filter((p) => p.gateways.length > 0), [plans]);
  const yearlyAvailable = useMemo(
    () => visiblePlans.some((p) => p.annualEnabled && p.annualPriceCents != null),
    [visiblePlans],
  );

  function checkout(plan: PublicBillingPlan) {
    setError(null);
    const gateway =
      gatewayByPlan[plan.id] ??
      (plan.gateways.includes(defaultGateway) ? defaultGateway : plan.gateways[0]!);

    if (interval === "YEAR" && !plan.annualEnabled) {
      setError("Annual billing is not available for this plan.");
      return;
    }
    if (interval === "MONTH" && !plan.monthlyEnabled) {
      setError("Monthly billing is not available for this plan.");
      return;
    }

    startTransition(async () => {
      const result = await startCheckoutAction({
        planId: plan.id,
        gateway,
        interval,
        turnstileToken: turnstileToken || undefined,
      });
      if (!result.ok) {
        setError(result.error.message);
        setTurnstileReset((n) => n + 1);
        return;
      }
      window.location.href = result.data.url;
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-in">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {pricingLabels.upgrade}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {pricingLabels.title}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted sm:text-base">
          {pricingLabels.body}
        </p>
      </div>

      {yearlyAvailable ? (
        <div className="flex justify-center">
          <div
            className="inline-flex max-w-full flex-wrap justify-center rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-soft)]"
            role="group"
            aria-label={pricingLabels.monthly}
          >
            {(
              [
                { key: "MONTH" as const, label: pricingLabels.monthly },
                { key: "YEAR" as const, label: pricingLabels.yearly },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setInterval(opt.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-medium transition-colors",
                  interval === opt.key
                    ? "bg-primary text-white shadow-[var(--shadow-soft)]"
                    : "text-muted hover:text-foreground",
                )}
                aria-pressed={interval === opt.key}
              >
                <span className="whitespace-nowrap">{opt.label}</span>
                {opt.key === "YEAR" ? (
                  <span
                    className={cn(
                      "whitespace-nowrap text-xs font-semibold",
                      interval === "YEAR" ? "text-white/90" : "text-primary",
                    )}
                  >
                    {pricingLabels.save}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-center text-sm text-danger">{error}</p> : null}

      <TurnstileField
        siteKey={turnstileSiteKey}
        action="checkout"
        onToken={setTurnstileToken}
        resetKey={turnstileReset}
      />

      {visiblePlans.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted">
            No paid plans are available right now. Contact support or try again later.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {visiblePlans.map((plan) => {
            const marketing =
              interval === "YEAR" ? plan.copy.year : plan.copy.month;
            const price =
              interval === "YEAR" && plan.annualPriceCents != null
                ? plan.annualPriceCents
                : plan.monthlyPriceCents;
            const selectedGateway =
              gatewayByPlan[plan.id] ??
              (plan.gateways.includes(defaultGateway) ? defaultGateway : plan.gateways[0]!);
            const intervalOk =
              interval === "YEAR"
                ? plan.annualEnabled && plan.annualPriceCents != null
                : plan.monthlyEnabled;
            const ctaKind = resolvePaidPlanCtaKind({
              plan,
              currentPlanId,
              currentPlanSlug,
              currentMonthlyPriceCents,
              hasActivePaidPlan,
            });
            const isCurrentPlan = ctaKind === "activated";
            const periodSuffix =
              interval === "YEAR"
                ? pricingLabels.perMonthYearly
                : pricingLabels.perMonth;
            const seatsLine = pricingLabels.seatsOnly.replace(
              "{seats}",
              String(plan.seatsLimit),
            );
            const description = marketing.description?.trim() || seatsLine;
            const ctaLabel =
              ctaKind === "activated"
                ? pricingLabels.activated
                : ctaKind === "upgrade"
                  ? pricingLabels.upgrade
                  : pricingLabels.getPlan;

            return (
              <Card
                key={plan.id}
                className={
                  plan.highlighted || isCurrentPlan
                    ? "relative border-primary ring-1 ring-primary/30"
                    : undefined
                }
              >
                {plan.highlighted && !isCurrentPlan ? (
                  <span className="absolute -top-2.5 start-5 rounded-lg bg-primary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                    {pricingLabels.recommended}
                  </span>
                ) : null}
                {isCurrentPlan ? (
                  <span className="absolute -top-2.5 start-5 rounded-lg bg-foreground/90 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-background">
                    {pricingLabels.currentPlan}
                  </span>
                ) : null}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2.5">
                    <Image
                      src={BRAND_MARK_SRC}
                      alt=""
                      width={28}
                      height={28}
                      unoptimized
                      className="object-contain"
                      aria-hidden
                    />
                    {marketing.name}
                  </CardTitle>
                  <CardDescription>{description}</CardDescription>
                  <p className="pt-2 text-3xl font-semibold tracking-tight tabular-nums">
                    {formatPlanMoney(
                      price,
                      plan.currency,
                      locale,
                      plan.currencyLabel,
                    )}
                    <span className="ms-2 text-base font-normal text-muted">
                      {periodSuffix}
                    </span>
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm text-muted">
                    {marketing.featureList.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-primary">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrentPlan || plan.gateways.length <= 1 ? null : (
                    <div className="flex gap-2">
                      {plan.gateways.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() =>
                            setGatewayByPlan((prev) => ({
                              ...prev,
                              [plan.id]: g,
                            }))
                          }
                          className={`h-9 flex-1 rounded-lg text-xs font-medium capitalize ${
                            selectedGateway === g
                              ? "bg-ink text-white"
                              : "border border-border bg-card"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={pending || !intervalOk || isCurrentPlan}
                    aria-busy={pending}
                    aria-disabled={isCurrentPlan || undefined}
                    onClick={() => {
                      if (isCurrentPlan) return;
                      checkout(plan);
                    }}
                    className={`inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                      isCurrentPlan
                        ? "border border-border bg-foreground/[0.04] text-muted"
                        : plan.highlighted || ctaKind === "upgrade"
                          ? "bg-primary text-white hover:bg-primary-hover shadow-[var(--shadow-soft)]"
                          : "border border-border bg-card text-foreground hover:bg-background"
                    }`}
                  >
                    {isCurrentPlan
                      ? pricingLabels.activated
                      : pending
                        ? "…"
                        : !intervalOk
                          ? "—"
                          : ctaLabel}
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
