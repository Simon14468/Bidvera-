"use client";

import { useState, useTransition } from "react";
import type { MatchingSponsorshipPricingPlanDto } from "@/modules/matching-engine";
import { cn } from "@/lib/cn";
import { formatMessage } from "@/i18n/format";
import type { Locale } from "@/i18n/config";

export type SponsoredMatchingRequestCopy = {
  sponsoredNoPlansTitle: string;
  sponsoredNoPlansBody: string;
  sponsoredPeriodOneTime: string;
  sponsoredPeriodThreeDays: string;
  sponsoredPeriodMonthly: string;
  sponsoredPeriodQuarterly: string;
  sponsoredPeriodYearly: string;
  sponsoredCampaignDays: string;
  sponsoredCampaignDurationAdmin: string;
  sponsoredUpToCampaigns: string;
  sponsoredUpToImpressions: string;
  sponsoredConfirmTitle: string;
  sponsoredConfirmBody: string;
  sponsoredPlanLabel: string;
  sponsoredPriceLabel: string;
  sponsoredDurationLabel: string;
  sponsoredDays: string;
  sponsoredAsConfigured: string;
  sponsoredCampaignsCount: string;
  sponsoredDefaultBenefit1: string;
  sponsoredDefaultBenefit2: string;
  sponsoredDefaultBenefit3: string;
  sponsoredBenefitPriority: string;
  sponsoredBenefitNoBypass: string;
  sponsoredSubmit: string;
  sponsoredSubmitSuccess: string;
  sponsoredSubmitError: string;
  sponsoredPayWithStripe: string;
  sponsoredPayWithPayPal: string;
  sponsoredGatewayLabel: string;
  sponsoredRedirecting: string;
  sponsoredNoGateways: string;
};

function formatMoney(cents: number, currency: string, locale: Locale) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function periodLabel(
  period: string,
  copy: SponsoredMatchingRequestCopy,
): string {
  switch (period) {
    case "THREE_DAYS":
      return copy.sponsoredPeriodThreeDays;
    case "MONTHLY":
      return copy.sponsoredPeriodMonthly;
    case "QUARTERLY":
      return copy.sponsoredPeriodQuarterly;
    case "YEARLY":
      return copy.sponsoredPeriodYearly;
    default:
      return copy.sponsoredPeriodOneTime;
  }
}

function localizeAdminText(
  text: string,
  copy: SponsoredMatchingRequestCopy,
): string {
  const pairs: Array<[string, string]> = [
    [
      "Priority placement among relevant matches",
      copy.sponsoredBenefitPriority,
    ],
    ["Does not bypass eligibility or relevance", copy.sponsoredDefaultBenefit2],
    ["Does not bypass relevance", copy.sponsoredBenefitNoBypass],
    [
      "Sponsored label among relevant matches only",
      copy.sponsoredDefaultBenefit1,
    ],
    [
      "Organic matches remain primary at equal relevance",
      copy.sponsoredDefaultBenefit3,
    ],
  ];
  let out = text;
  for (const [en, localized] of pairs) {
    out = out.replaceAll(en, localized);
  }
  return out;
}

function campaignMeta(
  plan: MatchingSponsorshipPricingPlanDto,
  copy: SponsoredMatchingRequestCopy,
  locale: Locale,
): string {
  const parts: string[] = [
    plan.campaignDurationDays
      ? formatMessage(copy.sponsoredCampaignDays, {
          days: plan.campaignDurationDays,
        })
      : copy.sponsoredCampaignDurationAdmin,
  ];
  if (plan.maxCampaigns != null) {
    parts.push(
      formatMessage(copy.sponsoredUpToCampaigns, { n: plan.maxCampaigns }),
    );
  }
  if (plan.maxImpressions != null) {
    parts.push(
      formatMessage(copy.sponsoredUpToImpressions, {
        n: plan.maxImpressions.toLocaleString(locale),
      }),
    );
  }
  return parts.join(" · ");
}

export function SponsoredMatchingRequestClient({
  plans,
  gateways,
  copy,
  locale,
}: {
  plans: MatchingSponsorshipPricingPlanDto[];
  gateways: Array<"stripe" | "paypal">;
  copy: SponsoredMatchingRequestCopy;
  locale: Locale;
}) {
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    plans[0]?.id ?? null,
  );
  const [gateway, setGateway] = useState<"stripe" | "paypal" | null>(
    gateways[0] ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const selected = plans.find((p) => p.id === selectedId) ?? null;

  if (plans.length === 0) {
    return (
      <div className="rounded-[12px] border border-border bg-card p-5">
        <p className="text-sm font-medium">{copy.sponsoredNoPlansTitle}</p>
        <p className="mt-1 text-sm text-muted">{copy.sponsoredNoPlansBody}</p>
      </div>
    );
  }

  if (gateways.length === 0) {
    return (
      <div className="rounded-[12px] border border-border bg-card p-5">
        <p className="text-sm font-medium">{copy.sponsoredNoGateways}</p>
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
                    {formatMoney(plan.priceCents, plan.currency, locale)}
                    <span className="ml-1 text-xs font-normal text-muted">
                      / {periodLabel(plan.billingPeriod, copy)}
                    </span>
                  </p>
                </div>
                {plan.description ? (
                  <p className="mt-1 text-sm text-muted">
                    {localizeAdminText(plan.description, copy)}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-muted">
                  {campaignMeta(plan, copy, locale)}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <div className="rounded-[12px] border border-border bg-card p-5">
          <h2 className="text-base font-semibold">{copy.sponsoredConfirmTitle}</h2>
          <p className="mt-1 text-sm text-muted">{copy.sponsoredConfirmBody}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{copy.sponsoredPlanLabel}</dt>
              <dd className="font-medium">{selected.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{copy.sponsoredPriceLabel}</dt>
              <dd className="font-medium">
                {formatMoney(selected.priceCents, selected.currency, locale)} ·{" "}
                {periodLabel(selected.billingPeriod, copy)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{copy.sponsoredDurationLabel}</dt>
              <dd className="text-right font-medium">
                {[
                  selected.campaignDurationDays
                    ? formatMessage(copy.sponsoredDays, {
                        days: selected.campaignDurationDays,
                      })
                    : copy.sponsoredAsConfigured,
                  selected.maxCampaigns != null
                    ? formatMessage(copy.sponsoredCampaignsCount, {
                        n: selected.maxCampaigns,
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </dd>
            </div>
          </dl>
          {selected.benefits.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
              {selected.benefits.map((b) => (
                <li key={b}>{localizeAdminText(b, copy)}</li>
              ))}
            </ul>
          ) : (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>{copy.sponsoredDefaultBenefit1}</li>
              <li>{copy.sponsoredDefaultBenefit2}</li>
              <li>{copy.sponsoredDefaultBenefit3}</li>
            </ul>
          )}

          {gateways.length > 1 ? (
            <fieldset className="mt-4 space-y-2">
              <legend className="text-sm font-medium">
                {copy.sponsoredGatewayLabel}
              </legend>
              <div className="flex flex-wrap gap-2">
                {gateways.includes("stripe") ? (
                  <button
                    type="button"
                    onClick={() => setGateway("stripe")}
                    className={cn(
                      "inline-flex h-9 items-center rounded-xl border px-3 text-sm font-medium",
                      gateway === "stripe"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-background",
                    )}
                  >
                    {copy.sponsoredPayWithStripe}
                  </button>
                ) : null}
                {gateways.includes("paypal") ? (
                  <button
                    type="button"
                    onClick={() => setGateway("paypal")}
                    className={cn(
                      "inline-flex h-9 items-center rounded-xl border px-3 text-sm font-medium",
                      gateway === "paypal"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-background",
                    )}
                  >
                    {copy.sponsoredPayWithPayPal}
                  </button>
                ) : null}
              </div>
            </fieldset>
          ) : null}

          <button
            type="button"
            disabled={pending || !gateway}
            className="mt-5 inline-flex h-10 items-center rounded-[12px] bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            onClick={() => {
              if (!gateway) return;
              setError(null);
              startTransition(() => {
                void fetch("/api/matching-engine/sponsorship-pricing/requests", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    planId: selected.id,
                    gateway,
                  }),
                })
                  .then(async (res) => {
                    const body = (await res.json().catch(() => ({}))) as {
                      error?: string;
                      checkoutUrl?: string;
                    };
                    if (!res.ok || !body.checkoutUrl) {
                      setError(body.error ?? copy.sponsoredSubmitError);
                      return;
                    }
                    window.location.assign(body.checkoutUrl);
                  })
                  .catch(() => setError(copy.sponsoredSubmitError));
              });
            }}
          >
            {pending ? copy.sponsoredRedirecting : copy.sponsoredSubmit}
          </button>
          {error ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
