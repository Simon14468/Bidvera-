"use client";

import {
  saDeleteCompany,
  saIssueCompanyUserPasswordReset,
  saSetCompanyPlan,
  saSuspendCompany,
  saUpsertOverride,
} from "@/app/actions/super-admin";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function CompanyAdminActions({
  companyId,
  companySlug,
  companyName,
  companiesHref,
  suspended,
  users,
}: {
  companyId: string;
  companySlug: string;
  companyName: string;
  companiesHref: string;
  suspended: boolean;
  users: Array<{ id: string; name: string; email: string; role: string }>;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmSlug, setConfirmSlug] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [resetUserId, setResetUserId] = useState(users[0]?.id ?? "");
  const [planId, setPlanId] = useState<"free" | "trial" | "starter" | "pro" | "business">(
    "business",
  );
  const [planStatus, setPlanStatus] = useState<
    "ACTIVE" | "TRIALING" | "EXPIRED" | "CANCELED"
  >("ACTIVE");

  return (
    <div className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div>
        <h3 className="font-medium text-white">Sensitive actions</h3>
        <p className="text-xs text-slate-400">
          Re-enter Super Admin password to confirm. Password resets never reveal or store
          plaintext passwords.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Confirm password"
          className="mt-2 w-full max-w-sm rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !password}
          className="rounded-lg bg-amber-800 px-3 py-2 text-sm disabled:opacity-50"
          onClick={() =>
            start(async () => {
              const r = await saSuspendCompany({
                companyId,
                suspend: !suspended,
                password,
                reason: suspended ? undefined : "Suspended via Super Admin",
              });
              setMsg(r.ok ? "Updated" : r.error.message);
              if (r.ok) router.refresh();
            })
          }
        >
          {suspended ? "Reactivate company" : "Ban / Suspend company"}
        </button>
      </div>

      <div className="max-w-xl space-y-2 rounded-lg border border-red-900/50 bg-red-950/20 p-3">
        <h3 className="font-medium text-red-300">Delete company permanently</h3>
        <p className="text-xs text-slate-400">
          Removes the tenant and cascaded data. Type the slug{" "}
          <span className="text-slate-200">{companySlug}</span> to confirm.
        </p>
        <input
          value={confirmSlug}
          onChange={(e) => setConfirmSlug(e.target.value)}
          placeholder={companySlug}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          autoComplete="off"
        />
        <button
          type="button"
          disabled={pending || !password || confirmSlug !== companySlug}
          className="rounded-lg bg-red-800 px-3 py-2 text-sm disabled:opacity-50"
          onClick={() =>
            start(async () => {
              if (
                !window.confirm(
                  `Delete "${companyName}" permanently? This cannot be undone.`,
                )
              ) {
                return;
              }
              const r = await saDeleteCompany({
                companyId,
                confirmSlug,
                password,
              });
              if (!r.ok) {
                setMsg(r.error.message);
                return;
              }
              router.push(companiesHref);
              router.refresh();
            })
          }
        >
          Delete account
        </button>
      </div>

      <div className="grid max-w-xl gap-2">
        <h3 className="font-medium text-white">Subscription plan</h3>
        <p className="text-xs text-slate-400">
          Changes real entitlements for this same company (upgrade / downgrade / trial /
          expired).
        </p>
        <select
          value={planId}
          onChange={(e) =>
            setPlanId(e.target.value as "free" | "trial" | "starter" | "pro" | "business")
          }
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        >
          <option value="free">Free Workspace</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
        <select
          value={planStatus}
          onChange={(e) =>
            setPlanStatus(
              e.target.value as "ACTIVE" | "TRIALING" | "EXPIRED" | "CANCELED",
            )
          }
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="TRIALING">TRIALING</option>
          <option value="EXPIRED">EXPIRED</option>
          <option value="CANCELED">CANCELED</option>
        </select>
        <button
          type="button"
          disabled={pending || !password}
          className="rounded-lg bg-sky-700 px-3 py-2 text-sm disabled:opacity-50"
          onClick={() =>
            start(async () => {
              const r = await saSetCompanyPlan({
                companyId,
                planId,
                status: planStatus,
                password,
              });
              setMsg(
                r.ok
                  ? `Plan set to ${planId} (${planStatus}). Limit: ${r.data.limits.analysesLimit}`
                  : r.error.message,
              );
              if (r.ok) router.refresh();
            })
          }
        >
          Apply subscription plan
        </button>
      </div>

      <div className="grid max-w-xl gap-2">
        <h3 className="font-medium text-white">Owner / user password reset</h3>
        <p className="text-xs text-slate-400">
          Issues the standard secure reset email. No temporary plaintext password is
          created.
        </p>
        <select
          value={resetUserId}
          onChange={(e) => setResetUserId(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.email} · {u.role}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !password || !resetUserId}
          className="rounded-lg bg-amber-700 px-3 py-2 text-sm disabled:opacity-50"
          onClick={() =>
            start(async () => {
              const r = await saIssueCompanyUserPasswordReset({
                companyId,
                userId: resetUserId,
                password,
              });
              setMsg(r.ok ? r.data.message : r.error.message);
              if (r.ok) router.refresh();
            })
          }
        >
          Send secure password reset
        </button>
      </div>

      <form
        className="grid max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const r = await saUpsertOverride(
              {
                companyId,
                customName: String(fd.get("customName") || "") || null,
                monthlyPriceCents: Number(fd.get("monthlyPriceCents") || 0) || null,
                analysesLimit: Number(fd.get("analysesLimit") || 0) || null,
                seatsLimit: Number(fd.get("seatsLimit") || 0) || null,
                notes: String(fd.get("notes") || "") || null,
                features: String(fd.get("features") || "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                active: true,
              },
              password,
            );
            setMsg(r.ok ? "Custom plan saved" : r.error.message);
            if (r.ok) router.refresh();
          });
        }}
      >
        <h3 className="font-medium text-white">Custom plan override</h3>
        <input
          name="customName"
          placeholder="Custom plan name"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          name="monthlyPriceCents"
          type="number"
          placeholder="Monthly price (cents)"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          name="analysesLimit"
          type="number"
          placeholder="Analyses limit"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          name="seatsLimit"
          type="number"
          placeholder="Seats limit"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <input
          name="features"
          placeholder="Feature keys (comma-separated)"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <textarea
          name="notes"
          placeholder="Notes"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !password}
          className="rounded-lg bg-emerald-700 px-3 py-2 text-sm disabled:opacity-50"
        >
          Save custom plan
        </button>
      </form>
      {msg ? <p className="text-sm text-slate-300">{msg}</p> : null}
    </div>
  );
}
