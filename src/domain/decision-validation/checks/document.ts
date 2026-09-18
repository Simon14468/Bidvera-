/**
 * Document integrity — readable text, validity gate passed.
 * Validates structured flags only (no re-OCR).
 */

import { failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

export function checkDocumentIntegrity(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const out: GuardianValidationFailure[] = [];
  const doc = input.document;
  const requireValidity = input.requireDocumentValidity !== false;

  if (!doc.readable || doc.textLength < 80) {
    out.push(
      failure({
        validationCode: "DOCUMENT_UNREADABLE",
        severity: "CRITICAL",
        check: "document-integrity",
        explanation:
          "Document text is unreadable or too short for tender analysis release.",
        sourceProvenance: doc.fileName ?? null,
      }),
    );
  } else if (doc.textLength < 200) {
    out.push(
      failure({
        validationCode: "DOCUMENT_INSUFFICIENT_TEXT",
        severity: "HIGH",
        check: "document-integrity",
        explanation: `Extracted text length (${doc.textLength}) is insufficient for a reliable completed report.`,
        sourceProvenance: doc.fileName ?? null,
      }),
    );
  }

  if (requireValidity && !doc.validityPassed) {
    out.push(
      failure({
        validationCode: "DOCUMENT_INVALID",
        severity: "CRITICAL",
        check: "document-integrity",
        explanation: `Tender validity gate failed${doc.validityReason ? `: ${doc.validityReason}` : ""}.`,
        sourceProvenance: doc.fileName ?? null,
      }),
    );
  }

  return out;
}
