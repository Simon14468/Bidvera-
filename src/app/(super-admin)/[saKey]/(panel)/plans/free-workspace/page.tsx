import { listPlansForAdmin } from "@/application/admin/plan-service";
import {
  mapPlanToAdminRow,
  pickExistingFreeWorkspacePlan,
} from "@/application/admin/plan-view-model";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { FreeWorkspaceSettings } from "@/components/super-admin/free-workspace-settings";
import { getSuperAdminPath } from "@/config/super-admin";
import { ADMIN_ENTITLEMENT_KEYS } from "@/domain/billing/entitlement-catalog";
import {
  hasDuplicateFreeWorkspacePlans,
  isDesignatedFreeWorkspaceIdentity,
  listConflictingFreeWorkspacePlans,
} from "@/services/billing/free-workspace-identity";

export const dynamic = "force-dynamic";

export default async function SaFreeWorkspacePlanPage() {
  await requireSuperAdmin();
  const plans = await listPlansForAdmin();
  const entitlementKeys = [...ADMIN_ENTITLEMENT_KEYS];
  const rows = plans.map((p) => mapPlanToAdminRow(p, entitlementKeys));
  const plan = pickExistingFreeWorkspacePlan(rows);
  const base = `/${getSuperAdminPath()}`;
  const duplicateFreeWorkspace = hasDuplicateFreeWorkspacePlans(rows);
  const extraFreeWorkspace = listConflictingFreeWorkspacePlans(rows);
  const designated = plan ? isDesignatedFreeWorkspaceIdentity(plan) : false;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Free Workspace Trial Settings
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">
          Free Workspace
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Configure the official default first-signup trial. Eligible new
          companies receive this existing catalog plan automatically as a dated
          TRIALING subscription.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Features and limits saved here are the same PlanFeature / entitlement
          records used by onboarding, the dashboard countdown, billing display,
          and access checks. Tender Analysis stays Super Admin-only.
        </p>
        <a
          href={`${base}/plans`}
          className="mt-3 inline-block text-sm text-emerald-300 hover:text-white"
        >
          ← All plans
        </a>
      </div>
      {duplicateFreeWorkspace ? (
        <div className="rounded-xl border border-amber-800/70 bg-amber-950/20 p-4 text-sm text-amber-100">
          <p className="font-semibold">Duplicate Free Workspace plans detected</p>
          <p className="mt-1 text-amber-200/90">
            This page edits the existing system plan and does not create another
            one. Extra isFree rows were not deleted.
          </p>
          <ul className="mt-2 list-disc ps-5">
            {extraFreeWorkspace.map((row) => (
              <li key={row.id}>
                {row.name} ({row.slug})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {plan && !designated ? (
        <div className="rounded-xl border border-amber-800/70 bg-amber-950/20 p-4 text-sm text-amber-100">
          The designated Free Workspace identity is slug <code>free</code> with
          isFree. Automatic first-signup grants use only that official plan.
        </div>
      ) : null}
      {plan ? (
        <FreeWorkspaceSettings
          entitlementKeys={entitlementKeys}
          plan={plan}
        />
      ) : (
        <div className="rounded-xl border border-amber-800/70 bg-amber-950/20 p-4 text-sm text-amber-100">
          The official Free Workspace plan (slug <code>free</code>) was not
          found. This page configures the existing system plan and does not
          create a new one.
        </div>
      )}
    </div>
  );
}
