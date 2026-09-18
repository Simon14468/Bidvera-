"use client";

import { activateFreeOrTrialPlan, startCheckoutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TurnstileField } from "@/components/security/turnstile-field";
import type { PublicBillingPlan } from "@/services/billing/catalog";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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

function resolveCheckoutGateway(
  plan: PublicBillingPlan,
  defaultGateway: "stripe" | "paypal",
): "stripe" | "paypal" | null {
  if (plan.gateways.includes(defaultGateway)) return defaultGateway;
  return plan.gateways[0] ?? null;
}

function yearlyAmount(plan: PublicBillingPlan): number | null {
  if (!plan.annualEnabled || plan.annualPriceCents == null || plan.annualPriceCents <= 0) {
    return null;
  }
  return plan.annualPriceCents;
}

export function OnboardingPlanPicker({
  plans,
  defaultGateway,
  copy,
  turnstileSiteKey,
}: {
  plans: PublicBillingPlan[];
  defaultGateway: "stripe" | "paypal";
  turnstileSiteKey?: string | null;
  copy: {
    title: string;
    body: string;
    trialTitle: string;
    trialBody: string;
    trialCta: string;
    paidCta: string;
    freeTitle: string;
    freeBody: string;
    freeCta: string;
    noChargeToday: string;
    paymentMethodRequired: string;
    cancelBeforeTrial: string;
    monthly: string;
    yearly: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<"MONTH" | "YEAR">("MONTH");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  const freePlans = useMemo(
    () => plans.filter((p) => p.isFree || p.slug === "free"),
    [plans],
  );
  const paidPlans = useMemo(
    () =>
      plans.filter(
        (p) =>
          !p.isFree &&
          p.slug !== "free" &&
          p.slug !== "trial" &&
          (p.monthlyEnabled || p.annualEnabled) &&
          p.gateways.length > 0,
      ),
    [plans],
  );
  const yearlyAvailable = paidPlans.some((p) => yearlyAmount(p) != null);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted">{copy.body}</p>
      </div>

      {error ? <p className="text-center text-sm text-danger">{error}</p> : null}

      <TurnstileField
        siteKey={turnstileSiteKey}
        action="checkout"
        onToken={setTurnstileToken}
        resetKey={turnstileReset}
      />

      {freePlans.map((plan) => (
        <Card key={plan.id} className="border-border shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle>{copy.freeTitle}</CardTitle>
            <CardDescription>{copy.freeBody}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              loading={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await activateFreeOrTrialPlan({
                    kind: "free",
                    turnstileToken: turnstileToken || undefined,
                  });
                  if (!result.ok) {
                    setError(result.error.message);
                    return;
                  }
                  router.push(result.data.redirectTo);
                  router.refresh();
                });
              }}
            >
              {copy.freeCta}
            </Button>
          </CardContent>
        </Card>
      ))}

      {yearlyAvailable ? (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => setInterval("MONTH")}
            className={`h-9 rounded-xl px-4 text-sm font-medium ${
              interval === "MONTH" ? "bg-primary text-white" : "border border-border"
            }`}
          >
            {copy.monthly}
          </button>
          <button
            type="button"
            onClick={() => setInterval("YEAR")}
            className={`h-9 rounded-xl px-4 text-sm font-medium ${
              interval === "YEAR" ? "bg-primary text-white" : "border border-border"
            }`}
          >
            {copy.yearly}
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {paidPlans.map((plan) => {
          const yearPrice = yearlyAmount(plan);
          const usingYear = interval === "YEAR" && yearPrice != null;
          const price = usingYear ? yearPrice : plan.monthlyPriceCents;
          const gateway = resolveCheckoutGateway(plan, defaultGateway);
          const showStripeTrial = Boolean(plan.stripeTrialDays) && gateway === "stripe";
          const checkoutBlocked = interval === "YEAR" && yearPrice == null;
          return (
            <Card
              key={plan.id}
              className={plan.highlighted ? "border-primary/30 shadow-[var(--shadow-lift)]" : undefined}
            >
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  {formatMoney(price, plan.currency)}
                  {usingYear ? " / yr" : " / mo"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {showStripeTrial ? (
                  <div className="space-y-1 text-xs leading-relaxed text-muted">
                    <p className="font-semibold text-foreground">{copy.trialTitle}</p>
                    <p>{copy.noChargeToday}</p>
                    <p>{copy.paymentMethodRequired}</p>
                    <p>{copy.cancelBeforeTrial}</p>
                  </div>
                ) : null}
                <Button
                  className="w-full"
                  disabled={!gateway || pending || checkoutBlocked}
                  loading={pending}
                  onClick={() => {
                    if (!gateway || checkoutBlocked) return;
                    setError(null);
                    startTransition(async () => {
                      const result = await startCheckoutAction({
                        planId: plan.id,
                        gateway,
                        interval: usingYear ? "YEAR" : "MONTH",
                        returnPath: "/onboarding/plan",
                        turnstileToken: turnstileToken || undefined,
                      });
                      if (!result.ok) {
                        setError(result.error.message);
                        setTurnstileReset((n) => n + 1);
                        return;
                      }
                      window.location.href = result.data.url;
                    });
                  }}
                >
                  {showStripeTrial ? copy.trialCta : copy.paidCta}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
