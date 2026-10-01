"use client";

import {
  saSavePaypalCredentials,
  saSaveStripeCredentials,
  saTestPaypalConnection,
  saTestStripeConnection,
} from "@/app/actions/super-admin";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type PaypalCredSnap = {
  environment: "sandbox" | "live";
  environmentLockedByEnv: boolean;
  credentialsConfigured: boolean;
  webhookConfigured: boolean;
  clientIdHint: string | null;
  clientSecretHint: string | null;
  webhookIdHint: string | null;
  clientIdSource: "env" | "vault" | "none";
  clientSecretSource: "env" | "vault" | "none";
  webhookIdSource: "env" | "vault" | "none";
  connectionStatus: string;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastErrorSafe: string | null;
  productionReady: boolean;
  nodeEnv: string;
};

export type StripeCredSnap = {
  credentialsConfigured: boolean;
  publishableConfigured: boolean;
  webhookConfigured: boolean;
  secretKeyHint: string | null;
  publishableKeyHint: string | null;
  webhookSecretHint: string | null;
  secretKeySource: "env" | "vault" | "none";
  publishableKeySource: "env" | "vault" | "none";
  webhookSecretSource: "env" | "vault" | "none";
  connectionStatus: string;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastErrorSafe: string | null;
  nodeEnv: string;
};

function statusLabel(status: string) {
  switch (status) {
    case "verified":
      return "Connection successful";
    case "configured":
      return "Configured";
    case "invalid":
      return "Invalid configuration";
    case "error":
      return "Connection test failed";
    default:
      return "Not configured";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "verified":
      return "text-emerald-400";
    case "configured":
      return "text-sky-400";
    case "invalid":
    case "error":
      return "text-rose-400";
    default:
      return "text-amber-400";
  }
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none";

export function PaymentCredentialsPanel({
  initialPaypal,
  initialStripe,
}: {
  initialPaypal: PaypalCredSnap;
  initialStripe: StripeCredSnap;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [paypal, setPaypal] = useState(initialPaypal);
  const [stripe, setStripe] = useState(initialStripe);

  const [ppClientId, setPpClientId] = useState("");
  const [ppSecret, setPpSecret] = useState("");
  const [ppWebhook, setPpWebhook] = useState("");
  const [ppEnv, setPpEnv] = useState<"sandbox" | "live">(
    initialPaypal.environment,
  );
  const [ppClearSecret, setPpClearSecret] = useState(false);

  const [stPublishable, setStPublishable] = useState("");
  const [stSecret, setStSecret] = useState("");
  const [stWebhook, setStWebhook] = useState("");
  const [stClearSecret, setStClearSecret] = useState(false);
  const [stClearWebhook, setStClearWebhook] = useState(false);

  return (
    <section className="space-y-6 rounded-xl border border-slate-800 p-4">
      <div>
        <h2 className="text-lg font-medium text-white">Provider credentials</h2>
        <p className="mt-1 text-sm text-slate-400">
          Configure PayPal and Stripe for real checkout. Secrets are encrypted at
          rest and never shown in full. Process environment variables always take
          precedence over the Super Admin vault.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Runtime mode: <span className="text-slate-300">{paypal.nodeEnv}</span>
          {" · "}
          Production origin: getbidvera.com (via app-origin)
        </p>
      </div>

      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}
      {err ? <p className="text-sm text-rose-400">{err}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* PayPal */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-medium text-white">PayPal</h3>
            <div className="text-right text-sm">
              <p className={statusClass(paypal.connectionStatus)}>
                {statusLabel(paypal.connectionStatus)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Env: {paypal.environment}
                {paypal.environmentLockedByEnv ? " (from process env)" : ""}
              </p>
            </div>
          </div>
          <dl className="mt-3 space-y-1 text-xs text-slate-400">
            <div className="flex justify-between gap-2">
              <dt>Client ID</dt>
              <dd className="font-mono text-slate-300">
                {paypal.clientIdHint ?? "—"}{" "}
                <span className="text-slate-500">({paypal.clientIdSource})</span>
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Client Secret</dt>
              <dd className="font-mono text-slate-300">
                {paypal.clientSecretHint ?? "—"}{" "}
                <span className="text-slate-500">({paypal.clientSecretSource})</span>
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Webhook ID</dt>
              <dd className="font-mono text-slate-300">
                {paypal.webhookIdHint ?? "—"}{" "}
                <span className="text-slate-500">({paypal.webhookIdSource})</span>
              </dd>
            </div>
          </dl>
          {paypal.lastErrorSafe ? (
            <p className="mt-2 text-xs text-rose-400">{paypal.lastErrorSafe}</p>
          ) : null}

          <label className="mt-4 block text-sm text-slate-300">
            Client ID
            <input
              className={inputClass}
              value={ppClientId}
              onChange={(e) => setPpClientId(e.target.value)}
              placeholder={paypal.clientIdHint ? "Leave blank to keep" : "PayPal Client ID"}
              autoComplete="off"
            />
          </label>
          <label className="mt-3 block text-sm text-slate-300">
            Client Secret
            <input
              className={inputClass}
              type="password"
              value={ppSecret}
              onChange={(e) => setPpSecret(e.target.value)}
              placeholder={
                paypal.clientSecretHint
                  ? "Leave blank to keep existing secret"
                  : "PayPal Client Secret"
              }
              autoComplete="new-password"
            />
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={ppClearSecret}
              onChange={(e) => setPpClearSecret(e.target.checked)}
            />
            Clear vault client secret
          </label>
          <label className="mt-3 block text-sm text-slate-300">
            Webhook ID
            <input
              className={inputClass}
              value={ppWebhook}
              onChange={(e) => setPpWebhook(e.target.value)}
              placeholder={paypal.webhookIdHint ? "Leave blank to keep" : "WH-…"}
              autoComplete="off"
            />
          </label>
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-200">Checkout mode</p>
              <span
                className={
                  paypal.environment === "live"
                    ? "rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose-300"
                    : "rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300"
                }
              >
                Active: {paypal.environment === "live" ? "Live" : "Sandbox"}
              </span>
            </div>
            <div
              className="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-slate-700 bg-slate-950 p-1"
              role="group"
              aria-label="PayPal Sandbox or Live mode"
            >
              {(["sandbox", "live"] as const).map((mode) => {
                const selected = ppEnv === mode;
                const active = paypal.environment === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={pending || paypal.environmentLockedByEnv}
                    className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? mode === "live"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-amber-500 text-slate-950 shadow-sm"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                    onClick={() => {
                      setPpEnv(mode);
                      if (
                        paypal.environmentLockedByEnv ||
                        mode === paypal.environment
                      ) {
                        return;
                      }
                      setMsg(null);
                      setErr(null);
                      start(async () => {
                        const r = await saSavePaypalCredentials({
                          environment: mode,
                        });
                        if (!r.ok) {
                          setErr(r.error.message);
                          setPpEnv(paypal.environment);
                          return;
                        }
                        setPaypal(r.data);
                        setPpEnv(r.data.environment);
                        setMsg(
                          mode === "live"
                            ? "PayPal switched to Live — real charges."
                            : "PayPal switched to Sandbox — test payments only.",
                        );
                        router.refresh();
                      });
                    }}
                  >
                    {mode === "live" ? "Live" : "Sandbox"}
                    {active ? " ✓" : ""}
                  </button>
                );
              })}
            </div>
            {paypal.environmentLockedByEnv ? (
              <p className="mt-2 text-xs text-amber-400">
                Locked by{" "}
                <code className="text-amber-300">PAYPAL_ENVIRONMENT</code> /{" "}
                <code className="text-amber-300">PAYPAL_MODE</code> on the server.
                Remove that env var to switch from Super Admin.
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                One-click switch for this server. Live uses real money; Sandbox is
                for testing. Unsaved credential fields are not required to change
                mode.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => {
                setMsg(null);
                setErr(null);
                start(async () => {
                  const r = await saSavePaypalCredentials({
                    clientId: ppClientId || undefined,
                    clientSecret: ppSecret || undefined,
                    webhookId: ppWebhook || undefined,
                    environment: ppEnv,
                    clearClientSecret: ppClearSecret,
                  });
                  if (!r.ok) {
                    setErr(r.error.message);
                    return;
                  }
                  setPaypal(r.data);
                  setPpClientId("");
                  setPpSecret("");
                  setPpWebhook("");
                  setPpClearSecret(false);
                  setMsg("PayPal credentials saved");
                  router.refresh();
                });
              }}
            >
              Save PayPal
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
              onClick={() => {
                setMsg(null);
                setErr(null);
                start(async () => {
                  const r = await saTestPaypalConnection();
                  if (!r.ok) {
                    setErr(r.error.message);
                    return;
                  }
                  setPaypal(r.data.snapshot);
                  if (r.data.ok) setMsg("PayPal connection successful");
                  else setErr(r.data.snapshot.lastErrorSafe ?? "PayPal connection failed");
                  router.refresh();
                });
              }}
            >
              Test PayPal Connection
            </button>
          </div>
        </div>

        {/* Stripe */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-medium text-white">Stripe</h3>
            <div className="text-right text-sm">
              <p className={statusClass(stripe.connectionStatus)}>
                {statusLabel(stripe.connectionStatus)}
              </p>
            </div>
          </div>
          <dl className="mt-3 space-y-1 text-xs text-slate-400">
            <div className="flex justify-between gap-2">
              <dt>Publishable Key</dt>
              <dd className="font-mono text-slate-300">
                {stripe.publishableKeyHint ?? "—"}{" "}
                <span className="text-slate-500">({stripe.publishableKeySource})</span>
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Secret Key</dt>
              <dd className="font-mono text-slate-300">
                {stripe.secretKeyHint ?? "—"}{" "}
                <span className="text-slate-500">({stripe.secretKeySource})</span>
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Webhook Secret</dt>
              <dd className="font-mono text-slate-300">
                {stripe.webhookSecretHint ?? "—"}{" "}
                <span className="text-slate-500">({stripe.webhookSecretSource})</span>
              </dd>
            </div>
          </dl>
          {stripe.lastErrorSafe ? (
            <p className="mt-2 text-xs text-rose-400">{stripe.lastErrorSafe}</p>
          ) : null}

          <label className="mt-4 block text-sm text-slate-300">
            Publishable Key
            <input
              className={inputClass}
              value={stPublishable}
              onChange={(e) => setStPublishable(e.target.value)}
              placeholder={
                stripe.publishableKeyHint ? "Leave blank to keep" : "pk_…"
              }
              autoComplete="off"
            />
          </label>
          <label className="mt-3 block text-sm text-slate-300">
            Secret Key
            <input
              className={inputClass}
              type="password"
              value={stSecret}
              onChange={(e) => setStSecret(e.target.value)}
              placeholder={
                stripe.secretKeyHint
                  ? "Leave blank to keep existing secret"
                  : "sk_…"
              }
              autoComplete="new-password"
            />
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={stClearSecret}
              onChange={(e) => setStClearSecret(e.target.checked)}
            />
            Clear vault secret key
          </label>
          <label className="mt-3 block text-sm text-slate-300">
            Webhook Secret
            <input
              className={inputClass}
              type="password"
              value={stWebhook}
              onChange={(e) => setStWebhook(e.target.value)}
              placeholder={
                stripe.webhookSecretHint
                  ? "Leave blank to keep existing secret"
                  : "whsec_…"
              }
              autoComplete="new-password"
            />
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={stClearWebhook}
              onChange={(e) => setStClearWebhook(e.target.checked)}
            />
            Clear vault webhook secret
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => {
                setMsg(null);
                setErr(null);
                start(async () => {
                  const r = await saSaveStripeCredentials({
                    publishableKey: stPublishable || undefined,
                    secretKey: stSecret || undefined,
                    webhookSecret: stWebhook || undefined,
                    clearSecretKey: stClearSecret,
                    clearWebhookSecret: stClearWebhook,
                  });
                  if (!r.ok) {
                    setErr(r.error.message);
                    return;
                  }
                  setStripe(r.data);
                  setStPublishable("");
                  setStSecret("");
                  setStWebhook("");
                  setStClearSecret(false);
                  setStClearWebhook(false);
                  setMsg("Stripe credentials saved");
                  router.refresh();
                });
              }}
            >
              Save Stripe
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
              onClick={() => {
                setMsg(null);
                setErr(null);
                start(async () => {
                  const r = await saTestStripeConnection();
                  if (!r.ok) {
                    setErr(r.error.message);
                    return;
                  }
                  setStripe(r.data.snapshot);
                  if (r.data.ok) setMsg("Stripe connection successful");
                  else setErr(r.data.snapshot.lastErrorSafe ?? "Stripe connection failed");
                  router.refresh();
                });
              }}
            >
              Test Stripe Connection
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
