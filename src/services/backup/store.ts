import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  resolveBackupRoot,
  resolveStorageRoot,
  sanitizeBackupError,
} from "@/services/backup/config";
import type { BackupManifest, BackupStorageStatus } from "@/services/backup/types";

export function manifestPath(root: string, id: string): string {
  return path.join(root, `${id}.manifest.json`);
}

export function archivePath(root: string, id: string): string {
  return path.join(root, `${id}.bak.enc`);
}

export function lockPath(root: string): string {
  return path.join(root, "backup.lock");
}

export function toPublicRelativeName(id: string, kind: "archive" | "manifest"): string {
  return kind === "archive" ? `${id}.bak.enc` : `${id}.manifest.json`;
}

export async function ensureBackupRoot(root = resolveBackupRoot()): Promise<void> {
  await mkdir(root, { recursive: true });
}

export async function inspectBackupStorage(
  env: Record<string, string | undefined> = process.env,
): Promise<{
  status: BackupStorageStatus;
  label: string;
  rootConfigured: boolean;
}> {
  const root = resolveBackupRoot(env);
  const uploads = resolveStorageRoot(env);
  const configured = Boolean(env.BACKUP_ROOT?.trim());
  const colocated =
    root === uploads ||
    root.startsWith(uploads + path.sep) ||
    uploads.startsWith(root + path.sep);

  if (colocated) {
    return {
      status: "COLOCATED_WITH_UPLOADS",
      label: "Backup directory must not share the upload storage path.",
      rootConfigured: configured,
    };
  }

  try {
    await ensureBackupRoot(root);
    const probe = path.join(root, ".write-probe");
    await writeFile(probe, "ok", "utf8");
    await rm(probe, { force: true });
  } catch (error) {
    return {
      status: "NOT_WRITABLE",
      label: sanitizeBackupError(error),
      rootConfigured: configured,
    };
  }

  if (!configured && env.NODE_ENV === "production") {
    return {
      status: "EPHEMERAL_DEFAULT",
      label: "BACKUP_ROOT is unset. Default local directory may be ephemeral in production.",
      rootConfigured: false,
    };
  }

  return {
    status: "READY",
    label: configured ? "Local backup directory is writable." : "Local default backup directory is writable.",
    rootConfigured: configured,
  };
}

export async function writeManifest(root: string, manifest: BackupManifest): Promise<void> {
  await ensureBackupRoot(root);
  await writeFile(manifestPath(root, manifest.id), JSON.stringify(manifest, null, 2), "utf8");
}

export async function readManifest(root: string, id: string): Promise<BackupManifest | null> {
  try {
    const raw = await readFile(manifestPath(root, id), "utf8");
    return JSON.parse(raw) as BackupManifest;
  } catch {
    return null;
  }
}

export async function listManifests(root = resolveBackupRoot()): Promise<BackupManifest[]> {
  try {
    const names = await readdir(root);
    const rows: BackupManifest[] = [];
    for (const name of names) {
      if (!name.endsWith(".manifest.json")) continue;
      const raw = await readFile(path.join(root, name), "utf8");
      try {
        rows.push(JSON.parse(raw) as BackupManifest);
      } catch {
        /* skip corrupt catalog rows */
      }
    }
    return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  } catch {
    return [];
  }
}

export async function deleteBackupArtifacts(root: string, id: string): Promise<void> {
  await rm(archivePath(root, id), { force: true });
  await rm(manifestPath(root, id), { force: true });
}

export async function cleanupExpiredBackups(input: {
  root?: string;
  retentionDays: number;
  now?: Date;
}): Promise<{ deleted: number; kept: number }> {
  const root = input.root ?? resolveBackupRoot();
  const now = input.now ?? new Date();
  const cutoff = now.getTime() - input.retentionDays * 24 * 60 * 60 * 1000;
  const rows = await listManifests(root);
  let deleted = 0;
  let kept = 0;
  for (const row of rows) {
    const ts = Date.parse(row.completedAt ?? row.startedAt);
    if (Number.isFinite(ts) && ts < cutoff) {
      await deleteBackupArtifacts(root, row.id);
      deleted += 1;
    } else {
      kept += 1;
    }
  }
  return { deleted, kept };
}

export async function archiveByteLength(root: string, id: string): Promise<number | null> {
  try {
    const info = await stat(archivePath(root, id));
    return info.size;
  } catch {
    return null;
  }
}
