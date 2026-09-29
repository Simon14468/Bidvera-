import { CookieConsentRoot } from "@/components/consent/cookie-consent-root";
import { getCookieConsentCopy } from "@/i18n/cookie-consent";
import { getLocale } from "@/i18n/get-locale";

/** Server wrapper — avoids reading browser cookies during SSR of the root tree. */
export async function CookieConsentMount() {
  const locale = await getLocale();
  const copy = getCookieConsentCopy(locale);
  return <CookieConsentRoot copy={copy} privacyHref="/privacy-policy" />;
}
