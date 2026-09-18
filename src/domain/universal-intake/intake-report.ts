/**
 * Canonical machine-readable IntakeReport — authoritative boundary for
 * file/package problems before Document Intelligence / decision layers.
 *
 * Extensible via adapters/recovery handlers; unknown formats fail safely.
 * Never invents content; never claims support for every possible file.
 */

import type {
  DocumentReadinessState,
  IntakeBlockingCode,
  IntakeFileRecord,
  IntakePackageStatus,
  IntakeWarningCode,
  PackageCompletenessState,
  PackageIntake,
} from "./types";
import { UNIVERSAL_INTAKE_VERSION } from "./types";
import type { FileRecoveryClass, FileRecoveryReport } from "./recovery/types";
import { buildCanonicalPackageInventory } from "./canonical-inventory";

/** UI-facing intake pipeline states (mutually exclusive primary banner). */
export const INTAKE_UI_STATES = [
  "PROCESSING",
  "REPAIRED_AUTOMATICALLY",
  "PASSWORD_REQUIRED",
  "USER_ACTION_REQUIRED",
  "PARTIALLY_READABLE",
  "UNSUPPORTED",
  "CORRUPTED",
  "PACKAGE_INCOMPLETE",
  "READY_FOR_ANALYSIS",
  "ANALYSIS_BLOCKED",
] as const;

export type IntakeUiState = (typeof INTAKE_UI_STATES)[number];

export type IntakeReportFile = {
  fileId: string;
  originalName: string;
  displayName: string;
  source: IntakeFileRecord["source"];
  archiveFileName: string | null;
  archivePath: string | null;
  /** Explicit terminal state — never ambiguous. */
  state: IntakeFileRecord["state"];
  readiness: DocumentReadinessState;
  blocking: boolean;
  message: string | null;
  warningCodes: IntakeWarningCode[];
  recoveryClass: FileRecoveryClass | null;
  recovery: FileRecoveryReport | null;
  sizeBytes: number;
  sniffedKind: string | null;
  forceOcr: boolean;
};

/**
 * Serializable intake attestation for downstream layers.
 * Buffers are intentionally excluded.
 */
export type IntakeReport = {
  version: typeof UNIVERSAL_INTAKE_VERSION | "intake-report/v1";
  reportVersion: "intake-report/v1";
  packageId: string;
  packageLabel: string;
  status: IntakePackageStatus;
  uiState: IntakeUiState;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  sourceUploadCount: number;
  discoveredFileCount: number;
  /**
   * Derived: state === ACCEPTED only (disjoint from recoverableFileCount).
   * Historical note: older reports may have incorrectly set this to ACCEPTED+RECOVERABLE;
   * consumers MUST prefer `files[]` / proceedableFileCount via canonical inventory helpers.
   */
  acceptedFileCount: number;
  /**
   * Derived: state === RECOVERABLE only.
   */
  recoverableFileCount: number;
  /**
   * Derived identity count of proceedable files (ACCEPTED ∪ RECOVERABLE ∪ future proceedable states).
   * Prefer this over acceptedFileCount + recoverableFileCount.
   */
  proceedableFileCount: number;
  rejectedFileCount: number;
  unreadableFileCount: number;
  passwordProtectedFileCount: number;
  unsupportedFileCount: number;
  corruptedFileCount: number;
  securityFailureCount: number;
  /** Intake package completeness — distinct from document readability. */
  packageCompleteness: PackageCompletenessState;
  /** Aggregate document readiness. */
  documentReadiness: DocumentReadinessState;
  userNotices: string[];
  warnings: Array<{ code: IntakeWarningCode; message: string; fileId?: string }>;
  blockingConditions: Array<{ code: IntakeBlockingCode; message: string; fileId?: string }>;
  files: IntakeReportFile[];
  /** True when analysis storage/enqueue may proceed with accepted files. */
  mayProceedToAnalysis: boolean;
  /**
   * True when decision scoring may run (enough readable docs).
   * Incomplete packages may still score when enough valid docs exist —
   * incompleteness is reported, not silently ignored.
   */
  mayProceedToScoring: boolean;
  /** Exact explanation when scoring must not complete. */
  analysisIncompleteReason: string | null;
  provenanceNote:
    "original → archive → extracted file → recovery → extraction → canonical analysis";
};

export function deriveIntakeUiState(input: {
  status: IntakePackageStatus;
  packageCompleteness: PackageCompletenessState;
  documentReadiness: DocumentReadinessState;
  passwordProtectedFileCount: number;
  unsupportedFileCount: number;
  corruptedFileCount: number;
  userNotices: string[];
  files: Array<{
    state: string;
    recoveryClass?: FileRecoveryClass | null;
    readiness?: string;
  }>;
  mayProceed: boolean;
}): IntakeUiState {
  if (!input.mayProceed || input.status === "INTAKE_BLOCKED") {
    if (input.passwordProtectedFileCount > 0 || input.documentReadiness === "NEEDS_PASSWORD") {
      return "PASSWORD_REQUIRED";
    }
    if (input.files.some((f) => f.recoveryClass === "USER_ACTION_REQUIRED")) {
      return "USER_ACTION_REQUIRED";
    }
    if (input.corruptedFileCount > 0 && input.files.every((f) => f.state === "CORRUPTED" || f.state.startsWith("REJECTED_"))) {
      return "CORRUPTED";
    }
    if (input.unsupportedFileCount > 0 && input.files.every((f) => f.state.includes("UNSUPPORTED") || f.state.startsWith("REJECTED_"))) {
      return "UNSUPPORTED";
    }
    return "ANALYSIS_BLOCKED";
  }

  if (input.userNotices.some((n) => /repaired it automatically/i.test(n))) {
    return "REPAIRED_AUTOMATICALLY";
  }
  if (
    input.documentReadiness === "NEEDS_OCR" ||
    input.files.some((f) => f.readiness === "NEEDS_OCR" || f.recoveryClass === "AUTO_RECOVERABLE")
  ) {
    if (input.packageCompleteness === "INCOMPLETE" || input.status === "INTAKE_PARTIAL") {
      return "PACKAGE_INCOMPLETE";
    }
    if (input.files.some((f) => f.readiness === "NEEDS_OCR")) {
      return "PARTIALLY_READABLE";
    }
  }
  if (input.packageCompleteness === "INCOMPLETE" || input.status === "INTAKE_PARTIAL") {
    return "PACKAGE_INCOMPLETE";
  }
  if (input.status === "INTAKE_READY_WITH_WARNINGS") {
    return "PARTIALLY_READABLE";
  }
  return "READY_FOR_ANALYSIS";
}

export function buildIntakeReport(
  intake: PackageIntake,
  mayProceedToStorage: boolean,
): IntakeReport {
  const files: IntakeReportFile[] = intake.files.map((f) => ({
    fileId: f.fileId,
    originalName: f.originalName,
    displayName: f.displayName,
    source: f.source,
    archiveFileName: f.archiveFileName,
    archivePath: f.archivePath,
    state: f.state,
    readiness: f.readiness,
    blocking: f.blocking,
    message: f.message,
    warningCodes: f.warningCodes,
    recoveryClass: f.recovery?.recoveryClass ?? null,
    recovery: f.recovery ?? null,
    sizeBytes: f.sizeBytes,
    sniffedKind: f.sniffedKind,
    forceOcr: Boolean(f.recovery?.forceOcr),
  }));

  // Prefer identity-derived proceedable count — never acceptedFileCount + recoverableFileCount
  // (those fields were historically overlapping on some persisted reports).
  const inventory = buildCanonicalPackageInventory(
    files.map((f) => ({
      fileId: f.fileId,
      state: f.state,
      readiness: f.readiness,
      recoveryClass: f.recoveryClass,
      originalName: f.originalName,
      displayName: f.displayName,
      source: f.source,
      archiveFileName: f.archiveFileName,
      archivePath: f.archivePath,
      sniffedKind: f.sniffedKind,
    })),
  );
  const proceedableFileCount =
    intake.proceedableFileCount ?? inventory.proceedableFileCount;
  const analysisIncompleteReason =
    !mayProceedToStorage
      ? intake.blockingConditions[0]?.message ??
        "Intake blocked — analysis cannot proceed until file/package issues are resolved."
      : proceedableFileCount === 0
        ? "No readable tender documents available after intake."
        : null;

  // Scoring may proceed when at least one proceedable identity exists.
  // Package incompleteness is reported separately (rule 8 vs 9).
  const mayProceedToScoring = mayProceedToStorage && proceedableFileCount > 0;

  const uiState = deriveIntakeUiState({
    status: intake.status,
    packageCompleteness: intake.packageCompleteness,
    documentReadiness: intake.documentReadiness,
    passwordProtectedFileCount: intake.passwordProtectedFileCount,
    unsupportedFileCount: intake.unsupportedFileCount,
    corruptedFileCount: intake.corruptedFileCount,
    userNotices: intake.userNotices,
    files: files.map((f) => ({
      state: f.state,
      recoveryClass: f.recoveryClass,
      readiness: f.readiness,
    })),
    mayProceed: mayProceedToStorage,
  });

  return {
    version: UNIVERSAL_INTAKE_VERSION,
    reportVersion: "intake-report/v1",
    packageId: intake.packageId,
    packageLabel: intake.packageLabel,
    status: intake.status,
    uiState,
    startedAt: intake.startedAt,
    endedAt: intake.endedAt,
    durationMs: intake.durationMs,
    sourceUploadCount: intake.sourceUploadCount,
    discoveredFileCount: inventory.totalFiles,
    acceptedFileCount: inventory.acceptedFileCount,
    recoverableFileCount: inventory.recoverableFileCount,
    proceedableFileCount,
    rejectedFileCount: intake.rejectedFileCount,
    unreadableFileCount: intake.unreadableFileCount,
    passwordProtectedFileCount: intake.passwordProtectedFileCount,
    unsupportedFileCount: intake.unsupportedFileCount,
    corruptedFileCount: intake.corruptedFileCount,
    securityFailureCount: intake.securityFailureCount,
    packageCompleteness: intake.packageCompleteness,
    documentReadiness: intake.documentReadiness,
    userNotices: intake.userNotices,
    warnings: intake.warnings,
    blockingConditions: intake.blockingConditions,
    files,
    mayProceedToAnalysis: mayProceedToStorage,
    mayProceedToScoring,
    analysisIncompleteReason,
    provenanceNote:
      "original → archive → extracted file → recovery → extraction → canonical analysis",
  };
}

/**
 * Downstream decision gate from IntakeReport.
 * Does not invent requirements; only blocks when critical readability is missing.
 */
export function evaluateIntakeDecisionGate(report: IntakeReport): {
  allowScoring: boolean;
  incomplete: boolean;
  reason: "INTAKE_BLOCKED" | "INTAKE_NO_READABLE_DOCS" | "INTAKE_PACKAGE_INCOMPLETE" | null;
  message: string | null;
} {
  if (!report.mayProceedToAnalysis || report.status === "INTAKE_BLOCKED") {
    return {
      allowScoring: false,
      incomplete: true,
      reason: "INTAKE_BLOCKED",
      message:
        report.analysisIncompleteReason ??
        report.blockingConditions[0]?.message ??
        "Universal Intake blocked this package.",
    };
  }
  if (
    !report.mayProceedToScoring ||
    (report.proceedableFileCount ??
      buildCanonicalPackageInventory(
        report.files.map((f) => ({ fileId: f.fileId, state: f.state })),
      ).proceedableFileCount) === 0
  ) {
    return {
      allowScoring: false,
      incomplete: true,
      reason: "INTAKE_NO_READABLE_DOCS",
      message: "No readable tender documents survived intake — decision scoring is blocked.",
    };
  }
  if (report.packageCompleteness === "INCOMPLETE" || report.status === "INTAKE_PARTIAL") {
    // Rule 8: continue safely while showing incompleteness — do not auto-block scoring.
    return {
      allowScoring: true,
      incomplete: true,
      reason: "INTAKE_PACKAGE_INCOMPLETE",
      message:
        "Package is incomplete (unsupported, skipped, or unreadable members present). Analysis continues on readable documents only.",
    };
  }
  return { allowScoring: true, incomplete: false, reason: null, message: null };
}

export function intakeReportUserBanner(report: IntakeReport): {
  state: IntakeUiState;
  title: string;
  body: string;
} {
  switch (report.uiState) {
    case "PASSWORD_REQUIRED":
      return {
        state: report.uiState,
        title: "Password required",
        body:
          report.blockingConditions[0]?.message ??
          "This file is password protected. Enter the password to continue.",
      };
    case "USER_ACTION_REQUIRED":
      return {
        state: report.uiState,
        title: "User action required",
        body:
          report.files.find((f) => f.recovery?.userActionRequired)?.recovery?.userActionRequired ??
          report.blockingConditions[0]?.message ??
          "Resolve the file issue to continue analysis.",
      };
    case "REPAIRED_AUTOMATICALLY":
      return {
        state: report.uiState,
        title: "Repaired automatically",
        body:
          report.userNotices[0] ??
          "We detected a file issue and repaired it automatically before analysis.",
      };
    case "PARTIALLY_READABLE":
      return {
        state: report.uiState,
        title: "Partially readable",
        body: "Some documents need OCR or soft recovery. Analysis continues with available text; low-confidence OCR is flagged.",
      };
    case "PACKAGE_INCOMPLETE":
      return {
        state: report.uiState,
        title: "Package incomplete",
        body:
          "Readable documents will be analyzed, but the tender package is incomplete. A readable single document is not automatically a complete tender pack.",
      };
    case "UNSUPPORTED":
      return {
        state: report.uiState,
        title: "Unsupported format",
        body: report.blockingConditions[0]?.message ?? "Unsupported files were identified and were not ignored silently.",
      };
    case "CORRUPTED":
      return {
        state: report.uiState,
        title: "Corrupted file",
        body: report.blockingConditions[0]?.message ?? "One or more files are corrupted and unrecoverable.",
      };
    case "ANALYSIS_BLOCKED":
      return {
        state: report.uiState,
        title: "Analysis blocked",
        body: report.analysisIncompleteReason ?? "Intake blocked analysis for this package.",
      };
    case "PROCESSING":
      return {
        state: report.uiState,
        title: "Processing",
        body: "Universal Intake is validating and recovering your tender package.",
      };
    case "READY_FOR_ANALYSIS":
    default:
      return {
        state: "READY_FOR_ANALYSIS",
        title: "Ready for analysis",
        body: "Package passed Universal Intake and is ready for Document Intelligence.",
      };
  }
}
