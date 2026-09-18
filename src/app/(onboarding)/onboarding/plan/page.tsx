import { PayPalActivate } from "@/components/billing/paypal-activate";
import { StripeActivate } from "@/components/billing/stripe-activate";
import { OnboardingPlanPicker } from "@/components/onboarding/plan-picker";
import { markOnboardingDoneIfSubscribed } from "@/services/auth/onboarding-complete";
import { resolveAuthContext } from "@/auth/session";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { listPublicPricingPlans } from "@/services/billing/catalog";
import { getBillingGatewaySettings } from "@/services/billing/settings";
import { getTurnstilePublicConfig } from "@/services/security/turnstile";
import { redirect } from "next/navigation";

export default async function OnboardingPlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await resolveAuthContext();
  if (!auth) redirect("/login");
  if (auth.user.onboardingStep === "VERIFY_EMAIL") redirect("/onboarding/verify");
  if (auth.user.onboardingStep === "COMPANY" || !auth.user.companyId) {
    redirect("/onboarding/company");
  }
  if (auth.user.onboardingStep === "DONE") redirect("/dashboard");

  const sp = await searchParams;
  if (sp.checkout === "success" && auth.user.companyId) {
    await markOnboardingDoneIfSubscribed(auth.user.companyId, auth.user.id);
    const refreshed = await resolveAuthContext();
    if (refreshed?.user.onboardingStep === "DONE") {
      redirect("/dashboard");
    }
  }

  const locale = await getLocale();
  const [plans, billing] = await Promise.all([
    listPublicPricingPlans(locale),
    getBillingGatewaySettings(),
  ]);
  const t = getDictionary(locale).app.onboarding;

  const paypalReturn = sp.paypal === "1";
  const stripeReturn = sp.stripe === "1";
  const subscriptionId =
    typeof sp.subscription_id === "string" ? sp.subscription_id : null;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;
  const planId = typeof sp.planId === "string" ? sp.planId : "";
  const interval =
    sp.interval === "YEAR" || sp.interval === "MONTH" ? sp.interval : "MONTH";

  return (
    <div className="space-y-4">
      {sp.canceled ? (
        <p className="text-center text-sm text-muted">{t.checkoutCanceled}</p>
      ) : null}
      {sp.checkout === "success" ? (
        <p className="text-center text-sm text-muted">{t.checkoutPending}</p>
      ) : null}
      {paypalReturn ? (
        <p className="text-center text-sm text-muted">
          Confirming PayPal subscription — access unlocks after server verification.
        </p>
      ) : null}
      {stripeReturn ? (
        <p className="text-center text-sm text-muted">
          Confirming Stripe payment — access unlocks after server verification.
        </p>
      ) : null}
      <OnboardingPlanPicker
        plans={plans}
        defaultGateway={billing.defaultGateway}
        turnstileSiteKey={getTurnstilePublicConfig().siteKey}
        copy={{
          title: t.planTitle,
          body: t.planBody,
          trialTitle: t.trialTitle,
          trialBody: t.trialBody,
          trialCta: t.trialCta,
          paidCta: t.paidCta,
          freeTitle: t.freeTitle,
          freeBody: t.freeBody,
          freeCta: t.freeCta,
          noChargeToday: t.noChargeToday,
          paymentMethodRequired: t.paymentMethodRequired,
          cancelBeforeTrial: t.cancelBeforeTrial,
          monthly: t.monthly,
          yearly: t.yearly,
        }}
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
