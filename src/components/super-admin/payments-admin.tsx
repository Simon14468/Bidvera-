"use client";

import { saSaveBillingGateways } from "@/app/actions/super-admin";
import {
  PaymentCredentialsPanel,
  type PaypalCredSnap,
  type StripeCredSnap,
} from "@/components/super-admin/payment-credentials-panel";
import type { BillingGatewaySettings } from "@/services/billing/settings";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
  paypalIntegration,
  providerCredentials,
}: {
  settings: BillingGatewaySettings;
  metrics: Metrics;
  paypalIntegration?: {
    credentialsConfigured: boolean;
    webhookConfigured: boolean;
    environment: "sandbox" | "live";
  };
  providerCredentials?: {
    paypal: PaypalCredSnap;
    stripe: StripeCredSnap;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState(settings);

  return (
    <div className="space-y-8">
      {providerCredentials ? (
        <PaymentCredentialsPanel
          initialPaypal={providerCredentials.paypal}
          initialStripe={providerCredentials.stripe}
        />
      ) : null}

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
