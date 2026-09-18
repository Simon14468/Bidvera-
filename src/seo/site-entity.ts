import { siteConfig } from "@/config/site";
import { locales, type Locale } from "@/i18n/config";

/** Stable entity facts for SEO/GEO — only truthful, non-invented claims. */
export const siteEntity = {
  name: "Bidvera",
  legalName: "Bidvera",
  alternateName: ["Bidvera AI"],
  description:
    "Bidvera is a Company Intelligence + Compliance + Evidence + Opportunity Intelligence platform for readiness, supplier qualification, client requests, questionnaires, and explainable decision support. Tender analysis is one capability — not the whole product.",
  url: siteConfig.url.replace(/\/$/, ""),
  applicationCategory: "BusinessApplication",
  applicationSubCategory:
    "Company intelligence, compliance, evidence and opportunity-readiness software",
  operatingSystem: "Web",
  logoPath: "/brand-mark.png",
  ogImagePath: "/brand-logo.png",
  sameAs: [] as string[],
  entityChain: [
    "Bidvera",
    "company intelligence",
    "document compliance",
    "supplier qualification",
    "evidence intelligence",
    "opportunity readiness",
    "decision support",
  ] as const,
  /** Commercially available capabilities we may truthfully describe publicly. */
  offeredCapabilities: [
    "Company profile management",
    "Document compliance and expiry tracking",
    "Supplier qualification profiles",
    "Evidence intelligence",
    "Client request management",
    "AI questionnaire assistance",
    "Tender calendar and deadline reminders",
    "Explainable bid / review / no-bid decision support",
    "Decision memory",
    "Team decision workflow",
    "Smart alerts",
    "PDF decision reports",
  ],
  /** Explicitly not marketed as generally available. */
  notCommerciallyClaimed: [
    "Matching Engine / matched opportunities marketplace",
    "Automated public tender discovery feed",
    "Tender Analysis as a standalone commercial product",
  ],
  audience: [
    "SMEs responding to RFPs and buyer requests",
    "Suppliers managing compliance and qualifications",
    "Teams that need evidence-backed bid decisions",
    "Companies replacing spreadsheet-based readiness tracking",
  ],
} as const;

export const localeToOgLocale: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  fr: "fr_FR",
  ar: "ar",
  zh: "zh_CN",
};

export const hreflangLocales = locales;

export function absoluteUrl(path = "/"): string {
  const base = siteEntity.url;
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function localeHref(path: string, locale: Locale): string {
  const url = new URL(absoluteUrl(path));
  url.searchParams.set("lang", locale);
  return url.toString();
}
