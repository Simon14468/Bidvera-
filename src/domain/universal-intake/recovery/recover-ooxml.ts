/**
 * Safe OOXML / spreadsheet / PPTX probes — never invent cell or slide text.
 */

import type { RecoveryAttempt } from "./types";
import { makeRecoveryAttempt } from "./recover-pdf";

export type OoxmlRecoveryProbe = {
  ok: boolean;
  softWarning: boolean;
  unrecoverable: boolean;
  attempts: RecoveryAttempt[];
  warnings: string[];
  message: string | null;
  adapterHint: string | null;
};

function hasPk(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function asciiIncludes(bytes: Buffer, needle: string): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 2_000_000)).toString("latin1");
  return sample.includes(needle);
}

export function recoverOoxmlBytes(
  kind: "docx" | "xlsx" | "pptx" | "unknown",
  fileName: string,
  bytes: Buffer,
): OoxmlRecoveryProbe {
  const attempts: RecoveryAttempt[] = [];
  const warnings: string[] = [];

  if (!hasPk(bytes)) {
    attempts.push(
      makeRecoveryAttempt(
        "CORRUPTION_REJECT",
        false,
        "Office Open XML container missing PK/ZIP header.",
        false,
      ),
    );
    return {
      ok: false,
      softWarning: false,
      unrecoverable: true,
      attempts,
      warnings,
      message: "Office Open XML container header missing (expected ZIP/PK).",
      adapterHint: null,
    };
  }

  const hasContentTypes = asciiIncludes(bytes, "[Content_Types].xml");
  if (!hasContentTypes) {
    // Some malformed producers omit early; still try DI adapters — soft warn if kind known
    attempts.push(
      makeRecoveryAttempt(
        "OOXML_CONTENT_TYPES_PROBE",
        false,
        "[Content_Types].xml not found in early scan.",
        false,
      ),
    );
    if (kind === "unknown") {
      return {
        ok: false,
        softWarning: false,
        unrecoverable: true,
        attempts,
        warnings,
        message: `OOXML package "${fileName}" is missing Content_Types — unrecoverable.`,
        adapterHint: null,
      };
    }
    warnings.push("OOXML Content_Types not visible in scan; extraction may be partial.");
  } else {
    attempts.push(
      makeRecoveryAttempt(
        "OOXML_CONTENT_TYPES_PROBE",
        true,
        "[Content_Types].xml present.",
        false,
      ),
    );
  }

  if (kind === "xlsx" || /\.xlsx?$/i.test(fileName)) {
    const hasWorkbook =
      asciiIncludes(bytes, "xl/workbook.xml") || asciiIncludes(bytes, "workbook.xml");
    attempts.push(
      makeRecoveryAttempt(
        "SPREADSHEET_STRUCTURE_PROBE",
        hasWorkbook,
        hasWorkbook ? "Workbook structure markers found." : "Workbook markers weak/missing.",
        false,
      ),
    );
    if (!hasWorkbook) {
      warnings.push("Spreadsheet workbook structure looks incomplete; extraction may be partial.");
    }
    return {
      ok: true,
      softWarning: warnings.length > 0,
      unrecoverable: false,
      attempts,
      warnings,
      message: warnings[0] ?? null,
      adapterHint: "adapter:sheetjs",
    };
  }

  if (kind === "pptx" || /\.pptx?$/i.test(fileName)) {
    const hasSlides =
      asciiIncludes(bytes, "ppt/slides/") || asciiIncludes(bytes, "slide1.xml");
    attempts.push(
      makeRecoveryAttempt(
        "PPTX_FALLBACK_PROBE",
        hasSlides,
        hasSlides
          ? "Slide parts detected."
          : "Slide parts weak — PPTX XML fallback may be used.",
        false,
      ),
    );
    if (!hasSlides) {
      warnings.push("Presentation slide structure incomplete; PPTX fallback extraction may apply.");
    }
    return {
      ok: true,
      softWarning: warnings.length > 0,
      unrecoverable: false,
      attempts,
      warnings,
      message: warnings[0] ?? null,
      adapterHint: "adapter:ooxml-text",
    };
  }

  // docx
  const hasDocument =
    asciiIncludes(bytes, "word/document.xml") || asciiIncludes(bytes, "document.xml");
  attempts.push(
    makeRecoveryAttempt(
      "OOXML_CONTENT_TYPES_PROBE",
      hasDocument,
      hasDocument ? "word/document.xml present." : "document.xml weak/missing.",
      false,
    ),
  );
  if (!hasDocument) {
    warnings.push("DOCX document part incomplete; extraction may be partial.");
  }

  return {
    ok: true,
    softWarning: warnings.length > 0,
    unrecoverable: false,
    attempts,
    warnings,
    message: warnings[0] ?? null,
    adapterHint: "adapter:mammoth",
  };
}
