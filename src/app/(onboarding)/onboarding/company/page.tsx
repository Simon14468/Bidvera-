import { CompanyOnboardingForm } from "@/components/onboarding/company-form";
import { resolveAuthContext } from "@/auth/session";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { getTurnstilePublicConfig } from "@/services/security/turnstile";
import { redirect } from "next/navigation";

export default async function OnboardingCompanyPage() {
  const auth = await resolveAuthContext();
  if (!auth) redirect("/login");
  if (auth.user.onboardingStep === "VERIFY_EMAIL") {
    redirect("/onboarding/verify");
  }
  if (auth.user.onboardingStep === "DONE" && auth.user.companyId) {
    redirect("/dashboard");
  }
  // Legacy mid-flow users who already finished company and are on plan
  if (auth.user.onboardingStep === "PLAN" && auth.user.companyId) {
    redirect("/onboarding/plan");
  }

  const t = getDictionary(await getLocale()).app.onboarding;

  return (
    <CompanyOnboardingForm
      turnstileSiteKey={getTurnstilePublicConfig().siteKey}
      copy={{
        title: t.companyTitle,
        body: t.companyBody,
        companyName: t.companyName,
        country: t.country,
        industry: t.industry,
        companySize: t.companySize,
        services: t.services,
        servicesHint: t.servicesHint,
        experience: t.experience,
        experienceOptional: t.experienceOptional,
        privacyNote: t.privacyNote,
        companySubmit: t.companySubmit,
        companySkip: t.companySkip,
      }}
    />
  );
}
