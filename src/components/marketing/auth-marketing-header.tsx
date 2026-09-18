import { BrandLogo } from "@/components/brand/brand-logo";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";

/** Minimal auth header — not sticky. Logo, language, theme only. */
export async function AuthMarketingHeader() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <header className="border-b border-border/60 bg-background">
      <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:gap-4 sm:px-6">
        <BrandLogo
          href="/"
          priority
          height={36}
          inverseOnDark
          className="min-w-0 [&_img]:h-7 [&_img]:w-auto sm:[&_img]:h-9"
        />

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher current={locale} label={t.nav.language} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
