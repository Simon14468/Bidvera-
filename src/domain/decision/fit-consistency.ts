/**
 * Canonical Fit consistency — one overall value everywhere.
 * Data-flow guard: fitScore, fitBreakdown.overall, and reasoning must agree.
 */

import type { CompanyTenderFitBreakdown } from "@/domain/decision/company-fit";

export function syncFitBreakdownOverall(
  fitBreakdown: CompanyTenderFitBreakdown | null,
  fitScore: number | null,
): CompanyTenderFitBreakdown | null {
  if (!fitBreakdown || fitScore == null) return fitBreakdown;
  if (fitBreakdown.overall === fitScore) return fitBreakdown;
  return { ...fitBreakdown, overall: fitScore };
}

export function assertCanonicalFitConsistency(input: {
  fitScore: number | null;
  fitBreakdown: CompanyTenderFitBreakdown | null;
  reasoning?: string | null;
  label?: string;
}): void {
  const prefix = input.label ? `${input.label}: ` : "";
  if (input.fitScore == null || !input.fitBreakdown) return;

  if (
    input.fitBreakdown.overall != null &&
    input.fitBreakdown.overall !== input.fitScore
  ) {
    throw new Error(
      `${prefix}Fit inconsistency — fitScore=${input.fitScore} fitBreakdown.overall=${input.fitBreakdown.overall}`,
    );
  }

  if (input.reasoning) {
    const m = input.reasoning.match(/(\d+)%\s+company–tender fit/i);
    if (m && Number(m[1]) !== input.fitScore) {
      throw new Error(
        `${prefix}Fit inconsistency — reasoning cites ${m[1]}% but fitScore=${input.fitScore}`,
      );
    }
  }
}
