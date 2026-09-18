import { VerifyEmailPanel } from "@/components/onboarding/verify-email-panel";
import { resolveAuthContext } from "@/auth/session";
import { onboardingPathForStep } from "@/auth/onboarding";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { redirect } from "next/navigation";

export default async function OnboardingVerifyPage() {
  const auth = await resolveAuthContext();
  if (!auth) redirect("/login");
  if (auth.user.emailVerified || auth.user.onboardingStep !== "VERIFY_EMAIL") {
    redirect(onboardingPathForStep(auth.user.onboardingStep));
  }

  const t = getDictionary(await getLocale()).app.onboarding;

  return (
    <VerifyEmailPanel
      email={auth.user.email}
      copy={{
        title: t.verifyTitle,
        body: t.verifyBody,
        resend: t.resend,
        resent: t.resent,
      }}
    />
  );
}
