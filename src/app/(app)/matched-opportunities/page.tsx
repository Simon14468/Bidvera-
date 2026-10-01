export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  acknowledgeMatchedOpportunityNotificationsForCompany,
  countNewMatchesForCompany,
  isMatchingSponsorshipGloballyEnabled,
  listActiveSponsoredMatchingPlansForCompany,
  listRecommendationsForCompany,
  requireMatchingEngineModule,
} from "@/modules/matching-engine";
import { MatchedOpportunitiesClient } from "@/modules/matching-engine/ui/matched-opportunities-client";
import { SponsoredMatchingIcon } from "@/modules/matching-engine/ui/sponsored-matching-icon";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { canManageCompanySettings } from "@/auth/company-settings-access";

export default async function MatchedOpportunitiesPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).app.matchedOpportunities;
  const { companyId, auth } = await requireMatchingEngineModule();
  const canRefresh = canManageCompanySettings(auth.user.role);

  // Same notifications Email sent — acknowledge when the user opens the page.
  await acknowledgeMatchedOpportunityNotificationsForCompany(companyId).catch(
    () => null,
  );

  const [recommendations, newCount, sponsorshipEnabled, sponsoredPlans] =
    await Promise.all([
      listRecommendationsForCompany(companyId, {
        limit: 50,
        offset: 0,
        status: "VISIBLE",
      }),
      countNewMatchesForCompany(companyId),
      isMatchingSponsorshipGloballyEnabled(),
      listActiveSponsoredMatchingPlansForCompany(companyId),
    ]);

  const showSponsoredCta =
    sponsorshipEnabled && sponsoredPlans.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-in">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          {t.eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t.subtitle}</p>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t.matchDisclaimer}</p>
        <span className="sr-only">not a won contract</span>
        {newCount > 0 ? (
          <p className="mt-3 text-sm text-foreground/90">
            {newCount} {t.recommendations.toLowerCase()}
          </p>
        ) : null}
        {showSponsoredCta ? (
          <div className="mt-4">
            <Link
              href="/matched-opportunities/sponsored"
              className="group inline-flex h-11 items-center gap-2.5 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm transition hover:border-cyan-500/40 hover:bg-gradient-to-r hover:from-emerald-500/10 hover:to-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SponsoredMatchingIcon className="size-5 shrink-0" />
              <span>{t.sponsoredCta}</span>
            </Link>
          </div>
        ) : null}
      </header>

      <MatchedOpportunitiesClient
        recommendations={recommendations}
        copy={t}
        canRefresh={canRefresh}
      />
    </div>
  );
}
