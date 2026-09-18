import path from "node:path";
import { z } from "zod";

export const BACKUP_SETTINGS_KEY = "backup.settings";
export const BACKUP_FORMAT_VERSION = 1;
export const STALE_LOCK_MS = 2 * 60 * 60 * 1000;

export const backupSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  intervalHours: z.number().int().min(1).max(168).default(24),
  retentionDays: z.number().int().min(1).max(365).default(14),
  rpoHours: z.number().int().min(1).max(168).default(24),
  rtoHours: z.number().int().min(1).max(72).default(4),
  lastScheduledAt: z.string().datetime().nullable().default(null),
  lastRestoreTest: z
    .object({
      at: z.string(),
      backupId: z.string(),
      ok: z.boolean(),
      method: z.string(),
      errorSafe: z.string().nullable().optional(),
    })
    .nullable()
    .default(null),
});

export type BackupSettings = z.infer<typeof backupSettingsSchema>;

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = backupSettingsSchema.parse({});

export function parseBackupSettings(raw: unknown): BackupSettings {
  return backupSettingsSchema.parse(raw ?? {});
}

export function loadBackupSettingsSafe(raw: unknown): BackupSettings {
  const parsed = backupSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_BACKUP_SETTINGS;
}

export function resolveBackupRoot(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.BACKUP_ROOT?.trim();
  if (raw) return path.resolve(raw);
  return path.resolve(process.cwd(), ".data", "backups");
}

export function resolveStorageRoot(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.STORAGE_ROOT?.trim();
  if (raw) return path.resolve(raw);
  return path.resolve(process.cwd(), ".data", "uploads");
}

export function resolveLandingUploadsRoot(): string {
  return path.resolve(process.cwd(), "public", "uploads", "landing");
}

export function isPooledDatabaseUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes("-pooler.");
  } catch {
    return false;
  }
}

/** Host:port/database identity for isolation checks (ignores user/password/query). */
export function databaseUrlIdentity(url: string): string | null {
  try {
    const u = new URL(url);
    const database = u.pathname.replace(/^\//, "").split("?")[0]?.toLowerCase() ?? "";
    if (!u.hostname || !database) return null;
    const port = u.port || "5432";
    return `${u.hostname.toLowerCase()}:${port}/${database}`;
  } catch {
    return null;
  }
}

export function resolveDumpDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): { url: string | null; pooled: boolean; source: "direct" | "pooled" | "none" } {
  const direct = env.DATABASE_URL_DIRECT?.trim() || "";
  const primary = env.DATABASE_URL?.trim() || "";
  if (direct) {
    return { url: direct, pooled: isPooledDatabaseUrl(direct), source: "direct" };
  }
  if (primary) {
    return {
      url: primary,
      pooled: isPooledDatabaseUrl(primary),
      source: isPooledDatabaseUrl(primary) ? "pooled" : "direct",
    };
  }
  return { url: null, pooled: false, source: "none" };
}

/**
 * Fail closed unless BACKUP_RESTORE_DATABASE_URL is set and is a different
 * database identity than production DATABASE_URL / DATABASE_URL_DIRECT.
 */
export function restoreDatabaseUrlIsIsolated(
  env: Record<string, string | undefined> = process.env,
): { ok: boolean; reason: string | null; url: string | null } {
  const restore = env.BACKUP_RESTORE_DATABASE_URL?.trim() || "";
  if (!restore) {
    return {
      ok: false,
      reason: "BACKUP_RESTORE_DATABASE_URL is not set.",
      url: null,
    };
  }
  const restoreId = databaseUrlIdentity(restore);
  if (!restoreId) {
    return {
      ok: false,
      reason: "BACKUP_RESTORE_DATABASE_URL is not a valid Postgres URL.",
      url: null,
    };
  }

  const prod = env.DATABASE_URL?.trim() || "";
  const direct = env.DATABASE_URL_DIRECT?.trim() || "";
  if (prod && (restore === prod || databaseUrlIdentity(prod) === restoreId)) {
    return {
      ok: false,
      reason: "Restore URL must not equal DATABASE_URL.",
      url: null,
    };
  }
  if (direct && (restore === direct || databaseUrlIdentity(direct) === restoreId)) {
    return {
      ok: false,
      reason: "Restore URL must not equal DATABASE_URL_DIRECT.",
      url: null,
    };
  }
  return { ok: true, reason: null, url: restore };
}

export function sanitizeBackupError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "postgresql://redacted")
    .replace(/DATABASE_URL[^\s'"]*/gi, "DATABASE_URL=redacted")
    .replace(/BACKUP_RESTORE_DATABASE_URL[^\s'"]*/gi, "BACKUP_RESTORE_DATABASE_URL=redacted")
    .slice(0, 300);
}

export const CRITICAL_RESTORE_TABLES = [
  "company",
  "user",
  "subscription",
  "systemSetting",
  "adminUser",
] as const;
