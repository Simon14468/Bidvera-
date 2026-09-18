import { SeoArticlePage } from "@/components/seo/seo-article-page";
import { getSeoPageByPath } from "@/seo/content";
import { buildPageMetadata } from "@/seo/metadata";
import { resolvePageLocale } from "@/seo/content/types";
import { getLocale } from "@/i18n/get-locale";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const PATH = "/solutions";

export async function generateMetadata(): Promise<Metadata> {
  const page = getSeoPageByPath(PATH);
  if (!page) return {};
  const locale = await getLocale();
  const copy = resolvePageLocale(page.locales, locale);
  return buildPageMetadata({
    path: PATH,
    title: copy.title,
    description: copy.description,
  });
}

export default async function SolutionsHubPage() {
  const page = getSeoPageByPath(PATH);
  if (!page) notFound();
  const locale = await getLocale();
  return (
    <SeoArticlePage
      page={page}
      locale={locale}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Solutions", path: PATH },
      ]}
    />
  );
}
