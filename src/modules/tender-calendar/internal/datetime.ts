/** Date/time helpers — never invent a timezone. */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

export type ParsedOccurrence = {
  occursAt: Date;
  dateOnly: boolean;
  /** Only set when caller provided an explicit timezone. */
  timezone: string | null;
};

export function isDateOnlyString(value: string): boolean {
  if (!DATE_ONLY_RE.test(value)) return false;
  const d = dateOnlyToUtcDate(value);
  return formatDateOnly(d) === value;
}

export function dateOnlyToUtcDate(ymd: string): Date {
  const m = DATE_ONLY_RE.exec(ymd);
  if (!m) throw new Error(`Invalid date-only value: ${ymd}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function formatDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayDateOnly(now: Date = new Date()): string {
  return formatDateOnly(now);
}

/**
 * Parse occurrence input.
 * - YYYY-MM-DD → date-only (UTC midnight), timezone ignored/null
 * - datetime + explicit timezone → preserved
 * - datetime without timezone → stored as absolute instant, timezone null (not invented)
 */
export function parseOccurrenceInput(input: {
  date?: string | null;
  dateTime?: string | null;
  timezone?: string | null;
  dateOnly?: boolean;
}): ParsedOccurrence {
  const tz = input.timezone?.trim() || null;
  if (tz && tz.length > 64) {
    throw new Error("Invalid timezone");
  }

  if (input.dateOnly || (input.date && isDateOnlyString(input.date) && !input.dateTime)) {
    const ymd = input.date!;
    if (!isDateOnlyString(ymd)) throw new Error("Invalid date-only value");
    return {
      occursAt: dateOnlyToUtcDate(ymd),
      dateOnly: true,
      timezone: null, // never invent timezone for date-only
    };
  }

  if (input.dateTime) {
    const raw = input.dateTime.trim();
    // If ends with Z or offset, treat as absolute instant
    if (/Z$|[+-]\d{2}:?\d{2}$/.test(raw)) {
      const occursAt = new Date(raw);
      if (Number.isNaN(occursAt.getTime())) throw new Error("Invalid dateTime");
      return { occursAt, dateOnly: false, timezone: tz };
    }
    const m = DATETIME_RE.exec(raw);
    if (!m) throw new Error("Invalid dateTime");
    if (tz) {
      // Explicit timezone: store wall-clock as UTC components tagged with timezone
      // (no conversion invented — occursAt is the labeled wall time as UTC fields).
      const occursAt = new Date(
        Date.UTC(
          Number(m[1]),
          Number(m[2]) - 1,
          Number(m[3]),
          Number(m[4]),
          Number(m[5]),
          Number(m[6] ?? 0),
        ),
      );
      return { occursAt, dateOnly: false, timezone: tz };
    }
    const occursAt = new Date(
      Date.UTC(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6] ?? 0),
      ),
    );
    return { occursAt, dateOnly: false, timezone: null };
  }

  if (input.date && isDateOnlyString(input.date)) {
    return {
      occursAt: dateOnlyToUtcDate(input.date),
      dateOnly: true,
      timezone: null,
    };
  }

  throw new Error("date or dateTime is required");
}

export function computeMilestoneStatus(
  occursAt: Date,
  dateOnly: boolean,
  now: Date = new Date(),
): "SCHEDULED" | "DUE_TODAY" | "PAST" {
  if (dateOnly) {
    const day = formatDateOnly(occursAt);
    const today = todayDateOnly(now);
    if (day < today) return "PAST";
    if (day === today) return "DUE_TODAY";
    return "SCHEDULED";
  }
  if (occursAt.getTime() < now.getTime()) return "PAST";
  const sameDay =
    formatDateOnly(occursAt) === todayDateOnly(now);
  if (sameDay) return "DUE_TODAY";
  return "SCHEDULED";
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function orderByOccursAtAsc<T extends { occursAt: Date | string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const ta = a.occursAt instanceof Date ? a.occursAt.getTime() : new Date(a.occursAt).getTime();
    const tb = b.occursAt instanceof Date ? b.occursAt.getTime() : new Date(b.occursAt).getTime();
    return ta - tb;
  });
}
