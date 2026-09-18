import { siteEntity } from "@/seo/site-entity";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export function JsonLd({ data }: { data: Record<string, JsonValue> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteEntity.name,
    legalName: siteEntity.legalName,
    alternateName: [...siteEntity.alternateName],
    url: siteEntity.url,
    logo: `${siteEntity.url}${siteEntity.logoPath}`,
    description: siteEntity.description,
    ...(siteEntity.sameAs.length ? { sameAs: [...siteEntity.sameAs] } : {}),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteEntity.name,
    url: siteEntity.url,
    description: siteEntity.description,
    publisher: { "@type": "Organization", name: siteEntity.name },
    inLanguage: ["en", "es", "fr", "ar", "zh"],
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteEntity.name,
    applicationCategory: siteEntity.applicationCategory,
    applicationSubCategory: siteEntity.applicationSubCategory,
    operatingSystem: siteEntity.operatingSystem,
    url: siteEntity.url,
    description: siteEntity.description,
    featureList: [...siteEntity.offeredCapabilities],
    knowsAbout: [...siteEntity.entityChain],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free Workspace available; paid plans published on the pricing page.",
      url: `${siteEntity.url}/pricing`,
    },
  };
}

export function webPageJsonLd(input: {
  path: string;
  name: string;
  description: string;
  locale: string;
}) {
  const url = `${siteEntity.url}${input.path === "/" ? "" : input.path}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name,
    description: input.description,
    url,
    isPartOf: { "@type": "WebSite", name: siteEntity.name, url: siteEntity.url },
    about: { "@type": "SoftwareApplication", name: siteEntity.name },
    inLanguage: input.locale,
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${siteEntity.url}${item.path === "/" ? "" : item.path}`,
    })),
  };
}

export function faqPageJsonLd(
  faqs: Array<{ q: string; a: string }>,
  pageUrl: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: pageUrl,
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function articleJsonLd(input: {
  path: string;
  headline: string;
  description: string;
  locale: string;
  dateModified?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    url: `${siteEntity.url}${input.path}`,
    inLanguage: input.locale,
    author: { "@type": "Organization", name: siteEntity.name },
    publisher: {
      "@type": "Organization",
      name: siteEntity.name,
      logo: {
        "@type": "ImageObject",
        url: `${siteEntity.url}${siteEntity.logoPath}`,
      },
    },
    dateModified: input.dateModified ?? "2026-09-15",
    mainEntityOfPage: `${siteEntity.url}${input.path}`,
  };
}
