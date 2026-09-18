import { requireSuperAdmin } from "@/auth/super-admin-session";
import { ProductionReadinessPanel } from "@/components/super-admin/production-readiness-admin";
import { collectProductionReadiness } from "@/services/production-readiness/checks";

export const dynamic = "force-dynamic";

export default async function SaProductionReadinessPage() {
  await requireSuperAdmin();
  const snapshot = await collectProductionReadiness();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Production readiness</h1>
        <p className="mt-1 text-sm text-slate-400">
          Read-only live checks. Each row is READY, NOT_CONFIGURED, or ERROR from real
          backend/config probes — never invented credentials or assumed external success.
        </p>
      </div>
      <ProductionReadinessPanel initial={snapshot} />
    </div>
  );
}
