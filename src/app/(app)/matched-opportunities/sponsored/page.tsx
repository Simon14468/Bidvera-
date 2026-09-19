export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  isMatchingSponsorshipGloballyEnabled,
  listActiveSponsoredMatchingPlansForCompany,
  requireMatchingEngineModule,
} from "@/modules/matching-engine";
import { SponsoredMatchingRequestClient } from "@/modules/matching-engine/ui/sponsored-matching-request-client";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";

/**
 * Explicit Sponsored Matching request flow.
 * Pricing is shown only here — not on organic Matched Opportunities cards.
 * Hidden when Sponsored Matching is globally OFF.
 */
export default async function SponsoredMatchingRequestPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).app.matchedOpportunities;
  const { companyId } = await requireMatchingEngineModule();
  const sponsorshipEnabled = await isMatchingSponsorshipGloballyEnabled();

  if (!sponsorshipEnabled) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 animate-fade-in">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            {t.sponsoredEyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t.sponsoredTitle}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t.sponsoredUnavailableSubtitle}</p>
          <Link
            href="/matched-opportunities"
            className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
          >
            ← {t.backToMatched}
          </Link>
        </header>
      </div>
    );
  }

  const plans = await listActiveSponsoredMatchingPlansForCompany(companyId);

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-in">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          {t.sponsoredEyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t.sponsoredRequestTitle}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t.sponsoredRequestSubtitle}</p>
        <Link
          href="/matched-opportunities"
          className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
        >
          ← {t.backToMatched}
        </Link>
      </header>

      <SponsoredMatchingRequestClient plans={plans} />
    </div>
  );
}
