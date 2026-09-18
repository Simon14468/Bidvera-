import { SeoArticlePage } from "@/components/seo/seo-article-page";
import { solutionPages } from "@/seo/content/solutions";
import { getSeoPageByPath } from "@/seo/content";
import { buildPageMetadata } from "@/seo/metadata";
import { resolvePageLocale } from "@/seo/content/types";
import { getLocale } from "@/i18n/get-locale";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return solutionPages
    .filter((p) => p.path.startsWith("/solutions/") && p.path !== "/solutions")
    .map((p) => ({ slug: p.path.replace("/solutions/", "") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPageByPath(`/solutions/${slug}`);
  if (!page) return {};
  const copy = resolvePageLocale(page.locales, await getLocale());
  return buildPageMetadata({
    path: page.path,
    title: copy.title,
    description: copy.description,
  });
}

export default async function SolutionSlugPage({ params }: Props) {
  const { slug } = await params;
  const page = getSeoPageByPath(`/solutions/${slug}`);
  if (!page) notFound();
  const locale = await getLocale();
  const copy = resolvePageLocale(page.locales, locale);
  return (
    <SeoArticlePage
      page={page}
      locale={locale}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Solutions", path: "/solutions" },
        { name: copy.title, path: page.path },
      ]}
    />
  );
}
