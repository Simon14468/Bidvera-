/**
 * Document extraction quality gate — Phase 1.
 * Maps legacy assessExtractQuality + capability → explicit states.
 */

import type { ExtractionSupportLevel } from "@/domain/tender-package/extraction-capabilities";
import type { DocumentExtractionQualityState } from "./types";

type LegacyExtractQuality = "ok" | "empty" | "low" | "degraded";

export function mapLegacyExtractQuality(
  quality: LegacyExtractQuality,
  opts?: { support?: ExtractionSupportLevel | null; ambiguous?: boolean },
): DocumentExtractionQualityState {
  if (opts?.support === "UNSUPPORTED" || opts?.support === "UPLOAD_ONLY") {
    return opts.support === "UNSUPPORTED" ? "UNSUPPORTED" : "UNREADABLE";
  }
  if (opts?.support === "ARCHIVE") {
    return "UNSUPPORTED";
  }
  if (opts?.ambiguous) return "AMBIGUOUS";
  switch (quality) {
    case "ok":
      return "VALID";
    case "degraded":
      return "PARTIALLY_READABLE";
    case "low":
    case "empty":
      return "UNREADABLE";
    default:
      return "AMBIGUOUS";
  }
}

export function assessDocumentExtractionState(input: {
  text: string;
  method: string;
  pageCount: number | null;
  legacyQuality: LegacyExtractQuality;
  support?: ExtractionSupportLevel | null;
  usedOcr?: boolean;
}): {
  state: DocumentExtractionQualityState;
  message: string | null;
} {
  if (input.support === "UNSUPPORTED") {
    return { state: "UNSUPPORTED", message: "Format is not supported for extraction." };
  }
  if (input.support === "UPLOAD_ONLY") {
    return {
      state: "UNREADABLE",
      message: "Format accepted at upload but has no reliable text extractor.",
    };
  }
  if (input.support === "ARCHIVE") {
    return {
      state: "UNSUPPORTED",
      message: "Archives must be expanded; not extracted as a single document.",
    };
  }

  const state = mapLegacyExtractQuality(input.legacyQuality, {
    support: input.support,
    ambiguous: false,
  });

  if (state === "VALID" && input.usedOcr) {
    return {
      state: "PARTIALLY_READABLE",
      message: "Text recovered via OCR — verify critical content manually.",
    };
  }

  const messages: Record<DocumentExtractionQualityState, string | null> = {
    VALID: null,
    PARTIALLY_READABLE:
      "Extraction succeeded with limited confidence — verify critical requirements.",
    UNREADABLE: "Could not extract readable text from this document.",
    UNSUPPORTED: "Format is not supported for extraction.",
    AMBIGUOUS: "Extraction result is ambiguous — treat as needs verification.",
  };

  return { state, message: messages[state] };
}

/** Package-level rollup: partial failures must not corrupt valid members. */
export function rollupPackageQuality(
  states: DocumentExtractionQualityState[],
): DocumentExtractionQualityState {
  if (states.length === 0) return "UNREADABLE";
  if (states.every((s) => s === "VALID")) return "VALID";
  if (states.some((s) => s === "VALID" || s === "PARTIALLY_READABLE")) {
    return "PARTIALLY_READABLE";
  }
  if (states.every((s) => s === "UNSUPPORTED")) return "UNSUPPORTED";
  if (states.some((s) => s === "AMBIGUOUS")) return "AMBIGUOUS";
  return "UNREADABLE";
}
