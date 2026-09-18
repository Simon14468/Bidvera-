/**
 * Configurable archive security limits — single source for ZIP/RAR processing.
 */

import { UPLOAD_LIMITS } from "@/config/server";

export const ARCHIVE_LIMITS = {
  /** Max size of the archive file itself (same as a single document). */
  maxArchiveBytes: UPLOAD_LIMITS.maxFileBytes,
  /** Max supported documents emitted from all archives + loose files. */
  maxMembers: UPLOAD_LIMITS.maxFilesPerPackage,
  /** Max size of any single extracted document. */
  maxMemberBytes: UPLOAD_LIMITS.maxFileBytes,
  /** Max total uncompressed bytes across extracted members. */
  maxTotalExtractedBytes: UPLOAD_LIMITS.maxPackageBytes,
  /** Max entries scanned inside one archive (directories + files). */
  maxEntriesToScan: UPLOAD_LIMITS.maxArchiveEntries,
  /** Reject members whose uncompressed/compressed ratio exceeds this. */
  maxCompressionRatio: UPLOAD_LIMITS.maxCompressionRatio,
  /** Max path segments inside an archive entry. */
  maxPathDepth: UPLOAD_LIMITS.maxArchivePathDepth,
  /** Max nested archive depth (0 = outer only, no nested). Default 3. */
  maxNestingDepth: UPLOAD_LIMITS.maxArchiveNestingDepth,
  /** Ephemeral pending-password session TTL (ms). */
  passwordPendingTtlMs: UPLOAD_LIMITS.archivePasswordPendingTtlSec * 1000,
} as const;

export const ARCHIVE_MIME_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
  "application/x-rar",
] as const;

export type ArchiveProcessLimits = typeof ARCHIVE_LIMITS;
