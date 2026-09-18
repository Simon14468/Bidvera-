"use client";

import { saDeleteCompany, saSuspendCompany } from "@/app/actions/super-admin";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function CompanyListActions({
  companyId,
  companyName,
  companySlug,
  suspended,
}: {
  companyId: string;
  companyName: string;
  companySlug: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmSlug, setConfirmSlug] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
        onClick={() => {
          setOpen((v) => !v);
          setMsg(null);
        }}
      >
        {open ? "Close" : "Ban / Delete"}
      </button>
      {open ? (
        <div className="min-w-[220px] space-y-2 rounded-lg border border-slate-700 bg-slate-950 p-2">
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
            className="w-full rounded-md bg-amber-800 px-2 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            onClick={() =>
              start(async () => {
                const r = await saSuspendCompany({
                  companyId,
                  suspend: !suspended,
                  password,
                  reason: suspended
                    ? undefined
                    : "Banned / suspended from Super Admin companies list",
                });
                setMsg(r.ok ? (suspended ? "Reactivated" : "Banned (suspended)") : r.error.message);
                if (r.ok) {
                  setPassword("");
                  router.refresh();
                }
              })
            }
          >
            {suspended ? "Reactivate" : "Ban / Suspend"}
          </button>
          <div className="border-t border-slate-800 pt-2">
            <p className="mb-1 text-[10px] leading-snug text-slate-500">
              Permanent delete. Type slug <span className="text-slate-300">{companySlug}</span>
            </p>
            <input
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={companySlug}
              className="mb-1.5 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs"
              autoComplete="off"
            />
            <button
              type="button"
              disabled={pending || !password || confirmSlug !== companySlug}
              className="w-full rounded-md bg-red-800 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
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
                  setMsg(r.ok ? "Deleted" : r.error.message);
                  if (r.ok) {
                    setPassword("");
                    setConfirmSlug("");
                    setOpen(false);
                    router.refresh();
                  }
                })
              }
            >
              Delete account
            </button>
          </div>
          {msg ? <p className="text-[11px] text-slate-300">{msg}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
