import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { PLANS } from "@/config/plans";
import {
  getPublicLandingVideo,
  listPublicTestimonials,
} from "@/application/admin/landing-service";
import { BidveraVoiceAssistantHost } from "@/components/assistant/voice-assistant-host";
import { LandingCapabilityDiscovery } from "@/components/marketing/landing-capability-discovery";
import { ProductVideoSection } from "@/components/marketing/product-video-section";
import { Reveal, ScrollFitBar, ScrollVideoFrame } from "@/components/marketing/reveal";
import { SmartMatchTeaser } from "@/components/marketing/smart-match-teaser";
import {
  LANDING_COMPLIANCE_IMAGE,
  LANDING_COMPLIANCE_IMAGE_SIZE,
} from "@/config/landing-images";
import { TestimonialsSection } from "@/components/marketing/testimonials-section";
import { buildPageMetadata } from "@/seo/metadata";
import { BRAND_MARK_SRC } from "@/components/brand/brand-logo";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return buildPageMetadata({
    path: "/",
    title: t.brand.tagline,
    description: t.brand.description,
  });
}

export default async function LandingPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const l = t.landing;
  const pro = PLANS.pro;
  const proPrice = `$${pro.priceMonthlyCents / 100}`;
  const [landingVideo, testimonials] = await Promise.all([
    getPublicLandingVideo(locale),
    listPublicTestimonials(),
  ]);

  const workflow = [
    { step: "01", title: l.step1Title, body: l.step1Body },
    { step: "02", title: l.step2Title, body: l.step2Body },
    { step: "03", title: l.step3Title, body: l.step3Body },
    { step: "04", title: l.step4Title, body: l.step4Body },
  ];

  return (
    <>
      {/* Hero */}
      <section className="hero-atmosphere relative overflow-hidden border-b border-border">
        <div className="hero-atmosphere__glow" aria-hidden />
        <div className="hero-atmosphere__stamp" aria-hidden />
        <div className="hero-atmosphere__stamp--echo" aria-hidden />
        <div className="hero-atmosphere__glass" aria-hidden />
        <div className="hero-atmosphere__vignette" aria-hidden />
        <div className="relative z-[2] mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-16 md:pb-20 md:pt-20 lg:pb-28 lg:pt-24">
          <Reveal className="mx-auto max-w-3xl text-center" variant="fade-up">
            <span className="mx-auto flex size-12 items-center justify-center sm:size-14">
              <Image
                src={BRAND_MARK_SRC}
                alt=""
                width={48}
                height={48}
                priority
                unoptimized
                className="size-8 object-contain sm:size-9"
              />
            </span>
            <h1 className="mt-3 text-[1.75rem] font-semibold leading-[1.15] tracking-tight text-foreground sm:mt-4 sm:text-4xl sm:leading-tight md:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
              {l.headline}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted sm:mt-5 sm:text-lg md:text-xl">
              {l.subhead}
            </p>
            <div className="mt-6 flex w-full flex-col items-stretch gap-2.5 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
              <Link
                href="/signup"
                className="cta-press inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-white shadow-[var(--shadow-soft)] hover:bg-primary-hover hover:shadow-[var(--shadow-lift)] sm:h-11"
              >
                {l.ctaPrimary}
              </Link>
              <Link
                href="#how-it-works"
                className="cta-press inline-flex h-12 items-center justify-center rounded-xl border border-border bg-card px-6 text-sm font-medium text-foreground hover:bg-background sm:h-11"
              >
                {l.ctaSecondary}
              </Link>
            </div>
            <p className="mt-3 px-2 text-sm text-muted sm:mt-4">{l.trialNote}</p>
          </Reveal>

          {landingVideo ? (
            <ScrollVideoFrame className="mx-auto mt-8 max-w-4xl sm:mt-12">
              <Reveal delay={80} variant="scale">
                <ProductVideoSection
                  embedded
                  video={{
                    title: landingVideo.title,
                    description: landingVideo.description,
                    youtubeUrl: landingVideo.youtubeUrl,
                    youtubeId: landingVideo.youtubeId,
                    videoUrl: landingVideo.videoUrl,
                    posterUrl: landingVideo.posterUrl,
                  }}
                />
              </Reveal>
            </ScrollVideoFrame>
          ) : null}

          {/* Product preview */}
          <Reveal className="mx-auto mt-8 max-w-4xl sm:mt-12 md:mt-14" delay={120} variant="fade-up">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-lift)]">
              <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2.5 sm:px-4 sm:py-3">
                <span className="size-2 rounded-full bg-primary sm:size-2.5" aria-hidden />
                <span className="size-2 rounded-full bg-border sm:size-2.5" aria-hidden />
                <span className="size-2 rounded-full bg-border sm:size-2.5" aria-hidden />
                <span className="ms-2 truncate text-[11px] font-medium text-muted sm:ms-3 sm:text-xs">
                  {l.previewLabel}
                </span>
              </div>
              <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
                <div className="border-b border-border p-4 sm:p-5 md:border-b-0 md:border-e md:p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted sm:text-xs">
                    {l.previewQuestion}
                  </p>
                  <div className="mt-3 inline-flex max-w-full items-center rounded-xl border border-primary/30 bg-primary-muted px-3 py-1.5 text-sm font-semibold text-primary">
                    {l.previewDecision}
                  </div>
                  <p className="mt-3 text-sm text-muted">{l.previewFit}</p>
                  <ScrollFitBar value={62} className="mt-4 sm:mt-5" delay={320} />
                  <p className="mt-4 text-sm leading-relaxed text-foreground sm:mt-6">
                    {l.previewWhy}
                  </p>
                </div>
                <ul className="space-y-0 p-4 sm:p-5 md:p-6">
                  {[
                    { k: l.previewRisk, v: l.previewRiskValue, danger: false },
                    { k: l.previewMissing, v: l.previewMissingValue },
                    { k: l.previewNext, v: l.previewNextValue },
                  ].map((row) => (
                    <li
                      key={row.k}
                      className="flex flex-col gap-0.5 border-b border-border py-3 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:py-3.5"
                    >
                      <span className="shrink-0 text-sm text-muted">{row.k}</span>
                      <span
                        className={`text-sm font-medium sm:max-w-[60%] sm:text-end ${row.danger ? "text-danger" : "text-foreground"}`}
                      >
                        {row.v}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <SmartMatchTeaser copy={l.smartMatch} />

      {/* Customer value */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-20">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
              {l.sectionTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{l.sectionBody}</p>
          </Reveal>
          <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {[
              { title: l.feature1Title, body: l.feature1Body },
              { title: l.feature2Title, body: l.feature2Body },
              { title: l.feature3Title, body: l.feature3Body },
            ].map((item, i) => (
              <Reveal
                key={item.title}
                as="article"
                delay={i * 70}
                className={`hover-lift rounded-xl border border-border bg-card p-4 sm:p-5 ${i === 2 ? "sm:col-span-2 lg:col-span-1" : ""}`}
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary-muted text-sm font-semibold text-primary">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-3 font-semibold text-foreground sm:mt-4">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <LandingCapabilityDiscovery
        title={l.capabilitiesTitle}
        learnMore={l.capabilitiesLearnMore}
        showLess={l.capabilitiesShowLess}
        cards={l.capabilities}
      />

      <TestimonialsSection
        testimonials={testimonials}
        copy={{
          title: l.testimonialsTitle,
          body: l.testimonialsBody,
          emptyTitle: l.testimonialsEmptyTitle,
          emptyBody: l.testimonialsEmptyBody,
          emptyCta: l.testimonialsEmptyCta,
        }}
      />

      {/* Workflow */}
      <section id="how-it-works" className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-20">
          <Reveal className="max-w-2xl">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
              {l.howTitle}
            </h2>
            <p className="mt-2 text-sm text-muted sm:text-base">{l.howBody}</p>
          </Reveal>
          <ol className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {workflow.map((item, i) => (
              <Reveal key={item.step} as="li" delay={i * 70} className="relative">
                <div className="hover-lift h-full rounded-xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
                  <span className="text-xs font-semibold tracking-[0.14em] text-primary">
                    {item.step}
                  </span>
                  <h3 className="mt-2 font-semibold text-foreground sm:mt-3">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted sm:mt-2">{item.body}</p>
                </div>
                {i < workflow.length - 1 ? (
                  <span
                    className="pointer-events-none absolute -end-2 top-1/2 hidden -translate-y-1/2 text-border lg:block"
                    aria-hidden
                  >
                    →
                  </span>
                ) : null}
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Before / After */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-20">
          <Reveal className="max-w-2xl">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
              {l.beforeAfterTitle}
            </h2>
            <p className="mt-2 text-sm text-muted sm:text-base">{l.beforeAfterBody}</p>
          </Reveal>
          <div className="mt-8 grid gap-3 sm:mt-10 sm:gap-4 md:grid-cols-2">
            <Reveal
              as="article"
              delay={40}
              className="rounded-xl border border-border bg-card p-4 sm:p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                {l.beforeLabel}
              </p>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted sm:mt-4 sm:space-y-3">
                {l.beforeItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal
              as="article"
              delay={120}
              className="rounded-xl border border-primary/25 bg-primary-muted/40 p-4 ring-1 ring-primary/15 sm:p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                {l.afterLabel}
              </p>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-foreground sm:mt-4 sm:space-y-3">
                {l.afterItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Document Compliance */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
            <Reveal className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                {l.complianceEyebrow}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
                {l.complianceHeadline}
              </h2>
              <p className="mt-2 text-sm text-muted sm:text-base">{l.complianceBody}</p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { title: l.complianceBenefit1Title, body: l.complianceBenefit1Body },
                  { title: l.complianceBenefit2Title, body: l.complianceBenefit2Body },
                  { title: l.complianceBenefit3Title, body: l.complianceBenefit3Body },
                ].map((item) => (
                  <li
                    key={item.title}
                    className="rounded-xl border border-border bg-background p-4 shadow-[var(--shadow-soft)]"
                  >
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">{item.body}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={80} variant="scale">
              <Image
                src={LANDING_COMPLIANCE_IMAGE[locale]}
                alt={l.complianceHeadline}
                width={LANDING_COMPLIANCE_IMAGE_SIZE.width}
                height={LANDING_COMPLIANCE_IMAGE_SIZE.height}
                className="h-auto w-full"
                sizes="(min-width: 1024px) 540px, 100vw"
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-20">
          <Reveal className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div className="max-w-xl">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
                {l.pricingTeaserTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                {l.pricingTeaserBody.split("{price}").map((part, i, arr) =>
                  i < arr.length - 1 ? (
                    <span key={i}>
                      {part}
                      <span className="font-semibold text-foreground">{proPrice}</span>
                    </span>
                  ) : (
                    <span key={i}>{part}</span>
                  ),
                )}
              </p>
            </div>
            <Link
              href="/pricing"
              className="cta-press inline-flex h-12 w-full shrink-0 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-medium hover:shadow-[var(--shadow-soft)] sm:h-11 sm:w-auto"
            >
              {l.pricingTeaserCta}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* FAQ teaser */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 md:py-20">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t.faq.title}</h2>
          </Reveal>
          <Reveal delay={60} className="mt-6 divide-y divide-border border-y border-border sm:mt-8">
            {t.faq.items.slice(0, 3).map((item) => (
              <details key={item.q} className="group py-4 sm:py-5">
                <summary className="cursor-pointer list-none text-sm font-semibold text-foreground marker:content-none focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
                    <span className="min-w-0 flex-1 leading-snug">{item.q}</span>
                    <span className="mt-0.5 shrink-0 text-muted transition group-open:rotate-45 motion-reduce:transition-none sm:mt-0">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </Reveal>
          <Reveal delay={100}>
            <Link
              href="/faq"
              className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline sm:mt-6 sm:min-h-0"
            >
              {l.viewAllFaq}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-ink text-white">
        <Reveal className="mx-auto flex max-w-6xl flex-col items-stretch gap-6 px-4 py-12 sm:gap-8 sm:px-6 sm:py-16 md:flex-row md:items-center md:justify-between md:py-20">
          <div className="min-w-0">
            <Image
              src={BRAND_MARK_SRC}
              alt="Bidvera"
              width={40}
              height={40}
              unoptimized
              className="size-8 object-contain sm:size-9"
            />
            <h2 className="mt-2 text-xl font-semibold tracking-tight sm:mt-3 sm:text-2xl md:text-3xl">
              {l.bottomTitle}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
              {l.bottomBody}
            </p>
          </div>
          <Link
            href="/signup"
            className="cta-press inline-flex h-12 w-full shrink-0 items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-white hover:bg-primary-hover md:h-11 md:w-auto"
          >
            {l.bottomCta}
          </Link>
        </Reveal>
      </section>
      <BidveraVoiceAssistantHost />
    </>
  );
}
