import type { Locale } from "@/i18n/config";

export type SeoSection = {
  heading: string;
  body: string[];
  bullets?: string[];
};

export type SeoFaqItem = { q: string; a: string };

export type SeoPageContent = {
  /** URL path without locale, e.g. /solutions/document-compliance */
  path: string;
  /** Sitemap priority 0–1 */
  priority: number;
  changeFrequency: "weekly" | "monthly" | "yearly";
  /** Content type for schema */
  schemaType: "WebPage" | "FAQPage" | "Article" | "CollectionPage";
  /** Per-locale metadata + body. Missing locales fall back to en. */
  locales: Partial<
    Record<
      Locale,
      {
        title: string;
        description: string;
        h1: string;
        /** Direct answer for AI/search snippets — first visible paragraph */
        answer: string;
        sections: SeoSection[];
        faqs?: SeoFaqItem[];
        relatedPaths?: string[];
      }
    >
  >;
};

export type GlossaryTerm = {
  slug: string;
  locales: Partial<
    Record<
      Locale,
      {
        term: string;
        definition: string;
      }
    >
  >;
};

export function resolvePageLocale<T>(
  locales: Partial<Record<Locale, T>>,
  locale: Locale,
): T {
  return (locales[locale] ?? locales.en) as T;
}
