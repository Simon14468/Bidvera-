"use client";

import { startCheckoutAction } from "@/app/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TurnstileField } from "@/components/security/turnstile-field";
import type { PublicBillingPlan } from "@/services/billing/catalog";
import type { PaywallRecap } from "@/domain/types";
import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { BRAND_MARK_SRC } from "@/components/brand/brand-logo";

interface PaywallProps {
  recap: PaywallRecap;
  plans: PublicBillingPlan[];
  defaultGateway: "stripe" | "paypal";
  turnstileSiteKey?: string | null;
  decisionLabels?: {
    bid: string;
    review: string;
    noBid: string;
    tendersAnalyzed: string;
  };
}

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(0)}`;
  }
}

export function Paywall({
  recap,
  plans,
  defaultGateway,
  turnstileSiteKey,
  decisionLabels,
}: PaywallProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [interval, setInterval] = useState<"MONTH" | "YEAR">("MONTH");
  const [gatewayByPlan, setGatewayByPlan] = useState<Record<string, "stripe" | "paypal">>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  const visiblePlans = useMemo(() => plans.filter((p) => p.gateways.length > 0), [plans]);

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
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Upgrade</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Choose a plan and pay securely
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted sm:text-base">
          Only payment methods enabled by Bidvera appear here. Prices are verified server-side —
          your browser cannot change them.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setInterval("MONTH")}
          className={`h-10 rounded-xl px-4 text-sm font-medium ${
            interval === "MONTH"
              ? "bg-primary text-white"
              : "border border-border bg-card text-foreground"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setInterval("YEAR")}
          className={`h-10 rounded-xl px-4 text-sm font-medium ${
            interval === "YEAR"
              ? "bg-primary text-white"
              : "border border-border bg-card text-foreground"
          }`}
        >
          Yearly
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: decisionLabels?.tendersAnalyzed ?? "Tenders analyzed",
            value: recap.tendersAnalyzed,
          },
          {
            label: decisionLabels
              ? `${decisionLabels.bid}`
              : "BID decisions",
            value: recap.bidCount,
            tone: "text-success",
          },
          {
            label: decisionLabels
              ? `${decisionLabels.review}`
              : "REVIEW decisions",
            value: recap.reviewCount,
            tone: "text-warning",
          },
          {
            label: decisionLabels
              ? `${decisionLabels.noBid}`
              : "NO-BID decisions",
            value: recap.noBidCount,
            tone: "text-danger",
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-5">
              <p className={`text-2xl font-semibold tabular-nums ${item.tone ?? ""}`}>
                {item.value}
              </p>
              <p className="mt-1 text-sm text-muted">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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
              interval === "YEAR" ? plan.annualEnabled && plan.annualPriceCents != null : plan.monthlyEnabled;

            return (
              <Card
                key={plan.id}
                className={
                  plan.highlighted ? "relative border-primary ring-1 ring-primary/30" : undefined
                }
              >
                {plan.highlighted ? (
                  <span className="absolute -top-2.5 start-5 rounded-lg bg-primary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                    Recommended
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
                  <CardDescription>
                    {plan.analysesLimit} analyses · {plan.seatsLimit} seats
                  </CardDescription>
                  <p className="pt-2 text-3xl font-semibold tracking-tight tabular-nums">
                    {formatMoney(price, plan.currency)}
                    <span className="text-base font-normal text-muted">
                      /{interval === "YEAR" ? "year" : "month"}
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

                  {plan.gateways.length > 1 ? (
                    <div className="flex gap-2">
                      {plan.gateways.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() =>
                            setGatewayByPlan((prev) => ({ ...prev, [plan.id]: g }))
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
                  ) : (
                    <p className="text-center text-xs capitalize text-muted">
                      Pay with {plan.gateways[0]}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={pending || !intervalOk}
                    onClick={() => checkout(plan)}
                    className={`inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium transition active:scale-[0.98] disabled:opacity-60 ${
                      plan.highlighted
                        ? "bg-primary text-white hover:bg-primary-hover shadow-[var(--shadow-soft)]"
                        : "border border-border bg-card text-foreground hover:bg-background"
                    }`}
                  >
                    {pending
                      ? "Redirecting…"
                      : !intervalOk
                        ? "Interval unavailable"
                        : `Continue with ${selectedGateway}`}
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
