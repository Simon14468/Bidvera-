"use client";

import { saSetCompanyPlan } from "@/app/actions/super-admin";
import {
  defaultStatusForGrantablePlan,
  type GrantableAdminPlan,
} from "@/application/admin/grantable-plans";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const STATUS_OPTIONS = [
  "ACTIVE",
  "TRIALING",
  "EXPIRED",
  "CANCELED",
  "PAST_DUE",
] as const;

export function CompanyListPlanControl({
  companyId,
  planName,
  planSlug,
  subscriptionStatus,
  plans,
}: {
  companyId: string;
  planName: string;
  planSlug: string;
  subscriptionStatus: string;
  plans: GrantableAdminPlan[];
}) {
  const router = useRouter();
  const options = plans;
  const currentId = options.some((p) => p.slug === planSlug)
    ? planSlug
    : (options[0]?.slug ?? "");
  const currentRank = options.find((p) => p.slug === currentId)?.sortOrder ?? 0;

  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState(currentId);
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>(
    (STATUS_OPTIONS as readonly string[]).includes(subscriptionStatus)
      ? (subscriptionStatus as (typeof STATUS_OPTIONS)[number])
      : "ACTIVE",
  );
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const direction = useMemo(() => {
    const next = options.find((p) => p.slug === planId);
    if (!next || planId === currentId) return null;
    if (next.sortOrder > currentRank) return `Upgrade → ${next.name}`;
    if (next.sortOrder < currentRank) return `Downgrade → ${next.name}`;
    return null;
  }, [planId, currentId, currentRank, options]);

  return (
    <div className="min-w-[140px]">
      <p className="font-medium text-slate-100">{planName}</p>
      <p className="text-xs text-slate-500">{subscriptionStatus}</p>
      <button
        type="button"
        className="mt-1 text-xs font-medium text-sky-400 hover:text-sky-300 hover:underline"
        onClick={() => {
          setOpen((v) => !v);
          setPlanId(currentId);
          setMsg(null);
        }}
      >
        {open ? "Cancel" : "Change plan"}
      </button>

      {open ? (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-lg">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Manual grant · no payment
          </p>
          <select
            value={planId}
            onChange={(e) => {
              const next = e.target.value;
              setPlanId(next);
              const cfg = options.find((p) => p.slug === next);
              if (cfg) setStatus(defaultStatusForGrantablePlan(cfg));
            }}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs"
          >
            {options.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
                {p.slug === currentId ? " (current)" : ""}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as (typeof STATUS_OPTIONS)[number])
            }
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {direction ? (
            <p className="text-[11px] font-medium text-emerald-400">{direction}</p>
          ) : (
            <p className="text-[11px] text-slate-500">Same plan · status only</p>
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="SA password"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs"
            autoComplete="current-password"
          />
          <button
            type="button"
            disabled={pending || !password || !planId}
            className="w-full rounded-md bg-sky-700 px-2 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50"
            onClick={() =>
              start(async () => {
                const r = await saSetCompanyPlan({
                  companyId,
                  planId,
                  status,
                  password,
                });
                if (!r.ok) {
                  setMsg(r.error.message);
                  return;
                }
                setMsg(
                  `Applied ${planId} · ${r.data.limits.planName} (${r.data.limits.analysesLimit === 0 ? "∞" : r.data.limits.analysesLimit} analyses)`,
                );
                setPassword("");
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending ? "Applying…" : "Apply plan"}
          </button>
          {msg ? <p className="text-[11px] text-slate-300">{msg}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
