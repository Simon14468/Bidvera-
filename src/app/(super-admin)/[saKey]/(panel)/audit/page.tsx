import { listAdminAuditLogs } from "@/application/admin/platform-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";

export const dynamic = "force-dynamic";

export default async function SaAuditPage() {
  await requireSuperAdmin();
  const logs = await listAdminAuditLogs(150);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Admin audit log</h1>
        <p className="mt-1 text-sm text-slate-400">
          Sensitive platform actions with admin identity and timestamps.
        </p>
      </div>
      <div className="space-y-2">
        {logs.map((l) => (
          <div
            key={l.id}
            className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-white">{l.action}</p>
              <p className="text-xs text-slate-500">
                {l.createdAt.toLocaleString()}
              </p>
            </div>
            <p className="mt-1 text-slate-400">
              {l.adminUser?.email ?? "system"} · {l.targetType ?? "—"} ·{" "}
              {l.targetId ?? "—"}
            </p>
          </div>
        ))}
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">No admin actions recorded yet.</p>
        ) : null}
      </div>
    </div>
  );
}
