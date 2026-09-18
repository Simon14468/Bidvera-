/**
 * Universal Intake, Recovery & Archive Engine — canonical types.
 * Pre-analysis layer before Document Intelligence / UTI.
 */

export const UNIVERSAL_INTAKE_VERSION = "universal-intake/v1" as const;

/** Terminal state for every inventoried file — never leave ambiguous. */
export const INTAKE_FILE_STATES = [
  "ACCEPTED",
  "REJECTED_EMPTY",
  "REJECTED_ZERO_BYTE",
  "REJECTED_UNSUPPORTED",
  "REJECTED_SPOOFED_EXTENSION",
  "REJECTED_MIME_MISMATCH",
  "REJECTED_DANGEROUS",
  "REJECTED_DUPLICATE",
  "REJECTED_TOO_LARGE",
  "CORRUPTED",
  "PASSWORD_PROTECTED",
  "UNREADABLE",
  "RECOVERABLE",
  "SECURITY_FAILURE",
  "NESTED_ARCHIVE_BLOCKED",
  "UNSUPPORTED_SKIPPED",
  "ARCHIVE_MEMBER_SKIPPED",
] as const;

export type IntakeFileTerminalState = (typeof INTAKE_FILE_STATES)[number];

export const INTAKE_PACKAGE_STATUSES = [
  "INTAKE_READY",
  "INTAKE_READY_WITH_WARNINGS",
  "INTAKE_BLOCKED",
  "INTAKE_PARTIAL",
] as const;

export type IntakePackageStatus = (typeof INTAKE_PACKAGE_STATUSES)[number];

export const DOCUMENT_READINESS_STATES = [
  "READY",
  "READY_WITH_WARNINGS",
  "NEEDS_OCR",
  "NEEDS_PASSWORD",
  "NOT_READY",
  "BLOCKED",
] as const;

export type DocumentReadinessState = (typeof DOCUMENT_READINESS_STATES)[number];

export const PACKAGE_COMPLETENESS_STATES = [
  "COMPLETE",
  "INCOMPLETE",
  "UNKNOWN",
  "BLOCKED",
] as const;

export type PackageCompletenessState = (typeof PACKAGE_COMPLETENESS_STATES)[number];

export type IntakeBlockingCode =
  | "NO_FILES"
  | "NO_ACCEPTED_DOCUMENTS"
  | "ARCHIVE_CORRUPTED"
  | "ARCHIVE_PASSWORD_REQUIRED"
  | "ARCHIVE_SECURITY_FAILURE"
  | "PACKAGE_LIMIT_EXCEEDED"
  | "DANGEROUS_CONTENT"
  | "UNSUPPORTED_ONLY"
  | "NESTED_ARCHIVE"
  | "UPLOAD_FAILED";

export type IntakeWarningCode =
  | "UNSUPPORTED_MEMBER_SKIPPED"
  | "DUPLICATE_FILENAME_RENAMED"
  | "MIME_NORMALIZED"
  | "FORMAT_SOFT_WARNING"
  | "PARTIAL_PACKAGE"
  | "PARTIAL_ARCHIVE_RECOVERY"
  | "LARGE_PACKAGE"
  | "HIGH_FILE_COUNT"
  | "RECOVERY_APPLIED"
  | "OCR_LIKELY_REQUIRED";

export type IntakeRecoveryAction =
  | "NORMALIZE_MIME"
  | "RENAME_DUPLICATE"
  | "SNIFF_OVERRIDE_EXTENSION"
  | "FLAG_OCR_CANDIDATE"
  | "RECORD_SKIPPED_MEMBER"
  | "AUTO_REPAIR"
  | "SCHEDULE_OCR"
  | "NONE";

export type IntakeFileRecord = {
  fileId: string;
  originalName: string;
  displayName: string;
  source: "loose" | "zip" | "rar" | "unknown";
  archiveFileName: string | null;
  archivePath: string | null;
  declaredMimeType: string | null;
  sniffedMimeType: string | null;
  sniffedKind: string | null;
  sizeBytes: number;
  state: IntakeFileTerminalState;
  readiness: DocumentReadinessState;
  blocking: boolean;
  warningCodes: IntakeWarningCode[];
  recoveryActions: IntakeRecoveryAction[];
  message: string | null;
  /** Present only for ACCEPTED / RECOVERABLE files that may proceed to storage. */
  bytesAvailable: boolean;
  /** Canonical recovery classification + attempts (when recovery layer ran). */
  recovery?: import("./recovery/types").FileRecoveryReport | null;
};

export type IntakeSourceUpload = {
  fileName: string;
  mimeType: string;
  fileSize: number;
  bytes: Buffer;
};

export type PackageIntake = {
  version: typeof UNIVERSAL_INTAKE_VERSION;
  packageId: string;
  packageLabel: string;
  status: IntakePackageStatus;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  sourceUploadCount: number;
  /**
   * Identity count — unique canonical files in `files[]`.
   * Never a sum of overlapping state counters.
   */
  discoveredFileCount: number;
  /**
   * Derived: files with state === ACCEPTED only.
   * MUST NOT include RECOVERABLE (or any other state).
   */
  acceptedFileCount: number;
  rejectedFileCount: number;
  /**
   * Derived: files with state === RECOVERABLE only.
   * Disjoint from acceptedFileCount.
   */
  recoverableFileCount: number;
  /**
   * Derived: unique files eligible to proceed to storage/analysis
   * (state ∈ PROCEEDABLE_LIFECYCLE_STATES). Identity-based — not a+b of rollups.
   */
  proceedableFileCount: number;
  unreadableFileCount: number;
  passwordProtectedFileCount: number;
  unsupportedFileCount: number;
  corruptedFileCount: number;
  securityFailureCount: number;
  files: IntakeFileRecord[];
  acceptedFiles: IntakeFileRecord[];
  rejectedFiles: IntakeFileRecord[];
  recoverableFiles: IntakeFileRecord[];
  unreadableFiles: IntakeFileRecord[];
  passwordProtectedFiles: IntakeFileRecord[];
  unsupportedFiles: IntakeFileRecord[];
  corruptedFiles: IntakeFileRecord[];
  securityFailures: IntakeFileRecord[];
  recoveryActions: Array<{ fileId: string; action: IntakeRecoveryAction; detail: string }>;
  warnings: Array<{ code: IntakeWarningCode; message: string; fileId?: string }>;
  blockingConditions: Array<{ code: IntakeBlockingCode; message: string; fileId?: string }>;
  packageCompleteness: PackageCompletenessState;
  documentReadiness: DocumentReadinessState;
  /** Non-blocking package-level recovery notices for UI. */
  userNotices: string[];
  /** Opaque hand-off for storage — accepted document buffers keyed by fileId. */
  _acceptedBuffers: Record<string, Buffer>;
};

export type UniversalIntakeResult = {
  intake: PackageIntake;
  /** True when analysis storage may proceed with accepted files. */
  mayProceedToStorage: boolean;
  /** Canonical machine-readable report for downstream layers (no buffers). */
  intakeReport: import("./intake-report").IntakeReport;
};
