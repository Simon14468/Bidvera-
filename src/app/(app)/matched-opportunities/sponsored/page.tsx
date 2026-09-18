export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  isMatchingSponsorshipGloballyEnabled,
  listActiveSponsoredMatchingPlansForCompany,
  requireMatchingEngineModule,
} from "@/modules/matching-engine";
import { SponsoredMatchingRequestClient } from "@/modules/matching-engine/ui/sponsored-matching-request-client";

/**
 * Explicit Sponsored Matching request flow.
 * Pricing is shown only here — not on organic Matched Opportunities cards.
 * Hidden when Sponsored Matching is globally OFF.
 */
export default async function SponsoredMatchingRequestPage() {
  const { companyId } = await requireMatchingEngineModule();
  const sponsorshipEnabled = await isMatchingSponsorshipGloballyEnabled();

  if (!sponsorshipEnabled) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 animate-fade-in">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            SPONSORED MATCHING
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Sponsored Matching
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Sponsored Matching is not available right now. Organic matched
            opportunities remain available when Matching Engine is enabled for
            your workspace.
          </p>
          <Link
            href="/matched-opportunities"
            className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
          >
            ← Back to matched opportunities
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
          SPONSORED MATCHING
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Request Sponsored Matching
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Choose an active plan to request sponsorship. This is a request /
          order intent only — payment is not processed here, and sponsorship
          never bypasses relevance.
        </p>
        <Link
          href="/matched-opportunities"
          className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
        >
          ← Back to matched opportunities
        </Link>
      </header>

      <SponsoredMatchingRequestClient plans={plans} />
    </div>
  );
}
