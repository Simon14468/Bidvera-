import { SeoArticlePage } from "@/components/seo/seo-article-page";
import { glossaryHub, glossaryTerms } from "@/seo/content/glossary";
import { buildPageMetadata } from "@/seo/metadata";
import { resolvePageLocale } from "@/seo/content/types";
import { JsonLd, breadcrumbJsonLd } from "@/seo/json-ld";
import { getLocale } from "@/i18n/get-locale";
import type { Metadata } from "next";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = resolvePageLocale(glossaryHub.locales, locale);
  return buildPageMetadata({
    path: "/glossary",
    title: copy.title,
    description: copy.description,
  });
}

export default async function GlossaryPage() {
  const locale = await getLocale();
  const copy = resolvePageLocale(glossaryHub.locales, locale);
  const terms = glossaryTerms
    .map((t) => {
      const localized = t.locales[locale] ?? t.locales.en;
      if (!localized) return null;
      return { slug: t.slug, ...localized };
    })
    .filter(Boolean);

  return (
    <div>
      <SeoArticlePage
        page={glossaryHub}
        locale={locale}
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: copy.title, path: "/glossary" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <JsonLd
          data={breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Glossary", path: "/glossary" },
          ])}
        />
        <h2 className="text-2xl font-semibold tracking-tight">Terms</h2>
        <dl className="mt-6 space-y-6">
          {terms.map((term) =>
            term ? (
              <div key={term.slug} id={term.slug} className="scroll-mt-24">
                <dt className="text-lg font-semibold text-foreground">{term.term}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">{term.definition}</dd>
              </div>
            ) : null,
          )}
        </dl>
        <p className="mt-10 text-sm text-muted">
          See also{" "}
          <Link href="/resources" className="text-primary hover:underline">
            Resources
          </Link>{" "}
          and{" "}
          <Link href="/solutions" className="text-primary hover:underline">
            Solutions
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
