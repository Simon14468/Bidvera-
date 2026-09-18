import { SeoArticlePage } from "@/components/seo/seo-article-page";
import { resourcePages } from "@/seo/content/resources-compare-guides";
import { getSeoPageByPath } from "@/seo/content";
import { buildPageMetadata } from "@/seo/metadata";
import { resolvePageLocale } from "@/seo/content/types";
import { getLocale } from "@/i18n/get-locale";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return resourcePages
    .filter((p) => p.path.startsWith("/resources/"))
    .map((p) => ({ slug: p.path.replace("/resources/", "") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPageByPath(`/resources/${slug}`);
  if (!page) return {};
  const copy = resolvePageLocale(page.locales, await getLocale());
  return buildPageMetadata({
    path: page.path,
    title: copy.title,
    description: copy.description,
    type: "article",
  });
}

export default async function ResourceSlugPage({ params }: Props) {
  const { slug } = await params;
  const page = getSeoPageByPath(`/resources/${slug}`);
  if (!page) notFound();
  const locale = await getLocale();
  const copy = resolvePageLocale(page.locales, locale);
  return (
    <SeoArticlePage
      page={page}
      locale={locale}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Resources", path: "/resources" },
        { name: copy.title, path: page.path },
      ]}
    />
  );
}
