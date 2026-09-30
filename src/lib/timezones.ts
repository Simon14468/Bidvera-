/**
 * Company timezone helpers — IANA identifiers only, offsets computed via Intl.
 */

export type TimezoneOption = {
  value: string;
  /** City / short display name, e.g. "Casablanca". */
  city: string;
  /** Region / group, e.g. "Africa", "UTC". */
  region: string;
  /** Primary trigger/list label, e.g. "Africa — Casablanca (Africa/Casablanca)". */
  label: string;
  /** Dynamic UTC offset for `at`, e.g. "UTC+01:00". */
  offsetLabel: string;
  /** Extra search tokens (spaces, underscores, city fragments). */
  searchText: string;
};

const REGION_ORDER = [
  "UTC",
  "Africa",
  "America",
  "Antarctica",
  "Arctic",
  "Asia",
  "Atlantic",
  "Australia",
  "Europe",
  "Indian",
  "Pacific",
  "Etc",
] as const;

/** True when `timeZone` is accepted by the runtime Intl engine. */
export function isValidIanaTimeZone(timeZone: string): boolean {
  const tz = timeZone.trim();
  if (!tz || tz.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Browser-reported IANA zone via Intl — client only.
 * Returns null during SSR or when unavailable/invalid.
 */
export function detectBrowserTimeZone(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof tz !== "string") return null;
    const trimmed = tz.trim();
    return isValidIanaTimeZone(trimmed) ? trimmed : null;
  } catch {
    return null;
  }
}

/** True when no company timezone has been chosen yet. */
export function isUnsetCompanyTimezone(timeZone: string | null | undefined): boolean {
  return !timeZone?.trim();
}

/**
 * Prefer the browser-detected IANA zone when available so the picker
 * switches immediately; fall back to a saved company timezone otherwise.
 */
export function resolveSuggestedCompanyTimezone(input: {
  savedTimezone: string | null | undefined;
  detectedTimezone: string | null | undefined;
}): { timezone: string; usedDetection: boolean } {
  const detected = input.detectedTimezone?.trim() ?? "";
  if (detected && isValidIanaTimeZone(detected)) {
    return { timezone: detected, usedDetection: true };
  }
  const saved = input.savedTimezone?.trim() ?? "";
  if (saved && isValidIanaTimeZone(saved)) {
    return { timezone: saved, usedDetection: false };
  }
  return { timezone: "", usedDetection: false };
}

/**
 * Full IANA set from the runtime (`Intl.supportedValuesOf("timeZone")`),
 * always including UTC. Falls back to UTC-only when unsupported.
 */
export function listIanaTimeZones(): string[] {
  const zones = new Set<string>();
  zones.add("UTC");
  try {
    const supported =
      typeof Intl !== "undefined" &&
      "supportedValuesOf" in Intl &&
      typeof (Intl as { supportedValuesOf?: (key: string) => string[] })
        .supportedValuesOf === "function"
        ? (Intl as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf(
            "timeZone",
          )
        : [];
    for (const z of supported) {
      if (typeof z === "string" && z.trim()) zones.add(z.trim());
    }
  } catch {
    // Runtime without supportedValuesOf — keep UTC.
  }
  return [...zones].sort((a, b) => a.localeCompare(b));
}

/** Region bucket for grouping (Etc/UTC → UTC). */
export function timezoneRegion(iana: string): string {
  const id = iana.trim();
  if (id === "UTC" || id === "Etc/UTC" || id === "Etc/GMT") return "UTC";
  const slash = id.indexOf("/");
  if (slash <= 0) return "UTC";
  return id.slice(0, slash);
}

/** Human city from the last IANA path segment. */
export function timezoneCity(iana: string): string {
  const id = iana.trim();
  if (id === "UTC" || id === "Etc/UTC" || id === "Etc/GMT") return "UTC";
  const segment = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
  return segment.replace(/_/g, " ");
}

/** Human-friendly label while storing the canonical IANA id. */
export function formatTimezoneFriendlyLabel(iana: string): string {
  const value = iana.trim();
  if (!value) return "";
  if (value === "UTC" || value === "Etc/UTC" || value === "Etc/GMT") {
    return "UTC (Etc/UTC)";
  }
  const city = timezoneCity(value);
  const region = timezoneRegion(value);
  return `${region} — ${city} (${value})`;
}

/**
 * Current (or `at`) UTC offset for an IANA zone, e.g. "UTC+01:00".
 * Never hardcodes DST — uses Intl for the given instant.
 */
export function formatTimezoneOffset(
  timeZone: string,
  at: Date = new Date(),
): string {
  if (!isValidIanaTimeZone(timeZone)) return "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).formatToParts(at);
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    if (/^GMT$/i.test(raw) || /^UTC$/i.test(raw)) return "UTC+00:00";
    const normalized = raw.replace(/^GMT/i, "UTC").replace(/^UTC/i, "UTC");
    if (/^UTC[+-]\d{2}:\d{2}$/.test(normalized)) return normalized;
    if (/^UTC[+-]\d{1,2}$/.test(normalized)) {
      const sign = normalized.includes("-") ? "-" : "+";
      const hours = normalized.replace(/^UTC[+-]/, "");
      return `UTC${sign}${hours.padStart(2, "0")}:00`;
    }
  } catch {
    // fall through
  }
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = Object.fromEntries(
      dtf.formatToParts(at).map((p) => [p.type, p.value]),
    ) as Record<string, string>;
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second),
    );
    const diffMin = Math.round((asUtc - at.getTime()) / 60_000);
    const sign = diffMin >= 0 ? "+" : "-";
    const abs = Math.abs(diffMin);
    const hh = String(Math.floor(abs / 60)).padStart(2, "0");
    const mm = String(abs % 60).padStart(2, "0");
    return `UTC${sign}${hh}:${mm}`;
  } catch {
    return "UTC";
  }
}

function regionSortKey(region: string): number {
  const idx = (REGION_ORDER as readonly string[]).indexOf(region);
  return idx >= 0 ? idx : REGION_ORDER.length + region.localeCompare("Z");
}

/** Build searchable, grouped options for the company timezone picker. */
export function buildTimezoneOptions(
  at: Date = new Date(),
  include?: string | null,
): TimezoneOption[] {
  const ids = new Set(listIanaTimeZones());
  const extra = include?.trim();
  if (extra && isValidIanaTimeZone(extra)) ids.add(extra);

  const options: TimezoneOption[] = [];
  for (const value of ids) {
    const city = timezoneCity(value);
    const region = timezoneRegion(value);
    const offsetLabel = formatTimezoneOffset(value, at);
    const label = formatTimezoneFriendlyLabel(value);
    const searchText = [
      value,
      value.replace(/\//g, " "),
      value.replace(/_/g, " "),
      city,
      region,
      label,
      offsetLabel,
      offsetLabel.replace("UTC", "GMT"),
    ].join(" ");
    options.push({
      value,
      city,
      region,
      label,
      offsetLabel,
      searchText,
    });
  }

  options.sort((a, b) => {
    const regionDiff = regionSortKey(a.region) - regionSortKey(b.region);
    if (regionDiff !== 0) return regionDiff;
    if (a.region !== b.region) return a.region.localeCompare(b.region);
    return a.city.localeCompare(b.city) || a.value.localeCompare(b.value);
  });

  return options;
}

/** Zod-friendly refine for company timezone persistence. */
export function assertValidCompanyTimezone(timeZone: string): string {
  const tz = timeZone.trim();
  if (!isValidIanaTimeZone(tz)) {
    throw new Error("Invalid timezone");
  }
  return tz;
}
