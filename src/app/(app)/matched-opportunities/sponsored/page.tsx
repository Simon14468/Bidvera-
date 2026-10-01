export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  isMatchingSponsorshipGloballyEnabled,
  listActiveSponsoredMatchingPlansForCompany,
  listEnabledSponsorshipGateways,
  markSponsorshipRequestPaid,
  requireMatchingEngineModule,
  verifySponsorshipPayPalPayment,
  verifySponsorshipStripePayment,
} from "@/modules/matching-engine";
import { SponsoredMatchingRequestClient } from "@/modules/matching-engine/ui/sponsored-matching-request-client";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";

/**
 * Explicit Sponsored Matching request + checkout flow.
 * Pricing is shown only here — not on organic Matched Opportunities cards.
 * Payment uses Super Admin Payments credentials (Stripe / PayPal).
 */
export default async function SponsoredMatchingRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale).app.matchedOpportunities;
  const { companyId } = await requireMatchingEngineModule();
  const sponsorshipEnabled = await isMatchingSponsorshipGloballyEnabled();
  const params = await searchParams;

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

  let paidMessage: string | null = null;
  let paidError: string | null = null;
  const paidFlag = params.paid === "1" || params.paid === "true";
  const provider = typeof params.provider === "string" ? params.provider : "";
  const sessionId =
    typeof params.session_id === "string" ? params.session_id : "";
  // PayPal return may use token=ORDER_ID
  const paypalOrderId =
    typeof params.token === "string"
      ? params.token
      : typeof params.order_id === "string"
        ? params.order_id
        : "";

  if (paidFlag && provider === "stripe" && sessionId) {
    try {
      const verified = await verifySponsorshipStripePayment({
        companyId,
        sessionId,
      });
      if (verified.paid) {
        await markSponsorshipRequestPaid({
          companyId,
          requestId: verified.requestId,
          billingRef: sessionId,
          billingStatus: "PAID:stripe",
        });
        paidMessage = t.sponsoredPaidSuccess;
      } else {
        paidError = t.sponsoredPaidPending;
      }
    } catch {
      paidError = t.sponsoredPaidError;
    }
  } else if (paidFlag && provider === "paypal" && paypalOrderId) {
    try {
      const verified = await verifySponsorshipPayPalPayment({
        companyId,
        orderId: paypalOrderId,
      });
      if (verified.paid) {
        await markSponsorshipRequestPaid({
          companyId,
          requestId: verified.requestId,
          billingRef: paypalOrderId,
          billingStatus: "PAID:paypal",
        });
        paidMessage = t.sponsoredPaidSuccess;
      } else {
        paidError = t.sponsoredPaidPending;
      }
    } catch {
      paidError = t.sponsoredPaidError;
    }
  } else if (params.cancelled === "1") {
    paidError = t.sponsoredCheckoutCancelled;
  }

  const [plans, gateways] = await Promise.all([
    listActiveSponsoredMatchingPlansForCompany(companyId),
    listEnabledSponsorshipGateways(),
  ]);

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

      {paidMessage ? (
        <p className="rounded-[12px] border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
          {paidMessage}
        </p>
      ) : null}
      {paidError ? (
        <p className="rounded-[12px] border border-border bg-card px-4 py-3 text-sm text-muted">
          {paidError}
        </p>
      ) : null}

      <SponsoredMatchingRequestClient
        plans={plans}
        gateways={gateways}
        locale={locale}
        copy={{
          sponsoredNoPlansTitle: t.sponsoredNoPlansTitle,
          sponsoredNoPlansBody: t.sponsoredNoPlansBody,
          sponsoredPeriodOneTime: t.sponsoredPeriodOneTime,
          sponsoredPeriodThreeDays: t.sponsoredPeriodThreeDays,
          sponsoredPeriodMonthly: t.sponsoredPeriodMonthly,
          sponsoredPeriodQuarterly: t.sponsoredPeriodQuarterly,
          sponsoredPeriodYearly: t.sponsoredPeriodYearly,
          sponsoredCampaignDays: t.sponsoredCampaignDays,
          sponsoredCampaignDurationAdmin: t.sponsoredCampaignDurationAdmin,
          sponsoredUpToCampaigns: t.sponsoredUpToCampaigns,
          sponsoredUpToImpressions: t.sponsoredUpToImpressions,
          sponsoredConfirmTitle: t.sponsoredConfirmTitle,
          sponsoredConfirmBody: t.sponsoredConfirmBody,
          sponsoredPlanLabel: t.sponsoredPlanLabel,
          sponsoredPriceLabel: t.sponsoredPriceLabel,
          sponsoredDurationLabel: t.sponsoredDurationLabel,
          sponsoredDays: t.sponsoredDays,
          sponsoredAsConfigured: t.sponsoredAsConfigured,
          sponsoredCampaignsCount: t.sponsoredCampaignsCount,
          sponsoredDefaultBenefit1: t.sponsoredDefaultBenefit1,
          sponsoredDefaultBenefit2: t.sponsoredDefaultBenefit2,
          sponsoredDefaultBenefit3: t.sponsoredDefaultBenefit3,
          sponsoredBenefitPriority: t.sponsoredBenefitPriority,
          sponsoredBenefitNoBypass: t.sponsoredBenefitNoBypass,
          sponsoredSubmit: t.sponsoredSubmit,
          sponsoredSubmitSuccess: t.sponsoredSubmitSuccess,
          sponsoredSubmitError: t.sponsoredSubmitError,
          sponsoredPayWithStripe: t.sponsoredPayWithStripe,
          sponsoredPayWithPayPal: t.sponsoredPayWithPayPal,
          sponsoredGatewayLabel: t.sponsoredGatewayLabel,
          sponsoredRedirecting: t.sponsoredRedirecting,
          sponsoredNoGateways: t.sponsoredNoGateways,
        }}
      />
    </div>
  );
}
