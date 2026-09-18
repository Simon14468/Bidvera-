import type { Metadata } from "next";
import { getLocale } from "@/i18n/get-locale";
import type { Locale } from "@/i18n/config";
import {
  absoluteUrl,
  hreflangLocales,
  localeHref,
  localeToOgLocale,
  siteEntity,
} from "@/seo/site-entity";

export type BuildPageMetadataInput = {
  path: string;
  title: string;
  description: string;
  /** Override robots; default index+follow for public marketing */
  noIndex?: boolean;
  type?: "website" | "article";
};

export async function buildPageMetadata(
  input: BuildPageMetadataInput,
): Promise<Metadata> {
  const locale = await getLocale();
  return buildPageMetadataForLocale(input, locale);
}

export function buildPageMetadataForLocale(
  input: BuildPageMetadataInput,
  locale: Locale,
): Metadata {
  const canonical = absoluteUrl(input.path);
  const title = input.title;
  const description = input.description;
  const ogImage = absoluteUrl(siteEntity.ogImagePath);

  const languages: Record<string, string> = {};
  for (const loc of hreflangLocales) {
    languages[loc] = localeHref(input.path, loc);
  }
  languages["x-default"] = absoluteUrl(input.path);

  return {
    title,
    description,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      type: input.type ?? "website",
      locale: localeToOgLocale[locale],
      url: canonical,
      siteName: siteEntity.name,
      title: `${title} · ${siteEntity.name}`,
      description,
      images: [
        {
          url: ogImage,
          alt: `${siteEntity.name} — company intelligence workspace`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${siteEntity.name}`,
      description,
      images: [ogImage],
    },
    robots: input.noIndex
      ? { index: false, follow: false, nocache: true }
      : { index: true, follow: true },
  };
}

export const noIndexMetadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: absoluteUrl("/") },
};
