"use client";

import {
  saCreateMatchingSponsorship,
  saSetMatchingSponsorshipGlobal,
  saTransitionMatchingSponsorship,
} from "@/app/actions/super-admin";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Sponsorship = {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  sponsorCompanyId: string;
  sponsorCompanyName: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  billingStatus: string | null;
  campaignMeta: unknown;
};

type Snapshot = {
  settings: { enabledGlobal: boolean };
  sponsorships: Sponsorship[];
};

export function MatchingSponsorshipAdminPanel({
  initial,
}: {
  initial: Snapshot;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enabledGlobal, setEnabledGlobal] = useState(
    initial.settings.enabledGlobal,
  );
  const [rows, setRows] = useState(initial.sponsorships);
  const [opportunityId, setOpportunityId] = useState("");
  const [sponsorCompanyId, setSponsorCompanyId] = useState("");
  const [campaignName, setCampaignName] = useState("");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-white">
          Global sponsorship switch
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          When OFF, opportunities are never labeled SPONSORED in matching.
          Sponsored items still must pass the 8C relevance gate — never
          pay-to-win.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={enabledGlobal}
            onChange={(e) => setEnabledGlobal(e.target.checked)}
            className="size-4 rounded border-slate-600"
          />
          Enable sponsored matching globally
        </label>
        <button
          type="button"
          disabled={pending}
          className="mt-4 h-10 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          onClick={() => {
            setMessage(null);
            setError(null);
            startTransition(() => {
              void saSetMatchingSponsorshipGlobal({ enabledGlobal }).then(
                (res) => {
                  if (!res.ok) {
                    setError(res.error.message);
                    return;
                  }
                  setEnabledGlobal(res.data.enabledGlobal);
                  setMessage("Global sponsorship setting saved.");
                  router.refresh();
                },
              );
            });
          }}
        >
          Save global setting
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-lg font-semibold text-white">Create sponsorship</h2>
        <p className="mt-1 text-sm text-slate-400">
          Foundation only — no Stripe/PayPal charges. Billing status stays
          NOT_REQUIRED.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="text-slate-300">Opportunity ID</span>
            <input
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100"
              value={opportunityId}
              onChange={(e) => setOpportunityId(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-slate-300">Sponsor company ID</span>
            <input
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100"
              value={sponsorCompanyId}
              onChange={(e) => setSponsorCompanyId(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-slate-300">Campaign name (optional)</span>
            <input
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={pending}
          className="mt-4 h-10 rounded-lg border border-slate-600 px-4 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          onClick={() => {
            setMessage(null);
            setError(null);
            startTransition(() => {
              void saCreateMatchingSponsorship({
                opportunityId: opportunityId.trim(),
                sponsorCompanyId: sponsorCompanyId.trim(),
                campaignMeta: campaignName.trim()
                  ? { name: campaignName.trim() }
                  : undefined,
              }).then((res) => {
                if (!res.ok) {
                  setError(res.error.message);
                  return;
                }
                setRows((prev) => [res.data, ...prev]);
                setMessage("Sponsorship created as DRAFT.");
                setOpportunityId("");
                setSponsorCompanyId("");
                setCampaignName("");
                router.refresh();
              });
            });
          }}
        >
          Create draft
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Campaigns</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {rows.length === 0 ? (
            <li className="text-slate-500">No sponsorships yet.</li>
          ) : (
            rows.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">
                      {s.opportunityTitle}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Sponsor: {s.sponsorCompanyName} · {s.status} · billing{" "}
                      {s.billingStatus ?? "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["ACTIVE", "PAUSED", "ENDED"] as const).map((to) => (
                      <button
                        key={to}
                        type="button"
                        disabled={pending || s.status === to}
                        className="h-8 rounded-md border border-slate-700 px-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                        onClick={() => {
                          setMessage(null);
                          setError(null);
                          startTransition(() => {
                            void saTransitionMatchingSponsorship({
                              sponsorshipId: s.id,
                              to,
                            }).then((res) => {
                              if (!res.ok) {
                                setError(res.error.message);
                                return;
                              }
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.id === res.data.id ? res.data : r,
                                ),
                              );
                              setMessage(`Sponsorship → ${to}`);
                              router.refresh();
                            });
                          });
                        }}
                      >
                        {to}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {message ? (
        <p className="text-sm text-emerald-400">{message}</p>
      ) : null}
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
    </div>
  );
}
