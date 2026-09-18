/**
 * Server-side model configuration. Never expose provider keys or model IDs to the client.
 */

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Document MIME types accepted after archive expansion (not ZIP/RAR themselves). */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/tiff",
] as const;

export type AllowedDocumentMimeType = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

/**
 * HTTP body ceiling for Server Actions / proxy.
 * Per-file product cap is 25MB; package cap is 100MB. 110mb covers the package
 * plus multipart overhead without the historical ~130MB acceptance window.
 */
export const HTTP_BODY_SIZE_LIMIT = "110mb";
export const HTTP_BODY_SIZE_LIMIT_BYTES = 110 * 1024 * 1024;

/**
 * Tender package upload limits.
 * Defaults sized for realistic multi-document packs under HTTP_BODY_SIZE_LIMIT.
 * Override via env — never hard-code a tiny UI-only file count.
 */
export const UPLOAD_LIMITS = {
  /** Max bytes per individual uploaded or extracted file. */
  maxFileBytes: envInt("UPLOAD_MAX_FILE_BYTES", 25 * 1024 * 1024, 1 * 1024 * 1024, 50 * 1024 * 1024),
  /**
   * Max documents in one tender package after archive expansion.
   * Also caps selected loose uploads before expansion.
   * Production default: 100 (realistic multi-doc tender packs).
   * Upper env bound raised so operators can raise beyond the historical UI "5 files" myth.
   */
  maxFilesPerPackage: envInt("UPLOAD_MAX_FILES_PER_PACKAGE", 100, 1, 500),
  /** Max total bytes across all documents in one package (selected + extracted). */
  maxPackageBytes: envInt("UPLOAD_MAX_PACKAGE_BYTES", 100 * 1024 * 1024, 5 * 1024 * 1024, 120 * 1024 * 1024),
  /** Max entries scanned inside one ZIP/RAR (dirs + files). */
  maxArchiveEntries: envInt("UPLOAD_MAX_ARCHIVE_ENTRIES", 250, 8, 2000),
  /** Reject archive members whose uncompressed/compressed ratio exceeds this. */
  maxCompressionRatio: envInt("UPLOAD_MAX_COMPRESSION_RATIO", 100, 10, 1000),
  /** Max path segments inside an archive entry. */
  maxArchivePathDepth: envInt("UPLOAD_MAX_ARCHIVE_PATH_DEPTH", 16, 2, 64),
  /** Max nested archive depth (outer archive = depth 0). */
  maxArchiveNestingDepth: envInt("UPLOAD_MAX_ARCHIVE_NESTING_DEPTH", 3, 0, 8),
  /** TTL for ephemeral password-pending archive sessions (seconds). */
  archivePasswordPendingTtlSec: envInt("UPLOAD_ARCHIVE_PASSWORD_PENDING_TTL_SEC", 900, 60, 3600),
  /**
   * Bounded concurrency for independent document text extraction
   * (cheap deterministic extract — not AI analysis).
   */
  extractConcurrency: envInt("UPLOAD_EXTRACT_CONCURRENCY", 4, 1, 16),
  allowedMimeTypes: ALLOWED_DOCUMENT_MIME_TYPES,
} as const;

export const AI_MODELS = {
  /** Complex reasoning — decision synthesis */
  reasoning: process.env.AI_MODEL_REASONING ?? "gpt-5.6-sol",
  /** High-volume extraction / classification */
  extraction: process.env.AI_MODEL_EXTRACTION ?? "gpt-5.6-luna",
} as const;

export const AI_PROVIDER = process.env.AI_PROVIDER ?? "openai";

export const SESSION = {
  cookieName: "bidvera_session",
  ttlDays: 14,
} as const;

/** Sensitive account email-change (Settings). Override TTL via EMAIL_CHANGE_TTL_MINUTES. */
export const EMAIL_CHANGE = {
  /** Confirmation link lifetime — short window for takeover resistance. */
  ttlMinutes: envInt("EMAIL_CHANGE_TTL_MINUTES", 45, 15, 120),
  /** Max initiate/resend attempts per user per hour. */
  maxRequestsPerUserPerHour: envInt("EMAIL_CHANGE_MAX_PER_USER_HOUR", 3, 1, 20),
  /** Max initiate/resend attempts per IP per hour. */
  maxRequestsPerIpPerHour: envInt("EMAIL_CHANGE_MAX_PER_IP_HOUR", 8, 1, 60),
  /** Max confirmation attempts per IP per hour. */
  maxConfirmPerIpPerHour: envInt("EMAIL_CHANGE_MAX_CONFIRM_IP_HOUR", 30, 5, 120),
} as const;

export const RATE_LIMITS = {
  authPerIpPerHour: 30,
  uploadPerCompanyPerHour: 20,
  analysisPerCompanyPerHour: 10,
} as const;
