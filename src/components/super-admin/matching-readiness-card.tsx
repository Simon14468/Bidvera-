"use client";

import {
  saRebuildMatchingProfile,
} from "@/app/actions/super-admin";
import type { SaMatchingReadinessDto } from "@/application/admin/matching-readiness";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function MatchingReadinessCard({
  readiness,
  companyId,
}: {
  readiness: SaMatchingReadinessDto;
  companyId: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-xl border border-slate-800 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-white">Matching readiness</h2>
          <p className="mt-1 text-xs text-slate-400">
            Diagnostic only — does not enable Matching Engine, invent capabilities, or
            change scoring.
          </p>
        </div>
        {readiness.isTestFixture ? (
          <span className="rounded bg-amber-900/50 px-2 py-1 text-xs text-amber-200">
            ME8 test fixture — excluded from activation counts
          </span>
        ) : null}
      </div>

      <dl className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-slate-500">Eligible</dt>
          <dd className={readiness.eligible ? "text-emerald-400" : "text-rose-300"}>
            {readiness.eligible ? "Yes" : "No"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Completeness</dt>
          <dd>{readiness.completeness}%</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Stored profile</dt>
          <dd>
            {readiness.storedProfile.exists
              ? `v${readiness.storedProfile.version ?? "?"} · ${
                  readiness.storedProfile.stale ? "stale" : "fresh"
                }`
              : "missing"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">TED service overlap</dt>
          <dd>
            {readiness.tedOverlap
              ? `${readiness.tedOverlap.serviceOverlapScore}% (${readiness.tedOverlap.liveTedOpportunityCount} live TED)`
              : "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Blockers</dt>
          <dd>
            {readiness.blockers.length
              ? readiness.blockers.join("; ")
              : "None"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Missing signals</dt>
          <dd>
            {readiness.missingSignals.length
              ? readiness.missingSignals.join(", ")
              : "None"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Services / capabilities</dt>
          <dd>{readiness.services.join(", ") || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Geography</dt>
          <dd>{readiness.geographies.join(", ") || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-slate-500">Certifications / DCM</dt>
          <dd>{readiness.certifications.join(", ") || "—"}</dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-slate-800 pt-3">
        <p className="text-xs text-slate-400">
          Rebuild Matching Profile from live Company / SQ / DCM / questionnaire sources
          only (password required).
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Confirm SA password"
            className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending || !password}
            className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white disabled:opacity-50 hover:bg-slate-600"
            onClick={() =>
              start(async () => {
                const r = await saRebuildMatchingProfile({
                  companyId,
                  password,
                });
                setMsg(r.ok ? "Matching profile rebuilt" : r.error.message);
                if (r.ok) router.refresh();
              })
            }
          >
            Rebuild matching profile
          </button>
        </div>
        {msg ? <p className="mt-2 text-xs text-slate-400">{msg}</p> : null}
      </div>
    </section>
  );
}
