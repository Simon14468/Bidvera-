import { confirmAdminPassword } from "@/application/admin/auth-service";
import type { SuperAdminContext } from "@/auth/super-admin-session";
import { writeAdminAudit } from "@/services/admin/audit";
import {
  createPlatformBackup,
  getBackupDashboard,
  loadBackupSettings,
  parseBackupSettings,
  runRestoreTest,
  saveBackupSettings,
  verifyBackup,
} from "@/services/backup";
import { AppError, ErrorCode } from "@/lib/errors";

export async function getBackupDashboardForAdmin() {
  return getBackupDashboard();
}

export async function runBackupNowForAdmin(
  ctx: SuperAdminContext,
  password: string,
  ipHash: string | null,
) {
  await confirmAdminPassword(ctx, { password, confirm: true });
  const data = await createPlatformBackup({ triggeredBy: "manual" });
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: data.status === "SUCCESS" ? "BACKUP_COMPLETED" : "BACKUP_FAILED",
    targetType: "backup",
    targetId: data.id,
    ipHash,
    metadata: {
      status: data.status,
      method: data.method,
      byteLength: data.byteLength,
      integrity: data.integrity,
    },
  });
  return data;
}

export async function verifyBackupForAdmin(
  ctx: SuperAdminContext,
  password: string,
  backupId: string,
  ipHash: string | null,
) {
  await confirmAdminPassword(ctx, { password, confirm: true });
  const data = await verifyBackup(backupId);
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "BACKUP_VERIFIED",
    targetType: "backup",
    targetId: data.id,
    ipHash,
    metadata: { integrity: data.integrity },
  });
  return data;
}

export async function restoreTestBackupForAdmin(
  ctx: SuperAdminContext,
  input: { password: string; backupId: string; acknowledge: boolean },
  ipHash: string | null,
) {
  if (!input.acknowledge) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Confirm that this restore test must not target production.",
      400,
    );
  }
  await confirmAdminPassword(ctx, { password: input.password, confirm: true });
  const data = await runRestoreTest(input.backupId);
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "BACKUP_RESTORE_TESTED",
    targetType: "backup",
    targetId: data.id,
    ipHash,
    metadata: {
      ok: data.restoreTestOk,
      restoreTestAt: data.restoreTestAt,
    },
  });
  return data;
}

export async function saveBackupSettingsForAdmin(
  ctx: SuperAdminContext,
  password: string,
  raw: unknown,
  ipHash: string | null,
) {
  await confirmAdminPassword(ctx, { password, confirm: true });
  const previous = await loadBackupSettings();
  const parsed = parseBackupSettings({ ...previous, ...(raw as object) });
  const data = await saveBackupSettings(parsed);
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "BACKUP_SETTINGS_UPDATED",
    targetType: "backup_settings",
    ipHash,
    previousValue: {
      enabled: previous.enabled,
      intervalHours: previous.intervalHours,
      retentionDays: previous.retentionDays,
      rpoHours: previous.rpoHours,
      rtoHours: previous.rtoHours,
    },
    newValue: {
      enabled: data.enabled,
      intervalHours: data.intervalHours,
      retentionDays: data.retentionDays,
      rpoHours: data.rpoHours,
      rtoHours: data.rtoHours,
    },
  });
  return data;
}
