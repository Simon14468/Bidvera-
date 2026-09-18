import { requireSuperAdmin } from "@/auth/super-admin-session";
import { LoadTestAdminPanel } from "@/components/super-admin/load-test-admin";
import {
  readLoadTestReport,
  toPublicLoadTestSnapshot,
} from "@/services/load-test/report";

export const dynamic = "force-dynamic";

export default async function SaLoadTestPage() {
  await requireSuperAdmin();
  const report = await readLoadTestReport();
  const snapshot = toPublicLoadTestSnapshot(report);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Load test results</h1>
        <p className="mt-1 text-sm text-slate-400">
          Read-only view of the latest report from the dedicated Docker + k6 suite.
          There is no production run button. PASS is shown only when stored results meet thresholds.
        </p>
      </div>
      <LoadTestAdminPanel initial={snapshot} />
    </div>
  );
}
