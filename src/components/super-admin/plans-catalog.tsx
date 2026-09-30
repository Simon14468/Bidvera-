"use client";

import type { AdminPlanRow } from "@/application/admin/plan-view-model";
import { PlansManager } from "@/components/super-admin/plan-form";
import { useState } from "react";

export function PlansCatalog({
  plans,
  entitlementKeys,
  freeWorkspaceHref,
}: {
  plans: AdminPlanRow[];
  entitlementKeys: string[];
  freeWorkspaceHref: string;
}) {
  const [createNonce, setCreateNonce] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-400">
          Create paid catalog plans here. They sync to the database and appear on
          public pricing, upgrade, and checkout when Active and Visible.
        </p>
        <button
          type="button"
          onClick={() => setCreateNonce((n) => n + 1)}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
        >
          Add new plan
        </button>
      </div>

      <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
          Default first-signup trial
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">Free Workspace</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Configure the automatic 14-day first-signup trial, trial features, and
          limits on a dedicated page. This catalog plan is the single source of
          truth for onboarding grants and entitlements.
        </p>
        <a
          href={freeWorkspaceHref}
          className="mt-3 inline-flex rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-600"
        >
          Configure Free Workspace
        </a>
      </div>

      <PlansManager
        entitlementKeys={entitlementKeys}
        plans={plans}
        createNonce={createNonce}
      />
    </div>
  );
}
