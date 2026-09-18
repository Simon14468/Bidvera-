"use client";

import { saSetCompanyPlan } from "@/app/actions/super-admin";
import type { PlanId } from "@/config/plans";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const PLAN_OPTIONS: Array<{
  id: PlanId;
  label: string;
  rank: number;
  defaultStatus: "ACTIVE" | "TRIALING";
}> = [
  { id: "free", label: "Free", rank: 0, defaultStatus: "ACTIVE" },
  { id: "trial", label: "Trial", rank: 1, defaultStatus: "TRIALING" },
  { id: "starter", label: "Starter", rank: 2, defaultStatus: "ACTIVE" },
  { id: "pro", label: "Pro", rank: 3, defaultStatus: "ACTIVE" },
  { id: "business", label: "Business", rank: 4, defaultStatus: "ACTIVE" },
];

const STATUS_OPTIONS = [
  "ACTIVE",
  "TRIALING",
  "EXPIRED",
  "CANCELED",
  "PAST_DUE",
] as const;

function planIdFromPrisma(plan: string): PlanId {
  const key = plan.toUpperCase();
  if (key === "FREE") return "free";
  if (key === "STARTER") return "starter";
  if (key === "PRO") return "pro";
  if (key === "BUSINESS") return "business";
  return "trial";
}

export function CompanyListPlanControl({
  companyId,
  planName,
  planEnum,
  subscriptionStatus,
}: {
  companyId: string;
  planName: string;
  /** Prisma Plan enum e.g. TRIAL */
  planEnum: string;
  subscriptionStatus: string;
}) {
  const router = useRouter();
  const currentId = planIdFromPrisma(planEnum);
  const currentRank =
    PLAN_OPTIONS.find((p) => p.id === currentId)?.rank ?? 1;

  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState<PlanId>(currentId);
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>(
    (STATUS_OPTIONS as readonly string[]).includes(subscriptionStatus)
      ? (subscriptionStatus as (typeof STATUS_OPTIONS)[number])
      : "ACTIVE",
  );
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const direction = useMemo(() => {
    const next = PLAN_OPTIONS.find((p) => p.id === planId);
    if (!next || planId === currentId) return null;
    if (next.rank > currentRank) return `Upgrade → ${next.label}`;
    if (next.rank < currentRank) return `Downgrade → ${next.label}`;
    return null;
  }, [planId, currentId, currentRank]);

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
              const next = e.target.value as PlanId;
              setPlanId(next);
              const cfg = PLAN_OPTIONS.find((p) => p.id === next);
              if (cfg) setStatus(cfg.defaultStatus);
            }}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs"
          >
            {PLAN_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.id === currentId ? " (current)" : ""}
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
            disabled={pending || !password}
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
