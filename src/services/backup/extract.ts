/**
 * Safe extraction of encrypted platform backup archives into an isolated directory.
 * Never extracts into STORAGE_ROOT / production paths.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type AdmZip from "adm-zip";
import { sanitizeArchiveEntryPath } from "@/domain/universal-intake/archive/security";
import { AppError, ErrorCode } from "@/lib/errors";

export type BackupExtractStats = {
  entryCount: number;
  fileCount: number;
  landingCount: number;
  hasPostgresDump: boolean;
  hasRecoveryJson: boolean;
};

/**
 * Extract zip entries with path-traversal protection into destRoot only.
 */
export async function extractBackupZipSafely(
  zip: AdmZip,
  destRoot: string,
): Promise<BackupExtractStats> {
  const resolvedRoot = path.resolve(destRoot);
  await mkdir(resolvedRoot, { recursive: true });

  let entryCount = 0;
  let fileCount = 0;
  let landingCount = 0;
  let hasPostgresDump = false;
  let hasRecoveryJson = false;

  for (const entry of zip.getEntries()) {
    const rawName = entry.entryName.replace(/\\/g, "/");
    if (!rawName || rawName.endsWith("/")) continue;

    let safeRel: string;
    try {
      safeRel = sanitizeArchiveEntryPath(rawName);
    } catch (error) {
      const message =
        error instanceof AppError
          ? error.message
          : "Archive entry path is not allowed.";
      throw new AppError(ErrorCode.VALIDATION, message, 400);
    }

    const full = path.resolve(resolvedRoot, safeRel);
    if (!full.startsWith(resolvedRoot + path.sep)) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Archive entry escapes restore directory.",
        400,
      );
    }

    await mkdir(path.dirname(full), { recursive: true });
    const data = entry.getData();
    await writeFile(full, data);
    entryCount += 1;

    if (safeRel === "recovery.json") hasRecoveryJson = true;
    if (safeRel === "db/postgres.dump") hasPostgresDump = true;
    if (safeRel.startsWith("files/")) fileCount += 1;
    if (safeRel.startsWith("landing/")) landingCount += 1;
  }

  return {
    entryCount,
    fileCount,
    landingCount,
    hasPostgresDump,
    hasRecoveryJson,
  };
}
