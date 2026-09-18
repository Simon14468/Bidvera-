/** Date-only helpers — calendar dates, no timezone conversion. */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateOnlyString(value: string): boolean {
  if (!DATE_ONLY_RE.test(value)) return false;
  const d = dateOnlyToUtcDate(value);
  return formatDateOnly(d) === value;
}

/** Store/compare as UTC midnight of the calendar date. */
export function dateOnlyToUtcDate(ymd: string): Date {
  const m = DATE_ONLY_RE.exec(ymd);
  if (!m) throw new Error(`Invalid date-only value: ${ymd}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d));
}

export function formatDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today as a calendar date in UTC (no local TZ conversion for comparisons). */
export function todayDateOnly(now: Date = new Date()): string {
  return formatDateOnly(now);
}

export function addDaysDateOnly(ymd: string, days: number): string {
  const base = dateOnlyToUtcDate(ymd);
  const next = new Date(base.getTime() + days * 86_400_000);
  return formatDateOnly(next);
}

/** Signed whole days from `fromYmd` to `toYmd` (to - from). */
export function daysBetweenDateOnly(fromYmd: string, toYmd: string): number {
  const a = dateOnlyToUtcDate(fromYmd).getTime();
  const b = dateOnlyToUtcDate(toYmd).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function parseLooseDateOnly(raw: string): string | null {
  const cleaned = raw.trim().replace(/\//g, "-").replace(/\./g, "-");
  // YYYY-MM-DD
  const iso = cleaned.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const ymd = `${iso[1]}-${iso[2]!.padStart(2, "0")}-${iso[3]!.padStart(2, "0")}`;
    return isDateOnlyString(ymd) ? ymd : null;
  }
  // DD-MM-YYYY
  const dmy = cleaned.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dmy) {
    const ymd = `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
    return isDateOnlyString(ymd) ? ymd : null;
  }
  return null;
}
