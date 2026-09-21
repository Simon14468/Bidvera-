import { Reveal } from "@/components/marketing/reveal";
import Link from "next/link";

export type SmartMatchCopy = {
  eyebrow: string;
  title: string;
  body: string;
  benefit1: string;
  benefit2: string;
  benefit3: string;
  dimensionsLabel: string;
  dimensions: [string, string, string, string, string, string];
  note: string;
  ctaPrimary: string;
  ctaSecondary: string;
};

type Props = {
  copy: SmartMatchCopy;
};

/**
 * Concise Smart Match teaser — placed below Hero.
 * Copy must stay honest: matching is implemented but commercially gated.
 */
export function SmartMatchTeaser({ copy }: Props) {
  return (
    <section
      id="smart-match"
      className="border-b border-border bg-card"
      aria-labelledby="smart-match-heading"
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-16">
        <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
          <Reveal className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {copy.eyebrow}
            </p>
            <h2
              id="smart-match-heading"
              className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl"
            >
              {copy.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
              {copy.body}
            </p>
            <ul className="mt-6 space-y-2.5 text-sm leading-relaxed text-foreground">
              {[copy.benefit1, copy.benefit2, copy.benefit3].map((item) => (
                <li key={item} className="flex gap-2">
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <Link
                href="/signup"
                className="cta-press inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-white shadow-[var(--shadow-soft)] hover:bg-primary-hover sm:h-11"
              >
                {copy.ctaPrimary}
              </Link>
              <Link
                href="/product"
                className="cta-press inline-flex h-12 items-center justify-center rounded-xl border border-border bg-background px-6 text-sm font-medium text-foreground hover:bg-card sm:h-11"
              >
                {copy.ctaSecondary}
              </Link>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">{copy.note}</p>
          </Reveal>
          <Reveal delay={80} className="rounded-xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {copy.dimensionsLabel}
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:gap-2.5">
              {copy.dimensions.map((dim) => (
                <li
                  key={dim}
                  className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground"
                >
                  {dim}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
