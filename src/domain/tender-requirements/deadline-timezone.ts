/**
 * Deadline timezone semantics — UNKNOWN is valid when the source does not state a zone.
 * Never invent an IANA zone from country/context at this boundary.
 */

/** Explicit sentinel when callers need a non-null UNKNOWN label. */
export const DEADLINE_TIMEZONE_UNKNOWN = "UNKNOWN";

/**
 * True when timezone is absent or the explicit UNKNOWN sentinel.
 * Null/empty means the same thing as UNKNOWN — not "lost" corruption.
 */
export function isDeadlineTimezoneUnknown(
  timezone: string | null | undefined,
): boolean {
  if (timezone == null) return true;
  const t = timezone.trim();
  if (!t) return true;
  return t.toUpperCase() === DEADLINE_TIMEZONE_UNKNOWN;
}

/**
 * Normalize for persistence / Guardian: keep real IANA zones; map blank → null (UNKNOWN).
 * Never invents a zone.
 */
export function normalizeDeadlineTimezone(
  timezone: string | null | undefined,
): string | null {
  if (timezone == null) return null;
  const t = timezone.trim();
  if (!t) return null;
  if (t.toUpperCase() === DEADLINE_TIMEZONE_UNKNOWN) return null;
  return t;
}
