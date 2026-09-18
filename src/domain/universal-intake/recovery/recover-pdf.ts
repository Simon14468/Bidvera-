/**
 * Safe PDF byte repairs — never invent page content.
 */

import { createHash } from "node:crypto";
import { isPdfEncrypted } from "@/services/document/pdf-encrypted";
import type { RecoveryAttempt, RecoveryMethod } from "./types";

export type PdfRecoveryProbe = {
  ok: boolean;
  encrypted: boolean;
  ocrLikely: boolean;
  repairedBytes: Buffer | null;
  attempts: RecoveryAttempt[];
  warnings: string[];
  unrecoverable: boolean;
  message: string | null;
};

function attempt(
  method: RecoveryMethod,
  success: boolean,
  detail: string,
  changedBytes: boolean,
): RecoveryAttempt {
  const now = new Date().toISOString();
  return { method, startedAt: now, endedAt: now, success, detail, changedBytes };
}

export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Recover PDF structure when possible without inventing content.
 * - Strip leading junk before %PDF-
 * - Trim trailing junk after the last %%EOF
 * - Detect encryption → caller maps to USER_ACTION_REQUIRED
 * - Detect image-only / missing text layer → OCR path
 */
export function recoverPdfBytes(fileName: string, bytes: Buffer): PdfRecoveryProbe {
  const attempts: RecoveryAttempt[] = [];
  const warnings: string[] = [];
  let working = bytes;

  const pdfIdx = working.indexOf(Buffer.from("%PDF-"));
  if (pdfIdx < 0) {
    attempts.push(
      attempt("CORRUPTION_REJECT", false, "No %PDF- header found in file bytes.", false),
    );
    return {
      ok: false,
      encrypted: false,
      ocrLikely: false,
      repairedBytes: null,
      attempts,
      warnings,
      unrecoverable: true,
      message: "PDF header missing or malformed.",
    };
  }

  if (pdfIdx > 0) {
    working = working.subarray(pdfIdx);
    attempts.push(
      attempt(
        "STRIP_PDF_LEADING_JUNK",
        true,
        `Removed ${pdfIdx} leading non-PDF byte(s) before %PDF-.`,
        true,
      ),
    );
    warnings.push("Leading junk before PDF header was stripped.");
  } else {
    attempts.push(
      attempt("NORMALIZE_PDF_EOF", true, "PDF header present at offset 0.", false),
    );
  }

  const eofMarker = Buffer.from("%%EOF");
  let lastEof = -1;
  for (let i = 0; i < working.length - 4; i++) {
    if (working[i] === 0x25 && working.subarray(i, i + 5).equals(eofMarker)) {
      lastEof = i;
    }
  }
  if (lastEof >= 0) {
    const end = lastEof + 5;
    // Keep a small trailing newline if present
    let trimEnd = end;
    if (trimEnd < working.length && (working[trimEnd] === 0x0a || working[trimEnd] === 0x0d)) {
      trimEnd += 1;
    }
    if (trimEnd < working.length) {
      const removed = working.length - trimEnd;
      working = working.subarray(0, trimEnd);
      attempts.push(
        attempt(
          "TRIM_PDF_TRAILING_JUNK",
          true,
          `Trimmed ${removed} trailing byte(s) after %%EOF.`,
          true,
        ),
      );
      warnings.push("Trailing bytes after %%EOF were trimmed.");
    }
  } else {
    warnings.push("PDF %%EOF marker missing — structure may be incomplete.");
    attempts.push(
      attempt(
        "NORMALIZE_PDF_EOF",
        false,
        "%%EOF not found; continuing with existing bytes (no content invented).",
        false,
      ),
    );
  }

  if (isPdfEncrypted(working)) {
    attempts.push(
      attempt("PASSWORD_GATE", false, "PDF /Encrypt dictionary detected.", false),
    );
    return {
      ok: false,
      encrypted: true,
      ocrLikely: false,
      repairedBytes: working.equals(bytes) ? null : working,
      attempts,
      warnings,
      unrecoverable: false,
      message:
        "This PDF is encrypted or password-protected. Upload an unlocked copy to continue.",
    };
  }

  const sample = working.subarray(0, Math.min(working.length, 512_000)).toString("latin1");
  const hasTextObject = /\/Font\b|BT\b|Tj\b|TJ\b/.test(sample);
  const hasImageXObject = /\/Image\b|\/XObject\b/.test(sample);
  const ocrLikely = !hasTextObject && (hasImageXObject || working.length > 2048);

  if (ocrLikely) {
    attempts.push(
      attempt(
        "FLAG_OCR_REQUIRED",
        true,
        "Missing text operators with image XObjects (or scant text layer) — OCR required.",
        false,
      ),
    );
    warnings.push("PDF appears scanned or image-only; OCR required.");
  }

  // Empty / broken metadata is non-blocking
  if (!/\/Info\s+\d+\s+\d+\s+R/.test(sample) && !/\/Metadata\b/.test(sample)) {
    attempts.push(
      attempt("RECORD_EMPTY_METADATA", true, "No Info/Metadata dictionary detected.", false),
    );
    warnings.push("PDF metadata empty or missing.");
  }

  const changed = !working.equals(bytes);
  return {
    ok: true,
    encrypted: false,
    ocrLikely,
    repairedBytes: changed ? working : null,
    attempts,
    warnings,
    unrecoverable: false,
    message: changed
      ? `Recovered PDF structure for ${fileName}.`
      : ocrLikely
        ? "PDF requires OCR path."
        : null,
  };
}

export { attempt as makeRecoveryAttempt };
