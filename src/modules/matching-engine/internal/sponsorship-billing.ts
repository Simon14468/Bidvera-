/**
 * Billing-ready seam for Matching sponsorship (Feature 8F).
 * No real payment providers — reserved for future Stripe/PayPal integration.
 */

export type MatchingSponsorshipBillingIntent = {
  sponsorshipId: string;
  sponsorCompanyId: string;
  opportunityId: string;
  amountCents?: number | null;
  currency?: string | null;
};

export type MatchingSponsorshipBillingResult = {
  ok: boolean;
  billingRef: string | null;
  billingStatus: "NOT_REQUIRED" | "PENDING" | "READY" | "FAILED";
  message: string;
};

/**
 * Port for future billing adapters. Implementations must never charge in 8F.
 */
export interface MatchingSponsorshipBillingPort {
  prepareSponsorshipBilling(
    intent: MatchingSponsorshipBillingIntent,
  ): Promise<MatchingSponsorshipBillingResult>;
}

/** Default no-op — sponsorship can activate without payment in foundation phase. */
export class NoOpMatchingSponsorshipBilling
  implements MatchingSponsorshipBillingPort
{
  async prepareSponsorshipBilling(
    intent: MatchingSponsorshipBillingIntent,
  ): Promise<MatchingSponsorshipBillingResult> {
    return {
      ok: true,
      billingRef: intent.sponsorshipId
        ? `noop:${intent.sponsorshipId}`
        : null,
      billingStatus: "NOT_REQUIRED",
      message: "Billing not integrated — sponsorship foundation only.",
    };
  }
}

let billingPort: MatchingSponsorshipBillingPort =
  new NoOpMatchingSponsorshipBilling();

export function getMatchingSponsorshipBillingPort(): MatchingSponsorshipBillingPort {
  return billingPort;
}

/** Test/DI hook — production keeps NoOp until a real gateway is wired. */
export function setMatchingSponsorshipBillingPort(
  port: MatchingSponsorshipBillingPort,
): void {
  billingPort = port;
}
