export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  countNewMatchesForCompany,
  isMatchingSponsorshipGloballyEnabled,
  listRecommendationsForCompany,
  requireMatchingEngineModule,
} from "@/modules/matching-engine";
import { MatchedOpportunitiesClient } from "@/modules/matching-engine/ui/matched-opportunities-client";

export default async function MatchedOpportunitiesPage() {
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
          MATCHED
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Matched Opportunities
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Bidvera ranks opportunities against your company profile, capabilities,
          qualifications and location. A match means a relevant opportunity was
          identified — not a won contract or guaranteed revenue.
        </p>
        {newCount > 0 ? (
          <p className="mt-3 text-sm text-foreground/90">
            {newCount} new relevant{" "}
            {newCount === 1 ? "match" : "matches"} since your last review.
          </p>
        ) : null}
        {sponsorshipEnabled ? (
          <div className="mt-4">
            <Link
              href="/matched-opportunities/sponsored"
              className="inline-flex h-9 items-center rounded-[12px] border border-border bg-card px-3 text-sm font-medium hover:border-primary/40"
            >
              Promote your company / Request Sponsored Matching
            </Link>
          </div>
        ) : null}
      </header>

      <MatchedOpportunitiesClient recommendations={recommendations} />
    </div>
  );
}
