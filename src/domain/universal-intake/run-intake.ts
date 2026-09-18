/**
 * Universal Intake, Recovery & Archive Engine — authoritative run path.
 *
 * UPLOAD → discovery/expand (reused) → security/format validation → readiness
 * BEFORE Document Intelligence / UTI.
 */

import { randomBytes } from "node:crypto";
import { AppError, ErrorCode } from "@/lib/errors";
import { ARCHIVE_LIMITS } from "@/domain/tender-package/archive-limits";
import {
  expandTenderPackageUploadsWithSkips,
  type PackageUploadFile,
} from "@/domain/tender-package/expand-tender-archive";
import { classifySourceUpload } from "./classify-upload";
import {
  classifyExpandFailureMessage,
  isTerminalAccepted,
  mapUploadStageToBlockingCode,
} from "./codes";
import {
  rollupDocumentReadiness,
  rollupPackageCompleteness,
  rollupPackageStatus,
} from "./readiness";
import {
  recoverDiscoveredFile,
  recoveryReportForTerminal,
  type IntakeOcrRunner,
} from "./recovery";
import { buildIntakeReport } from "./intake-report";
import {
  buildCanonicalPackageInventory,
  isProceedableLifecycleState,
} from "./canonical-inventory";
import type {
  IntakeFileRecord,
  IntakeSourceUpload,
  PackageIntake,
  UniversalIntakeResult,
} from "./types";
import { UNIVERSAL_INTAKE_VERSION } from "./types";

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function partition(files: IntakeFileRecord[]) {
  const acceptedFiles = files.filter((f) => f.state === "ACCEPTED");
  const rejectedFiles = files.filter(
    (f) =>
      f.state.startsWith("REJECTED_") ||
      f.state === "NESTED_ARCHIVE_BLOCKED" ||
      f.state === "SECURITY_FAILURE",
  );
  const recoverableFiles = files.filter((f) => f.state === "RECOVERABLE");
  const unreadableFiles = files.filter((f) => f.state === "UNREADABLE");
  const passwordProtectedFiles = files.filter((f) => f.state === "PASSWORD_PROTECTED");
  const unsupportedFiles = files.filter(
    (f) => f.state === "UNSUPPORTED_SKIPPED" || f.state === "ARCHIVE_MEMBER_SKIPPED",
  );
  const corruptedFiles = files.filter((f) => f.state === "CORRUPTED");
  const securityFailures = files.filter((f) => f.state === "SECURITY_FAILURE");
  return {
    acceptedFiles,
    rejectedFiles,
    recoverableFiles,
    unreadableFiles,
    passwordProtectedFiles,
    unsupportedFiles,
    corruptedFiles,
    securityFailures,
  };
}

function finalize(
  startedAt: string,
  t0: number,
  packageLabel: string,
  sourceUploadCount: number,
  files: IntakeFileRecord[],
  buffers: Record<string, Buffer>,
  extraWarnings: PackageIntake["warnings"],
  extraBlocking: PackageIntake["blockingConditions"],
  recoveryActions: PackageIntake["recoveryActions"],
): UniversalIntakeResult {
  const parts = partition(files);
  const warnings = [...extraWarnings];
  const blockingConditions = [...extraBlocking];

  for (const f of files) {
    for (const code of f.warningCodes) {
      warnings.push({ code, message: f.message ?? code, fileId: f.fileId });
    }
    if (f.blocking && !isTerminalAccepted(f.state)) {
      // blocking file-level issues already reflected; package may still proceed if others accepted
    }
  }

  // Canonical identity authority — all counters derived from unique fileIds.
  const inventory = buildCanonicalPackageInventory(
    files.map((f) => ({
      fileId: f.fileId,
      state: f.state,
      readiness: f.readiness,
      recoveryClass: f.recovery?.recoveryClass ?? null,
      originalName: f.originalName,
      displayName: f.displayName,
      source: f.source,
      archiveFileName: f.archiveFileName,
      archivePath: f.archivePath,
      sniffedKind: f.sniffedKind,
    })),
  );
  const proceedableFileCount = inventory.proceedableFileCount;

  if (proceedableFileCount === 0 && blockingConditions.length === 0) {
    blockingConditions.push({
      code: "NO_ACCEPTED_DOCUMENTS",
      message: "No accepted tender documents after intake.",
    });
  }

  const partialMembers =
    parts.unsupportedFiles.length > 0 ||
    parts.corruptedFiles.length > 0 ||
    parts.unreadableFiles.length > 0 ||
    parts.rejectedFiles.some(
      (f) =>
        f.state === "REJECTED_UNSUPPORTED" ||
        f.state === "REJECTED_SPOOFED_EXTENSION" ||
        f.state === "UNSUPPORTED_SKIPPED",
    );

  const status = rollupPackageStatus({
    acceptedCount: proceedableFileCount,
    blockingCount: blockingConditions.length,
    warningCount: warnings.length,
    partialMembers:
      partialMembers && proceedableFileCount > 0 && blockingConditions.length === 0,
  });

  // Soft blocking: password/security on whole package when nothing accepted
  const hardBlocked =
    proceedableFileCount === 0 ||
    blockingConditions.some((b) =>
      [
        "ARCHIVE_PASSWORD_REQUIRED",
        "ARCHIVE_SECURITY_FAILURE",
        "NESTED_ARCHIVE",
        "DANGEROUS_CONTENT",
        "PACKAGE_LIMIT_EXCEEDED",
        "NO_FILES",
      ].includes(b.code),
    );

  const packageCompleteness = rollupPackageCompleteness({
    acceptedCount: proceedableFileCount,
    blocked: hardBlocked,
    hasSkippedMembers: parts.unsupportedFiles.length > 0,
    hasCorruptedOrUnreadable:
      parts.corruptedFiles.length > 0 || parts.unreadableFiles.length > 0,
  });

  const documentReadiness = hardBlocked
    ? parts.passwordProtectedFiles.length > 0
      ? "NEEDS_PASSWORD"
      : "BLOCKED"
    : rollupDocumentReadiness(files);

  const endedAt = new Date().toISOString();
  const intake: PackageIntake = {
    version: UNIVERSAL_INTAKE_VERSION,
    packageId: newId("pkg"),
    packageLabel,
    status: hardBlocked ? "INTAKE_BLOCKED" : status,
    startedAt,
    endedAt,
    durationMs: Date.now() - t0,
    sourceUploadCount,
    discoveredFileCount: inventory.totalFiles,
    // Disjoint derived counters — NEVER accepted := ACCEPTED+RECOVERABLE
    acceptedFileCount: inventory.acceptedFileCount,
    rejectedFileCount: parts.rejectedFiles.length,
    recoverableFileCount: inventory.recoverableFileCount,
    proceedableFileCount: inventory.proceedableFileCount,
    unreadableFileCount: parts.unreadableFiles.length,
    passwordProtectedFileCount: parts.passwordProtectedFiles.length,
    unsupportedFileCount: parts.unsupportedFiles.length,
    corruptedFileCount: parts.corruptedFiles.length,
    securityFailureCount: parts.securityFailures.length,
    files,
    ...parts,
    recoveryActions,
    warnings,
    blockingConditions: hardBlocked
      ? blockingConditions.length
        ? blockingConditions
        : [{ code: "NO_ACCEPTED_DOCUMENTS", message: "Intake blocked — no accepted documents." }]
      : blockingConditions.filter((b) => b.code === "NO_ACCEPTED_DOCUMENTS" ? false : true),
    packageCompleteness,
    documentReadiness,
    userNotices: Array.from(
      new Set(
        files
          .map((f) => f.recovery?.userMessage)
          .filter((m): m is string => Boolean(m))
          .concat(
            warnings
              .filter((w) => w.code === "RECOVERY_APPLIED" || w.code === "PARTIAL_ARCHIVE_RECOVERY")
              .map((w) => w.message),
          ),
      ),
    ),
    _acceptedBuffers: hardBlocked ? {} : buffers,
  };

  const mayProceedToStorage = !hardBlocked && proceedableFileCount > 0;
  return {
    intake,
    mayProceedToStorage,
    intakeReport: buildIntakeReport(intake, mayProceedToStorage),
  };
}

/**
 * Run the Universal Intake pipeline on raw uploads.
 * Reuses expandTenderPackageUploadsWithSkips for ZIP/RAR security + extraction.
 */
export async function runUniversalIntake(
  uploads: IntakeSourceUpload[],
  options?: {
    /** Ephemeral passwords keyed by upload fileName — never logged or persisted. */
    passwordsByFileName?: Record<string, string>;
    /** When true, execute OCR at intake (slow). Default: schedule OCR for DI via forceOcr. */
    executeOcrAtIntake?: boolean;
    ocrRunner?: IntakeOcrRunner | null;
  },
): Promise<UniversalIntakeResult> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const packageLabel =
    uploads.length === 1
      ? uploads[0]!.fileName
      : uploads.length > 1
        ? `Tender package (${uploads.length} uploads)`
        : "Empty package";

  const warnings: PackageIntake["warnings"] = [];
  const blocking: PackageIntake["blockingConditions"] = [];
  const recoveryActions: PackageIntake["recoveryActions"] = [];
  const files: IntakeFileRecord[] = [];
  const buffers: Record<string, Buffer> = {};

  if (uploads.length === 0) {
    blocking.push({ code: "NO_FILES", message: "At least one file is required." });
    return finalize(startedAt, t0, packageLabel, 0, files, buffers, warnings, blocking, recoveryActions);
  }

  // —— Pre-expand source classification ——
  const preRecords: IntakeFileRecord[] = [];
  for (const upload of uploads) {
    const id = newId("src");
    const record = classifySourceUpload(upload, id);
    preRecords.push(record);
    if (record.blocking && record.state === "REJECTED_DANGEROUS") {
      blocking.push({
        code: "DANGEROUS_CONTENT",
        message: record.message ?? "Dangerous content",
        fileId: id,
      });
    }
    if (record.state === "REJECTED_ZERO_BYTE" || record.state === "REJECTED_EMPTY") {
      files.push(record);
      blocking.push({
        code: "UPLOAD_FAILED",
        message: record.message ?? "Empty file",
        fileId: id,
      });
    } else if (record.state === "REJECTED_SPOOFED_EXTENSION" || record.state === "REJECTED_UNSUPPORTED") {
      files.push(record);
    } else if (record.warningCodes.length) {
      for (const action of record.recoveryActions) {
        if (action !== "NONE") {
          recoveryActions.push({ fileId: id, action, detail: "source upload recovery" });
        }
      }
    }
  }

  if (blocking.some((b) => b.code === "DANGEROUS_CONTENT" || b.code === "UPLOAD_FAILED")) {
    // Include remaining pre-records that weren't pushed
    for (const r of preRecords) {
      if (!files.some((f) => f.fileId === r.fileId)) files.push(r);
    }
    return finalize(
      startedAt,
      t0,
      packageLabel,
      uploads.length,
      files,
      buffers,
      warnings,
      blocking,
      recoveryActions,
    );
  }

  // Soft-reject unsupported loose files but continue if archives/docs remain
  const expandable = uploads.filter((_, i) => {
    const r = preRecords[i]!;
    return r.state === "ACCEPTED" || r.state === "RECOVERABLE";
  });

  if (expandable.length === 0) {
    for (const r of preRecords) {
      if (!files.some((f) => f.fileId === r.fileId)) files.push(r);
    }
    blocking.push({
      code: "UNSUPPORTED_ONLY",
      message: "No supported tender documents or archives in the upload.",
    });
    return finalize(
      startedAt,
      t0,
      packageLabel,
      uploads.length,
      files,
      buffers,
      warnings,
      blocking,
      recoveryActions,
    );
  }

  // Large package advisories
  if (expandable.length >= Math.floor(ARCHIVE_LIMITS.maxMembers * 0.8)) {
    warnings.push({
      code: "HIGH_FILE_COUNT",
      message: `Upload count is high (${expandable.length}).`,
    });
  }
  const totalBytes = expandable.reduce((n, u) => n + u.bytes.byteLength, 0);
  if (totalBytes >= ARCHIVE_LIMITS.maxTotalExtractedBytes * 0.8) {
    warnings.push({
      code: "LARGE_PACKAGE",
      message: "Package size is near the configured limit.",
    });
  }

  // —— Archive expansion (reuses security validation) ——
  let expanded: Awaited<ReturnType<typeof expandTenderPackageUploadsWithSkips>>;
  try {
    expanded = await expandTenderPackageUploadsWithSkips(expandable, {
      passwordsByFileName: options?.passwordsByFileName,
    });
  } catch (err) {
    for (const r of preRecords) {
      if (!files.some((f) => f.fileId === r.fileId)) files.push({ ...r, state: r.state === "ACCEPTED" ? "CORRUPTED" : r.state });
    }
    const message = err instanceof Error ? err.message : String(err);
    const classified = classifyExpandFailureMessage(message);
    const stage =
      err instanceof AppError && err.details && typeof err.details === "object"
        ? (err.details as { uploadStage?: string }).uploadStage
        : undefined;
    const code =
      classified.blockingCode !== "UPLOAD_FAILED"
        ? classified.blockingCode
        : mapUploadStageToBlockingCode(stage);

    const failId = newId("arch");
    files.push({
      fileId: failId,
      originalName: expandable[0]?.fileName ?? packageLabel,
      displayName: expandable[0]?.fileName ?? packageLabel,
      source: "unknown",
      archiveFileName: expandable[0]?.fileName ?? null,
      archivePath: null,
      declaredMimeType: expandable[0]?.mimeType ?? null,
      sniffedMimeType: null,
      sniffedKind: null,
      sizeBytes: expandable[0]?.bytes.byteLength ?? 0,
      state: classified.state,
      readiness:
        classified.state === "PASSWORD_PROTECTED" ? "NEEDS_PASSWORD" : "BLOCKED",
      blocking: true,
      warningCodes: [],
      recoveryActions: ["NONE"],
      message,
      bytesAvailable: false,
    });
    blocking.push({ code, message, fileId: failId });
    return finalize(
      startedAt,
      t0,
      packageLabel,
      uploads.length,
      files,
      buffers,
      warnings,
      blocking,
      recoveryActions,
    );
  }

  for (const warn of expanded.recoveryWarnings) {
    warnings.push({
      code: "PARTIAL_ARCHIVE_RECOVERY",
      message: warn,
    });
  }

  // —— Accepted members + Universal File Recovery & Readiness ——
  const seenNames = new Map<string, string>();
  for (const doc of expanded.files) {
    const fileId = doc.discoveryId;
    const recovered = await recoverDiscoveredFile({
      fileId,
      fileName: doc.fileName,
      originalName: doc.originalFileName,
      mimeType: doc.mimeType,
      bytes: doc.bytes,
      priorState: "DISCOVERED",
      seenNames,
      executeOcrAtIntake: options?.executeOcrAtIntake,
      ocrRunner: options?.ocrRunner,
    });

    if (!seenNames.has(doc.originalFileName.toLowerCase())) {
      seenNames.set(doc.originalFileName.toLowerCase(), fileId);
    }

    const warningCodes: IntakeFileRecord["warningCodes"] = [];
    const recActs: IntakeFileRecord["recoveryActions"] = [];

    if (recovered.report.ocrRequired) {
      warningCodes.push("OCR_LIKELY_REQUIRED");
      recActs.push("FLAG_OCR_CANDIDATE", "SCHEDULE_OCR");
    }
    if (recovered.report.recoveredSha256 || recovered.report.derived) {
      warningCodes.push("RECOVERY_APPLIED");
      recActs.push("AUTO_REPAIR");
    }
    if (recovered.report.warnings.some((w) => /duplicate/i.test(w))) {
      warningCodes.push("DUPLICATE_FILENAME_RENAMED");
      recActs.push("RENAME_DUPLICATE");
    }
    if (recovered.report.attempts.some((a) => a.method === "CORRECT_EXTENSION_FROM_SNIFF")) {
      warningCodes.push("MIME_NORMALIZED");
      recActs.push("SNIFF_OVERRIDE_EXTENSION", "NORMALIZE_MIME");
    }
    if (
      recovered.report.recoveryClass === "AUTO_RECOVERABLE" &&
      !warningCodes.includes("RECOVERY_APPLIED") &&
      recovered.report.warnings.length > 0
    ) {
      warningCodes.push("FORMAT_SOFT_WARNING");
    }

    for (const action of recActs.filter((a) => a !== "NONE")) {
      recoveryActions.push({
        fileId,
        action,
        detail: recovered.report.userMessage ?? recovered.report.attempts.at(-1)?.detail ?? action,
      });
    }

    if (recovered.report.userMessage) {
      warnings.push({
        code: "RECOVERY_APPLIED",
        message: recovered.report.userMessage,
        fileId,
      });
    } else if (recovered.report.warnings[0]) {
      warnings.push({
        code: warningCodes[0] ?? "FORMAT_SOFT_WARNING",
        message: recovered.report.warnings[0],
        fileId,
      });
    }

    if (!recovered.proceedToStorage) {
      const blockingState = recovered.intakeState;
      files.push({
        fileId,
        originalName: doc.originalFileName,
        displayName: recovered.displayName,
        source: doc.source,
        archiveFileName: doc.archiveFileName,
        archivePath: doc.archivePath,
        declaredMimeType: doc.mimeType,
        sniffedMimeType: recovered.sniffedMime,
        sniffedKind: recovered.sniffedKind,
        sizeBytes: recovered.bytes.byteLength,
        state: blockingState,
        readiness: recovered.readiness,
        blocking: true,
        warningCodes,
        recoveryActions: recActs.length ? recActs : ["NONE"],
        message:
          recovered.report.userActionRequired ??
          recovered.report.blockingConditions[0] ??
          recovered.report.warnings[0] ??
          null,
        bytesAvailable: false,
        recovery: recovered.report,
      });
      if (
        recovered.report.recoveryClass === "USER_ACTION_REQUIRED" &&
        Object.keys(buffers).length === 0 &&
        expanded.files.length === 1
      ) {
        blocking.push({
          code: "UPLOAD_FAILED",
          message:
            recovered.report.userActionRequired ??
            "User action required before this file can be analyzed.",
          fileId,
        });
      }
      // Other files may still proceed — do not hard-block whole package for one corrupt file
      continue;
    }

    buffers[fileId] = recovered.bytes;
    files.push({
      fileId,
      originalName: doc.originalFileName,
      displayName: recovered.displayName,
      source: doc.source,
      archiveFileName: doc.archiveFileName,
      archivePath: doc.archivePath,
      declaredMimeType: doc.mimeType,
      sniffedMimeType: recovered.sniffedMime,
      sniffedKind: recovered.sniffedKind,
      sizeBytes: recovered.bytes.byteLength,
      state: recovered.intakeState,
      readiness: recovered.readiness,
      blocking: false,
      warningCodes,
      recoveryActions: recActs.length ? recActs : ["NONE"],
      message: recovered.report.userMessage ?? recovered.report.warnings[0] ?? null,
      bytesAvailable: true,
      recovery: recovered.report,
    });
  }

  for (const skip of expanded.skipped) {
    const fileId = skip.discoveryId;
    const report = recoveryReportForTerminal({
      fileId,
      originalName: skip.originalFileName,
      bytes: Buffer.alloc(0),
      recoveryClass: "UNSUPPORTED",
      originalState: "ARCHIVE_MEMBER",
      message: skip.reason,
    });
    files.push({
      fileId,
      originalName: skip.originalFileName,
      displayName: skip.originalFileName,
      source: skip.archiveFileName.toLowerCase().endsWith(".rar") ? "rar" : "zip",
      archiveFileName: skip.archiveFileName,
      archivePath: skip.archivePath,
      declaredMimeType: null,
      sniffedMimeType: null,
      sniffedKind: null,
      sizeBytes: 0,
      state: "UNSUPPORTED_SKIPPED",
      readiness: "NOT_READY",
      blocking: false,
      warningCodes: ["UNSUPPORTED_MEMBER_SKIPPED"],
      recoveryActions: ["RECORD_SKIPPED_MEMBER"],
      message: skip.reason,
      bytesAvailable: false,
      recovery: report,
    });
    warnings.push({
      code: "UNSUPPORTED_MEMBER_SKIPPED",
      message: skip.reason,
      fileId,
    });
    recoveryActions.push({
      fileId,
      action: "RECORD_SKIPPED_MEMBER",
      detail: skip.reason,
    });
  }

  // Preserve pre-classification notes for unsupported loose uploads that were filtered out
  for (const r of preRecords) {
    if (
      (r.state === "REJECTED_UNSUPPORTED" ||
        r.state === "REJECTED_SPOOFED_EXTENSION" ||
        r.state === "REJECTED_DANGEROUS" ||
        r.state === "REJECTED_ZERO_BYTE") &&
      !files.some((f) => f.originalName === r.originalName && f.source === "loose")
    ) {
      const recoveryClass =
        r.state === "REJECTED_DANGEROUS"
          ? ("SECURITY_BLOCKED" as const)
          : r.state === "REJECTED_ZERO_BYTE"
            ? ("CORRUPTED_UNRECOVERABLE" as const)
            : ("UNSUPPORTED" as const);
      files.push({
        ...r,
        recovery: recoveryReportForTerminal({
          fileId: r.fileId,
          originalName: r.originalName,
          bytes: Buffer.alloc(0),
          recoveryClass,
          originalState: r.state,
          message: r.message ?? r.state,
        }),
      });
      warnings.push({
        code: "PARTIAL_PACKAGE",
        message: r.message ?? "Source upload rejected at intake",
        fileId: r.fileId,
      });
    }
  }

  return finalize(
    startedAt,
    t0,
    packageLabel,
    uploads.length,
    files,
    buffers,
    warnings,
    blocking,
    recoveryActions,
  );
}

/**
 * Convert a successful intake into storage-ready PackageUploadFile list.
 * One proceedable identity → one upload; never concat overlapping counter views.
 */
export function acceptedUploadsFromIntake(result: UniversalIntakeResult): PackageUploadFile[] {
  if (!result.mayProceedToStorage) return [];
  const inventory = buildCanonicalPackageInventory(
    result.intake.files.map((f) => ({
      fileId: f.fileId,
      state: f.state,
      originalName: f.originalName,
      archivePath: f.archivePath,
    })),
  );
  const proceedableIds = new Set(
    inventory.files
      .filter((f) => isProceedableLifecycleState(f.state))
      .map((f) => f.identity),
  );
  const byId = new Map(result.intake.files.map((f) => [f.fileId, f]));
  const out: PackageUploadFile[] = [];
  for (const id of proceedableIds) {
    const f = byId.get(id);
    const buf = result.intake._acceptedBuffers[id];
    if (!f || !buf) continue;
    out.push({
      discoveryId: f.fileId,
      fileName: f.displayName,
      originalFileName: f.originalName,
      mimeType: f.sniffedMimeType ?? f.declaredMimeType ?? "application/octet-stream",
      fileSize: f.sizeBytes,
      bytes: buf,
      source: f.source === "unknown" ? "loose" : f.source,
      archiveFileName: f.archiveFileName,
      archivePath: f.archivePath,
      recovery: f.recovery ?? null,
    });
  }
  return out;
}

/**
 * Throw AppError when intake is blocked — preserves uploadStage for UI.
 */
export function assertIntakeMayProceed(result: UniversalIntakeResult): void {
  if (result.mayProceedToStorage) return;
  const primary = result.intake.blockingConditions[0];
  const message = primary?.message ?? "Package intake blocked.";
  let stage = "UPLOAD_FAILED";
  switch (primary?.code) {
    case "ARCHIVE_PASSWORD_REQUIRED":
      stage = "ARCHIVE_PASSWORD_REQUIRED";
      break;
    case "ARCHIVE_CORRUPTED":
    case "ARCHIVE_SECURITY_FAILURE":
    case "NESTED_ARCHIVE":
      stage = "ARCHIVE_EXTRACTION_FAILED";
      break;
    case "UNSUPPORTED_ONLY":
      stage = "UNSUPPORTED_FILE";
      break;
    case "PACKAGE_LIMIT_EXCEEDED":
      stage = "PACKAGE_LIMIT_EXCEEDED";
      break;
    default:
      stage = "UPLOAD_FAILED";
  }
  throw new AppError(ErrorCode.VALIDATION, message, 400, {
    uploadStage: stage,
    intakeStatus: result.intake.status,
    intakeBlockingCodes: result.intake.blockingConditions.map((b) => b.code),
    intakeVersion: UNIVERSAL_INTAKE_VERSION,
    userAction:
      primary?.code === "ARCHIVE_PASSWORD_REQUIRED" ? "ENTER_ARCHIVE_PASSWORD" : undefined,
    userMessage: message,
    retryable: primary?.code === "ARCHIVE_PASSWORD_REQUIRED",
    fileName:
      result.intake.passwordProtectedFiles[0]?.originalName ??
      result.intake.files.find((f) => f.state === "PASSWORD_PROTECTED")?.originalName ??
      undefined,
  });
}

export { ErrorCode, AppError };
