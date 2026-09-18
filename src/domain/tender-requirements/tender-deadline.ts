/**
 * Tender deadline parsing — preserve wall-clock date/time and timezone semantics.
 * Never store midnight UTC when the tender states an explicit local time (e.g. 10:30).
 */

export type ParsedTenderDeadline = {
  deadlineIso: string | null;
  /** IANA timezone when inferred from tender country/context */
  deadlineTimezone: string | null;
  evidence: string | null;
  reason: string | null;
  /** Wall-clock parts as stated in the tender (for integrity checks) */
  localHour: number | null;
  localMinute: number | null;
};

function monthIndex(name: string): number | null {
  const n = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const map: Record<string, number> = {
    january: 0,
    jan: 0,
    february: 1,
    feb: 1,
    februari: 1,
    march: 2,
    mar: 2,
    mars: 2,
    april: 3,
    apr: 3,
    avril: 3,
    may: 4,
    mai: 4,
    mei: 4,
    june: 5,
    jun: 5,
    juin: 5,
    july: 6,
    jul: 6,
    julai: 6,
    juillet: 6,
    august: 7,
    aug: 7,
    aout: 7,
    août: 7,
    ogos: 7,
    september: 8,
    sept: 8,
    sep: 8,
    septembre: 8,
    october: 9,
    oct: 9,
    octobre: 9,
    november: 10,
    nov: 10,
    novembre: 10,
    december: 11,
    dec: 11,
    decembre: 11,
    disember: 11,
  };
  return map[n] ?? null;
}

export function parseLooseDateOnly(raw: string): string | null {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  const eu = cleaned.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if (eu) {
    const d = Number(eu[1]);
    const m = Number(eu[2]);
    let y = Number(eu[3]);
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const named = cleaned.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})\b/);
  if (named) {
    const month = monthIndex(named[2]!);
    if (month != null) {
      const d = Number(named[1]);
      const y = Number(named[3]);
      return `${y}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

/** Extract HH:MM from tender deadline phrasing. */
export function parseDeadlineLocalTime(window: string): {
  hour: number;
  minute: number;
} | null {
  const w = window.replace(/\s+/g, " ");
  let m = w.match(/\bat\s+(\d{1,2}):(\d{2})\b/i);
  if (m) {
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }
  m = w.match(/[àa]\s+(\d{1,2})\s*h\s*(\d{2})\b/i);
  if (m) {
    return { hour: Number(m[1]), minute: Number(m[2]) };
  }
  m = w.match(/\bjam\s+(\d{1,2})\.(\d{2})\b/i);
  if (m) {
    return { hour: Number(m[1]), minute: Number(m[2]) };
  }
  m = w.match(/\btime\s*[:\-]\s*(\d{1,2})[:.](\d{2})\b/i);
  if (m) {
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }
  m = w.match(/\b(\d{1,2}):(\d{2})\s*(?:hours?|hrs?)\b/i);
  if (m) {
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }
  m = w.match(/\b(\d{1,2}):(\d{2})\s*(?:local|casablanca|morocco)?\b/i);
  if (m && /deadline|submission|soumission|limite|closing|peti\s+tender|dokumen\s+tender|sebelum\s+jam|due\s+date/i.test(w)) {
    return { hour: Number(m[1]), minute: Number(m[2]) };
  }
  m = w.match(/\b(\d{2})(\d{2})\s*hrs?\b/i);
  if (m && /deadline|submission|soumission|limite|closing|due\s+date|bid\s+due/i.test(w)) {
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }
  m = w.match(/\b(\d{1,2})\.(\d{2})\s*(?:tengah\s+hari)?\b/i);
  if (m && /jam|sebelum|peti\s+tender|dokumen\s+tender/i.test(w)) {
    return { hour: Number(m[1]), minute: Number(m[2]) };
  }
  return null;
}

/** Offset for Morocco — UTC+1 year-round (no DST since 2018). */
const MOROCCO_OFFSET = "+01:00";
const MALAYSIA_OFFSET = "+08:00";
const INDIA_OFFSET = "+05:30";

/**
 * IANA timezone only when the source text states it.
 * Country of the tender is not timezone evidence.
 */
export function extractExplicitTimezone(text: string): string | null {
  const t = text.replace(/\s+/g, " ");
  if (/\bIST\b|Indian Standard Time|Asia\/Kolkata|Asia\/Calcutta/i.test(t)) {
    return "Asia/Kolkata";
  }
  if (/UTC\s*[+-]\s*0?5\s*[:.]?\s*30|GMT\s*[+-]\s*0?5\s*[:.]?\s*30/i.test(t)) {
    return "Asia/Kolkata";
  }
  if (/Africa\/Casablanca|heure\s+(?:locale\s+)?(?:de\s+)?Casablanca|Morocco time|heure du Maroc/i.test(t)) {
    return "Africa/Casablanca";
  }
  if (/Asia\/Kuala_Lumpur|\bMYT\b|Malaysia time|Malaysian time/i.test(t)) {
    return "Asia/Kuala_Lumpur";
  }
  if (/\bUTC\b(?!\s*[+-])|\bGMT\b(?!\s*[+-])/i.test(t) && /\b(deadline|closing|submission|due)\b/i.test(t)) {
    return "UTC";
  }
  if (/\bCEST\b|Central European Summer Time/i.test(t)) {
    return "CEST";
  }
  if (/\bEurope\/Copenhagen\b|\bCopenhagen time\b/i.test(t)) {
    return "Europe/Copenhagen";
  }
  if (/\bCET\b|Central European Time/i.test(t)) {
    return "CET";
  }
  return null;
}

export type CanonicalDeadlineParts = {
  dateYmd: string;
  hour: number | null;
  minute: number | null;
  second: number | null;
  /** "+01:00" | "Z" | null when the ISO is a naive wall-clock. */
  offset: string | null;
  dateOnly: boolean;
};

/**
 * Fixed offsets only for zones that do not observe DST (or are pure UTC).
 * CET/CEST are abbreviations with seasonal DST — never pin them to +01/+02
 * year-round; that turns summer 23:59+01:00 into Copenhagen 00:59 on readback.
 */
const FIXED_ZONE_OFFSET: Record<string, string> = {
  "Africa/Casablanca": MOROCCO_OFFSET,
  "Asia/Kuala_Lumpur": MALAYSIA_OFFSET,
  "Asia/Kolkata": INDIA_OFFSET,
  UTC: "+00:00",
  GMT: "+00:00",
  "Etc/UTC": "+00:00",
};

/**
 * Resolve timezone labels to an IANA zone usable by Intl for DST-correct offsets.
 * CET/CEST map to a representative Central-European IANA zone for offset math only —
 * not tender-country inference and not a rewrite of the stored timezone label.
 */
export function ianaZoneForOffsetResolution(timeZone: string): string {
  const t = timeZone.trim();
  if (t === "CET" || t === "CEST") return "Europe/Paris";
  return t;
}

function normalizeOffsetToken(offset: string | null): string | null {
  if (!offset) return null;
  if (offset === "Z") return "+00:00";
  return offset;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatOffsetMinutes(totalMinutes: number): string {
  const sign = totalMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(totalMinutes);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

function formatInstantWall(
  ms: number,
  timeZone: string,
): { dateYmd: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return {
    dateYmd: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
    minute: Number(get("minute")),
  };
}

function isUsableIanaTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Offset that makes `dateYmd` + hour:minute the civil time in `timeZone`.
 * Computed from Intl — not a fixed +1/−1 hour patch and not country inference.
 */
export function offsetForNamedTimeZone(
  dateYmd: string,
  hour: number,
  minute: number,
  timeZone: string,
): string | null {
  const fixed = FIXED_ZONE_OFFSET[timeZone];
  if (fixed) return fixed;
  const iana = ianaZoneForOffsetResolution(timeZone);
  if (!isUsableIanaTimeZone(iana)) return null;

  const [year, month, day] = dateYmd.split("-").map((p) => Number(p));
  if (!year || !month || !day) return null;
  const targetUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = targetUtcMs;
  for (let i = 0; i < 8; i++) {
    const wall = formatInstantWall(guess, iana);
    const [wy, wm, wd] = wall.dateYmd.split("-").map((p) => Number(p));
    const wallUtcMs = Date.UTC(wy!, wm! - 1, wd!, wall.hour, wall.minute, 0);
    const delta = wallUtcMs - targetUtcMs;
    if (delta === 0) {
      return formatOffsetMinutes(Math.round((targetUtcMs - guess) / 60_000));
    }
    guess -= delta;
  }
  return null;
}

/** Read civil date/time/offset from the canonical ISO string — never via Date. */
export function parseCanonicalDeadlineIso(iso: string): CanonicalDeadlineParts | null {
  const trimmed = iso.trim();
  const dateOnly = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) {
    return {
      dateYmd: dateOnly[1]!,
      hour: null,
      minute: null,
      second: null,
      offset: null,
      dateOnly: true,
    };
  }
  const full = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/,
  );
  if (!full) return null;
  return {
    dateYmd: full[1]!,
    hour: Number(full[2]),
    minute: Number(full[3]),
    second: full[4] != null ? Number(full[4]) : 0,
    offset: full[5] ?? null,
    dateOnly: false,
  };
}

export function buildDeadlineIsoWithLocalTime(input: {
  dateYmd: string;
  hour: number;
  minute: number;
  timezone: string | null;
}): string {
  const time = `${pad2(input.hour)}:${pad2(input.minute)}:00`;
  if (!input.timezone) {
    // Naive local wall-clock — do not attach UTC (+00:00) without evidence.
    return `${input.dateYmd}T${time}`;
  }
  const offset = offsetForNamedTimeZone(
    input.dateYmd,
    input.hour,
    input.minute,
    input.timezone,
  );
  if (!offset) {
    return `${input.dateYmd}T${time}`;
  }
  return `${input.dateYmd}T${time}${offset}`;
}

/**
 * Prisma DateTime persistable instant. Uses the ISO offset when present;
 * otherwise computes it from an explicit named zone. Never treats a naive
 * wall-clock as UTC.
 */
export function deadlineIsoToPersistableDate(
  iso: string,
  timezone?: string | null,
): Date | null {
  const parts = parseCanonicalDeadlineIso(iso);
  if (!parts) return null;
  if (parts.dateOnly) {
    return new Date(`${parts.dateYmd}T00:00:00.000Z`);
  }
  if (parts.offset) {
    const instant = new Date(iso);
    return Number.isNaN(instant.getTime()) ? null : instant;
  }
  if (timezone) {
    const withOffset = buildDeadlineIsoWithLocalTime({
      dateYmd: parts.dateYmd,
      hour: parts.hour ?? 0,
      minute: parts.minute ?? 0,
      timezone,
    });
    if (parseCanonicalDeadlineIso(withOffset)?.offset) {
      const instant = new Date(withOffset);
      return Number.isNaN(instant.getTime()) ? null : instant;
    }
  }
  return null;
}

/** Reconstruct a canonical ISO from a stored instant + explicit zone. Never emits Z as SoT. */
export function instantToCanonicalDeadlineIso(
  instant: Date,
  timezone: string | null,
): string | null {
  if (Number.isNaN(instant.getTime())) return null;
  if (!timezone || timezone === "UTC" || timezone === "GMT" || timezone === "Etc/UTC") {
    const wall = formatInstantWall(instant.getTime(), "UTC");
    return buildDeadlineIsoWithLocalTime({
      dateYmd: wall.dateYmd,
      hour: wall.hour,
      minute: wall.minute,
      timezone: "UTC",
    });
  }
  const iana = ianaZoneForOffsetResolution(timezone);
  const wall = formatInstantWall(instant.getTime(), iana);
  return buildDeadlineIsoWithLocalTime({
    dateYmd: wall.dateYmd,
    hour: wall.hour,
    minute: wall.minute,
    timezone,
  });
}

/** Snapshot string wins. Never use Date#toISOString() as the canonical deadline. */
export function readCanonicalDeadlineIso(input: {
  snapshotIso?: string | null;
  persistedInstant?: Date | null;
  timezone?: string | null;
}): string | null {
  const snap = input.snapshotIso?.trim();
  if (snap) return snap;
  if (input.persistedInstant && !Number.isNaN(input.persistedInstant.getTime())) {
    return instantToCanonicalDeadlineIso(input.persistedInstant, input.timezone ?? null);
  }
  return null;
}

/** Country is not timezone evidence. Always UNKNOWN unless the source states a zone. */
export function inferDeadlineTimezone(_country: string | null): string | null {
  void _country;
  return null;
}

/**
 * Civil wall-clock for Guardian / integrity.
 *
 * Authoritative rule: the civil date/time encoded in the canonical ISO string
 * is the wall clock when the offset matches the named timezone for that civil
 * instant. If the offset is missing (naive) the civil components stay as-is.
 * If the offset is Z/+00:00 under a non-UTC zone, or disagrees with the named
 * zone's DST-correct offset, project the instant so integrity checks surface
 * the mutated local time (e.g. 23:59Z → Copenhagen 00:59).
 */
export function formatDeadlineWallClock(
  iso: string,
  timezone: string,
): { hour: number; minute: number; dateYmd: string } {
  const parsed = parseCanonicalDeadlineIso(iso);
  if (!parsed) {
    throw new Error(`Unparseable canonical deadline ISO: ${iso}`);
  }
  if (parsed.dateOnly) {
    return { dateYmd: parsed.dateYmd, hour: 0, minute: 0 };
  }

  const zoneIsUtc =
    timezone === "UTC" || timezone === "GMT" || timezone === "Etc/UTC";
  const iana = ianaZoneForOffsetResolution(timezone);
  const actualOffset = normalizeOffsetToken(parsed.offset);
  const expectedOffset =
    parsed.hour != null && parsed.minute != null && timezone && !zoneIsUtc
      ? offsetForNamedTimeZone(parsed.dateYmd, parsed.hour, parsed.minute, timezone)
      : null;

  const offsetDisagrees =
    Boolean(expectedOffset) &&
    Boolean(actualOffset) &&
    actualOffset !== expectedOffset;
  const utcEncodedUnderNamedZone =
    Boolean(actualOffset) &&
    actualOffset === "+00:00" &&
    Boolean(timezone) &&
    !zoneIsUtc;

  if (
    parsed.offset &&
    timezone &&
    !zoneIsUtc &&
    (offsetDisagrees || utcEncodedUnderNamedZone || parsed.offset === "Z")
  ) {
    const instant = new Date(iso);
    if (!Number.isNaN(instant.getTime())) {
      return formatInstantWall(instant.getTime(), iana);
    }
  }

  return {
    dateYmd: parsed.dateYmd,
    hour: parsed.hour ?? 0,
    minute: parsed.minute ?? 0,
  };
}

function dateTokenIn(window: string): string | null {
  return (
    window.match(
      /(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4})/,
    )?.[1] ?? null
  );
}

/** Date:/Time: rows used by data-sheet / particulars tables. */
function extractLabelledDateTime(window: string): string | null {
  const date = window.match(/\bdate\s*[:\-]\s*([^\n]{0,80})/i);
  const time = window.match(/\btime\s*[:\-]\s*([^\n]{0,60})/i);
  if (!date && !time) return null;
  return [date?.[0], time?.[0]].filter(Boolean).join(" ");
}

/** Same-line capture, then labelled Date/Time rows or the next few lines. */
function expandDeadlineWindow(text: string, matchIndex: number, matched: string, group: string): string {
  const same = (group || matched).replace(/\s+/g, " ").trim();
  if (dateTokenIn(same)) return same;
  const after = text.slice(matchIndex + matched.length, matchIndex + matched.length + 400);
  const labelled = extractLabelledDateTime(after);
  if (labelled && dateTokenIn(labelled)) {
    return `${same} ${labelled}`.replace(/\s+/g, " ").trim();
  }
  const following = after
    .split(/\n/)
    .slice(0, 4)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return `${same} ${following}`.replace(/\s+/g, " ").trim();
}

function isNonBidDeadlineContext(around: string): boolean {
  const t = around.replace(/\s+/g, " ");
  if (
    /clarif(?:ication)?\s+deadline|deadline\s+for\s+(?:clarif|request\s+for\s+clarif)|last\s+date\s+for\s+clarif/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(?:bid\s+)?opening|ouverture\s+des\s+plis\b/i.test(t) &&
    !/\b(?:submission\s+deadline|deadline\s+for\s+submission|closing\s+date|receipt\s+of\s+(?:bids?|tenders?))\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/\b(?:bid\s+)?validity|validit[eé]\s+de\s+(?:l['’])?offre\b/i.test(t)) return true;
  if (
    /\b(?:contract\s+(?:start|commencement|end|date)|delivery\s+date|commissioning\s+date)\b/i.test(t) &&
    !/\b(?:submission|closing|receipt\s+of)\b/i.test(t)
  ) {
    return true;
  }
  if (
    /\b(?:pre[- ]?bid|pre[- ]?proposal|site\s+visit|clarification\s+meeting|bidders?['’]?\s+conference|pre[- ]?tender\s+meeting)\b/i.test(
      t,
    ) &&
    !/\b(?:submission\s+deadline|deadline\s+for\s+submission|closing\s+date|receipt\s+of\s+(?:bids?|tenders?))\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/\bwarrant(?:y|ies)\s+(?:period|date|expires?|expiry|valid)/i.test(t)) {
    return true;
  }
  return false;
}

export function extractTenderDeadlineFromText(
  text: string,
  country: string | null,
): ParsedTenderDeadline {
  void country;
  const patterns: RegExp[] = [
    /(?:deadline\s+for\s+(?:the\s+)?(?:proposal|bid|tender|offer)s?\s+submission|deadline\s+for\s+(?:the\s+)?submission\s+of\s+(?:proposals?|offers?|bids?|tenders?))\s*[:\-]?\s*([^\n]{0,100})/gi,
    /(?:deadline\s+for\s+submission(?:\s+of\s+(?:bids?|tenders?|offers?))?|submission\s+deadline|closing\s+date|date\s+limite\s+(?:de\s+)?(?:remise|soumission)|deadline)\s*[:\-]?\s*([^\n]{0,100})/gi,
    /(?:bid\s+)?submission\s+due\s+date(?:\s+and\s+time)?\s*[:\-]?\s*([^\n]{0,100})/gi,
    /(?:bid\s+due\s+date(?:\s+and\s+time)?)\s*[:\-]?\s*([^\n]{0,100})/gi,
    /(?:last\s+date\s+and\s+time\s+for\s+receipt|time\s+limit\s+for\s+receipt|due\s+date\s+for\s+submission)\s+(?:of\s+(?:bids?|tenders?|offers?))?\s*[:\-]?\s*([^\n]{0,100})/gi,
    /(?:bids?|tenders?|offers?)\s+must\s+be\s+received\s+(?:by|on|before)\s+([^\n]{0,80})/gi,
    /(?:publication[^.\n]{0,40})?\s*submission\s+deadline\s*[:\-]?\s*([^\n]{0,100})/gi,
    /(?:au\s+plus\s+tard\s+le|avant\s+le)\s+([^\n]{0,80})/gi,
    /(?:no\s+later\s+than)(?=[^\n]{0,80}\b(?:deadline|submission|soumission|offre|offer|bid|tender|proposition|closing)\b)\s+([^\n]{0,80})/gi,
    /(?:bid|tender|offer|proposal|submission)s?\s+[^\n]{0,60}no\s+later\s+than\s+([^\n]{0,80})/gi,
    /(?:date\s+limite\s+(?:de\s+)?(?:remise|dépôt|depot|soumission)|date\s+et\s+heure\s+limites?[^\n]{0,40}|clôture\s+des\s+offres|deadline|closing\s+date|submission\s+date)\s*[:\-]?\s*([^\n]{0,80})/gi,
    /(?:sebelum\s+jam[\s\S]{0,60}?pada|tarikh\s+tutup\s*[:\-]?)\s*([^\n]{0,80})/gi,
    /(?:hingga|sehingga)\s+(\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4})(?=[^\n]{0,40}\b(?:tender|tawaran|peti|dokumen)\b)/gi,
    /(?:peti\s+tender|dokumen\s+tender|borang\s+tawaran)[\s\S]{0,160}?pada\s+(\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4})/gi,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const window = expandDeadlineWindow(text, m.index, m[0], m[1] ?? "");
      const around = text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
      if (isNonBidDeadlineContext(`${m[0]} ${window}`)) {
        continue;
      }
      if (
        /\b(?:delivery|livraison|commissioning|installation|warranty)\b/i.test(around) &&
        !/\b(?:deadline|submission|soumission|offre|offer|bid|tender|closing|depot|dépôt|dossier|portail|peti|dokumen)\b/i.test(
          around,
        )
      ) {
        continue;
      }
      const dateToken = dateTokenIn(window);
      if (!dateToken) continue;
      const dateYmd = parseLooseDateOnly(dateToken);
      if (!dateYmd) continue;
      const localTime =
        parseDeadlineLocalTime(window) ??
        parseDeadlineLocalTime(m[0]) ??
        parseDeadlineLocalTime(text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 80));
      const evidence = `${m[0]} ${window}`.replace(/\s+/g, " ").trim().slice(0, 240);
      const tzWindow = `${window} ${m[0]} ${text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80)}`;
      const timezone = extractExplicitTimezone(tzWindow);

      // Preserve stated wall-clock time. Timezone is UNKNOWN unless the source states it.
      if (localTime) {
        return {
          deadlineIso: buildDeadlineIsoWithLocalTime({
            dateYmd,
            hour: localTime.hour,
            minute: localTime.minute,
            timezone,
          }),
          deadlineTimezone: timezone,
          evidence,
          reason: timezone
            ? null
            : "Local wall-clock time preserved; timezone UNKNOWN (not stated in source).",
          localHour: localTime.hour,
          localMinute: localTime.minute,
        };
      }

      return {
        deadlineIso: dateYmd,
        deadlineTimezone: null,
        evidence,
        reason: null,
        localHour: null,
        localMinute: null,
      };
    }
  }

  if (/date\s+limite|deadline|closing\s+date|remise\s+des\s+offres/i.test(text)) {
    const phrase = text.match(
      /(?:deadline\s+for[^\n]{0,160}|closing\s+date[^\n]{0,80}|date\s+limite[^\n]{0,80})/i,
    );
    const pointer =
      /as\s+set\s+out\s+in|see\s+(?:the\s+)?(?:section|data\s+sheet|particulars|bid\s+data|tender\s+particulars)|set\s+out\s+in\s+(?:the\s+)?(?:itb|rfp|itt|rfq)/i.test(
        text,
      );
    return {
      deadlineIso: null,
      deadlineTimezone: null,
      evidence: phrase?.[0]?.replace(/\s+/g, " ").trim().slice(0, 240) ?? null,
      reason: pointer
        ? "A bid-submission deadline is referenced but the calendar date is not present in the available package text."
        : "A deadline/closing phrase was found but no reliable calendar date could be parsed.",
      localHour: null,
      localMinute: null,
    };
  }

  return {
    deadlineIso: null,
    deadlineTimezone: null,
    evidence: null,
    reason: "No reliable deadline date was found in the tender package text.",
    localHour: null,
    localMinute: null,
  };
}
