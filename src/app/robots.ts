import type { MetadataRoute } from "next";
import { robotsAllowPaths, robotsDisallowPaths } from "@/seo/robots-policy";
import { siteEntity } from "@/seo/site-entity";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [...robotsAllowPaths],
      disallow: [...robotsDisallowPaths],
    },
    sitemap: `${siteEntity.url}/sitemap.xml`,
    host: siteEntity.url,
  };
}
