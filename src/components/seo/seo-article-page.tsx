import Link from "next/link";
import {
  JsonLd,
  articleJsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  webPageJsonLd,
} from "@/seo/json-ld";
import { absoluteUrl, siteEntity } from "@/seo/site-entity";
import type { SeoPageContent } from "@/seo/content/types";
import { resolvePageLocale } from "@/seo/content/types";
import type { Locale } from "@/i18n/config";
import { getSeoPageByPath } from "@/seo/content";

export function SeoArticlePage({
  page,
  locale,
  breadcrumbs,
}: {
  page: SeoPageContent;
  locale: Locale;
  breadcrumbs: Array<{ name: string; path: string }>;
}) {
  const copy = resolvePageLocale(page.locales, locale);
  const pageUrl = absoluteUrl(page.path);
  const related =
    copy.relatedPaths
      ?.map((path) => {
        const relatedPage = getSeoPageByPath(path);
        if (!relatedPage) return null;
        const relatedCopy = resolvePageLocale(relatedPage.locales, locale);
        return { path, title: relatedCopy.title };
      })
      .filter(Boolean) ?? [];

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 animate-fade-in">
      <JsonLd data={webPageJsonLd({ path: page.path, name: copy.h1, description: copy.description, locale })} />
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
      {page.schemaType === "Article" || page.path.startsWith("/guides/") || page.path.startsWith("/resources/") ? (
        <JsonLd
          data={articleJsonLd({
            path: page.path,
            headline: copy.h1,
            description: copy.description,
            locale,
          })}
        />
      ) : null}
      {copy.faqs?.length ? (
        <JsonLd data={faqPageJsonLd(copy.faqs, pageUrl)} />
      ) : null}

      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          {breadcrumbs.map((crumb, i) => (
            <li key={crumb.path} className="flex items-center gap-1">
              {i > 0 ? <span aria-hidden>/</span> : null}
              {i === breadcrumbs.length - 1 ? (
                <span className="text-foreground">{crumb.name}</span>
              ) : (
                <Link href={crumb.path} className="hover:text-foreground">
                  {crumb.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
        {siteEntity.name}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{copy.h1}</h1>
      <p className="mt-4 text-lg leading-relaxed text-foreground">{copy.answer}</p>

      <div className="mt-10 space-y-10">
        {copy.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-2xl font-semibold tracking-tight">{section.heading}</h2>
            {section.body.map((para) => (
              <p key={para.slice(0, 48)} className="mt-3 text-sm leading-relaxed text-muted">
                {para}
              </p>
            ))}
            {section.bullets?.length ? (
              <ul className="mt-4 list-disc space-y-2 ps-5 text-sm text-foreground">
                {section.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      {copy.faqs?.length ? (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
          <div className="mt-6 space-y-4">
            {copy.faqs.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
              >
                <summary className="cursor-pointer list-none font-semibold marker:content-none">
                  <span className="flex items-center justify-between gap-3">
                    {item.q}
                    <span className="text-muted transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {related.length ? (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">Related</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {related.map((item) =>
              item ? (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {item.title}
                  </Link>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      ) : null}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Start free
        </Link>
        <Link
          href="/product"
          className="inline-flex h-11 items-center rounded-xl border border-border px-5 text-sm font-medium hover:bg-card"
        >
          View product
        </Link>
        <Link
          href="/pricing"
          className="inline-flex h-11 items-center rounded-xl border border-border px-5 text-sm font-medium hover:bg-card"
        >
          Pricing
        </Link>
      </div>
    </article>
  );
}
