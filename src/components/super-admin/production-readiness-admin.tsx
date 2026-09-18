"use client";

import type { ProductionReadinessSnapshot } from "@/services/production-readiness/checks";

function statusClass(s: string) {
  if (s === "READY") return "text-emerald-400";
  if (s === "NOT_CONFIGURED") return "text-amber-400";
  return "text-rose-400";
}

export function ProductionReadinessPanel({
  initial,
}: {
  initial: ProductionReadinessSnapshot;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Overall</p>
          <p className={`mt-1 text-lg font-medium ${statusClass(initial.overall)}`}>
            {initial.overall}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">NODE_ENV</p>
          <p className="mt-1 text-sm text-white">{initial.nodeEnv}</p>
        </div>
        <div className="rounded-xl border border-slate-800 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Checked at</p>
          <p className="mt-1 text-sm text-slate-300">
            {new Date(initial.checkedAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Check</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {initial.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-800/80">
                <td className="px-4 py-3 text-white">{item.label}</td>
                <td className={`px-4 py-3 font-medium ${statusClass(item.status)}`}>
                  {item.status}
                </td>
                <td className="px-4 py-3 text-slate-400">{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Public probes: <code className="text-slate-400">/api/health</code> (liveness) ·{" "}
        <code className="text-slate-400">/api/ready</code> (readiness, 503 when not ready).
        Neither exposes secrets or paths.
      </p>
    </div>
  );
}
