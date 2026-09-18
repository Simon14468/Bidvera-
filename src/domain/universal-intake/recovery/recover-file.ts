/**
 * Canonical per-file recovery orchestrator.
 */

import {
  sniffUploadContent,
  isDocumentUploadKind,
  type DetectedUploadKind,
} from "@/domain/tender-package/upload-content-sniff";
import {
  AUTO_REPAIR_USER_MESSAGE,
  OCR_SCHEDULED_USER_MESSAGE,
  type DerivedRepresentation,
  type FileRecoveryClass,
  type FileRecoveryReport,
  type RecoveryAttempt,
} from "./types";
import { recoverPdfBytes, sha256Hex, makeRecoveryAttempt } from "./recover-pdf";
import { recoverOoxmlBytes } from "./recover-ooxml";
import { recoverTextEncoding } from "./recover-text";
import { runOcrGate, type IntakeOcrRunner } from "./ocr-gate";

export type RecoverFileInput = {
  fileId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  bytes: Buffer;
  /** Prior terminal hint from classify/expand (optional). */
  priorState?: string;
  seenNames?: Map<string, string>;
  executeOcrAtIntake?: boolean;
  ocrRunner?: IntakeOcrRunner | null;
};

export type RecoverFileOutput = {
  report: FileRecoveryReport;
  /** Bytes to use for storage/analysis (recovered or original). */
  bytes: Buffer;
  /** Ephemeral OCR text when executed at intake — never persisted as invented content. */
  derivedOcrText: string | null;
  proceedToStorage: boolean;
  intakeState:
    | "ACCEPTED"
    | "RECOVERABLE"
    | "CORRUPTED"
    | "PASSWORD_PROTECTED"
    | "REJECTED_UNSUPPORTED"
    | "REJECTED_SPOOFED_EXTENSION"
    | "SECURITY_FAILURE"
    | "UNREADABLE";
  readiness:
    | "READY"
    | "READY_WITH_WARNINGS"
    | "NEEDS_OCR"
    | "NEEDS_PASSWORD"
    | "NOT_READY"
    | "BLOCKED";
  sniffedKind: DetectedUploadKind | "unknown";
  sniffedMime: string;
  displayName: string;
};

function mapKind(kind: DetectedUploadKind | "unknown"): "docx" | "xlsx" | "pptx" | "unknown" {
  if (kind === "docx" || kind === "xlsx" || kind === "pptx") return kind;
  return "unknown";
}

export async function recoverDiscoveredFile(
  input: RecoverFileInput,
): Promise<RecoverFileOutput> {
  const originalSha256 = sha256Hex(input.bytes);
  const attempts: RecoveryAttempt[] = [];
  const warnings: string[] = [];
  const blocking: string[] = [];
  let working = input.bytes;
  let displayName = input.fileName;
  let derived: DerivedRepresentation | null = null;
  let adapterUsed: string | null = null;
  let recoveryClass: FileRecoveryClass = "READY";
  let userMessage: string | null = null;
  let userActionRequired: string | null = null;
  let ocrUsed = false;
  let ocrRequired = false;
  let ocrConfidence: number | null = null;
  let forceOcr = false;
  let extractionQuality: FileRecoveryReport["extractionQuality"] = "unknown";
  let derivedOcrText: string | null = null;
  let autoRepaired = false;

  const sniffed = sniffUploadContent(working, input.fileName);
  const sniffedKind = sniffed.kind;
  let sniffedMime = sniffed.mimeType || input.mimeType;

  // Extension correction when content is safely identifiable
  const lower = input.fileName.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
  if (
    isDocumentUploadKind(sniffedKind) &&
    ext &&
    !lower.endsWith(`.${sniffedKind === "jpeg" ? "jpg" : sniffedKind}`) &&
    !(sniffedKind === "jpeg" && (ext === ".jpeg" || ext === ".jpg")) &&
    !(sniffedKind === "tiff" && (ext === ".tif" || ext === ".tiff"))
  ) {
    // Misleading extension but identifiable content — correct display name, keep provenance of original
    const corrected = `${input.originalName.replace(/\.[^.]+$/, "")}.${sniffedKind === "jpeg" ? "jpg" : sniffedKind}`;
    if (corrected.toLowerCase() !== lower) {
      displayName = corrected;
      attempts.push(
        makeRecoveryAttempt(
          "CORRECT_EXTENSION_FROM_SNIFF",
          true,
          `Extension ${ext || "(none)"} corrected to .${sniffedKind === "jpeg" ? "jpg" : sniffedKind} from content sniff.`,
          false,
        ),
      );
      warnings.push(`Misleading extension corrected to match ${sniffedKind} content.`);
      autoRepaired = true;
      recoveryClass = "AUTO_RECOVERABLE";
      sniffedMime = sniffed.mimeType;
      attempts.push(
        makeRecoveryAttempt(
          "NORMALIZE_MIME_FROM_SNIFF",
          true,
          `MIME normalized to ${sniffedMime}.`,
          false,
        ),
      );
    }
  }

  // Duplicate representation
  const nameKey = input.originalName.toLowerCase();
  if (input.seenNames?.has(nameKey)) {
    attempts.push(
      makeRecoveryAttempt(
        "RENAME_DUPLICATE",
        true,
        `Duplicate of ${input.seenNames.get(nameKey)}.`,
        false,
      ),
    );
    warnings.push(`Duplicate filename normalized: ${displayName}`);
    if (recoveryClass === "READY") recoveryClass = "AUTO_RECOVERABLE";
    autoRepaired = true;
  }

  // —— Format-specific recovery ——
  if (sniffedKind === "pdf" || lower.endsWith(".pdf")) {
    const pdf = recoverPdfBytes(displayName, working);
    attempts.push(...pdf.attempts);
    warnings.push(...pdf.warnings);

    if (pdf.encrypted) {
      recoveryClass = "USER_ACTION_REQUIRED";
      userActionRequired =
        "This PDF is encrypted or password-protected. Upload an unlocked copy to continue.";
      blocking.push(userActionRequired);
      return finish({
        intakeState: "PASSWORD_PROTECTED",
        readiness: "NEEDS_PASSWORD",
        proceed: false,
      });
    }

    if (pdf.unrecoverable) {
      recoveryClass = "CORRUPTED_UNRECOVERABLE";
      blocking.push(pdf.message ?? "PDF is corrupted and unrecoverable.");
      return finish({
        intakeState: "CORRUPTED",
        readiness: "BLOCKED",
        proceed: false,
      });
    }

    if (pdf.repairedBytes) {
      working = pdf.repairedBytes;
      autoRepaired = true;
      recoveryClass = "AUTO_RECOVERABLE";
      derived = {
        kind: "repaired_bytes",
        method: "TRIM_PDF_TRAILING_JUNK",
        confidence: 0.9,
        quality: "degraded",
        sha256: sha256Hex(working),
        charCount: null,
        pageCount: null,
      };
    }

    adapterUsed = pdf.ocrLikely ? "adapter:pdf-parse+ocr" : "adapter:pdf-parse";
    const ocr = await runOcrGate({
      ocrLikely: pdf.ocrLikely,
      bytes: working,
      fileName: displayName,
      executeOcr: Boolean(input.executeOcrAtIntake),
      runner: input.ocrRunner ?? null,
    });
    attempts.push(...ocr.attempts);
    warnings.push(...ocr.warnings);
    ocrRequired = ocr.ocrRequired;
    ocrUsed = ocr.ocrUsed;
    ocrConfidence = ocr.ocrConfidence;
    forceOcr = ocr.forceOcr;
    extractionQuality = ocr.quality === "ok" && !pdf.ocrLikely ? "ok" : ocr.quality;
    derivedOcrText = ocr.derivedText;

    if (ocr.ocrRequired) {
      recoveryClass = "AUTO_RECOVERABLE";
      if (ocr.derivedText) {
        derived = {
          kind: "ocr_text",
          method: "EXECUTE_OCR",
          confidence: ocr.ocrConfidence,
          quality: ocr.quality,
          sha256: null,
          charCount: ocr.derivedText.length,
          pageCount: ocr.pageCount,
        };
        autoRepaired = true;
      } else {
        userMessage = OCR_SCHEDULED_USER_MESSAGE;
      }
    }

    return finish({
      intakeState: recoveryClass === "READY" && !autoRepaired ? "ACCEPTED" : "RECOVERABLE",
      readiness: ocrRequired ? "NEEDS_OCR" : autoRepaired ? "READY_WITH_WARNINGS" : "READY",
      proceed: true,
    });
  }

  if (
    sniffedKind === "docx" ||
    sniffedKind === "xlsx" ||
    sniffedKind === "pptx" ||
    /\.(docx|xlsx|pptx)$/i.test(displayName)
  ) {
    const kind = mapKind(sniffedKind);
    const ooxml = recoverOoxmlBytes(kind, displayName, working);
    attempts.push(...ooxml.attempts);
    warnings.push(...ooxml.warnings);
    adapterUsed = ooxml.adapterHint;

    if (ooxml.unrecoverable) {
      recoveryClass = "CORRUPTED_UNRECOVERABLE";
      blocking.push(ooxml.message ?? "Office document unrecoverable.");
      return finish({
        intakeState: "CORRUPTED",
        readiness: "BLOCKED",
        proceed: false,
      });
    }

    if (ooxml.softWarning) {
      recoveryClass = "AUTO_RECOVERABLE";
      autoRepaired = true;
      extractionQuality = "degraded";
    } else {
      extractionQuality = "ok";
    }

    return finish({
      intakeState: ooxml.softWarning || autoRepaired ? "RECOVERABLE" : "ACCEPTED",
      readiness: ooxml.softWarning || autoRepaired ? "READY_WITH_WARNINGS" : "READY",
      proceed: true,
    });
  }

  if (sniffedKind === "txt" || sniffedKind === "csv" || /\.(txt|csv)$/i.test(displayName)) {
    const text = recoverTextEncoding(working);
    attempts.push(...text.attempts);
    warnings.push(...text.warnings);
    adapterUsed = "adapter:utf8";
    if (text.repairedBytes) {
      working = text.repairedBytes;
      autoRepaired = true;
      recoveryClass = "AUTO_RECOVERABLE";
      derived = {
        kind: "normalized_encoding",
        method: "NORMALIZE_TEXT_ENCODING",
        confidence: 0.95,
        quality: "ok",
        sha256: sha256Hex(working),
        charCount: working.byteLength,
        pageCount: null,
      };
    }
    extractionQuality = "ok";
    return finish({
      intakeState: autoRepaired ? "RECOVERABLE" : "ACCEPTED",
      readiness: autoRepaired ? "READY_WITH_WARNINGS" : "READY",
      proceed: true,
    });
  }

  if (isDocumentUploadKind(sniffedKind)) {
    adapterUsed = `adapter:${sniffedKind}`;
    extractionQuality = "ok";
    // Empty metadata note for images
    if (sniffedKind === "png" || sniffedKind === "jpeg" || sniffedKind === "tiff") {
      attempts.push(
        makeRecoveryAttempt(
          "RECORD_EMPTY_METADATA",
          true,
          "Image document — OCR may apply at Document Intelligence.",
          false,
        ),
      );
      forceOcr = true;
      ocrRequired = true;
      recoveryClass = "AUTO_RECOVERABLE";
      userMessage = OCR_SCHEDULED_USER_MESSAGE;
      extractionQuality = "ocr_pending";
      return finish({
        intakeState: "RECOVERABLE",
        readiness: "NEEDS_OCR",
        proceed: true,
      });
    }
    return finish({
      intakeState: autoRepaired ? "RECOVERABLE" : "ACCEPTED",
      readiness: autoRepaired ? "READY_WITH_WARNINGS" : "READY",
      proceed: true,
    });
  }

  if (sniffedKind === "unknown") {
    recoveryClass = "UNSUPPORTED";
    blocking.push(`Unsupported or unidentifiable file: ${input.originalName}`);
    attempts.push(
      makeRecoveryAttempt("UNSUPPORTED_REJECT", false, "Content not a supported tender type.", false),
    );
    return finish({
      intakeState: "REJECTED_UNSUPPORTED",
      readiness: "NOT_READY",
      proceed: false,
    });
  }

  recoveryClass = "UNSUPPORTED";
  return finish({
    intakeState: "REJECTED_UNSUPPORTED",
    readiness: "NOT_READY",
    proceed: false,
  });

  function finish(opts: {
    intakeState: RecoverFileOutput["intakeState"];
    readiness: RecoverFileOutput["readiness"];
    proceed: boolean;
  }): RecoverFileOutput {
    if (autoRepaired && !userMessage && recoveryClass === "AUTO_RECOVERABLE") {
      userMessage = AUTO_REPAIR_USER_MESSAGE;
    }
    if (recoveryClass === "READY" && !autoRepaired && !ocrRequired) {
      extractionQuality = extractionQuality === "unknown" ? "ok" : extractionQuality;
    }

    const recoveredSha256 = working.equals(input.bytes) ? null : sha256Hex(working);
    if (recoveredSha256 && !derived) {
      derived = {
        kind: "repaired_bytes",
        method: "STRIP_PDF_LEADING_JUNK",
        confidence: 0.85,
        quality: extractionQuality,
        sha256: recoveredSha256,
        charCount: null,
        pageCount: null,
      };
    }

    const report: FileRecoveryReport = {
      fileId: input.fileId,
      originalName: input.originalName,
      recoveryClass,
      originalState: input.priorState ?? "DISCOVERED",
      attempts,
      recoveryResult: recoveryClass,
      extractionQuality,
      adapterUsed,
      ocrUsed,
      ocrRequired,
      ocrConfidence,
      warnings,
      blockingConditions: blocking,
      userMessage,
      userActionRequired,
      derived,
      originalSha256,
      recoveredSha256,
      forceOcr,
    };

    return {
      report,
      bytes: working,
      derivedOcrText,
      proceedToStorage: opts.proceed,
      intakeState: opts.intakeState,
      readiness: opts.readiness,
      sniffedKind,
      sniffedMime,
      displayName,
    };
  }
}

/** Map pre-expand security / unsupported states into recovery reports. */
export function recoveryReportForTerminal(input: {
  fileId: string;
  originalName: string;
  bytes: Buffer;
  recoveryClass: FileRecoveryClass;
  originalState: string;
  message: string;
  userActionRequired?: string | null;
}): FileRecoveryReport {
  const originalSha256 = sha256Hex(input.bytes);
  return {
    fileId: input.fileId,
    originalName: input.originalName,
    recoveryClass: input.recoveryClass,
    originalState: input.originalState,
    attempts: [
      makeRecoveryAttempt(
        input.recoveryClass === "SECURITY_BLOCKED"
          ? "SECURITY_REJECT"
          : input.recoveryClass === "USER_ACTION_REQUIRED"
            ? "PASSWORD_GATE"
            : input.recoveryClass === "UNSUPPORTED"
              ? "UNSUPPORTED_REJECT"
              : "CORRUPTION_REJECT",
        false,
        input.message,
        false,
      ),
    ],
    recoveryResult: input.recoveryClass,
    extractionQuality: "empty",
    adapterUsed: null,
    ocrUsed: false,
    ocrRequired: false,
    ocrConfidence: null,
    warnings: [],
    blockingConditions: [input.message],
    userMessage: null,
    userActionRequired: input.userActionRequired ?? input.message,
    derived: null,
    originalSha256,
    recoveredSha256: null,
    forceOcr: false,
  };
}
