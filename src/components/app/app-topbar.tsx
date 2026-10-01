import { CompanyAvatar } from "@/components/brand/company-avatar";
import { PlanBadge } from "@/components/billing/plan-badge";
import { MatchedOpportunitiesNotifyButton } from "@/components/app/matched-opportunities-notify-button";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { PlanBadgeIdentity } from "@/services/billing/plan-identity";
import Link from "next/link";

export function AppTopbar({
  locale,
  languageLabel,
  shell,
  companyName,
  userName,
  userAvatarUrl,
  showUpgrade = false,
  planBadge = null,
  tenderAnalysisEnabled = false,
  companyProfileEnabled = true,
  matchingEngineEnabled = false,
  newMatchesCount = 0,
}: {
  locale: Locale;
  languageLabel: string;
  shell: Dictionary["app"]["shell"];
  companyName: string;
  userName: string;
  userAvatarUrl?: string | null;
  showUpgrade?: boolean;
  planBadge?: PlanBadgeIdentity | null;
  tenderAnalysisEnabled?: boolean;
  companyProfileEnabled?: boolean;
  matchingEngineEnabled?: boolean;
  newMatchesCount?: number;
}) {
  const t = shell;
  const companyHref = companyProfileEnabled ? "/company" : "/upgrade";

  return (
    <header className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 min-w-0 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
            {t.decisionWorkspace}
          </p>
          <p className="truncate text-xs text-muted">{t.tagline}</p>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2.5">
          {matchingEngineEnabled ? (
            <MatchedOpportunitiesNotifyButton
              initialCount={newMatchesCount}
              label={t.matchedOpportunitiesNotify}
              newMatchesLabel={t.newMatchesNotify}
            />
          ) : null}

          <LanguageSwitcher
            current={locale}
            label={languageLabel}
            variant="header"
          />

          {showUpgrade ? (
            <Link
              href="/upgrade"
              className="hidden h-9 shrink-0 items-center rounded-xl bg-card px-3 text-sm font-medium text-foreground transition hover:bg-background sm:inline-flex"
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
            className="group flex min-w-0 max-w-[9.5rem] items-center gap-1.5 rounded-xl bg-card py-1 pe-2 ps-1 transition hover:shadow-[var(--shadow-soft)] sm:max-w-[18rem] sm:gap-2.5 sm:pe-3"
            title={companyName}
          >
            <CompanyAvatar
              size={32}
              className="rounded-[10px]"
              src={userAvatarUrl}
              alt={userName}
            />
            <span className="min-w-0 text-start">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="block truncate text-sm font-semibold tracking-tight text-foreground group-hover:text-primary">
                  {companyName}
                </span>
                {planBadge?.showInChrome ? (
                  <PlanBadge
                    label={planBadge.label}
                    tone={planBadge.tone}
                    title={planBadge.planName}
                    className="hidden sm:inline-flex"
                  />
                ) : null}
              </span>
              <span className="hidden truncate text-[11px] text-muted sm:block">
                {userName || t.workspace}
              </span>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
