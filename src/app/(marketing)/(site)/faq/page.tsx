import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { buildPageMetadata } from "@/seo/metadata";
import {
  JsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  webPageJsonLd,
} from "@/seo/json-ld";
import { absoluteUrl } from "@/seo/site-entity";
import type { Metadata } from "next";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return buildPageMetadata({
    path: "/faq",
    title: `${t.faq.eyebrow}: ${t.faq.title}`,
    description:
      "Answers about Bidvera company intelligence, document compliance, supplier readiness, client requests, evidence and security.",
  });
}

export default async function FaqPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <JsonLd
        data={webPageJsonLd({
          path: "/faq",
          name: t.faq.title,
          description: t.faq.title,
          locale,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: t.faq.eyebrow, path: "/faq" },
        ])}
      />
      <JsonLd data={faqPageJsonLd(t.faq.items, absoluteUrl("/faq"))} />

      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
        {t.faq.eyebrow}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{t.faq.title}</h1>
      <div className="mt-10 space-y-4">
        {t.faq.items.map((item) => (
          <details
            key={item.q}
            className="group rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
          >
            <summary className="cursor-pointer list-none font-semibold text-foreground marker:content-none">
              <span className="flex items-center justify-between gap-3">
                {item.q}
                <span className="text-muted transition group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted">
        <Link href="/solutions" className="text-primary hover:underline">
          Solutions
        </Link>
        {" · "}
        <Link href="/resources" className="text-primary hover:underline">
          Resources
        </Link>
        {" · "}
        <Link href="/guides/company-readiness-software" className="text-primary hover:underline">
          Company readiness guide
        </Link>
      </p>
    </div>
  );
}
