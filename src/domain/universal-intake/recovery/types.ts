/**
 * Universal File Recovery & Readiness — classification taxonomy.
 * Recovery never invents document content.
 */

export const FILE_RECOVERY_CLASSES = [
  "AUTO_RECOVERABLE",
  "USER_ACTION_REQUIRED",
  "UNSUPPORTED",
  "CORRUPTED_UNRECOVERABLE",
  "SECURITY_BLOCKED",
  "READY",
] as const;

export type FileRecoveryClass = (typeof FILE_RECOVERY_CLASSES)[number];

export type RecoveryMethod =
  | "NONE"
  | "STRIP_PDF_LEADING_JUNK"
  | "TRIM_PDF_TRAILING_JUNK"
  | "NORMALIZE_PDF_EOF"
  | "FLAG_OCR_REQUIRED"
  | "EXECUTE_OCR"
  | "NORMALIZE_TEXT_ENCODING"
  | "CORRECT_EXTENSION_FROM_SNIFF"
  | "NORMALIZE_MIME_FROM_SNIFF"
  | "RENAME_DUPLICATE"
  | "OOXML_CONTENT_TYPES_PROBE"
  | "SPREADSHEET_STRUCTURE_PROBE"
  | "PPTX_FALLBACK_PROBE"
  | "PARTIAL_ARCHIVE_MEMBER"
  | "RECORD_EMPTY_METADATA"
  | "PASSWORD_GATE"
  | "SECURITY_REJECT"
  | "UNSUPPORTED_REJECT"
  | "CORRUPTION_REJECT";

export type ExtractionQualityHint =
  | "ok"
  | "degraded"
  | "low"
  | "empty"
  | "unknown"
  | "ocr_pending"
  | "ocr_low_confidence"
  | "ocr_ok";

export type RecoveryAttempt = {
  method: RecoveryMethod;
  startedAt: string;
  endedAt: string;
  success: boolean;
  /** Never includes secrets or invented body text. */
  detail: string;
  changedBytes: boolean;
};

export type DerivedRepresentation = {
  kind: "repaired_bytes" | "ocr_text" | "normalized_encoding" | "metadata_only";
  /** How the derived form relates to the original — never claimed as original. */
  method: RecoveryMethod;
  confidence: number | null;
  quality: ExtractionQualityHint;
  /** SHA-256 of derived bytes when kind is repaired_bytes / normalized_encoding. */
  sha256: string | null;
  /** Char count when kind is ocr_text — content itself is held ephemerally. */
  charCount: number | null;
  pageCount: number | null;
};

export type FileRecoveryReport = {
  fileId: string;
  originalName: string;
  recoveryClass: FileRecoveryClass;
  /** State before any recovery attempt. */
  originalState: string;
  attempts: RecoveryAttempt[];
  /** Final class after attempts. */
  recoveryResult: FileRecoveryClass;
  extractionQuality: ExtractionQualityHint;
  adapterUsed: string | null;
  ocrUsed: boolean;
  ocrRequired: boolean;
  ocrConfidence: number | null;
  warnings: string[];
  blockingConditions: string[];
  /** Non-blocking user message when auto-repaired. */
  userMessage: string | null;
  /** Exact user action when USER_ACTION_REQUIRED. */
  userActionRequired: string | null;
  derived: DerivedRepresentation | null;
  /** Original content fingerprint — original bytes are not discarded from provenance. */
  originalSha256: string;
  recoveredSha256: string | null;
  forceOcr: boolean;
};

export const AUTO_REPAIR_USER_MESSAGE =
  "We detected a file issue and repaired it automatically before analysis." as const;

export const OCR_SCHEDULED_USER_MESSAGE =
  "This PDF appears scanned or image-only. OCR will be used during analysis; low-confidence pages will be flagged." as const;
