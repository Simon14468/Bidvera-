/**
 * Cap AI-suggested risk severity when language indicates uncertainty — UNKNOWN ≠ HIGH risk.
 */

import type { RiskSeverity } from "@/domain/risk/types";

const UNCERTAINTY_LANGUAGE =
  /\b(unknown|unclear|unable\s+to\s+(?:determine|verify|confirm)|could\s+not\s+determine|needs?\s+verification|unverified|not\s+confirmed|may\s+require|might\s+need)\b/i;

/** Sanitize severity from AI risk drafts before persistence. */
export function sanitizeAiRiskSeverity(
  severity: string,
  description: string,
): RiskSeverity {
  const normalized = severity.toUpperCase() as RiskSeverity;
  if (!UNCERTAINTY_LANGUAGE.test(description)) {
    if (normalized === "CRITICAL" || normalized === "HIGH" || normalized === "MEDIUM" || normalized === "LOW") {
      return normalized;
    }
    return "MEDIUM";
  }
  if (normalized === "CRITICAL" || normalized === "HIGH") return "MEDIUM";
  if (normalized === "LOW") return "LOW";
  return "MEDIUM";
}
