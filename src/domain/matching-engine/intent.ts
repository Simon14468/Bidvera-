/**
 * Two-sided matching intent seams (Feature 8E) — architecture only.
 * No marketplace; no private company data exposure.
 */

export const MATCHING_INTENT_DIRECTIONS = [
  "UNSPECIFIED",
  "LOOKING_FOR_SUPPLIER",
  "LOOKING_FOR_CUSTOMER",
  "LOOKING_FOR_PARTNER",
  "OFFERING_SERVICE",
] as const;

export type MatchingIntentDirection = (typeof MATCHING_INTENT_DIRECTIONS)[number];

export function isMatchingIntentDirection(
  value: unknown,
): value is MatchingIntentDirection {
  return (
    typeof value === "string" &&
    (MATCHING_INTENT_DIRECTIONS as readonly string[]).includes(value)
  );
}

/** Normalize optional API/input intent; default UNSPECIFIED. */
export function normalizeMatchingIntentDirection(
  value: unknown,
): MatchingIntentDirection {
  if (isMatchingIntentDirection(value)) return value;
  return "UNSPECIFIED";
}
