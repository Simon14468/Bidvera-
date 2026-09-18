export const dynamic = "force-dynamic";

import { requireCompanyId } from "@/auth/session";
import { PayPalActivate } from "@/components/billing/paypal-activate";
import { StripeActivate } from "@/components/billing/stripe-activate";
import { Paywall } from "@/components/billing/paywall";
import { Alert } from "@/components/ui/alert";
import { getLocale } from "@/i18n/get-locale";
import { getDecisionLabel } from "@/lib/labels";
import { listPublicCheckoutPlans } from "@/services/billing/catalog";
import { getBillingGatewaySettings } from "@/services/billing/settings";
import { getTurnstilePublicConfig } from "@/services/security/turnstile";
import { trackEvent } from "@/services/observability";
import { getTrialUsage, recordUsage } from "@/services/usage";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UpgradePage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const { auth, companyId } = await requireCompanyId();
  const usage = await getTrialUsage(companyId);
  const params = await searchParams;
  const [plans, settings] = await Promise.all([
    listPublicCheckoutPlans(locale),
    getBillingGatewaySettings(),
  ]);

  await recordUsage({ companyId, action: "UPGRADE_VIEWED" });
  await trackEvent({
    action: "UPGRADE_VIEWED",
    companyId,
    userId: auth.user.id,
  });

  const paypalReturn = params.paypal === "1";
  const stripeReturn = params.stripe === "1";
  const subscriptionId =
    typeof params.subscription_id === "string" ? params.subscription_id : null;
  const sessionId = typeof params.session_id === "string" ? params.session_id : null;
  const planId = typeof params.planId === "string" ? params.planId : "";
  const interval =
    params.interval === "YEAR" || params.interval === "MONTH"
      ? params.interval
      : "MONTH";

  return (
    <div className="animate-fade-in space-y-4 py-4">
      {params.canceled === "1" ? (
        <Alert variant="warning" title="Checkout cancelled">
          No charge was made. You can restart checkout whenever you are ready.
        </Alert>
      ) : null}
      {params.reason === "trial_expired" ? (
        <Alert variant="warning" title="Trial ended">
          Your free trial has ended. Choose a plan below to continue analyzing tenders.
        </Alert>
      ) : params.reason === "credits_exhausted" ? (
        <Alert variant="warning" title="Analysis limit reached">
          You have used all analyses included in your trial. Upgrade to continue.
        </Alert>
      ) : null}
      {paypalReturn ? (
        <Alert variant="info" title="Confirming PayPal subscription">
          Access unlocks only after PayPal verifies the subscription — not from the browser alone.
        </Alert>
      ) : null}
      {stripeReturn ? (
        <Alert variant="info" title="Confirming Stripe payment">
          Access unlocks only after Stripe verifies the checkout session.
        </Alert>
      ) : null}
      <Paywall
        plans={plans}
        defaultGateway={settings.defaultGateway}
        turnstileSiteKey={getTurnstilePublicConfig().siteKey}
        decisionLabels={
          locale === "ar"
            ? {
                bid: getDecisionLabel("BID", "ar"),
                review: getDecisionLabel("REVIEW", "ar"),
                noBid: getDecisionLabel("NO_BID", "ar"),
                tendersAnalyzed: "مناقصات محلّلة",
              }
            : {
                bid: "BID decisions",
                review: "REVIEW decisions",
                noBid: "NO-BID decisions",
                tendersAnalyzed: "Tenders analyzed",
              }
        }
        recap={{
          tendersAnalyzed: usage.tendersAnalyzed,
          decisionsGenerated: usage.decisionsGenerated,
          bidCount: usage.bidCount,
          reviewCount: usage.reviewCount,
          noBidCount: usage.noBidCount,
          risksDetected: usage.risksDetected,
          missingDocsDetected: usage.missingDocsDetected,
          estimatedHoursSaved: usage.estimatedHoursSaved,
        }}
      />
      {paypalReturn && subscriptionId && planId ? (
        <PayPalActivate
          subscriptionId={subscriptionId}
          planId={planId}
          interval={interval}
        />
      ) : null}
      {stripeReturn && sessionId ? <StripeActivate sessionId={sessionId} /> : null}
    </div>
  );
}
