"use client";

import {
  saSaveMatchingAiSettings,
  saTestMatchingAiConnection,
} from "@/app/actions/super-admin";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Snapshot = {
  enabled: boolean;
  provider: "openai" | "google" | "anthropic" | "deepseek" | "qwen";
  model: string;
  connectionStatus: string;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastErrorSafe: string | null;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  defaultModels: Record<string, string>;
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

export function MatchingAiAdminPanel({ initial }: { initial: Snapshot }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [provider, setProvider] = useState(initial.provider);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [snap, setSnap] = useState(initial);

  function applySnap(next: Snapshot) {
    setSnap(next);
    setEnabled(next.enabled);
    setProvider(next.provider);
    setModel(next.model);
    setApiKey("");
    setClearApiKey(false);
  }

  function onProviderChange(next: Snapshot["provider"]) {
    setProvider(next);
    const def = snap.defaultModels[next];
    if (def) setModel(def);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Matching AI assistant
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Optional ranking refine after the hard capability gate. API keys are
              encrypted at rest and never shown in full. Matching continues
              without AI when this is disabled or unavailable.
            </p>
          </div>
          <div className="text-right text-sm">
            <p className={`font-medium ${statusClass(snap.connectionStatus)}`}>
              {statusLabel(snap.connectionStatus)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {snap.provider} · {snap.model}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Key:{" "}
              {snap.hasApiKey ? (snap.apiKeyHint ?? "••••") : "not set"}
            </p>
            {snap.lastTestAt ? (
              <p className="mt-1 text-xs text-slate-500">
                Last test: {snap.lastTestOk ? "OK" : "failed"} ·{" "}
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
          <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4 rounded border-slate-600"
            />
            Enable AI refinement for Matching Engine
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-slate-300">Provider</span>
            <select
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100"
              value={provider}
              onChange={(e) =>
                onProviderChange(e.target.value as Snapshot["provider"])
              }
            >
              <option value="openai">OpenAI</option>
              <option value="google">Google Gemini</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="deepseek">DeepSeek</option>
              <option value="qwen">Alibaba Qwen</option>
            </select>
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-slate-300">Model</span>
            <input
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4o-mini"
              autoComplete="off"
            />
            <span className="text-xs text-slate-500">
              Default for OpenAI: gpt-4o-mini (low-cost ranking assist).
            </span>
          </label>

          <label className="block space-y-1.5 text-sm sm:col-span-2">
            <span className="text-slate-300">
              API key{" "}
              {snap.hasApiKey ? (
                <span className="text-slate-500">(leave blank to keep)</span>
              ) : null}
            </span>
            <input
              type="password"
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                snap.hasApiKey
                  ? `Current ${snap.apiKeyHint ?? "••••"}`
                  : "Paste provider API key"
              }
              autoComplete="new-password"
            />
          </label>

          {snap.hasApiKey ? (
            <label className="flex items-center gap-2 text-sm text-slate-400 sm:col-span-2">
              <input
                type="checkbox"
                checked={clearApiKey}
                onChange={(e) => setClearApiKey(e.target.checked)}
                className="size-4 rounded border-slate-600"
              />
              Clear stored API key
            </label>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setMessage(null);
              setError(null);
              startTransition(() => {
                void saSaveMatchingAiSettings({
                  enabled,
                  provider,
                  model,
                  apiKey: apiKey.trim() || null,
                  clearApiKey,
                }).then((res) => {
                  if (!res.ok) {
                    setError(res.error.message);
                    return;
                  }
                  applySnap(res.data);
                  setMessage("Settings saved.");
                  router.refresh();
                });
              });
            }}
            className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setMessage(null);
              setError(null);
              startTransition(() => {
                void saTestMatchingAiConnection({ provider, model }).then(
                  (res) => {
                    if (!res.ok) {
                      setError(res.error.message);
                      return;
                    }
                    applySnap(res.data.snapshot);
                    if (res.data.ok) {
                      setMessage(res.data.message);
                    } else {
                      setError(res.data.message);
                    }
                    router.refresh();
                  },
                );
              });
            }}
            className="h-10 rounded-lg border border-slate-600 px-4 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Test connection
          </button>
        </div>

        {message ? (
          <p className="mt-3 text-sm text-emerald-400">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-rose-400">{error}</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        <p className="font-medium text-slate-300">Safety boundaries</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>AI runs only after the 8C hard relevance / capability gate.</li>
          <li>
            AI may reorder already-eligible matches — it cannot invent capabilities
            or bypass mismatches.
          </li>
          <li>
            Disabled, misconfigured, timeout, or low-confidence results fall back
            to deterministic ranking.
          </li>
          <li>No AI calls on dashboard GET or behavior events.</li>
        </ul>
      </div>
    </div>
  );
}
