/**
 * Preserve tender requirement reference codes (T-09, E-05, R-01) from extracted text.
 */

const REQUIREMENT_REF = /\b([ETR]-\d{2})\b/i;

/** Extract a requirement reference code when present at the start of obligation text. */
export function extractRequirementRef(text: string): string | null {
  const m = text.match(/(?:^|[•\-\u2022]\s*)([ETR]-\d{2})\b/i);
  return m?.[1]?.toUpperCase() ?? null;
}

/** True when text carries an explicit requirement reference prefix. */
export function hasRequirementRef(text: string): boolean {
  return REQUIREMENT_REF.test(text);
}
