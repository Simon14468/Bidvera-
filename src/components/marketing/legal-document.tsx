import type { LegalSection } from "@/content/legal/types";
import Link from "next/link";

export function LegalDocument({
  eyebrow,
  title,
  effectiveLabel,
  lastUpdatedLabel,
  effectiveDate,
  onThisPageLabel,
  sections,
  relatedHeading,
  relatedLinks,
}: {
  eyebrow: string;
  title: string;
  effectiveLabel: string;
  lastUpdatedLabel: string;
  effectiveDate: string;
  onThisPageLabel: string;
  sections: LegalSection[];
  relatedHeading: string;
  relatedLinks: { href: string; label: string }[];
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-sm text-muted">
        <span className="font-medium text-foreground">{effectiveLabel}:</span>{" "}
        {effectiveDate}
        <span className="mx-2 text-border" aria-hidden>
          ·
        </span>
        <span className="font-medium text-foreground">{lastUpdatedLabel}:</span>{" "}
        {effectiveDate}
      </p>

      <nav
        className="mt-8 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
        aria-label={onThisPageLabel}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          {onThisPageLabel}
        </p>
        <ol className="mt-3 columns-1 gap-x-8 space-y-1.5 text-sm sm:columns-2">
          {sections.map((section) => (
            <li key={section.id} className="break-inside-avoid">
              <a
                href={`#${section.id}`}
                className="text-muted transition hover:text-primary"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-24"
            aria-labelledby={`${section.id}-heading`}
          >
            <h2
              id={`${section.id}-heading`}
              className="text-xl font-semibold tracking-tight text-foreground"
            >
              {section.title}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
              {section.paragraphs.map((p, i) => (
                <p key={`${section.id}-p-${i}`}>{p}</p>
              ))}
              {section.bullets && section.bullets.length > 0 ? (
                <ul className="list-disc space-y-2 ps-5">
                  {section.bullets.map((b, i) => (
                    <li key={`${section.id}-b-${i}`}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <aside className="mt-12 border-t border-border pt-8">
        <p className="text-sm font-semibold text-foreground">{relatedHeading}</p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {relatedLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-primary hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </p>
      </aside>
    </article>
  );
}
