/**
 * OCR gate — detect necessity; optionally execute (injectable for tests).
 * Never pretends low-confidence OCR is perfect.
 */

import type { RecoveryAttempt, ExtractionQualityHint } from "./types";
import { makeRecoveryAttempt } from "./recover-pdf";

export type IntakeOcrPage = {
  page: number;
  text: string;
  confidence: number | null;
  charCount: number;
};

export type IntakeOcrResult = {
  text: string;
  pageCount: number;
  pages: IntakeOcrPage[];
  meanConfidence: number | null;
};

/** Injectable OCR runner — production may call pdf-ocr; tests inject stubs. */
export type IntakeOcrRunner = (input: {
  buffer: Buffer;
  fileName: string;
}) => Promise<IntakeOcrResult>;

export type OcrGateResult = {
  ocrRequired: boolean;
  ocrUsed: boolean;
  ocrConfidence: number | null;
  quality: ExtractionQualityHint;
  attempts: RecoveryAttempt[];
  warnings: string[];
  derivedText: string | null;
  pageCount: number | null;
  forceOcr: boolean;
};

const LOW_OCR_CONFIDENCE = 55;

export async function runOcrGate(input: {
  ocrLikely: boolean;
  bytes: Buffer;
  fileName: string;
  /** When false (default), schedule OCR for Document Intelligence via forceOcr. */
  executeOcr: boolean;
  runner?: IntakeOcrRunner | null;
}): Promise<OcrGateResult> {
  const attempts: RecoveryAttempt[] = [];
  const warnings: string[] = [];

  if (!input.ocrLikely) {
    return {
      ocrRequired: false,
      ocrUsed: false,
      ocrConfidence: null,
      quality: "ok",
      attempts,
      warnings,
      derivedText: null,
      pageCount: null,
      forceOcr: false,
    };
  }

  attempts.push(
    makeRecoveryAttempt(
      "FLAG_OCR_REQUIRED",
      true,
      "OCR necessity confirmed for scanned/image-only PDF.",
      false,
    ),
  );

  if (!input.executeOcr || !input.runner) {
    warnings.push(
      "OCR scheduled for analysis — original PDF preserved; text will not be invented.",
    );
    return {
      ocrRequired: true,
      ocrUsed: false,
      ocrConfidence: null,
      quality: "ocr_pending",
      attempts,
      warnings,
      derivedText: null,
      pageCount: null,
      forceOcr: true,
    };
  }

  try {
    const result = await input.runner({
      buffer: input.bytes,
      fileName: input.fileName,
    });
    const confidences = result.pages
      .map((p) => p.confidence)
      .filter((c): c is number => typeof c === "number");
    const mean =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : result.meanConfidence;
    const low = mean != null && mean < LOW_OCR_CONFIDENCE;
    if (low) {
      warnings.push(
        `OCR mean confidence ${mean!.toFixed(1)} is low — results flagged, not treated as perfect.`,
      );
    }
    attempts.push(
      makeRecoveryAttempt(
        "EXECUTE_OCR",
        result.text.trim().length > 0,
        `OCR produced ${result.text.length} chars across ${result.pageCount} page(s); meanConfidence=${mean ?? "n/a"}.`,
        false,
      ),
    );
    return {
      ocrRequired: true,
      ocrUsed: true,
      ocrConfidence: mean,
      quality: low ? "ocr_low_confidence" : result.text.trim() ? "ocr_ok" : "empty",
      attempts,
      warnings,
      derivedText: result.text,
      pageCount: result.pageCount,
      forceOcr: true,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "OCR failed";
    attempts.push(makeRecoveryAttempt("EXECUTE_OCR", false, detail, false));
    warnings.push("OCR execution failed at intake — Document Intelligence will retry.");
    return {
      ocrRequired: true,
      ocrUsed: false,
      ocrConfidence: null,
      quality: "ocr_pending",
      attempts,
      warnings,
      derivedText: null,
      pageCount: null,
      forceOcr: true,
    };
  }
}
