"use client";

import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/cn";

export type LandingCapabilityCard = {
  title: string;
  body: string;
  detail: string;
};

type Props = {
  title: string;
  learnMore: string;
  showLess: string;
  cards: LandingCapabilityCard[];
};

/**
 * Accessible expandable capability discovery — uses native <details>
 * with focus-visible rings and prefers-reduced-motion friendly Reveal.
 */
export function LandingCapabilityDiscovery({
  title,
  learnMore,
  showLess,
  cards,
}: Props) {
  return (
    <section
      id="capabilities"
      className="border-b border-border bg-background"
      aria-labelledby="landing-capabilities-heading"
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-20">
        <Reveal className="max-w-2xl">
          <h2
            id="landing-capabilities-heading"
            className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl"
          >
            {title}
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-2">
          {cards.map((item, i) => (
            <Reveal
              key={item.title}
              delay={Math.min(i * 40, 280)}
              className="h-full"
            >
              <details
                className={cn(
                  "group h-full rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-[border-color,box-shadow] duration-200 sm:p-5",
                  "hover:border-primary/25 hover:shadow-[var(--shadow-lift)]",
                  "open:border-primary/30 open:shadow-[var(--shadow-lift)]",
                  "motion-reduce:transition-none",
                )}
              >
                <summary
                  className={cn(
                    "cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden",
                    "rounded-lg outline-none",
                    "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold tracking-[0.12em] text-primary">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="mt-1.5 block font-semibold text-foreground">
                        {item.title}
                      </span>
                      <span className="mt-2 block text-sm leading-relaxed text-muted">
                        {item.body}
                      </span>
                    </span>
                    <span
                      className="mt-1 shrink-0 text-muted transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                      aria-hidden
                    >
                      +
                    </span>
                  </span>
                  <span className="mt-3 block text-xs font-medium text-primary group-open:hidden">
                    {learnMore}
                  </span>
                  <span className="mt-3 hidden text-xs font-medium text-primary group-open:block">
                    {showLess}
                  </span>
                </summary>
                <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-foreground">
                  {item.detail}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
