"use client";

import {
  saSaveBillingGateways,
  saUpdatePlanGateways,
} from "@/app/actions/super-admin";
import type { BillingGatewaySettings } from "@/services/billing/settings";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type PlanRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  visibleToPublic: boolean;
  isFree: boolean;
  monthlyPriceCents: number;
  annualPriceCents: number | null;
  monthlyEnabled: boolean;
  annualEnabled: boolean;
  currency: string;
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  trialEligible: boolean;
  trialDays: number | null;
  stripePriceMonthly: string | null;
  stripePriceAnnual: string | null;
  paypalPlanMonthly: string | null;
  paypalPlanAnnual: string | null;
  subscriptionsCount: number;
};

type Metrics = {
  totalRevenueCents: number;
  monthRevenueCents: number;
  paymentCount: number;
  activeSubscriptions: number;
  trialUsers: number;
  failedPayments: number;
  canceledSubscriptions: number;
  revenueByGateway: Array<{ gateway: string; amountCents: number; count: number }>;
  revenueByPlan: Array<{ planSlug: string; amountCents: number; count: number }>;
  monthlyCycleRevenueCents: number;
  yearlyCycleRevenueCents: number;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PaymentsAdminPanel({
  settings,
  metrics,
  plans,
  paypalIntegration,
}: {
  settings: BillingGatewaySettings;
  metrics: Metrics;
  plans: PlanRow[];
  paypalIntegration?: {
    credentialsConfigured: boolean;
    webhookConfigured: boolean;
    environment: "sandbox" | "live";
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState(settings);

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total revenue", value: money(metrics.totalRevenueCents) },
          { label: "This month", value: money(metrics.monthRevenueCents) },
          { label: "Active subscriptions", value: String(metrics.activeSubscriptions) },
          { label: "Trial users", value: String(metrics.trialUsers) },
          { label: "Failed / past due", value: String(metrics.failedPayments) },
          { label: "Cancelled", value: String(metrics.canceledSubscriptions) },
          { label: "Monthly-cycle revenue", value: money(metrics.monthlyCycleRevenueCents) },
          { label: "Yearly-cycle revenue", value: money(metrics.yearlyCycleRevenueCents) },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{m.label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{m.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="text-lg font-medium text-white">Payment gateways</h2>
        <p className="mt-2 text-sm text-slate-300">
          Current default:{" "}
          <span className="font-semibold text-white">
            {settings.defaultGateway === "paypal" ? "PayPal" : "Stripe"}
          </span>
          {" · "}
          PayPal {settings.paypalEnabled ? "enabled" : "disabled"}
          {paypalIntegration
            ? ` · credentials ${paypalIntegration.credentialsConfigured ? "configured" : "missing"} · webhook ${paypalIntegration.webhookConfigured ? "configured" : "missing"} · ${paypalIntegration.environment}`
            : ""}
          {" · "}
          Stripe {settings.stripeEnabled ? "enabled" : "available (not default)"}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Disabled gateways are hidden from checkout. Existing subscriptions stay active unless you
          explicitly choose otherwise.
        </p>
        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Trial settings
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          These controls are Super Admin only. Companies never see or edit them.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.stripeEnabled}
              onChange={(e) => setForm((f) => ({ ...f, stripeEnabled: e.target.checked }))}
            />
            Enable Stripe
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.paypalEnabled}
              onChange={(e) => setForm((f) => ({ ...f, paypalEnabled: e.target.checked }))}
            />
            Enable PayPal
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Default gateway
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              value={form.defaultGateway}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  defaultGateway: e.target.value as "stripe" | "paypal",
                }))
              }
            >
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.trialEnabled}
              onChange={(e) => setForm((f) => ({ ...f, trialEnabled: e.target.checked }))}
            />
            Enable trial signups
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.requirePaymentMethodForTrial}
              onChange={(e) =>
                setForm((f) => ({ ...f, requirePaymentMethodForTrial: e.target.checked }))
              }
            />
            Require payment method for trial (Stripe)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.freeWorkspaceEnabled}
              onChange={(e) =>
                setForm((f) => ({ ...f, freeWorkspaceEnabled: e.target.checked }))
              }
            />
            Enable Free Workspace after trial/cancel
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Global trial days (0 = credit-only / no time-boxed trial)
            <input
              type="number"
              min={0}
              max={365}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              value={form.trialDays}
              onChange={(e) =>
                setForm((f) => ({ ...f, trialDays: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Grace days after payment failure
            <input
              type="number"
              min={0}
              max={90}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              value={form.graceDays}
              onChange={(e) =>
                setForm((f) => ({ ...f, graceDays: Number(e.target.value) || 0 }))
              }
            />
            <span className="text-xs text-slate-500">
              Keep access during grace; then expire. Plan-level grace overrides this.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.cancelSubsOnPlanDisable}
              onChange={(e) =>
                setForm((f) => ({ ...f, cancelSubsOnPlanDisable: e.target.checked }))
              }
            />
            Cancel subs when plan disabled
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.cancelSubsOnGatewayDisable}
              onChange={(e) =>
                setForm((f) => ({ ...f, cancelSubsOnGatewayDisable: e.target.checked }))
              }
            />
            Cancel subs when gateway disabled
          </label>
        </div>
        <button
          type="button"
          disabled={pending}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          onClick={() =>
            start(async () => {
              const r = await saSaveBillingGateways(form);
              setMsg(r.ok ? "Gateway settings saved" : r.error.message);
              if (r.ok) router.refresh();
            })
          }
        >
          Save gateway settings
        </button>
      </section>

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="text-lg font-medium text-white">Plan visibility & gateways</h2>
        <p className="mt-1 text-sm text-slate-400">
          Control which plans and payment methods appear in checkout. Prices stay server-side.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-2 py-2">Plan</th>
                <th className="px-2 py-2">Visible</th>
                <th className="px-2 py-2">Stripe</th>
                <th className="px-2 py-2">PayPal</th>
                <th className="px-2 py-2">Price IDs</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <PlanGatewayRow
                  key={p.id}
                  plan={p}
                  pending={pending}
                  onSaved={(m) => {
                    setMsg(m);
                    router.refresh();
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 p-4">
          <h3 className="font-medium text-white">Revenue by gateway</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {metrics.revenueByGateway.length === 0 ? (
              <li className="text-slate-500">No payments yet</li>
            ) : (
              metrics.revenueByGateway.map((r) => (
                <li key={r.gateway} className="flex justify-between">
                  <span>{r.gateway}</span>
                  <span>
                    {money(r.amountCents)} · {r.count}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-800 p-4">
          <h3 className="font-medium text-white">Revenue by plan</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {metrics.revenueByPlan.length === 0 ? (
              <li className="text-slate-500">No payments yet</li>
            ) : (
              metrics.revenueByPlan.map((r) => (
                <li key={r.planSlug} className="flex justify-between">
                  <span>{r.planSlug}</span>
                  <span>
                    {money(r.amountCents)} · {r.count}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {msg ? <p className="text-sm text-slate-300">{msg}</p> : null}
    </div>
  );
}

function PlanGatewayRow({
  plan,
  pending,
  onSaved,
}: {
  plan: PlanRow;
  pending: boolean;
  onSaved: (msg: string) => void;
}) {
  const [visible, setVisible] = useState(plan.visibleToPublic);
  const [stripeOn, setStripeOn] = useState(plan.stripeEnabled);
  const [paypalOn, setPaypalOn] = useState(plan.paypalEnabled);
  const [stripeMonthly, setStripeMonthly] = useState(plan.stripePriceMonthly ?? "");
  const [stripeAnnual, setStripeAnnual] = useState(plan.stripePriceAnnual ?? "");
  const [paypalMonthly, setPaypalMonthly] = useState(plan.paypalPlanMonthly ?? "");
  const [paypalAnnual, setPaypalAnnual] = useState(plan.paypalPlanAnnual ?? "");
  const [localPending, start] = useTransition();

  return (
    <tr className="border-b border-slate-800/60 align-top">
      <td className="px-2 py-3">
        <p className="font-medium text-white">{plan.name}</p>
        <p className="text-xs text-slate-500">
          {plan.slug} · {plan.status} · {plan.subscriptionsCount} subs
          {plan.isFree || plan.slug === "free" ? " · Free Workspace" : ""}
        </p>
      </td>
      <td className="px-2 py-3">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
      </td>
      <td className="px-2 py-3">
        <input
          type="checkbox"
          checked={plan.isFree ? false : stripeOn}
          disabled={plan.isFree}
          onChange={(e) => setStripeOn(e.target.checked)}
        />
      </td>
      <td className="px-2 py-3">
        <input
          type="checkbox"
          checked={plan.isFree ? false : paypalOn}
          disabled={plan.isFree}
          onChange={(e) => setPaypalOn(e.target.checked)}
        />
      </td>
      <td className="px-2 py-3">
        <div className="grid min-w-[14rem] gap-1">
          <input
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            placeholder="Stripe price monthly"
            value={stripeMonthly}
            onChange={(e) => setStripeMonthly(e.target.value)}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            placeholder="Stripe price annual"
            value={stripeAnnual}
            onChange={(e) => setStripeAnnual(e.target.value)}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            placeholder="PayPal plan monthly"
            value={paypalMonthly}
            onChange={(e) => setPaypalMonthly(e.target.value)}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            placeholder="PayPal plan annual"
            value={paypalAnnual}
            onChange={(e) => setPaypalAnnual(e.target.value)}
          />
        </div>
      </td>
      <td className="px-2 py-3">
        <button
          type="button"
          disabled={pending || localPending}
          className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
          onClick={() =>
            start(async () => {
              const r = await saUpdatePlanGateways({
                planId: plan.id,
                visibleToPublic: visible,
                stripeEnabled: plan.isFree ? false : stripeOn,
                paypalEnabled: plan.isFree ? false : paypalOn,
                isFree: plan.isFree,
                stripePriceMonthly: stripeMonthly || null,
                stripePriceAnnual: stripeAnnual || null,
                paypalPlanMonthly: paypalMonthly || null,
                paypalPlanAnnual: paypalAnnual || null,
              });
              onSaved(r.ok ? `${plan.name} gateways saved` : r.error.message);
            })
          }
        >
          Save
        </button>
      </td>
    </tr>
  );
}
