import { CompanyAvatar } from "@/components/brand/company-avatar";
import { PlanBadge } from "@/components/billing/plan-badge";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { resolveAuthContext } from "@/auth/session";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import type { Locale } from "@/i18n/config";
import { prisma } from "@/lib/db";
import { resolvePlanBadgeIdentity } from "@/services/billing/plan-identity";
import { companyHasUpgradePath } from "@/services/billing/upgrade-eligibility";
import { getEffectiveEntitlements } from "@/services/entitlements";
import { getTrialUsage } from "@/services/usage";
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

  const [showUpgrade, planBadge] = await Promise.all([
    companyId
      ? companyHasUpgradePath(companyId).catch(() => false)
      : Promise.resolve(false),
    companyId
      ? (async () => {
          const [sub, entitlements, usage] = await Promise.all([
            prisma.subscription.findUnique({
              where: { companyId },
              include: {
                billingPlan: { select: { slug: true, name: true, isFree: true } },
              },
            }),
            getEffectiveEntitlements(companyId),
            getTrialUsage(companyId),
          ]);
          return resolvePlanBadgeIdentity({
            status: sub?.status ?? usage.subscriptionStatus,
            effectiveStatus: usage.effectiveStatus,
            reason: usage.isTrialExpired ? "trial_expired" : undefined,
            plan: sub?.plan ?? usage.plan,
            slug: sub?.billingPlan?.slug ?? entitlements.planSlug,
            isFree: sub?.billingPlan?.isFree ?? entitlements.planSlug === "free",
            planName: sub?.billingPlan?.name ?? entitlements.planName,
            cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
            currentPeriodEnd: sub?.currentPeriodEnd ?? usage.periodEndsAt,
          });
        })().catch(() => null)
      : Promise.resolve(null),
  ]);

  const companyName = company?.name?.trim() || t.yourCompany;
  const companyHref = companyProfileEnabled ? "/company" : "/upgrade";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 min-w-0 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
            {t.decisionWorkspace}
          </p>
          <p className="truncate text-xs text-muted">{t.tagline}</p>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2.5">
          <LanguageSwitcher
            current={locale as Locale}
            label={langLabel}
            variant="header"
          />

          {showUpgrade ? (
            <Link
              href="/upgrade"
              className="hidden h-9 shrink-0 items-center rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-background sm:inline-flex"
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
            className="group flex min-w-0 max-w-[9.5rem] items-center gap-1.5 rounded-xl border border-border bg-card py-1 pe-2 ps-1 transition hover:border-primary/25 hover:shadow-[var(--shadow-soft)] sm:max-w-[18rem] sm:gap-2.5 sm:pe-3"
            title={companyName}
          >
            <CompanyAvatar
              size={32}
              className="rounded-[10px]"
              src={auth?.user.avatarUrl}
              alt={auth?.user.name ?? ""}
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
                {auth?.user.name ?? t.workspace}
              </span>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
