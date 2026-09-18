import { randomBytes } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { escapeHtml } from "@/lib/html";
import { AppError, ErrorCode } from "@/lib/errors";
import { getSetting, setSetting } from "@/services/settings";
import { logError, logInfo } from "@/services/observability";
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_SETTINGS_KEY,
  DEFAULT_BACKUP_SETTINGS,
  STALE_LOCK_MS,
  loadBackupSettingsSafe,
  parseBackupSettings,
  resolveBackupRoot,
  resolveLandingUploadsRoot,
  resolveStorageRoot,
  restoreDatabaseUrlIsIsolated,
  sanitizeBackupError,
  type BackupSettings,
} from "@/services/backup/config";
import { decryptBackupPayload, encryptBackupPayload, sha256Hex } from "@/services/backup/crypto";
import { criticalTablesPresent, dumpPrismaLogical, tryPgDump, tryPgRestore, verifyIsolatedRestoreTables } from "@/services/backup/dump";
import { extractBackupZipSafely } from "@/services/backup/extract";
import {
  archivePath,
  cleanupExpiredBackups,
  inspectBackupStorage,
  listManifests,
  lockPath,
  readManifest,
  writeManifest,
} from "@/services/backup/store";
import type {
  BackupDashboard,
  BackupIntegrity,
  BackupManifest,
  BackupMethod,
  BackupTrigger,
  PublicBackupRow,
  RecoveryStatus,
} from "@/services/backup/types";

export { BACKUP_SETTINGS_KEY, parseBackupSettings, DEFAULT_BACKUP_SETTINGS };
export type { BackupSettings };

function newBackupId(): string {
  return `bck_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

export async function loadBackupSettings(): Promise<BackupSettings> {
  const raw = await getSetting<unknown>(BACKUP_SETTINGS_KEY, DEFAULT_BACKUP_SETTINGS);
  return loadBackupSettingsSafe(raw);
}

export async function saveBackupSettings(next: BackupSettings): Promise<BackupSettings> {
  const parsed = parseBackupSettings(next);
  await setSetting(
    BACKUP_SETTINGS_KEY,
    parsed,
    "Backup schedule, retention, and recovery targets",
  );
  return parsed;
}

async function countFilesRecursive(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    let n = 0;
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) n += await countFilesRecursive(full);
      else n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}

async function copyIfExists(src: string, dest: string): Promise<number> {
  try {
    const info = await stat(src);
    if (!info.isDirectory()) return 0;
    await cp(src, dest, { recursive: true, force: true });
    return countFilesRecursive(dest);
  } catch {
    return 0;
  }
}

async function schemaFingerprint(): Promise<string | null> {
  try {
    const schema = await readFile(path.join(process.cwd(), "prisma", "schema.prisma"));
    return sha256Hex(schema);
  } catch {
    return null;
  }
}

async function acquireLock(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  const file = lockPath(root);
  const payload = JSON.stringify({
    at: new Date().toISOString(),
    pid: process.pid,
  });

  // Exclusive create so multiple web instances + worker cannot TOCTOU-race the lock file.
  try {
    await writeFile(file, payload, { flag: "wx" });
    return;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
    if (code !== "EEXIST") throw error;
  }

  try {
    const existing = JSON.parse(await readFile(file, "utf8")) as { at?: string };
    const at = existing.at ? Date.parse(existing.at) : 0;
    if (Number.isFinite(at) && Date.now() - at < STALE_LOCK_MS) {
      throw new AppError(ErrorCode.CONFLICT, "A backup is already running.", 409);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
  }

  await rm(file, { force: true });
  try {
    await writeFile(file, payload, { flag: "wx" });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
    if (code === "EEXIST") {
      throw new AppError(ErrorCode.CONFLICT, "A backup is already running.", 409);
    }
    throw error;
  }
}

async function releaseLock(root: string): Promise<void> {
  await rm(lockPath(root), { force: true });
}

function ageHours(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  return Math.round(((now - ts) / 36e5) * 10) / 10;
}

export function toPublicBackupRow(row: BackupManifest, now = Date.now()): PublicBackupRow {
  return {
    id: row.id,
    status: row.status,
    method: row.method,
    byteLength: row.byteLength,
    checksumSha256: row.checksumSha256,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    ageHours: ageHours(row.completedAt ?? row.startedAt, now),
    triggeredBy: row.triggeredBy,
    integrity: row.integrity,
    errorSafe: row.errorSafe,
    tableCount: Object.keys(row.tableCounts ?? {}).length,
    fileCount: row.fileCount,
    restoreTestOk: row.restoreTest ? row.restoreTest.ok : null,
    restoreTestAt: row.restoreTest?.at ?? null,
  };
}

function assertPublicSnapshotSafe(value: unknown): void {
  const blob = JSON.stringify(value);
  if (
    /postgresql:\/\//i.test(blob) ||
    /DATABASE_URL/i.test(blob) ||
    /AUTH_SECRET/i.test(blob) ||
    /passwordHash/i.test(blob) ||
    /BEGIN (PGDUMP|PGDATABASE)/i.test(blob)
  ) {
    throw new AppError(ErrorCode.INTERNAL, "Backup snapshot refused to expose secrets.", 500);
  }
}

export async function getBackupDashboard(now = Date.now()): Promise<BackupDashboard> {
  const settings = await loadBackupSettings();
  const storage = await inspectBackupStorage();
  const history = (await listManifests()).map((row) => toPublicBackupRow(row, now));
  const lastSuccess = history.find((row) => row.status === "SUCCESS") ?? null;
  const lastFailure = history.find((row) => row.status === "FAILED") ?? null;
  const rpoMet =
    lastSuccess?.ageHours == null ? null : lastSuccess.ageHours <= settings.rpoHours;
  let recoveryStatus: RecoveryStatus;
  if (!settings.enabled) recoveryStatus = "DISABLED";
  else if (storage.status === "NOT_WRITABLE" || storage.status === "COLOCATED_WITH_UPLOADS") {
    recoveryStatus = "STORAGE_UNAVAILABLE";
  } else if (!lastSuccess) recoveryStatus = "NO_VALID_BACKUP";
  else if (lastSuccess.integrity === "failed") recoveryStatus = "INTEGRITY_FAILED";
  else if (rpoMet === false) recoveryStatus = "BACKUP_STALE";
  else if (lastSuccess.integrity !== "verified") recoveryStatus = "NO_VALID_BACKUP";
  else recoveryStatus = "READY";

  const snapshot = {
    enabled: settings.enabled,
    systemStatus: settings.enabled ? ("ENABLED" as const) : ("DISABLED" as const),
    storage: {
      kind: "local_directory" as const,
      status: storage.status,
      label: storage.label,
      rootConfigured: storage.rootConfigured,
    },
    lastSuccess,
    lastFailure,
    retentionDays: settings.retentionDays,
    intervalHours: settings.intervalHours,
    rpoHours: settings.rpoHours,
    rtoHours: settings.rtoHours,
    rpoMet,
    lastRestoreTest: settings.lastRestoreTest,
    recoveryStatus,
    history: history.slice(0, 30),
    failures: history.filter((row) => row.status === "FAILED").slice(0, 15),
  };
  assertPublicSnapshotSafe(snapshot);
  return snapshot;
}

async function alertBackupFailure(errorSafe: string): Promise<void> {
  const to = (process.env.BACKUP_ALERT_EMAIL ?? process.env.SUPER_ADMIN_EMAIL ?? "").trim();
  if (!to) return;
  try {
    const { sendEmail } = await import("@/services/email");
    await sendEmail({
      to,
      subject: "Bidvera backup failed",
      text: `A Bidvera platform backup failed.\n\n${errorSafe}\n`,
      html: `<p>A Bidvera platform backup failed.</p><p>${escapeHtml(errorSafe)}</p>`,
    });
  } catch (error) {
    logError("backup.alert_failed", { error: sanitizeBackupError(error) });
  }
}

export async function createPlatformBackup(input: {
  triggeredBy: BackupTrigger;
}): Promise<PublicBackupRow> {
  const settings = await loadBackupSettings();
  const root = resolveBackupRoot();
  const storage = await inspectBackupStorage();
  if (storage.status === "COLOCATED_WITH_UPLOADS" || storage.status === "NOT_WRITABLE") {
    throw new AppError(ErrorCode.FORBIDDEN, storage.label, 503);
  }

  const id = newBackupId();
  const startedAt = new Date().toISOString();
  const empty: BackupManifest = {
    id,
    formatVersion: BACKUP_FORMAT_VERSION,
    status: "FAILED",
    method: null,
    fileName: null,
    byteLength: null,
    checksumSha256: null,
    startedAt,
    completedAt: null,
    triggeredBy: input.triggeredBy,
    integrity: "unverified",
    errorSafe: null,
    tableCounts: {},
    fileCount: 0,
    landingFileCount: 0,
    restoreTest: null,
  };

  await acquireLock(root);
  const tmp = path.join(os.tmpdir(), `bidvera-backup-${id}`);
  await mkdir(tmp, { recursive: true });
  try {
    const pg = await tryPgDump(tmp);
    const allowLogicalOnly =
      process.env.NODE_ENV !== "production" ||
      process.env.BACKUP_ALLOW_LOGICAL === "1";
    if (!pg.ok && !allowLogicalOnly) {
      throw new Error(
        pg.errorSafe ??
          "Production backups require pg_dump via DATABASE_URL_DIRECT. Set BACKUP_ALLOW_LOGICAL=1 only for explicit logical-only emergency dumps.",
      );
    }
    const logical = await dumpPrismaLogical(tmp);
    const fileCount = await copyIfExists(resolveStorageRoot(), path.join(tmp, "files"));
    const landingFileCount = await copyIfExists(
      resolveLandingUploadsRoot(),
      path.join(tmp, "landing"),
    );
    const method: BackupMethod = pg.ok ? "pg_dump+logical" : "prisma_logical";
    const recovery = {
      formatVersion: BACKUP_FORMAT_VERSION,
      createdAt: startedAt,
      method,
      tableCounts: logical.tableCounts,
      fileCount,
      landingFileCount,
      schemaFingerprint: await schemaFingerprint(),
      pgDump: pg.ok,
      pgDumpNote: pg.ok ? null : pg.errorSafe,
    };
    await writeFile(path.join(tmp, "recovery.json"), JSON.stringify(recovery), "utf8");

    const zip = new AdmZip();
    zip.addLocalFolder(tmp, "");
    const plain = zip.toBuffer();
    const encrypted = encryptBackupPayload(plain);
    const checksumSha256 = sha256Hex(encrypted);
    await writeFile(archivePath(root, id), encrypted);

    const roundTrip = decryptBackupPayload(encrypted);
    const integrity: BackupIntegrity =
      sha256Hex(encrypted) === checksumSha256 && roundTrip.length === plain.length
        ? "verified"
        : "failed";
    if (integrity !== "verified") {
      throw new Error("Backup integrity check failed immediately after write.");
    }

    const completedAt = new Date().toISOString();
    const manifest: BackupManifest = {
      ...empty,
      status: "SUCCESS",
      method,
      fileName: `${id}.bak.enc`,
      byteLength: encrypted.length,
      checksumSha256,
      completedAt,
      integrity,
      tableCounts: logical.tableCounts,
      fileCount,
      landingFileCount,
    };
    await writeManifest(root, manifest);
    await cleanupExpiredBackups({ root, retentionDays: settings.retentionDays });
    logInfo("backup.completed", {
      id,
      method,
      byteLength: encrypted.length,
      fileCount,
      triggeredBy: input.triggeredBy,
    });
    return toPublicBackupRow(manifest);
  } catch (error) {
    const errorSafe = sanitizeBackupError(error);
    const failed: BackupManifest = {
      ...empty,
      completedAt: new Date().toISOString(),
      errorSafe,
      integrity: "failed",
    };
    await writeManifest(root, failed).catch(() => undefined);
    logError("backup.failed", { id, error: errorSafe, triggeredBy: input.triggeredBy });
    await alertBackupFailure(errorSafe);
    return toPublicBackupRow(failed);
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
    await releaseLock(root);
  }
}

export async function verifyBackup(id: string): Promise<PublicBackupRow> {
  const root = resolveBackupRoot();
  const manifest = await readManifest(root, id);
  if (!manifest) {
    throw new AppError(ErrorCode.NOT_FOUND, "Backup not found.", 404);
  }
  if (!manifest.fileName || manifest.status !== "SUCCESS") {
    throw new AppError(ErrorCode.VALIDATION, "This backup has no archive to verify.", 400);
  }
  const encrypted = await readFile(archivePath(root, id));
  const checksum = sha256Hex(encrypted);
  let integrity: BackupIntegrity = "failed";
  let errorSafe: string | null = null;
  try {
    if (manifest.checksumSha256 && manifest.checksumSha256 !== checksum) {
      throw new Error("Stored checksum does not match file bytes.");
    }
    const plain = decryptBackupPayload(encrypted);
    const zip = new AdmZip(plain);
    const recoveryEntry = zip.getEntry("recovery.json");
    if (!recoveryEntry) throw new Error("recovery.json missing from archive.");
    JSON.parse(recoveryEntry.getData().toString("utf8"));
    integrity = "verified";
  } catch (error) {
    errorSafe = sanitizeBackupError(error);
    integrity = "failed";
  }
  const next: BackupManifest = {
    ...manifest,
    checksumSha256: checksum,
    byteLength: encrypted.length,
    integrity,
    errorSafe: integrity === "verified" ? null : errorSafe,
  };
  await writeManifest(root, next);
  logInfo("backup.verified", { id, integrity });
  return toPublicBackupRow(next);
}

export async function runRestoreTest(id: string): Promise<PublicBackupRow> {
  const isolated = restoreDatabaseUrlIsIsolated();
  const root = resolveBackupRoot();
  const manifest = await readManifest(root, id);
  if (!manifest) {
    throw new AppError(ErrorCode.NOT_FOUND, "Backup not found.", 404);
  }
  const verified = await verifyBackup(id);
  if (verified.integrity !== "verified") {
    const failed = await readManifest(root, id);
    if (!failed) throw new AppError(ErrorCode.NOT_FOUND, "Backup not found.", 404);
    const next = {
      ...failed,
      restoreTest: {
        at: new Date().toISOString(),
        ok: false,
        method: "archive_verify",
        errorSafe: failed.errorSafe ?? "Integrity verification failed.",
      },
    };
    await writeManifest(root, next);
    await persistLastRestoreTest(next);
    return toPublicBackupRow(next);
  }

  const tmp = path.join(os.tmpdir(), `bidvera-restore-${id}-${randomBytes(4).toString("hex")}`);
  await mkdir(tmp, { recursive: true });
  let ok = false;
  let errorSafe: string | null = null;
  let method = "archive_verify";
  try {
    const encrypted = await readFile(archivePath(root, id));
    const zip = new AdmZip(decryptBackupPayload(encrypted));
    // Safe extract into isolated temp — never STORAGE_ROOT / production paths.
    const extracted = await extractBackupZipSafely(zip, tmp);
    if (!extracted.hasRecoveryJson) {
      throw new Error("Archive missing recovery.json.");
    }
    const recovery = JSON.parse(await readFile(path.join(tmp, "recovery.json"), "utf8")) as {
      tableCounts?: Record<string, number>;
      schemaFingerprint?: string | null;
    };
    const missing = criticalTablesPresent(recovery.tableCounts ?? {});
    if (missing.length) {
      throw new Error(`Archive missing critical tables: ${missing.join(", ")}`);
    }
    const currentSchema = await schemaFingerprint();
    if (
      recovery.schemaFingerprint &&
      currentSchema &&
      recovery.schemaFingerprint !== currentSchema
    ) {
      throw new Error(
        "Prisma schema fingerprint differs from this backup. Review migrations before restore.",
      );
    }

    // File recovery probe: entries extracted under isolated tmp only.
    if (extracted.fileCount < 0 || extracted.landingCount < 0) {
      throw new Error("File extraction counts are invalid.");
    }

    if (!isolated.ok || !isolated.url) {
      // Archive integrity + safe extract only — do not claim DB restore.
      method = "archive_verify";
      ok = true;
    } else if (!extracted.hasPostgresDump) {
      method = "archive_verify";
      ok = false;
      errorSafe =
        "BACKUP_RESTORE_DATABASE_URL is set but this backup has no db/postgres.dump (logical-only). Cannot perform isolated pg_restore.";
    } else {
      const dumpFile = path.join(tmp, "db", "postgres.dump");
      const restored = await tryPgRestore({ dumpFile });
      if (!restored.ok) {
        method = "pg_restore_isolated";
        ok = false;
        errorSafe = restored.errorSafe ?? "Isolated pg_restore failed.";
      } else {
        const tables = await verifyIsolatedRestoreTables();
        method = "pg_restore_isolated";
        if (!tables.ok) {
          ok = false;
          errorSafe = tables.errorSafe ?? "Isolated restore table verification failed.";
        } else {
          ok = true;
          errorSafe = null;
        }
      }
    }
  } catch (error) {
    ok = false;
    errorSafe = sanitizeBackupError(error);
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }

  const latest = (await readManifest(root, id))!;
  const next: BackupManifest = {
    ...latest,
    restoreTest: {
      at: new Date().toISOString(),
      ok,
      method,
      errorSafe,
    },
  };
  await writeManifest(root, next);
  await persistLastRestoreTest(next);
  logInfo("backup.restore_test", { id, ok, method });
  return toPublicBackupRow(next);
}

async function persistLastRestoreTest(manifest: BackupManifest): Promise<void> {
  const settings = await loadBackupSettings();
  await saveBackupSettings({
    ...settings,
    lastRestoreTest: manifest.restoreTest
      ? {
          at: manifest.restoreTest.at,
          backupId: manifest.id,
          ok: manifest.restoreTest.ok,
          method: manifest.restoreTest.method,
          errorSafe: manifest.restoreTest.errorSafe,
        }
      : null,
  });
}

export async function runScheduledPlatformBackup(): Promise<{ ran: boolean; id?: string }> {
  const settings = await loadBackupSettings();
  if (!settings.enabled) return { ran: false };
  const last = settings.lastScheduledAt ? Date.parse(settings.lastScheduledAt) : 0;
  const due =
    !Number.isFinite(last) ||
    Date.now() - last >= settings.intervalHours * 36e5;
  if (!due) return { ran: false };
  try {
    const row = await createPlatformBackup({ triggeredBy: "scheduled" });
    return { ran: true, id: row.id };
  } finally {
    await saveBackupSettings({
      ...settings,
      lastScheduledAt: new Date().toISOString(),
    });
  }
}
