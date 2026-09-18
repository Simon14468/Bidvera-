import { requireSuperAdmin } from "@/auth/super-admin-session";
import { BackupAdminPanel } from "@/components/super-admin/backup-admin";
import { getBackupDashboardForAdmin } from "@/application/admin/backup-service";

export const dynamic = "force-dynamic";

export default async function SaBackupsPage() {
  await requireSuperAdmin();
  const snapshot = await getBackupDashboardForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Backup & disaster recovery</h1>
        <p className="mt-1 text-sm text-slate-400">
          Encrypted platform backups of Postgres, uploaded files, and recovery metadata.
          Status below is live backend state — never assumed healthy.
        </p>
      </div>
      <BackupAdminPanel initial={snapshot} />
    </div>
  );
}
