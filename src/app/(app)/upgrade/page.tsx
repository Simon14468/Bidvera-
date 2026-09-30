export const dynamic = "force-dynamic";

import { requireCompanyId } from "@/auth/session";
import { PayPalActivate } from "@/components/billing/paypal-activate";
import { StripeActivate } from "@/components/billing/stripe-activate";
import { Paywall } from "@/components/billing/paywall";
import { Alert } from "@/components/ui/alert";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import { listPublicCheckoutPlans } from "@/services/billing/catalog";
import { getBillingGatewaySettings } from "@/services/billing/settings";
import { getEffectiveLimits } from "@/services/plans/effective";
import { getTurnstilePublicConfig } from "@/services/security/turnstile";
import { trackEvent } from "@/services/observability";
import { recordUsage } from "@/services/usage";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function UpgradePage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const { auth, companyId } = await requireCompanyId();
  const params = await searchParams;
  const [plans, settings, limits] = await Promise.all([
    listPublicCheckoutPlans(locale),
    getBillingGatewaySettings(),
    getEffectiveLimits(companyId).catch(() => null),
  ]);

  const hasActivePaidPlan = Boolean(
    limits &&
      limits.planSlug !== "free" &&
      limits.planSlug !== "trial" &&
      limits.monthlyPriceCents > 0,
  );

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
        <Alert variant="warning" title="Free Workspace period ended">
          Your 14-day Free Workspace access has ended. Choose a paid plan below to continue. Payment is required.
        </Alert>
      ) : params.reason === "credits_exhausted" ? (
        <Alert variant="warning" title="Plan limit reached">
          You have reached a limit on your current plan. Upgrade to continue.
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
        locale={locale}
        pricingLabels={dict.pricing}
        turnstileSiteKey={getTurnstilePublicConfig().siteKey}
        currentPlanId={limits?.planId ?? null}
        currentPlanSlug={limits?.planSlug ?? null}
        currentMonthlyPriceCents={limits?.monthlyPriceCents ?? null}
        hasActivePaidPlan={hasActivePaidPlan}
      />
      {paypalReturn && subscriptionId ? (
        <PayPalActivate
          subscriptionId={subscriptionId}
          planId={planId}
          interval={interval}
          redirectTo="/dashboard"
        />
      ) : null}
      {stripeReturn && sessionId ? (
        <StripeActivate sessionId={sessionId} redirectTo="/dashboard" />
      ) : null}
    </div>
  );
}
