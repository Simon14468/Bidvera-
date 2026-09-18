"use client";

import { useState, useTransition } from "react";
import type { MatchingSponsorshipPricingPlanDto } from "@/modules/matching-engine";
import { cn } from "@/lib/cn";

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function periodLabel(period: string) {
  switch (period) {
    case "THREE_DAYS":
      return "3 days";
    case "MONTHLY":
      return "Monthly";
    case "QUARTERLY":
      return "Quarterly";
    case "YEARLY":
      return "Yearly";
    default:
      return "One-time";
  }
}

export function SponsoredMatchingRequestClient({
  plans,
}: {
  plans: MatchingSponsorshipPricingPlanDto[];
}) {
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    plans[0]?.id ?? null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = plans.find((p) => p.id === selectedId) ?? null;

  if (plans.length === 0) {
    return (
      <div className="rounded-[12px] border border-border bg-card p-5">
        <p className="text-sm font-medium">No sponsored plans available</p>
        <p className="mt-1 text-sm text-muted">
          Active Sponsored Matching plans will appear here when Super Admin
          publishes them.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", pending && "opacity-80")}>
      <ul className="space-y-3">
        {plans.map((plan) => {
          const active = plan.id === selectedId;
          return (
            <li key={plan.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(plan.id);
                  setMessage(null);
                  setError(null);
                }}
                className={cn(
                  "w-full rounded-[12px] border bg-card p-4 text-left transition",
                  active
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{plan.name}</p>
                  <p className="text-sm font-medium text-primary">
                    {formatMoney(plan.priceCents, plan.currency)}
                    <span className="ml-1 text-xs font-normal text-muted">
                      / {periodLabel(plan.billingPeriod)}
                    </span>
                  </p>
                </div>
                {plan.description ? (
                  <p className="mt-1 text-sm text-muted">{plan.description}</p>
                ) : null}
                <p className="mt-2 text-xs text-muted">
                  {plan.campaignDurationDays
                    ? `${plan.campaignDurationDays}-day campaign`
                    : "Campaign duration set by admin"}
                  {plan.maxCampaigns != null
                    ? ` · up to ${plan.maxCampaigns} campaigns`
                    : ""}
                  {plan.maxImpressions != null
                    ? ` · up to ${plan.maxImpressions.toLocaleString()} impressions`
                    : ""}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <div className="rounded-[12px] border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Confirm request</h2>
          <p className="mt-1 text-sm text-muted">
            This submits a Sponsored Matching request / order intent. Payment is
            not processed here. Sponsorship never bypasses matching relevance.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Plan</dt>
              <dd className="font-medium">{selected.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Price</dt>
              <dd className="font-medium">
                {formatMoney(selected.priceCents, selected.currency)} ·{" "}
                {periodLabel(selected.billingPeriod)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Duration / limits</dt>
              <dd className="text-right font-medium">
                {selected.campaignDurationDays
                  ? `${selected.campaignDurationDays} days`
                  : "As configured"}
                {selected.maxCampaigns != null
                  ? ` · ${selected.maxCampaigns} campaigns`
                  : ""}
              </dd>
            </div>
          </dl>
          {selected.benefits.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
              {selected.benefits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>Sponsored label among relevant matches only</li>
              <li>Does not bypass eligibility or relevance</li>
              <li>Organic matches remain primary at equal relevance</li>
            </ul>
          )}
          <button
            type="button"
            disabled={pending}
            className="mt-5 inline-flex h-10 items-center rounded-[12px] bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            onClick={() => {
              setMessage(null);
              setError(null);
              startTransition(() => {
                void fetch("/api/matching-engine/sponsorship-pricing/requests", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ planId: selected.id }),
                })
                  .then(async (res) => {
                    const body = (await res.json().catch(() => ({}))) as {
                      error?: string;
                      request?: { id: string };
                    };
                    if (!res.ok) {
                      setError(body.error ?? "Could not submit request.");
                      return;
                    }
                    setMessage(
                      "Request submitted. Our team will follow up — no payment was charged.",
                    );
                  })
                  .catch(() => setError("Could not submit request."));
              });
            }}
          >
            Submit sponsorship request
          </button>
          {message ? (
            <p className="mt-3 text-sm text-primary">{message}</p>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
