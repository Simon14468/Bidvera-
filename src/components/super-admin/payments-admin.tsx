"use client";

import { saSaveBillingGateways, saUpdatePlanGateways } from "@/app/actions/super-admin";
import {
  isOfficialFreeWorkspacePaymentsPlan,
  shouldRenderCommercialPaymentFields,
} from "@/application/admin/payments-plan-visibility";
import {
  PaymentCredentialsPanel,
  type PaypalCredSnap,
  type StripeCredSnap,
} from "@/components/super-admin/payment-credentials-panel";
import {
  gatewayMappingLabels,
  isUsablePaypalBillingPlanId,
  isUsableStripePriceId,
} from "@/services/billing/plan-gateway-ids";
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
  monthlyEnabled: boolean;
  annualEnabled: boolean;
  stripeEnabled: boolean;
  paypalEnabled: boolean;
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
  paypalIntegration,
  providerCredentials,
  plans,
  freeWorkspaceSettingsHref,
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
  plans: PlanRow[];
  freeWorkspaceSettingsHref?: string;
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

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="text-lg font-medium text-white">Plan visibility & gateways</h2>
        <p className="mt-1 text-sm text-slate-400">
          Control which plans and payment methods appear in checkout. Price IDs and PayPal Plan
          IDs are mapping values, not provider secrets.
          {paypalIntegration
            ? ` PayPal mappings are verified against the current ${paypalIntegration.environment} environment.`
            : ""}
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
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <PlanGatewayRow
                  key={[
                    p.id,
                    p.visibleToPublic,
                    p.stripeEnabled,
                    p.paypalEnabled,
                    p.stripePriceMonthly,
                    p.stripePriceAnnual,
                    p.paypalPlanMonthly,
                    p.paypalPlanAnnual,
                  ].join("|")}
                  plan={p}
                  pending={pending}
                  freeWorkspaceSettingsHref={freeWorkspaceSettingsHref}
                  onSaved={(message) => {
                    setMsg(message);
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

      {msg ? <p className="text-sm text-emerald-300">{msg}</p> : null}
    </div>
  );
}

function StatusPills({ labels }: { labels: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((label) => (
        <span
          key={label}
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
            label === "Configured"
              ? "bg-emerald-950 text-emerald-300"
              : label === "Off"
                ? "bg-slate-800 text-slate-400"
                : "bg-amber-950 text-amber-200"
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function PlanGatewayRow({
  plan,
  pending,
  onSaved,
  freeWorkspaceSettingsHref,
}: {
  plan: PlanRow;
  pending: boolean;
  onSaved: (msg: string) => void;
  freeWorkspaceSettingsHref?: string;
}) {
  const officialFreeWorkspace = isOfficialFreeWorkspacePaymentsPlan(plan);
  const [visible, setVisible] = useState(plan.visibleToPublic);
  const [stripeOn, setStripeOn] = useState(plan.stripeEnabled);
  const [paypalOn, setPaypalOn] = useState(plan.paypalEnabled);
  const [stripeMonthly, setStripeMonthly] = useState(plan.stripePriceMonthly ?? "");
  const [stripeAnnual, setStripeAnnual] = useState(plan.stripePriceAnnual ?? "");
  const [paypalMonthly, setPaypalMonthly] = useState(plan.paypalPlanMonthly ?? "");
  const [paypalAnnual, setPaypalAnnual] = useState(plan.paypalPlanAnnual ?? "");
  const [rowError, setRowError] = useState<string | null>(null);
  const [localPending, start] = useTransition();

  if (officialFreeWorkspace) {
    return (
      <tr className="border-b border-slate-800/60 align-top">
        <td className="px-2 py-3">
          <p className="font-medium text-white">{plan.name}</p>
          <p className="text-xs text-slate-500">
            {plan.slug} · {plan.status} · {plan.subscriptionsCount} subs · Official Free Workspace
          </p>
        </td>
        <td className="px-2 py-3 text-xs text-slate-500">—</td>
        <td className="px-2 py-3 text-xs text-slate-500">Off</td>
        <td className="px-2 py-3 text-xs text-slate-500">Off</td>
        <td className="px-2 py-3 text-xs text-slate-400">
          Not a checkout product. Stripe and PayPal stay off. Configure trial features on the Free
          Workspace settings page.
        </td>
        <td className="px-2 py-3">
          {freeWorkspaceSettingsHref ? (
            <a
              href={freeWorkspaceSettingsHref}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
            >
              Free Workspace settings
            </a>
          ) : (
            <span className="text-xs text-slate-500">Dedicated settings only</span>
          )}
        </td>
      </tr>
    );
  }

  if (!shouldRenderCommercialPaymentFields(plan)) {
    return (
      <tr className="border-b border-slate-800/60 align-top">
        <td className="px-2 py-3">
          <p className="font-medium text-white">{plan.name}</p>
          <p className="text-xs text-slate-500">
            {plan.slug} · {plan.status} · {plan.subscriptionsCount} subs · Trial
          </p>
        </td>
        <td className="px-2 py-3">
          <input
            type="checkbox"
            checked={visible}
            aria-label={`Visible ${plan.name}`}
            onChange={(e) => setVisible(e.target.checked)}
          />
        </td>
        <td className="px-2 py-3 text-xs text-slate-500">Off</td>
        <td className="px-2 py-3 text-xs text-slate-500">Off</td>
        <td className="px-2 py-3 text-xs text-slate-400">
          Trial is not a paid checkout product. Payment mappings are not required.
        </td>
        <td className="px-2 py-3">
          <button
            type="button"
            disabled={pending || localPending}
            className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
            onClick={() =>
              start(async () => {
                setRowError(null);
                const result = await saUpdatePlanGateways({
                  planId: plan.id,
                  visibleToPublic: visible,
                  stripeEnabled: false,
                  paypalEnabled: false,
                  isFree: plan.isFree,
                });
                if (!result.ok) {
                  setRowError(result.error.message);
                  return;
                }
                onSaved(`${plan.name} visibility saved`);
              })
            }
          >
            {localPending ? "Saving…" : "Save"}
          </button>
          {rowError ? <p className="mt-2 max-w-xs text-xs text-rose-300">{rowError}</p> : null}
        </td>
      </tr>
    );
  }

  const stripeLabels = gatewayMappingLabels({
    enabled: plan.isFree ? false : stripeOn,
    monthlyEnabled: plan.monthlyEnabled,
    annualEnabled: plan.annualEnabled,
    monthlyId: stripeMonthly,
    annualId: stripeAnnual,
    usable: isUsableStripePriceId,
  });
  const paypalLabels = gatewayMappingLabels({
    enabled: plan.isFree ? false : paypalOn,
    monthlyEnabled: plan.monthlyEnabled,
    annualEnabled: plan.annualEnabled,
    monthlyId: paypalMonthly,
    annualId: paypalAnnual,
    usable: isUsablePaypalBillingPlanId,
  });

  return (
    <tr className="border-b border-slate-800/60 align-top">
      <td className="px-2 py-3">
        <p className="font-medium text-white">{plan.name}</p>
        <p className="text-xs text-slate-500">
          {plan.slug} · {plan.status} · {plan.subscriptionsCount} subs
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          {plan.monthlyEnabled ? "Monthly on" : "Monthly off"}
          {" · "}
          {plan.annualEnabled ? "Annual on" : "Annual off"}
        </p>
      </td>
      <td className="px-2 py-3">
        <input
          type="checkbox"
          checked={visible}
          aria-label={`Visible ${plan.name}`}
          onChange={(e) => setVisible(e.target.checked)}
        />
      </td>
      <td className="px-2 py-3">
        <input
          type="checkbox"
          checked={plan.isFree ? false : stripeOn}
          disabled={plan.isFree}
          aria-label={`Stripe ${plan.name}`}
          onChange={(e) => setStripeOn(e.target.checked)}
        />
      </td>
      <td className="px-2 py-3">
        <input
          type="checkbox"
          checked={plan.isFree ? false : paypalOn}
          disabled={plan.isFree}
          aria-label={`PayPal ${plan.name}`}
          onChange={(e) => setPaypalOn(e.target.checked)}
        />
      </td>
      <td className="px-2 py-3">
        {shouldRenderCommercialPaymentFields(plan) ? (
          <div className="grid min-w-[16rem] gap-1">
            <StatusPills labels={stripeLabels.map((label) => `Stripe ${label}`)} />
            <StatusPills labels={paypalLabels.map((label) => `PayPal ${label}`)} />
            <input
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs"
              placeholder="Stripe price monthly"
              aria-label={`Stripe price monthly ${plan.name}`}
              spellCheck={false}
              autoComplete="off"
              value={stripeMonthly}
              onChange={(e) => setStripeMonthly(e.target.value)}
            />
            <input
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs"
              placeholder="Stripe price annual"
              aria-label={`Stripe price annual ${plan.name}`}
              spellCheck={false}
              autoComplete="off"
              value={stripeAnnual}
              onChange={(e) => setStripeAnnual(e.target.value)}
            />
            <input
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs"
              placeholder="PayPal plan monthly"
              aria-label={`PayPal plan monthly ${plan.name}`}
              spellCheck={false}
              autoComplete="off"
              value={paypalMonthly}
              onChange={(e) => setPaypalMonthly(e.target.value)}
            />
            <input
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs"
              placeholder="PayPal plan annual"
              aria-label={`PayPal plan annual ${plan.name}`}
              spellCheck={false}
              autoComplete="off"
              value={paypalAnnual}
              onChange={(e) => setPaypalAnnual(e.target.value)}
            />
            {rowError ? (
              <p className="max-w-sm whitespace-normal text-xs text-rose-300">{rowError}</p>
            ) : null}
          </div>
        ) : null}
      </td>
      <td className="px-2 py-3">
        <button
          type="button"
          disabled={pending || localPending}
          className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 disabled:opacity-50"
          onClick={() => {
            if (localPending) return;
            start(async () => {
              setRowError(null);
              const result = await saUpdatePlanGateways({
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
              if (!result.ok) {
                setRowError(result.error.message);
                return;
              }
              onSaved(`${plan.name} gateways saved`);
            });
          }}
        >
          {localPending ? "Saving…" : "Save"}
        </button>
      </td>
    </tr>
  );
}
