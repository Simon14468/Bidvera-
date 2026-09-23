import { BrandLogo } from "@/components/brand/brand-logo";
import { CompanyAvatar } from "@/components/brand/company-avatar";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { MarketingMobileMenu } from "@/components/marketing/marketing-mobile-menu";
import { MarketingNavShell } from "@/components/marketing/marketing-nav-shell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { resolveAuthContext } from "@/auth/session";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { prisma } from "@/lib/db";
import Link from "next/link";

export async function MarketingHeader() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const auth = await resolveAuthContext();
  const company = auth?.user.companyId
    ? await prisma.company.findUnique({
        where: { id: auth.user.companyId },
        select: { name: true },
      })
    : null;
  const companyName = company?.name?.trim() || null;

  const nav = [
    { label: t.nav.product, href: "/product" },
    { label: t.nav.solutions, href: "/solutions" },
    { label: t.nav.pricing, href: "/pricing" },
    { label: t.nav.resources, href: "/resources" },
    { label: t.nav.faq, href: "/faq" },
  ];

  return (
    <MarketingNavShell>
      <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:gap-4 sm:px-6">
        <BrandLogo
          href={auth ? "/dashboard" : "/"}
          priority
          height={36}
          inverseOnDark
          className="min-w-0 [&_img]:h-7 [&_img]:w-auto sm:[&_img]:h-9"
        />

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Marketing">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <LanguageSwitcher current={locale} label={t.nav.language} />

          {auth && companyName ? (
            <>
              <Link
                href="/company"
                className="hidden max-w-[10rem] items-center gap-2 rounded-xl border border-border bg-card py-1 pe-3 ps-1 shadow-[var(--shadow-soft)] transition hover:border-primary/25 xl:inline-flex"
                title={companyName}
              >
                <CompanyAvatar size={28} />
                <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {companyName}
                </span>
              </Link>
              <Link
                href="/dashboard"
                className="cta-press hidden h-9 items-center rounded-xl bg-primary px-3.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] hover:bg-primary-hover hover:shadow-[var(--shadow-lift)] sm:inline-flex"
              >
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden h-9 items-center rounded-xl px-3 text-sm font-medium text-muted transition-colors hover:text-foreground lg:inline-flex"
              >
                {t.nav.signIn}
              </Link>
              <Link
                href="/signup"
                className="cta-press hidden h-9 items-center rounded-xl bg-primary px-3.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] hover:bg-primary-hover hover:shadow-[var(--shadow-lift)] sm:inline-flex"
              >
                {t.nav.startFree}
              </Link>
            </>
          )}

          <MarketingMobileMenu
            links={nav}
            actions={
              auth && companyName ? (
                <>
                  <Link
                    href="/company"
                    className="inline-flex h-11 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-background"
                  >
                    <CompanyAvatar size={28} />
                    <span className="truncate">{companyName}</span>
                  </Link>
                  <Link
                    href="/dashboard"
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-white hover:bg-primary-hover"
                  >
                    Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-background"
                  >
                    {t.nav.signIn}
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-white hover:bg-primary-hover"
                  >
                    {t.nav.startFree}
                  </Link>
                </>
              )
            }
          />
        </div>
      </div>
    </MarketingNavShell>
  );
}

export async function MarketingFooter() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  const nav = [
    { label: t.nav.product, href: "/product" },
    { label: t.nav.solutions, href: "/solutions" },
    { label: t.nav.pricing, href: "/pricing" },
    { label: t.nav.resources, href: "/resources" },
    { label: t.nav.faq, href: "/faq" },
  ];

  const legal = [
    { label: t.legal.privacyLink, href: "/privacy-policy" },
    { label: t.legal.termsLink, href: "/terms-of-service" },
  ];

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="space-y-2">
            <BrandLogo
              href="/"
              height={32}
              inverseOnDark
              className="[&_img]:h-7 [&_img]:w-auto sm:[&_img]:h-8"
            />
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              {t.brand.tagline}
            </p>
            <nav
              className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm text-muted"
              aria-label={t.legal.footerHeading}
            >
              {legal.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <nav
            className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted"
            aria-label="Product"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/signup" className="hover:text-foreground">
              {t.nav.startFree}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
