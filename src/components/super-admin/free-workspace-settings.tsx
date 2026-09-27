"use client";

import { saUpsertPlan } from "@/app/actions/super-admin";
import {
  buildFreeWorkspaceSettingsPayload,
  type AdminPlanRow,
} from "@/application/admin/plan-view-model";
import { ENTITLEMENT_CATALOG } from "@/domain/billing/entitlement-catalog";
import { parseOptionalQuotaLimit } from "@/services/billing/free-plan-guard";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const inputClass =
  "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100";

function formatLimit(value: number | null | undefined, unit: string): string {
  if (value == null) return `Unlimited ${unit}`;
  return `${value} ${unit}`;
}

export function FreeWorkspaceSettings({
  plan,
  entitlementKeys,
}: {
  plan: AdminPlanRow;
  entitlementKeys: string[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [trialEligible, setTrialEligible] = useState(plan.trialEligible);
  const [featureKeys, setFeatureKeys] = useState<string[]>(plan.featureKeys);

  const catalog = useMemo(
    () =>
      ENTITLEMENT_CATALOG.filter(
        (entry) =>
          entitlementKeys.includes(entry.key) && !entry.hiddenInAdmin,
      ),
    [entitlementKeys],
  );

  const enabledLabels = catalog
    .filter((entry) => featureKeys.includes(entry.key))
    .map((entry) => entry.adminLabel);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const fd = new FormData(form);
        const trialRaw = String(fd.get("trialDays") ?? "").trim();
        const trialDays = trialRaw
          ? Number(trialRaw)
          : null;
        start(async () => {
          const payload = buildFreeWorkspaceSettingsPayload(
            plan,
            {
              trialEligible,
              trialDays:
                trialDays != null && Number.isFinite(trialDays) && trialDays >= 0
                  ? Math.floor(trialDays)
                  : null,
              featureKeys,
              seatsLimit: Number(fd.get("seatsLimit") || 1),
              aiTokensLimit: parseOptionalQuotaLimit(
                String(fd.get("aiTokensLimit") ?? ""),
              ),
              storageMbLimit: parseOptionalQuotaLimit(
                String(fd.get("storageMbLimit") ?? ""),
              ),
            },
            entitlementKeys,
          );
          const result = await saUpsertPlan(payload);
          setMsg(
            result.ok
              ? "Free Workspace settings saved."
              : result.error.message,
          );
          if (result.ok) router.refresh();
        });
      }}
    >
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Current status
        </p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Plan</dt>
            <dd className="text-white">{plan.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd
              className={
                plan.status === "ACTIVE" ? "text-emerald-400" : "text-amber-400"
              }
            >
              {plan.status === "ACTIVE" ? "Active" : "Inactive"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Trial eligible</dt>
            <dd className="text-slate-200">
              {plan.trialEligible ? "Yes" : "No"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Trial duration</dt>
            <dd className="text-slate-200">
              {plan.trialDays != null ? `${plan.trialDays} days` : "Not set"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Configured limits</dt>
            <dd className="text-slate-200">
              {plan.seatsLimit} seats ·{" "}
              {formatLimit(plan.aiTokensLimit, "AI tokens")} ·{" "}
              {formatLimit(plan.storageMbLimit, "MB storage")}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Enabled features</dt>
            <dd className="text-slate-200">
              {enabledLabels.length ? enabledLabels.join(", ") : "None"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3 rounded-xl border border-emerald-800/70 bg-emerald-950/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
          First-signup trial
        </p>
        <p className="text-sm text-slate-400">
          New workspaces receive Free Workspace automatically on first signup. No
          payment method is required.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={trialEligible}
            onChange={(event) => setTrialEligible(event.target.checked)}
          />
          Enable first-signup trial
        </label>
        <label className="block text-xs text-slate-400">
          Trial duration (days)
          <input
            name="trialDays"
            type="number"
            min={1}
            max={365}
            defaultValue={plan.trialDays ?? 14}
            className={`mt-1 w-full max-w-xs ${inputClass}`}
          />
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Features available during the Free Workspace trial
        </p>
        <p className="text-xs text-slate-500">
          These PlanFeature flags are the source of truth for trial access.
          Internal Super Admin-only modules stay off this list.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {catalog.map((entry) => (
            <label
              key={entry.key}
              className="flex items-start gap-2 text-sm text-slate-200"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={featureKeys.includes(entry.key)}
                onChange={(event) => {
                  setFeatureKeys((prev) =>
                    event.target.checked
                      ? [...prev, entry.key]
                      : prev.filter((key) => key !== entry.key),
                  );
                }}
              />
              <span>
                <span className="font-medium">{entry.adminLabel}</span>
                <span className="block text-[11px] text-slate-500">
                  {entry.enforced ? "Enforced" : "Catalog flag"} · {entry.key}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Limits
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-400">
            Seats
            <input
              name="seatsLimit"
              type="number"
              min={1}
              required
              defaultValue={plan.seatsLimit}
              className={`mt-1 w-full ${inputClass}`}
            />
          </label>
          <label className="text-xs text-slate-400">
            AI token limit (empty = unlimited, 0 = blocked)
            <input
              name="aiTokensLimit"
              type="number"
              min={0}
              defaultValue={plan.aiTokensLimit ?? ""}
              placeholder="unlimited"
              className={`mt-1 w-full ${inputClass}`}
            />
          </label>
          <label className="text-xs text-slate-400">
            Storage MB (empty = unlimited, 0 = blocked)
            <input
              name="storageMbLimit"
              type="number"
              min={0}
              defaultValue={plan.storageMbLimit ?? ""}
              placeholder="unlimited"
              className={`mt-1 w-full ${inputClass}`}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          After the trial
        </p>
        <p className="mt-2 text-sm text-slate-400">
          After the configured trial period ends, the workspace becomes EXPIRED
          and payment is required. Free Workspace is not converted into an
          indefinite ACTIVE subscription.
        </p>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        Save Free Workspace settings
      </button>
      {msg ? <p className="text-sm text-emerald-300/90">{msg}</p> : null}
    </form>
  );
}
