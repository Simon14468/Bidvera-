/**
 * Archive security helpers — path, bomb, symlink, executable checks.
 */

import { AppError, ErrorCode } from "@/lib/errors";
import { ARCHIVE_LIMITS, type ArchiveProcessLimits } from "@/domain/tender-package/archive-limits";
import { isDangerousBinaryContent } from "@/domain/tender-package/upload-content-sniff";
import type { ArchiveProcessIssue } from "./types";

export function resolveLimits(
  overrides?: Partial<ArchiveProcessLimits>,
): ArchiveProcessLimits {
  return { ...ARCHIVE_LIMITS, ...overrides };
}

export function sanitizeArchiveEntryPath(
  rawPath: string,
  limits: ArchiveProcessLimits = ARCHIVE_LIMITS,
): string {
  const replaced = rawPath.replace(/\\/g, "/").trim();
  if (!replaced || replaced === "." || replaced === "./") {
    throw archiveSecurityError("Archive contains an invalid entry path.", "MALFORMED");
  }
  if (replaced.includes("\0")) {
    throw archiveSecurityError("Archive contains a corrupted entry path.", "MALFORMED");
  }
  if (/^[a-zA-Z]:/.test(replaced) || replaced.startsWith("/") || replaced.startsWith("~")) {
    throw archiveSecurityError(
      "Archive entry paths must be relative (absolute paths are not allowed).",
      "PATH_TRAVERSAL",
    );
  }
  const parts = replaced.split("/").filter((p) => p.length > 0 && p !== ".");
  if (parts.some((p) => p === "..")) {
    throw archiveSecurityError("Archive entry path traversal is not allowed.", "PATH_TRAVERSAL");
  }
  if (parts.length > limits.maxPathDepth) {
    throw archiveSecurityError("Archive entry path is too deep.", "MALFORMED");
  }
  if (parts.some((p) => p.includes(":"))) {
    throw archiveSecurityError("Archive entry path is not allowed.", "MALFORMED");
  }
  return parts.join("/");
}

export function assertCompressionRatio(
  compressed: number,
  uncompressed: number,
  label: string,
  limits: ArchiveProcessLimits = ARCHIVE_LIMITS,
): void {
  if (uncompressed <= 0) return;
  const denom = Math.max(compressed, 1);
  if (uncompressed / denom > limits.maxCompressionRatio) {
    throw archiveSecurityError(
      `Archive member "${label}" exceeds the safe compression ratio limit (possible zip bomb).`,
      "BOMB_RATIO",
    );
  }
}

export function assertNotSymlink(isSymlink: boolean): void {
  if (isSymlink) {
    throw archiveSecurityError("Archives containing symbolic links are not allowed.", "SYMLINK");
  }
}

export function assertNotExecutablePayload(bytes: Buffer, label: string): void {
  if (isDangerousBinaryContent(bytes)) {
    throw archiveSecurityError(
      `Archive member "${label}" looks like an executable or script and is not allowed.`,
      "EXECUTABLE",
    );
  }
}

export function archiveSecurityError(
  message: string,
  code: ArchiveProcessIssue["code"],
): AppError {
  return new AppError(ErrorCode.VALIDATION, message, 400, {
    uploadStage:
      code === "BOMB_RATIO" || code === "EXECUTABLE" || code === "SYMLINK" || code === "PATH_TRAVERSAL"
        ? "ARCHIVE_EXTRACTION_FAILED"
        : "ARCHIVE_EXTRACTION_FAILED",
    archiveIssueCode: code,
    retryable: false,
  });
}

export function passwordRequiredError(fileName: string): AppError {
  return new AppError(
    ErrorCode.VALIDATION,
    "This file is password protected. Enter the password to continue.",
    400,
    {
      uploadStage: "ARCHIVE_PASSWORD_REQUIRED",
      archiveIssueCode: "PASSWORD_REQUIRED",
      retryable: true,
      fileName,
      userAction: "ENTER_ARCHIVE_PASSWORD",
      userMessage: "This file is password protected. Enter the password to continue.",
    },
  );
}

export function wrongPasswordError(fileName: string): AppError {
  return new AppError(
    ErrorCode.VALIDATION,
    "Incorrect password. Please try again.",
    400,
    {
      uploadStage: "ARCHIVE_WRONG_PASSWORD",
      archiveIssueCode: "WRONG_PASSWORD",
      retryable: true,
      fileName,
      userAction: "ENTER_ARCHIVE_PASSWORD",
      userMessage: "Incorrect password. Please try again.",
    },
  );
}

/** Redact any accidental password-like fields before logging/serializing errors. */
export function redactSecretsForLog(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    // Never echo long secrets; strip password= query fragments
    return value.replace(/(password|passwd|pwd)\s*[:=]\s*\S+/gi, "$1=[redacted]");
  }
  if (Array.isArray(value)) return value.map(redactSecretsForLog);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/password|passwd|pwd|secret/i.test(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = redactSecretsForLog(v);
      }
    }
    return out;
  }
  return value;
}

export const NESTED_ARCHIVE_EXT = /\.(zip|rar)$/i;

export function looksLikeNestedArchiveName(entryPath: string): boolean {
  return NESTED_ARCHIVE_EXT.test(entryPath);
}
