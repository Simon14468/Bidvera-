import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/cn";
import { BadgeCheck, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export type TestimonialPublic = {
  id: string;
  customerName: string;
  companyName: string;
  jobTitle: string | null;
  quote: string;
  rating: number;
  avatarUrl: string | null;
  verified: boolean;
};

type TestimonialsCopy = {
  title: string;
  body: string;
  emptyTitle: string;
  emptyBody: string;
  emptyCta: string;
};

function Stars({ rating }: { rating: number }) {
  const clamped = Math.max(1, Math.min(5, rating));
  return (
    <div className="flex gap-0.5" aria-label={`${clamped} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-4",
            i < clamped ? "fill-warning text-warning" : "text-border",
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}

export function TestimonialsSection({
  testimonials,
  copy,
}: {
  testimonials: TestimonialPublic[];
  copy: TestimonialsCopy;
}) {
  if (testimonials.length === 0) {
    return (
      <section
        id="testimonials"
        className="border-b border-border bg-card"
        aria-labelledby="testimonials-heading"
      >
        <Reveal className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6 sm:py-16 md:py-20">
          <h2
            id="testimonials-heading"
            className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl"
          >
            {copy.emptyTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted sm:text-base">{copy.emptyBody}</p>
          <Link
            href="/signup"
            className="cta-press mt-6 inline-flex h-12 w-full max-w-xs items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover sm:mt-8 sm:h-11 sm:w-auto"
          >
            {copy.emptyCta}
          </Link>
        </Reveal>
      </section>
    );
  }

  return (
    <section
      id="testimonials"
      className="border-b border-border bg-card"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2
            id="testimonials-heading"
            className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl"
          >
            {copy.title}
          </h2>
          <p className="mt-3 text-sm text-muted sm:text-base">{copy.body}</p>
        </Reveal>

        <ul className="mt-8 grid gap-3 sm:mt-10 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal
              key={t.id}
              as="li"
              delay={i * 70}
              className={`hover-lift ${i === 2 ? "sm:col-span-2 lg:col-span-1" : ""}`}
            >
              <article className="flex h-full flex-col rounded-xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
                <Stars rating={t.rating} />
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground sm:mt-4">
                  “{t.quote}”
                </blockquote>
                <footer className="mt-4 flex items-center gap-3 border-t border-border pt-4 sm:mt-5">
                  {t.avatarUrl ? (
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-xl border border-border bg-card">
                      <Image
                        src={t.avatarUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="40px"
                        loading="lazy"
                      />
                    </span>
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-xs font-semibold text-primary">
                      {t.customerName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                      {t.customerName}
                      {t.verified ? (
                        <BadgeCheck
                          className="size-4 shrink-0 text-primary"
                          aria-label="Verified"
                        />
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {[t.jobTitle, t.companyName].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </footer>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
