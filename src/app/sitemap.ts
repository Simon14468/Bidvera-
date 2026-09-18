import type { MetadataRoute } from "next";
import { listIndexablePaths, getSeoPageByPath } from "@/seo/content";
import { absoluteUrl, hreflangLocales, localeHref } from "@/seo/site-entity";
import { maxPriorityForPath } from "@/seo/keywords";

/** Stable content revision date for lastmod (avoid churning every request). */
const CONTENT_LASTMOD = new Date("2026-09-15T00:00:00.000Z");

function sitemapPriority(path: string, fallback: number): number {
  const scored = maxPriorityForPath(path);
  if (scored == null) return fallback;
  // Map 1–100 keyword score → 0.4–1.0 sitemap priority without inventing rankings.
  return Math.round((0.4 + (scored / 100) * 0.6) * 100) / 100;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return listIndexablePaths().map((path) => {
    const page = getSeoPageByPath(path);
    const languages: Record<string, string> = {};
    for (const loc of hreflangLocales) {
      languages[loc] = localeHref(path, loc);
    }
    languages["x-default"] = absoluteUrl(path);

    return {
      url: absoluteUrl(path),
      lastModified: CONTENT_LASTMOD,
      changeFrequency: page?.changeFrequency ?? "monthly",
      priority: sitemapPriority(path, page?.priority ?? 0.5),
      alternates: { languages },
    };
  });
}
