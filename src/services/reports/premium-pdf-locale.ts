/**
 * PDF locale policy — presentation only.
 * Arabic UI → English PDF (Latin labels). Latin-script locales keep their language.
 */

import type { Locale } from "@/i18n/config";
import { defaultLocale, isLocale } from "@/i18n/config";

/** Locales that render safely with Latin Noto fonts + accents. */
const LATIN_SCRIPT_PDF_LOCALES = new Set<Locale>(["en", "es", "fr"]);

/**
 * Resolve the locale used for PDF chrome/labels.
 * Arabic (RTL) always maps to English so labels stay readable.
 * Other Latin-script locales (en/fr/es) pass through unchanged.
 * Non-Latin locales without a dedicated Latin twin fall back to English.
 */
export function resolvePdfLocale(appLocale?: Locale | string | null): Locale {
  if (!appLocale || !isLocale(appLocale)) return defaultLocale;
  if (appLocale === "ar") return "en";
  if (LATIN_SCRIPT_PDF_LOCALES.has(appLocale)) return appLocale;
  // zh and any future non-Latin UI → English PDF chrome
  return "en";
}

/** Arabic / Arabic presentation-form code points. */
const ARABIC_SCRIPT_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;

/**
 * Strip Arabic script from PDF strings so missing glyphs / tofu never appear.
 * Preserves Latin, French accents, digits, and punctuation. Does not alter
 * canonical report data — only the characters drawn into the PDF.
 * Arabic-only strings become a short English placeholder so the PDF never
 * shows empty or broken glyphs.
 */
export function sanitizePdfText(text: string): string {
  if (!text) return text;
  if (!ARABIC_SCRIPT_RE.test(text)) return text;
  const cleaned = text
    .replace(ARABIC_SCRIPT_RE, "")
    .replace(/[ \t]*\/[ \t]*\/[ \t]*/g, " / ")
    .replace(/[ \t]*—[ \t]*—[ \t]*/g, " — ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([(/[])\s+/g, "$1")
    .replace(/\s+([)\]])/g, "$1")
    .replace(/^[\s/—–-]+|[\s/—–-]+$/g, "")
    .trim();
  return cleaned || "See application report for original-language text";
}
