"use client";

import {
  saSaveEmailSettings,
  saSendResendTestEmail,
} from "@/app/actions/super-admin";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Snapshot = {
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
  enabled: boolean;
  connectionStatus: string;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestToMasked: string | null;
  lastErrorSafe: string | null;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  apiKeySource: "vault" | "env" | "none";
};

function statusLabel(status: string) {
  switch (status) {
    case "verified":
      return "Verified";
    case "configured":
      return "Configured";
    case "disabled":
      return "Disabled";
    case "error":
      return "Error";
    default:
      return "Unconfigured";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "verified":
      return "text-emerald-400";
    case "configured":
      return "text-sky-400";
    case "error":
      return "text-rose-400";
    case "disabled":
      return "text-slate-400";
    default:
      return "text-amber-400";
  }
}

export function EmailAdminPanel({ initial }: { initial: Snapshot }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState(initial.fromEmail);
  const [fromName, setFromName] = useState(initial.fromName);
  const [replyTo, setReplyTo] = useState(initial.replyTo ?? "");
  const [enabled, setEnabled] = useState(initial.enabled);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [snap, setSnap] = useState(initial);

  function applySnap(next: Snapshot) {
    setSnap(next);
    setFromEmail(next.fromEmail);
    setFromName(next.fromName);
    setReplyTo(next.replyTo ?? "");
    setEnabled(next.enabled);
    setApiKey("");
    setClearApiKey(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Resend provider</h2>
            <p className="mt-1 text-sm text-slate-400">
              Transactional email and Smart Alerts. API keys are encrypted at rest
              and never shown in the browser.
            </p>
          </div>
          <div className="text-right text-sm">
            <p className={`font-medium ${statusClass(snap.connectionStatus)}`}>
              {statusLabel(snap.connectionStatus)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Key:{" "}
              {snap.hasApiKey
                ? `${snap.apiKeyHint ?? "••••"} (${snap.apiKeySource})`
                : "not set"}
            </p>
            {snap.lastTestAt ? (
              <p className="mt-1 text-xs text-slate-500">
                Last test:{" "}
                {snap.lastTestOk ? "OK" : "failed"} ·{" "}
                {snap.lastTestToMasked ?? "—"} ·{" "}
                {snap.lastTestAt.slice(0, 19).replace("T", " ")}
              </p>
            ) : null}
          </div>
        </div>

        {snap.lastErrorSafe ? (
          <p className="mt-3 rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
            {snap.lastErrorSafe}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm">
            <span className="text-slate-300">From name</span>
            <input
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Bidvera"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-slate-300">From email</span>
            <input
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="noreply@yourdomain.com"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1.5 text-sm sm:col-span-2">
            <span className="text-slate-300">Reply-To (optional)</span>
            <input
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="support@yourdomain.com"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1.5 text-sm sm:col-span-2">
            <span className="text-slate-300">
              Resend API key{" "}
              {snap.hasApiKey ? (
                <span className="text-slate-500">
                  — leave blank to keep current ({snap.apiKeyHint})
                </span>
              ) : null}
            </span>
            <input
              type="password"
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setClearApiKey(false);
              }}
              placeholder="re_••••••••"
              autoComplete="new-password"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enable Resend for Smart Alerts & transactional email
          </label>
          <label className="flex items-center gap-2 text-sm text-rose-300">
            <input
              type="checkbox"
              checked={clearApiKey}
              onChange={(e) => {
                setClearApiKey(e.target.checked);
                if (e.target.checked) setApiKey("");
              }}
            />
            Clear stored API key
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            onClick={() => {
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const result = await saSaveEmailSettings({
                  fromEmail,
                  fromName,
                  replyTo: replyTo || null,
                  enabled,
                  apiKey: apiKey || null,
                  clearApiKey,
                });
                if (!result.ok) {
                  setError(result.error.message);
                  return;
                }
                applySnap(result.data);
                setMessage(
                  enabled
                    ? "Resend saved and validated. Provider enabled."
                    : "Resend settings saved (provider disabled).",
                );
                router.refresh();
              });
            }}
          >
            Save configuration
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-white">Send test email</h2>
        <p className="mt-1 text-sm text-slate-400">
          Validates live delivery through Resend. Provider must be enabled with a
          valid From address.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className="h-10 min-w-[240px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@company.com"
            autoComplete="off"
          />
          <button
            type="button"
            disabled={pending}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-50"
            onClick={() => {
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const result = await saSendResendTestEmail({ to: testTo });
                if (!result.ok) {
                  setError(result.error.message);
                  return;
                }
                applySnap(result.data.snapshot);
                setMessage(
                  `Test email sent to ${result.data.toMasked} (${result.data.mode}).`,
                );
                router.refresh();
              });
            }}
          >
            Send test email
          </button>
        </div>
      </div>

      {message ? (
        <p className="text-sm text-emerald-400">{message}</p>
      ) : null}
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
    </div>
  );
}
