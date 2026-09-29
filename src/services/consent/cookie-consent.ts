/**
 * First-party cookie consent — storage, versioning, and category gates.
 * Does not touch session / OAuth / locale cookies.
 */

export const COOKIE_CONSENT_COOKIE_NAME = "bidvera_cookie_consent";

/** Bump when categories or legal meaning change — outdated cookies re-prompt. */
export const COOKIE_CONSENT_VERSION = 1;

export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const COOKIE_CONSENT_CHANGED_EVENT = "bidvera:cookie-consent-changed";
export const COOKIE_CONSENT_OPEN_SETTINGS_EVENT = "bidvera:open-cookie-settings";

export type CookieConsentPreferences = {
  /** Always true when a decision exists; essential for the service. */
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export type CookieConsentRecord = CookieConsentPreferences & {
  version: number;
  /** Unix seconds when the decision was saved. */
  updatedAt: number;
};

export type CookieConsentDecision =
  | { status: "unknown" }
  | { status: "outdated"; record: CookieConsentRecord }
  | { status: "set"; record: CookieConsentRecord };

type StoredPayload = {
  v: number;
  a: 0 | 1;
  m: 0 | 1;
  t: number;
};

export function buildConsentRecord(
  prefs: Pick<CookieConsentPreferences, "analytics" | "marketing">,
  nowSeconds = Math.floor(Date.now() / 1000),
): CookieConsentRecord {
  return {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    analytics: Boolean(prefs.analytics),
    marketing: Boolean(prefs.marketing),
    updatedAt: nowSeconds,
  };
}

export function acceptAllConsent(
  nowSeconds?: number,
): CookieConsentRecord {
  return buildConsentRecord({ analytics: true, marketing: true }, nowSeconds);
}

export function rejectAllConsent(
  nowSeconds?: number,
): CookieConsentRecord {
  return buildConsentRecord({ analytics: false, marketing: false }, nowSeconds);
}

export function serializeConsentRecord(record: CookieConsentRecord): string {
  const payload: StoredPayload = {
    v: record.version,
    a: record.analytics ? 1 : 0,
    m: record.marketing ? 1 : 0,
    t: record.updatedAt,
  };
  return JSON.stringify(payload);
}

export function parseConsentRecord(
  raw: string | undefined | null,
): CookieConsentRecord | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<StoredPayload>;
    if (
      typeof data.v !== "number" ||
      !Number.isFinite(data.v) ||
      (data.a !== 0 && data.a !== 1) ||
      (data.m !== 0 && data.m !== 1) ||
      typeof data.t !== "number" ||
      !Number.isFinite(data.t)
    ) {
      return null;
    }
    return {
      version: data.v,
      necessary: true,
      analytics: data.a === 1,
      marketing: data.m === 1,
      updatedAt: data.t,
    };
  } catch {
    return null;
  }
}

export function resolveConsentDecision(
  raw: string | undefined | null,
  currentVersion = COOKIE_CONSENT_VERSION,
): CookieConsentDecision {
  const record = parseConsentRecord(raw);
  if (!record) return { status: "unknown" };
  if (record.version !== currentVersion) {
    return { status: "outdated", record };
  }
  return { status: "set", record };
}

export function isAnalyticsAllowed(record: CookieConsentRecord | null): boolean {
  return Boolean(record?.analytics);
}

export function isMarketingAllowed(record: CookieConsentRecord | null): boolean {
  return Boolean(record?.marketing);
}

/** Necessary / essential cookies are always permitted for the service. */
export function isNecessaryAllowed(): boolean {
  return true;
}

export function consentCookieWriteOptions(secure: boolean) {
  return {
    path: "/",
    maxAge: COOKIE_CONSENT_MAX_AGE_SECONDS,
    sameSite: "lax" as const,
    secure,
    /** Must be readable by the client to gate non-essential scripts. */
    httpOnly: false,
  };
}

export function buildConsentSetCookieHeader(
  record: CookieConsentRecord,
  secure: boolean,
): string {
  const value = encodeURIComponent(serializeConsentRecord(record));
  const parts = [
    `${COOKIE_CONSENT_COOKIE_NAME}=${value}`,
    "Path=/",
    `Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readConsentCookieFromDocument(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_CONSENT_COOKIE_NAME}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(COOKIE_CONSENT_COOKIE_NAME.length + 1));
}

export function writeConsentCookieToDocument(record: CookieConsentRecord): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = buildConsentSetCookieHeader(record, secure);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT, { detail: record }),
    );
  }
}

export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_OPEN_SETTINGS_EVENT));
}
