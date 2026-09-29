/**
 * Client-side gates for non-essential scripts.
 * Call before initializing analytics or marketing tags.
 * Essential auth/locale cookies are never gated here.
 */

import {
  COOKIE_CONSENT_CHANGED_EVENT,
  isAnalyticsAllowed,
  isMarketingAllowed,
  parseConsentRecord,
  readConsentCookieFromDocument,
  type CookieConsentRecord,
} from "@/services/consent/cookie-consent";

function currentRecord(): CookieConsentRecord | null {
  return parseConsentRecord(readConsentCookieFromDocument());
}

export function getLiveConsentRecord(): CookieConsentRecord | null {
  if (typeof window === "undefined") return null;
  return currentRecord();
}

export function canInitializeAnalytics(): boolean {
  return isAnalyticsAllowed(currentRecord());
}

export function canInitializeMarketing(): boolean {
  return isMarketingAllowed(currentRecord());
}

/**
 * Subscribe to consent updates. Safe no-op on the server.
 * Use to start/stop non-essential scripts when preferences change.
 */
export function subscribeConsentChange(
  listener: (record: CookieConsentRecord) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<CookieConsentRecord>).detail;
    if (detail) listener(detail);
  };
  window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, handler);
  return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, handler);
}

/**
 * Optional helper for future third-party tags.
 * Returns false and does nothing when the category is not consented.
 */
export function runIfAnalyticsAllowed(fn: () => void): boolean {
  if (!canInitializeAnalytics()) return false;
  fn();
  return true;
}

export function runIfMarketingAllowed(fn: () => void): boolean {
  if (!canInitializeMarketing()) return false;
  fn();
  return true;
}
