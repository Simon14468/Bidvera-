import { CompanyAvatar } from "@/components/brand/company-avatar";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { resolveAuthContext } from "@/auth/session";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import type { Locale } from "@/i18n/config";
import { prisma } from "@/lib/db";
import { companyHasUpgradePath } from "@/services/billing/upgrade-eligibility";
import Link from "next/link";

export async function AppTopbar({
  tenderAnalysisEnabled = false,
  companyProfileEnabled = true,
  languageLabel,
}: {
  tenderAnalysisEnabled?: boolean;
  companyProfileEnabled?: boolean;
  languageLabel?: string;
}) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.app.shell;
  const langLabel = languageLabel ?? dict.nav.language;
  const auth = await resolveAuthContext();
  const companyId = auth?.user.companyId ?? null;
  const company = companyId
    ? await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      })
    : null;

  const showUpgrade = companyId
    ? await companyHasUpgradePath(companyId).catch(() => false)
    : false;

  const companyName = company?.name?.trim() || t.yourCompany;
  const companyHref = companyProfileEnabled ? "/company" : "/upgrade";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
            {t.decisionWorkspace}
          </p>
          <p className="truncate text-xs text-muted">{t.tagline}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <LanguageSwitcher
            current={locale as Locale}
            label={langLabel}
            variant="header"
          />

          {showUpgrade ? (
            <Link
              href="/upgrade"
              className="inline-flex h-9 shrink-0 items-center rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-background"
            >
              {t.upgrade}
            </Link>
          ) : null}

          {tenderAnalysisEnabled ? (
            <Link
              href="/tenders/upload"
              className="hidden h-9 shrink-0 items-center rounded-xl bg-primary px-3.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition hover:bg-primary-hover active:scale-[0.98] sm:inline-flex"
            >
              {t.analyzeTender}
            </Link>
          ) : null}

          <Link
            href={companyHref}
            className="group flex min-w-0 max-w-[11rem] items-center gap-2 rounded-xl border border-border bg-card py-1 pe-2.5 ps-1 transition hover:border-primary/25 hover:shadow-[var(--shadow-soft)] sm:max-w-[16rem] sm:gap-2.5 sm:pe-3"
            title={companyName}
          >
            <CompanyAvatar
              size={32}
              className="rounded-[10px]"
              src={auth?.user.avatarUrl}
              alt={auth?.user.name ?? ""}
            />
            <span className="min-w-0 text-start">
              <span className="block truncate text-sm font-semibold tracking-tight text-foreground group-hover:text-primary">
                {companyName}
              </span>
              <span className="hidden truncate text-[11px] text-muted sm:block">
                {auth?.user.name ?? t.workspace}
              </span>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
