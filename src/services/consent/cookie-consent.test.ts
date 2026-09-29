import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";
import { locales } from "@/i18n/config";
import { getCookieConsentCopy } from "@/i18n/cookie-consent";
import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_VERSION,
  acceptAllConsent,
  rejectAllConsent,
  buildConsentRecord,
  buildConsentSetCookieHeader,
  isAnalyticsAllowed,
  isMarketingAllowed,
  isNecessaryAllowed,
  parseConsentRecord,
  resolveConsentDecision,
  serializeConsentRecord,
} from "@/services/consent/cookie-consent";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("cookie consent persistence and categories", () => {
  it("Accept All enables analytics and marketing while necessary stays on", () => {
    const record = acceptAllConsent(1_700_000_000);
    assert.equal(record.version, COOKIE_CONSENT_VERSION);
    assert.equal(record.necessary, true);
    assert.equal(record.analytics, true);
    assert.equal(record.marketing, true);
    assert.equal(isNecessaryAllowed(), true);
    assert.equal(isAnalyticsAllowed(record), true);
    assert.equal(isMarketingAllowed(record), true);
  });

  it("Reject All keeps necessary on and disables optional categories", () => {
    const record = rejectAllConsent(1_700_000_000);
    assert.equal(record.necessary, true);
    assert.equal(record.analytics, false);
    assert.equal(record.marketing, false);
    assert.equal(isAnalyticsAllowed(record), false);
    assert.equal(isMarketingAllowed(record), false);
  });

  it("granular preferences round-trip through serialize/parse", () => {
    const record = buildConsentRecord(
      { analytics: true, marketing: false },
      1_700_000_100,
    );
    const raw = serializeConsentRecord(record);
    const parsed = parseConsentRecord(raw);
    assert.deepEqual(parsed, record);
    assert.match(raw, /"a":1/);
    assert.match(raw, /"m":0/);
  });

  it("unknown and outdated decisions re-prompt", () => {
    assert.equal(resolveConsentDecision(null).status, "unknown");
    assert.equal(resolveConsentDecision("not-json").status, "unknown");
    const outdated = serializeConsentRecord({
      version: COOKIE_CONSENT_VERSION + 9,
      necessary: true,
      analytics: true,
      marketing: true,
      updatedAt: 1,
    });
    const decision = resolveConsentDecision(outdated);
    assert.equal(decision.status, "outdated");
    if (decision.status === "outdated") {
      assert.equal(decision.record.analytics, true);
    }
    const current = serializeConsentRecord(acceptAllConsent(2));
    assert.equal(resolveConsentDecision(current).status, "set");
  });

  it("set-cookie header is first-party, not HttpOnly, and versioned", () => {
    const header = buildConsentSetCookieHeader(rejectAllConsent(3), true);
    assert.match(header, new RegExp(`^${COOKIE_CONSENT_COOKIE_NAME}=`));
    assert.match(header, /Path=\//);
    assert.match(header, /SameSite=Lax/);
    assert.match(header, /Secure/);
    assert.doesNotMatch(header, /HttpOnly/i);
    assert.match(header, /Max-Age=/);
  });

  it("analytics and marketing stay blocked without consent", () => {
    assert.equal(isAnalyticsAllowed(null), false);
    assert.equal(isMarketingAllowed(null), false);
  });
});

describe("cookie consent i18n coverage", () => {
  it("provides required strings for every Bidvera locale", () => {
    const keys = [
      "title",
      "description",
      "acceptAll",
      "rejectAll",
      "cookiesSettings",
      "savePreferences",
      "necessaryTitle",
      "analyticsTitle",
      "marketingTitle",
      "privacyPolicy",
      "manageCookies",
      "closeLabel",
    ] as const;
    for (const locale of locales) {
      const copy = getCookieConsentCopy(locale);
      for (const key of keys) {
        assert.ok(copy[key].trim().length > 0, `${locale}.${key}`);
      }
    }
  });
});

describe("cookie consent UI wiring", () => {
  it("mounts consent UI in root layout and reopens from footer/settings", () => {
    const layout = read("src/app/layout.tsx");
    const footer = read("src/components/marketing/site-chrome.tsx");
    const settings = read("src/app/(app)/settings/page.tsx");
    const root = read("src/components/consent/cookie-consent-root.tsx");
    assert.match(layout, /CookieConsentMount/);
    assert.match(footer, /CookieSettingsLink/);
    assert.match(settings, /CookieSettingsLink/);
    assert.match(root, /data-cookie-consent-banner/);
    assert.match(root, /data-cookie-consent-settings/);
    assert.match(root, /Accept All Cookies|acceptAll/);
    assert.match(root, /rejectAll/);
    assert.match(root, /cookiesSettings/);
    assert.match(root, /savePreferences/);
    assert.match(root, /role="switch"/);
    assert.match(root, /sm:flex-row/);
    assert.match(root, /max-w-xl/);
    assert.match(root, /fixed inset-x-0 bottom-0/);
    assert.doesNotMatch(root, /sm:items-center sm:p-6|sm:inset-0 sm:items-center/);
    assert.match(root, /privacy-policy|privacyHref/);
  });

  it("does not gate essential session or locale cookies", () => {
    const consent = read("src/services/consent/cookie-consent.ts");
    assert.doesNotMatch(consent, /bidvera_session|SESSION\.cookieName/);
    assert.doesNotMatch(consent, /bidvera_locale|localeCookieName/);
    assert.doesNotMatch(consent, /bidvera_oauth_/);
  });

  it("script gate refuses analytics/marketing before consent", () => {
    const gate = read("src/services/consent/script-gate.ts");
    assert.match(gate, /canInitializeAnalytics/);
    assert.match(gate, /canInitializeMarketing/);
    assert.match(gate, /runIfAnalyticsAllowed/);
    assert.match(gate, /runIfMarketingAllowed/);
  });

  it("avoids inventing a third-party analytics provider", () => {
    const root = read("src/components/consent/cookie-consent-root.tsx");
    const gate = read("src/services/consent/script-gate.ts");
    assert.doesNotMatch(root, /gtag|GTM-|googletagmanager|plausible|posthog|hotjar/i);
    assert.doesNotMatch(gate, /gtag|GTM-|googletagmanager|plausible|posthog|hotjar/i);
  });
});
