import { BrandLogo } from "@/components/brand/brand-logo";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import Image from "next/image";
import type { ReactNode } from "react";

type AuthSplitShellProps = {
  headline: string;
  body: string;
  children: ReactNode;
};

/**
 * Desktop: Facebook-style split — visual left, form right.
 * Mobile: form only, centered.
 * RTL: grid direction flips naturally with document dir.
 */
export async function AuthSplitShell({ headline, body, children }: AuthSplitShellProps) {
  const locale = await getLocale();
  const { sidePillMatched, sidePillReview, sidePillNotAMatch } = getDictionary(locale).auth;

  return (
    <div className="flex flex-1 items-center px-4 py-10 sm:px-6 sm:py-12 lg:py-16">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14 xl:gap-20">
        <aside className="hidden lg:block" aria-hidden={false}>
          <div className="relative mx-auto max-w-lg">
            <p className="text-4xl font-semibold tracking-tight text-foreground xl:text-5xl">
              {headline}
            </p>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">{body}</p>

            <div className="relative mt-10 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-lift)]">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_55%),radial-gradient(ellipse_at_90%_80%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_50%)]"
                aria-hidden
              />
              <Image
                src="/auth-side-visual.webp"
                alt=""
                width={960}
                height={720}
                priority
                className="relative z-[1] h-auto w-full object-cover"
              />
              <div className="relative z-[2] border-t border-border bg-card/90 px-5 py-4 backdrop-blur-sm">
                <BrandLogo
                  href="/"
                  height={28}
                  inverseOnDark
                  className="[&_img]:h-7 [&_img]:w-auto"
                />
                <div className="mt-4 flex flex-col gap-2">
                  <span className="inline-flex max-w-full items-start gap-1.5 rounded-lg border border-success/25 bg-success/10 px-2.5 py-1.5 text-xs font-semibold leading-snug text-success">
                    <StatusIndicator className="mt-0.5 size-3 shrink-0" />
                    <span className="min-w-0">{sidePillMatched}</span>
                  </span>
                  <span className="inline-flex max-w-full items-start gap-1.5 rounded-lg border border-warning/25 bg-warning/10 px-2.5 py-1.5 text-xs font-semibold leading-snug text-warning">
                    <StatusIndicator className="mt-0.5 size-3 shrink-0" />
                    <span className="min-w-0">{sidePillReview}</span>
                  </span>
                  <span className="inline-flex max-w-full items-start gap-1.5 rounded-lg border border-danger/25 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold leading-snug text-danger">
                    <StatusIndicator className="mt-0.5 size-3 shrink-0" />
                    <span className="min-w-0">{sidePillNotAMatch}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
          {children}
        </div>
      </div>
    </div>
  );
}
