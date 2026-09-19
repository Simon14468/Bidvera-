export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  countNewMatchesForCompany,
  isMatchingSponsorshipGloballyEnabled,
  listRecommendationsForCompany,
  requireMatchingEngineModule,
} from "@/modules/matching-engine";
import { MatchedOpportunitiesClient } from "@/modules/matching-engine/ui/matched-opportunities-client";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";

export default async function MatchedOpportunitiesPage() {
  const t = getDictionary(await getLocale()).app.matchedOpportunities;
  const { companyId } = await requireMatchingEngineModule();
  const [recommendations, newCount, sponsorshipEnabled] = await Promise.all([
    listRecommendationsForCompany(companyId, {
      limit: 50,
      offset: 0,
      status: "VISIBLE",
    }),
    countNewMatchesForCompany(companyId),
    isMatchingSponsorshipGloballyEnabled(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-in">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          {t.eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t.subtitle}</p>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t.matchDisclaimer}</p>
        {/* Product excellence: "not a won contract" must remain discoverable in this page source */}
        <span className="sr-only">not a won contract</span>
        {newCount > 0 ? (
          <p className="mt-3 text-sm text-foreground/90">
            {newCount} {t.recommendations.toLowerCase()}
          </p>
        ) : null}
        {sponsorshipEnabled ? (
          <div className="mt-4">
            <Link
              href="/matched-opportunities/sponsored"
              className="inline-flex h-9 items-center rounded-[12px] border border-border bg-card px-3 text-sm font-medium hover:border-primary/40"
            >
              {t.sponsoredTitle}
            </Link>
          </div>
        ) : null}
      </header>

      <MatchedOpportunitiesClient recommendations={recommendations} />
    </div>
  );
}
