import type { Locale } from "@/i18n/config";
import { privacyPolicySections } from "./privacy-en";
import { privacyPolicySectionsAr } from "./privacy-ar";
import { privacyPolicySectionsEs } from "./privacy-es";
import { privacyPolicySectionsFr } from "./privacy-fr";
import { privacyPolicySectionsZh } from "./privacy-zh";
import { termsOfServiceSections } from "./terms-en";
import { termsOfServiceSectionsAr } from "./terms-ar";
import { termsOfServiceSectionsEs } from "./terms-es";
import { termsOfServiceSectionsFr } from "./terms-fr";
import { termsOfServiceSectionsZh } from "./terms-zh";
import type { LegalSection } from "./types";

export type { LegalSection } from "./types";

const PRIVACY_BY_LOCALE: Record<Locale, LegalSection[]> = {
  en: privacyPolicySections,
  es: privacyPolicySectionsEs,
  zh: privacyPolicySectionsZh,
  ar: privacyPolicySectionsAr,
  fr: privacyPolicySectionsFr,
};

const TERMS_BY_LOCALE: Record<Locale, LegalSection[]> = {
  en: termsOfServiceSections,
  es: termsOfServiceSectionsEs,
  zh: termsOfServiceSectionsZh,
  ar: termsOfServiceSectionsAr,
  fr: termsOfServiceSectionsFr,
};

export function getPrivacyPolicySections(locale: Locale): LegalSection[] {
  return PRIVACY_BY_LOCALE[locale] ?? privacyPolicySections;
}

export function getTermsOfServiceSections(locale: Locale): LegalSection[] {
  return TERMS_BY_LOCALE[locale] ?? termsOfServiceSections;
}
