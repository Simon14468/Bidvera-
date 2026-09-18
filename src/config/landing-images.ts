import type { Locale } from "@/i18n/config";

/**
 * Landing Document Compliance visual, one file per locale.
 * Replace a locale PNG to update that language independently:
 *   public/landing-page-images/document-compliance/{locale}.png
 */
export const LANDING_COMPLIANCE_IMAGE = {
  en: "/landing-page-images/document-compliance/en.png",
  es: "/landing-page-images/document-compliance/es.png",
  zh: "/landing-page-images/document-compliance/zh.png",
  ar: "/landing-page-images/document-compliance/ar.png",
  fr: "/landing-page-images/document-compliance/fr.png",
} as const satisfies Record<Locale, string>;

export const LANDING_COMPLIANCE_IMAGE_SIZE = {
  width: 1368,
  height: 1149,
} as const;
