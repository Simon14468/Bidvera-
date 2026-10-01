"use client";

import {
  saRefreshMatchingOpportunities,
  saRunMatchingNow,
  saSetMatchingEngineGlobal,
} from "@/app/actions/super-admin";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type RunState = {
  status: "idle" | "running" | "completed" | "failed";
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastOpportunityRefreshAt: string | null;
  lastErrorSafe: string | null;
  lastSummary: {
    ingestRan?: boolean;
    ingestSkippedReason?: string | null;
    opportunitiesUpserted?: number;
    opportunitiesCreated?: number;
    opportunitiesUpdated?: number;
    companiesProcessed: number;
    companiesSucceeded: number;
    companiesFailed: number;
    recommendationsWritten: number;
  } | null;
};

export type MatchingActivationSnapshot = {
  matchingEnabledGlobal: boolean;
  run: RunState;
  activeOpportunities: number;
  eligibleProfiles: number;
  recommendationsVisible: number;
  tedIngestEnabled: boolean;
  tedFiltersConfigured: boolean;
};

function formatTs(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function runStatusLabel(status: RunState["status"]): string {
  switch (status) {
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}

export function MatchingActivationAdminPanel({
  initial,
}: {
  initial: MatchingActivationSnapshot;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snap, setSnap] = useState(initial);

  function applyResult(data: {
    matchingEnabledGlobal: boolean;
    run: RunState;
    summary?: RunState["lastSummary"];
    enabled?: boolean;
  }) {
    setSnap((prev) => ({
      ...prev,
      matchingEnabledGlobal:
        data.enabled ?? data.matchingEnabledGlobal ?? prev.matchingEnabledGlobal,
      run: data.run,
    }));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Matching control</h2>
            <p className="mt-1 text-sm text-slate-400">
              Global Matching Engine switch (same Feature flag as Features page).
              Enable runs opportunity refresh + recommendation generation for
              eligible companies.
            </p>
          </div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              snap.matchingEnabledGlobal
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-slate-700/60 text-slate-300"
            }`}
          >
            {snap.matchingEnabledGlobal ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Active opportunities" value={snap.activeOpportunities} />
          <Stat label="Eligible profiles" value={snap.eligibleProfiles} />
          <Stat
            label="Match recommendations"
            value={snap.recommendationsVisible}
          />
          <Stat
            label="Current run"
            value={runStatusLabel(snap.run.status)}
          />
          <Stat
            label="Last successful run"
            value={formatTs(snap.run.lastSuccessAt)}
          />
          <Stat
            label="Last opportunity refresh"
            value={formatTs(snap.run.lastOpportunityRefreshAt)}
          />
          <Stat
            label="TED ingest"
            value={
              snap.tedIngestEnabled
                ? snap.tedFiltersConfigured
                  ? "Configured"
                  : "ON (filters missing)"
                : "OFF"
            }
          />
          <Stat
            label="Last run at"
            value={formatTs(snap.run.lastRunAt)}
          />
        </div>

        {snap.run.lastErrorSafe ? (
          <p className="mt-4 rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
            {snap.run.lastErrorSafe}
          </p>
        ) : null}

        {snap.run.lastSummary ? (
          <p className="mt-3 text-xs text-slate-500">
            Last summary: companies {snap.run.lastSummary.companiesSucceeded}/
            {snap.run.lastSummary.companiesProcessed} ok
            {snap.run.lastSummary.companiesFailed
              ? ` (${snap.run.lastSummary.companiesFailed} failed)`
              : ""}
            {" · "}
            recs {snap.run.lastSummary.recommendationsWritten}
            {snap.run.lastSummary.ingestRan
              ? ` · opportunities upserted ${snap.run.lastSummary.opportunitiesUpserted ?? 0}`
              : snap.run.lastSummary.ingestSkippedReason
                ? ` · ingest skipped (${snap.run.lastSummary.ingestSkippedReason})`
                : ""}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending || snap.run.status === "running"}
            className={`h-10 rounded-lg px-4 text-sm font-medium text-white disabled:opacity-50 ${
              snap.matchingEnabledGlobal
                ? "bg-rose-700 hover:bg-rose-600"
                : "bg-emerald-600 hover:bg-emerald-500"
            }`}
            onClick={() => {
              setMessage(null);
              setError(null);
              const enabled = !snap.matchingEnabledGlobal;
              startTransition(() => {
                void saSetMatchingEngineGlobal({
                  enabled,
                  runWorkflowOnEnable: true,
                }).then((res) => {
                  if (!res.ok) {
                    setError(res.error.message);
                    return;
                  }
                  applyResult(res.data);
                  setMessage(
                    enabled
                      ? "Matching enabled. Opportunity refresh + generation finished."
                      : "Matching disabled. New generation is blocked.",
                  );
                  router.refresh();
                });
              });
            }}
          >
            {snap.matchingEnabledGlobal ? "Disable Matching" : "Enable Matching"}
          </button>

          <button
            type="button"
            disabled={
              pending ||
              !snap.matchingEnabledGlobal ||
              snap.run.status === "running"
            }
            className="h-10 rounded-lg border border-slate-600 bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            onClick={() => {
              setMessage(null);
              setError(null);
              startTransition(() => {
                void saRunMatchingNow().then((res) => {
                  if (!res.ok) {
                    setError(res.error.message);
                    return;
                  }
                  applyResult(res.data);
                  setMessage("Matching run completed.");
                  router.refresh();
                });
              });
            }}
          >
            Run Matching Now
          </button>

          <button
            type="button"
            disabled={pending || snap.run.status === "running"}
            className="h-10 rounded-lg border border-slate-600 bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            onClick={() => {
              setMessage(null);
              setError(null);
              startTransition(() => {
                void saRefreshMatchingOpportunities().then((res) => {
                  if (!res.ok) {
                    setError(res.error.message);
                    return;
                  }
                  applyResult(res.data);
                  setMessage(
                    res.data.summary.ingestRan
                      ? "Opportunity refresh completed."
                      : `Opportunity refresh skipped: ${res.data.summary.ingestSkippedReason ?? "unavailable"}`,
                  );
                  router.refresh();
                });
              });
            }}
          >
            Refresh opportunities
          </button>
        </div>

        {message ? (
          <p className="mt-4 text-sm text-emerald-300">{message}</p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        {pending ? (
          <p className="mt-3 text-xs text-slate-500">Working… this may take a minute.</p>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}
