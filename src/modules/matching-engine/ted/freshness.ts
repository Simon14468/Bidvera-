/**
 * TED publication-date freshness helpers.
 * Window is relative (days) — never a hard-coded permanent calendar date.
 */

/** Format Date as TED expert-query YYYYMMDD (UTC). */
export function formatTedPublicationDateYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Parse TED Search date values (publication-date, deadline-receipt-tender-date-lot, …).
 * Handles compact YYYYMMDD, ISO datetimes, and TED date-only + zone forms
 * like 2026-06-15+02:00 (invalid for native Date).
 */
export function parseTedDateValue(raw: string | null | undefined): Date | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;

  const compact = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const d = new Date(
      Date.UTC(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3])),
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // TED often returns date-only with zone suffix: 2026-06-15+02:00 or 2024-03-25Z
  const dated = t.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+)?(?:Z|[+-]\d{2}:?\d{2})?$/i,
  );
  if (dated) {
    const d = new Date(
      Date.UTC(Number(dated[1]), Number(dated[2]) - 1, Number(dated[3])),
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const iso = new Date(t);
  if (!Number.isNaN(iso.getTime())) return iso;

  return null;
}

/** Alias — publication-date uses the same TED date formats. */
export function parseTedPublicationDate(
  raw: string | null | undefined,
): Date | null {
  return parseTedDateValue(raw);
}

export function freshnessCutoffDate(
  freshnessDays: number,
  now = new Date(),
): Date | null {
  if (!Number.isFinite(freshnessDays) || freshnessDays <= 0) return null;
  const ms = Math.floor(freshnessDays) * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms);
}

export function isPublicationWithinFreshness(
  publicationDate: Date | null,
  freshnessDays: number,
  now = new Date(),
): boolean {
  if (!freshnessDays || freshnessDays <= 0) return true;
  if (!publicationDate) return false;
  const cutoff = freshnessCutoffDate(freshnessDays, now);
  if (!cutoff) return true;
  return publicationDate.getTime() >= cutoff.getTime();
}

/** Expert-query fragment for TED Search when freshnessDays > 0. */
export function buildTedFreshnessQueryClause(
  freshnessDays: number,
  now = new Date(),
): string | null {
  const cutoff = freshnessCutoffDate(freshnessDays, now);
  if (!cutoff) return null;
  return `publication-date >= ${formatTedPublicationDateYmd(cutoff)}`;
}
