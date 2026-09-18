import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { buildPageMetadata } from "@/seo/metadata";
import { JsonLd, breadcrumbJsonLd, webPageJsonLd } from "@/seo/json-ld";
import type { Metadata } from "next";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return buildPageMetadata({
    path: "/product",
    title: t.product.title,
    description: t.product.body,
  });
}

export default async function ProductPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const p = t.product;
  const steps = [
    { step: "1", title: p.step1Title, body: p.step1Body },
    { step: "2", title: p.step2Title, body: p.step2Body },
    { step: "3", title: p.step3Title, body: p.step3Body },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 animate-fade-in">
      <JsonLd
        data={webPageJsonLd({
          path: "/product",
          name: p.title,
          description: p.body,
          locale,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: p.eyebrow, path: "/product" },
        ])}
      />
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
        Bidvera · {p.eyebrow}
      </p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight">{p.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">{p.body}</p>

      <ol className="mt-12 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li
            key={s.step}
            className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] hover-lift animate-fade-up"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary-muted text-sm font-semibold text-primary">
              {s.step}
            </span>
            <h2 className="mt-4 text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <section className="mt-16 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight">{p.seeTitle}</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {p.seeItems.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-foreground">
              <span className="text-primary">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <Link
          href="/signup"
          className="mt-8 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {p.cta}
        </Link>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href="/solutions" className="text-primary hover:underline">
            Solutions
          </Link>
          <Link href="/pricing" className="text-primary hover:underline">
            Pricing
          </Link>
          <Link href="/faq" className="text-primary hover:underline">
            FAQ
          </Link>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">{p.futureTitle}</h2>
        <p className="mt-2 max-w-2xl text-muted">{p.futureBody}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {p.highlightItems.map((m) => (
            <span
              key={m}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted"
            >
              {m}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
