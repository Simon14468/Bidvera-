"use client";

import {
  saReorderMatchingSponsorshipPricingPlans,
  saSetMatchingSponsorshipPricingPlanStatus,
  saUpsertMatchingSponsorshipPricingPlan,
} from "@/app/actions/super-admin";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingPeriod: string;
  campaignDurationDays: number | null;
  maxCampaigns: number | null;
  maxImpressions: number | null;
  segment: string | null;
  companyId: string | null;
  status: string;
  displayOrder: number;
  benefits: string[];
};

type RequestRow = {
  id: string;
  companyId: string;
  companyName?: string;
  planId: string;
  status: string;
  billingStatus: string | null;
  createdAt: string;
  plan?: { name: string; priceCents: number; currency: string };
};

type Snapshot = {
  plans: Plan[];
  requests: RequestRow[];
};

const emptyForm = {
  id: "" as string,
  name: "",
  description: "",
  priceCents: "9900",
  currency: "usd",
  billingPeriod: "ONE_TIME",
  campaignDurationDays: "30",
  maxCampaigns: "1",
  maxImpressions: "",
  segment: "",
  companyId: "",
  status: "INACTIVE",
  displayOrder: "0",
  benefits: "Priority placement among relevant matches\nDoes not bypass relevance",
};

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

export function MatchingSponsorshipPricingAdminPanel({
  initial,
}: {
  initial: Snapshot;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState(initial.plans);
  const [form, setForm] = useState(emptyForm);

  const orderedIds = useMemo(
    () => [...plans].sort((a, b) => a.displayOrder - b.displayOrder).map((p) => p.id),
    [plans],
  );

  function loadPlan(plan: Plan) {
    setForm({
      id: plan.id,
      name: plan.name,
      description: plan.description ?? "",
      priceCents: String(plan.priceCents),
      currency: plan.currency,
      billingPeriod: plan.billingPeriod,
      campaignDurationDays:
        plan.campaignDurationDays == null ? "" : String(plan.campaignDurationDays),
      maxCampaigns: plan.maxCampaigns == null ? "" : String(plan.maxCampaigns),
      maxImpressions:
        plan.maxImpressions == null ? "" : String(plan.maxImpressions),
      segment: plan.segment ?? "",
      companyId: plan.companyId ?? "",
      status: plan.status,
      displayOrder: String(plan.displayOrder),
      benefits: (plan.benefits ?? []).join("\n"),
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-white">
          {form.id ? "Edit pricing plan" : "Create pricing plan"}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Database-driven Sponsored Matching prices. Companies see active plans
          only after they explicitly request Sponsored Matching. No live payment
          charging.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-300">
            Name
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-300">
            Price (cents)
            <input
              value={form.priceCents}
              onChange={(e) =>
                setForm((f) => ({ ...f, priceCents: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-300">
            Currency
            <input
              value={form.currency}
              onChange={(e) =>
                setForm((f) => ({ ...f, currency: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-300">
            Billing period
            <select
              value={form.billingPeriod}
              onChange={(e) =>
                setForm((f) => ({ ...f, billingPeriod: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="ONE_TIME">One-time</option>
              <option value="THREE_DAYS">3 days</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Campaign duration (days)
            <input
              value={form.campaignDurationDays}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  campaignDurationDays: e.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-300">
            Max campaigns
            <input
              value={form.maxCampaigns}
              onChange={(e) =>
                setForm((f) => ({ ...f, maxCampaigns: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-300">
            Max impressions
            <input
              value={form.maxImpressions}
              onChange={(e) =>
                setForm((f) => ({ ...f, maxImpressions: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-300">
            Segment (optional)
            <input
              value={form.segment}
              placeholder="Starter / Growth / Professional / Enterprise"
              onChange={(e) =>
                setForm((f) => ({ ...f, segment: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-300">
            Custom company ID (optional)
            <input
              value={form.companyId}
              onChange={(e) =>
                setForm((f) => ({ ...f, companyId: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-300">
            Display order
            <input
              value={form.displayOrder}
              onChange={(e) =>
                setForm((f) => ({ ...f, displayOrder: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-300">
            Status
            <select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="INACTIVE">Inactive</option>
              <option value="ACTIVE">Active</option>
            </select>
          </label>
          <label className="md:col-span-2 text-sm text-slate-300">
            Description
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="md:col-span-2 text-sm text-slate-300">
            Benefits (one per line)
            <textarea
              value={form.benefits}
              onChange={(e) =>
                setForm((f) => ({ ...f, benefits: e.target.value }))
              }
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            onClick={() => {
              setMessage(null);
              setError(null);
              startTransition(() => {
                void saUpsertMatchingSponsorshipPricingPlan({
                  ...(form.id ? { id: form.id } : {}),
                  name: form.name,
                  description: form.description || null,
                  priceCents: Number(form.priceCents),
                  currency: form.currency,
                  billingPeriod: form.billingPeriod,
                  campaignDurationDays: form.campaignDurationDays
                    ? Number(form.campaignDurationDays)
                    : null,
                  maxCampaigns: form.maxCampaigns
                    ? Number(form.maxCampaigns)
                    : null,
                  maxImpressions: form.maxImpressions
                    ? Number(form.maxImpressions)
                    : null,
                  segment: form.segment || null,
                  companyId: form.companyId || null,
                  status: form.status,
                  displayOrder: Number(form.displayOrder || 0),
                  benefits: form.benefits
                    .split("\n")
                    .map((b) => b.trim())
                    .filter(Boolean),
                }).then((res) => {
                  if (!res.ok) {
                    setError(res.error.message);
                    return;
                  }
                  setMessage(form.id ? "Plan updated." : "Plan created.");
                  setPlans((prev) => {
                    const rest = prev.filter((p) => p.id !== res.data.id);
                    return [...rest, res.data].sort(
                      (a, b) => a.displayOrder - b.displayOrder,
                    );
                  });
                  setForm(emptyForm);
                  router.refresh();
                });
              });
            }}
          >
            {form.id ? "Save plan" : "Create plan"}
          </button>
          {form.id ? (
            <button
              type="button"
              disabled={pending}
              className="h-10 rounded-lg border border-slate-700 px-4 text-sm text-slate-300 hover:bg-slate-900 disabled:opacity-50"
              onClick={() => setForm(emptyForm)}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
        {message ? (
          <p className="mt-3 text-sm text-emerald-400">{message}</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Pricing plans</h2>
          <button
            type="button"
            disabled={pending || orderedIds.length < 2}
            className="h-9 rounded-lg border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-900 disabled:opacity-50"
            onClick={() => {
              setMessage(null);
              setError(null);
              startTransition(() => {
                void saReorderMatchingSponsorshipPricingPlans({
                  orderedIds,
                }).then((res) => {
                  if (!res.ok) {
                    setError(res.error.message);
                    return;
                  }
                  setPlans(res.data);
                  setMessage("Display order saved.");
                  router.refresh();
                });
              });
            }}
          >
            Save current order
          </button>
        </div>
        <ul className="mt-4 space-y-3">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">
                    {plan.name}{" "}
                    <span className="text-xs text-slate-400">
                      ({plan.status})
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {formatMoney(plan.priceCents, plan.currency)} ·{" "}
                    {plan.billingPeriod}
                    {plan.campaignDurationDays
                      ? ` · ${plan.campaignDurationDays}d`
                      : ""}
                    {plan.segment ? ` · ${plan.segment}` : ""}
                    {plan.companyId ? ` · custom:${plan.companyId.slice(0, 8)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="h-8 rounded-lg border border-slate-700 px-3 text-xs text-slate-300 hover:bg-slate-900"
                    onClick={() => loadPlan(plan)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="h-8 rounded-lg border border-slate-700 px-3 text-xs text-slate-300 hover:bg-slate-900 disabled:opacity-50"
                    onClick={() => {
                      const next =
                        plan.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                      startTransition(() => {
                        void saSetMatchingSponsorshipPricingPlanStatus({
                          planId: plan.id,
                          status: next,
                        }).then((res) => {
                          if (!res.ok) {
                            setError(res.error.message);
                            return;
                          }
                          setPlans((prev) =>
                            prev.map((p) =>
                              p.id === res.data.id ? res.data : p,
                            ),
                          );
                          router.refresh();
                        });
                      });
                    }}
                  >
                    {plan.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-lg border border-slate-700 px-3 text-xs text-slate-300 hover:bg-slate-900"
                    onClick={() => {
                      setPlans((prev) => {
                        const sorted = [...prev].sort(
                          (a, b) => a.displayOrder - b.displayOrder,
                        );
                        const idx = sorted.findIndex((p) => p.id === plan.id);
                        if (idx <= 0) return prev;
                        const swap = sorted[idx - 1]!;
                        sorted[idx - 1] = sorted[idx]!;
                        sorted[idx] = swap;
                        return sorted.map((p, i) => ({
                          ...p,
                          displayOrder: i,
                        }));
                      });
                    }}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-lg border border-slate-700 px-3 text-xs text-slate-300 hover:bg-slate-900"
                    onClick={() => {
                      setPlans((prev) => {
                        const sorted = [...prev].sort(
                          (a, b) => a.displayOrder - b.displayOrder,
                        );
                        const idx = sorted.findIndex((p) => p.id === plan.id);
                        if (idx < 0 || idx >= sorted.length - 1) return prev;
                        const swap = sorted[idx + 1]!;
                        sorted[idx + 1] = sorted[idx]!;
                        sorted[idx] = swap;
                        return sorted.map((p, i) => ({
                          ...p,
                          displayOrder: i,
                        }));
                      });
                    }}
                  >
                    Down
                  </button>
                </div>
              </div>
            </li>
          ))}
          {plans.length === 0 ? (
            <li className="text-sm text-slate-400">No pricing plans yet.</li>
          ) : null}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-white">
          Recent company requests
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Request / order intent only — NoOp billing, no Stripe/PayPal charges.
        </p>
        <ul className="mt-4 space-y-2">
          {initial.requests.map((req) => (
            <li
              key={req.id}
              className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300"
            >
              <span className="font-medium text-white">
                {req.companyName ?? req.companyId}
              </span>{" "}
              · {req.plan?.name ?? req.planId} · {req.status}
              {req.billingStatus ? ` · billing:${req.billingStatus}` : ""} ·{" "}
              {new Date(req.createdAt).toLocaleString()}
            </li>
          ))}
          {initial.requests.length === 0 ? (
            <li className="text-sm text-slate-400">No requests yet.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
