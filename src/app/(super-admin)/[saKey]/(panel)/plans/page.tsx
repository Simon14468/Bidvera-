import { listPlansForAdmin } from "@/application/admin/plan-service";
import { mapPlanToAdminRow } from "@/application/admin/plan-view-model";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { PlansManager } from "@/components/super-admin/plan-form";
import { getSuperAdminPath } from "@/config/super-admin";
import { ADMIN_ENTITLEMENT_KEYS } from "@/domain/billing/entitlement-catalog";
import {
  hasDuplicateFreeWorkspacePlans,
  listConflictingFreeWorkspacePlans,
} from "@/services/billing/free-workspace-identity";

export const dynamic = "force-dynamic";

export default async function SaPlansPage() {
  await requireSuperAdmin();
  const plans = await listPlansForAdmin();
  const entitlementKeys = [...ADMIN_ENTITLEMENT_KEYS];
  const rows = plans.map((p) => mapPlanToAdminRow(p, entitlementKeys));
  const base = `/${getSuperAdminPath()}`;
  const duplicateFreeWorkspace = hasDuplicateFreeWorkspacePlans(rows);
  const extraFreeWorkspace = listConflictingFreeWorkspacePlans(rows);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Plans & Entitlements</h1>
        <p className="mt-1 text-sm text-slate-400">
          Prices, limits, and real entitlements enforce Paywall, checkout, and
          product access. Marketing Languages remain separate display copy.
        </p>
      </div>
      {duplicateFreeWorkspace ? (
        <div className="rounded-xl border border-amber-800/70 bg-amber-950/20 p-4 text-sm text-amber-100">
          <p className="font-semibold">Duplicate Free Workspace plans detected</p>
          <p className="mt-1 text-amber-200/90">
            Only one designated system plan (slug <code>free</code>, isFree)
            may exist. Extra rows were not deleted. Remove or convert the extras
            before creating another Free Workspace identity.
          </p>
          <ul className="mt-2 list-disc ps-5 text-amber-100/90">
            {extraFreeWorkspace.map((plan) => (
              <li key={plan.id}>
                {plan.name} ({plan.slug})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
          href={`${base}/plans/free-workspace`}
          className="mt-3 inline-flex rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-600"
        >
          Configure Free Workspace
        </a>
      </div>
      <PlansManager
        entitlementKeys={entitlementKeys}
        plans={rows}
      />
    </div>
  );
}
