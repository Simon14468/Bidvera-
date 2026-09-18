/**
 * Lightweight format validation for accepted document bytes.
 * Soft warnings only — does not replace Document Intelligence extraction.
 */

import type { IntakeRecoveryAction, IntakeWarningCode } from "./types";

export type FormatValidationResult = {
  ok: boolean;
  softWarning: boolean;
  ocrLikely: boolean;
  codes: IntakeWarningCode[];
  recovery: IntakeRecoveryAction[];
  message: string | null;
};

/** PDF magic + minimal structure. Image-only PDFs are flagged OCR_LIKELY, not rejected. */
export function validateDocumentFormat(
  fileName: string,
  bytes: Buffer,
  sniffedKind: string | null,
): FormatValidationResult {
  const lower = fileName.toLowerCase();
  const codes: IntakeWarningCode[] = [];
  const recovery: IntakeRecoveryAction[] = [];

  if (sniffedKind === "pdf" || lower.endsWith(".pdf")) {
    if (bytes.length < 5 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return {
        ok: false,
        softWarning: false,
        ocrLikely: false,
        codes: [],
        recovery: ["NONE"],
        message: "PDF header missing or malformed.",
      };
    }
    const sample = bytes.subarray(0, Math.min(bytes.length, 512_000)).toString("latin1");
    const hasTextObject = /\/Font\b|BT\b|Tj\b|TJ\b/.test(sample);
    const hasImageXObject = /\/Image\b|\/XObject\b/.test(sample);
    if (!hasTextObject && hasImageXObject) {
      codes.push("OCR_LIKELY_REQUIRED");
      recovery.push("FLAG_OCR_CANDIDATE");
      return {
        ok: true,
        softWarning: true,
        ocrLikely: true,
        codes,
        recovery,
        message: "PDF appears image-heavy; OCR may be required.",
      };
    }
    return { ok: true, softWarning: false, ocrLikely: false, codes, recovery: ["NONE"], message: null };
  }

  // OOXML (docx/xlsx/pptx) are ZIP containers — require PK header
  if (
    sniffedKind === "docx" ||
    sniffedKind === "xlsx" ||
    sniffedKind === "pptx" ||
    /\.(docx|xlsx|pptx)$/i.test(fileName)
  ) {
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      return {
        ok: false,
        softWarning: false,
        ocrLikely: false,
        codes: [],
        recovery: ["NONE"],
        message: "Office Open XML container header missing (expected ZIP/PK).",
      };
    }
    return { ok: true, softWarning: false, ocrLikely: false, codes, recovery: ["NONE"], message: null };
  }

  return { ok: true, softWarning: false, ocrLikely: false, codes, recovery: ["NONE"], message: null };
}
