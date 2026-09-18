"use client";

import { saToggleFeature } from "@/app/actions/super-admin";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function FeatureToggleRow({
  featureKey,
  name,
  enabledGlobal,
  moduleBadge = null,
}: {
  featureKey: string;
  name: string;
  enabledGlobal: boolean;
  moduleBadge?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const on = optimistic ?? enabledGlobal;

  function toggle() {
    if (pending) return;
    const next = !on;
    setError(null);
    setOptimistic(next);
    start(async () => {
      const res = await saToggleFeature({
        featureKey,
        enabled: next,
        scope: "GLOBAL",
      });
      if (!res.ok) {
        setOptimistic(null);
        setError(res.error.message);
        return;
      }
      setOptimistic(null);
      router.refresh();
    });
  }

  return (
    <tr className="border-b border-slate-800/70 last:border-0">
      <td className="px-4 py-3 align-middle">
        <p className="font-medium text-white">
          {name}
          {moduleBadge ? (
            <span className="ms-2 rounded border border-emerald-700/60 bg-emerald-950/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              module · {moduleBadge}
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-slate-500">{featureKey}</p>
        {error ? (
          <p className="mt-1.5 max-w-md text-xs text-rose-400" role="alert">
            {error}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-3">
          <span
            className={`min-w-[2.25rem] text-xs font-semibold tracking-wide ${
              on ? "text-emerald-400" : "text-slate-500"
            }`}
          >
            {pending ? "…" : on ? "ON" : "OFF"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-busy={pending}
            aria-label={`${name}: ${on ? "on" : "off"}. Click to turn ${on ? "off" : "on"}.`}
            disabled={pending}
            onClick={toggle}
            className={[
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500",
              "disabled:cursor-wait disabled:opacity-60",
              on
                ? "border-emerald-400/50 bg-emerald-500"
                : "border-slate-600 bg-slate-700 hover:bg-slate-600",
            ].join(" ")}
          >
            <span
              aria-hidden
              className={[
                "pointer-events-none absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200",
                on ? "translate-x-6" : "translate-x-0.5",
              ].join(" ")}
            />
          </button>
        </div>
      </td>
    </tr>
  );
}
