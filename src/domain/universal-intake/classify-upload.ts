/**
 * Pre-expand upload classification — empty, sniff, spoof, dangerous.
 */

import {
  isDangerousBinaryContent,
  isDocumentUploadKind,
  sniffUploadContent,
  type DetectedUploadKind,
} from "@/domain/tender-package/upload-content-sniff";
import type { IntakeFileRecord, IntakeSourceUpload, IntakeWarningCode } from "./types";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

const EXT_KIND: Record<string, DetectedUploadKind | "archive"> = {
  ".pdf": "pdf",
  ".doc": "doc",
  ".docx": "docx",
  ".xls": "xls",
  ".xlsx": "xlsx",
  ".ppt": "ppt",
  ".pptx": "pptx",
  ".txt": "txt",
  ".csv": "csv",
  ".png": "png",
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".tif": "tiff",
  ".tiff": "tiff",
  ".zip": "archive",
  ".rar": "archive",
};

export function classifySourceUpload(
  upload: IntakeSourceUpload,
  fileId: string,
): IntakeFileRecord {
  const size = upload.bytes.byteLength;
  const sniffed = sniffUploadContent(upload.bytes, upload.fileName);
  const ext = extOf(upload.fileName);
  const expectedKind = EXT_KIND[ext] ?? null;
  const warnings: IntakeWarningCode[] = [];

  if (size <= 0) {
    return baseRecord(upload, fileId, sniffed, {
      state: "REJECTED_ZERO_BYTE",
      readiness: "BLOCKED",
      blocking: true,
      message: "File is empty (zero bytes).",
    });
  }

  if (isDangerousBinaryContent(upload.bytes)) {
    return baseRecord(upload, fileId, sniffed, {
      state: "REJECTED_DANGEROUS",
      readiness: "BLOCKED",
      blocking: true,
      message: "File looks like an executable or script, not a tender document.",
    });
  }

  // Spoofed extension: declared doc ext but sniffed as something else (not archive/doc).
  if (
    expectedKind &&
    expectedKind !== "archive" &&
    sniffed.kind !== "unknown" &&
    sniffed.kind !== expectedKind &&
    !(expectedKind === "docx" && sniffed.kind === "zip") && // OOXML containers sniff as zip
    !(expectedKind === "xlsx" && sniffed.kind === "zip") &&
    !(expectedKind === "pptx" && sniffed.kind === "zip")
  ) {
    // Extension says PDF but bytes are not PDF
    if (isDocumentUploadKind(sniffed.kind) || sniffed.kind === "zip" || sniffed.kind === "rar") {
      warnings.push("MIME_NORMALIZED");
    } else {
      return baseRecord(upload, fileId, sniffed, {
        state: "REJECTED_SPOOFED_EXTENSION",
        readiness: "BLOCKED",
        blocking: true,
        message: `Extension ${ext} does not match file content (${sniffed.kind}).`,
        warningCodes: warnings,
      });
    }
  }

  if (
    upload.mimeType &&
    sniffed.mimeType &&
    normalizeMime(upload.mimeType) !== normalizeMime(sniffed.mimeType) &&
    !isLooseMimeMatch(upload.mimeType, sniffed.mimeType)
  ) {
    warnings.push("MIME_NORMALIZED");
  }

  const isArchive = sniffed.kind === "zip" || sniffed.kind === "rar" || expectedKind === "archive";
  const isDoc = isDocumentUploadKind(sniffed.kind);

  if (!isArchive && !isDoc) {
    return baseRecord(upload, fileId, sniffed, {
      state: "REJECTED_UNSUPPORTED",
      readiness: "BLOCKED",
      blocking: true,
      message: `Unsupported upload format (${sniffed.kind}).`,
      warningCodes: warnings,
    });
  }

  return baseRecord(upload, fileId, sniffed, {
    state: "ACCEPTED",
    readiness: "READY",
    blocking: false,
    message: null,
    warningCodes: warnings,
    recoveryActions: warnings.includes("MIME_NORMALIZED") ? ["NORMALIZE_MIME"] : ["NONE"],
    bytesAvailable: true,
  });
}

function normalizeMime(m: string): string {
  return m.split(";")[0]!.trim().toLowerCase();
}

function isLooseMimeMatch(declared: string, sniffed: string): boolean {
  const a = normalizeMime(declared);
  const b = normalizeMime(sniffed);
  if (a === b) return true;
  if (a.includes("zip") && b.includes("zip")) return true;
  if (a.includes("rar") && b.includes("rar")) return true;
  if (a === "application/octet-stream") return true;
  return false;
}

function baseRecord(
  upload: IntakeSourceUpload,
  fileId: string,
  sniffed: { kind: string; mimeType: string },
  partial: Partial<IntakeFileRecord> &
    Pick<IntakeFileRecord, "state" | "readiness" | "blocking" | "message">,
): IntakeFileRecord {
  return {
    fileId,
    originalName: upload.fileName,
    displayName: upload.fileName,
    source: "loose",
    archiveFileName: null,
    archivePath: null,
    declaredMimeType: upload.mimeType || null,
    sniffedMimeType: sniffed.mimeType,
    sniffedKind: sniffed.kind,
    sizeBytes: upload.bytes.byteLength,
    warningCodes: [],
    recoveryActions: ["NONE"],
    bytesAvailable: false,
    ...partial,
  };
}
