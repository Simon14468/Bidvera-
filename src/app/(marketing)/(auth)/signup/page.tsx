import { AuthForm } from "@/components/auth/auth-form";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { DatabaseUnavailable } from "@/components/system/database-unavailable";
import { resolveAuthContext } from "@/auth/session";
import { onboardingPathForStep } from "@/auth/onboarding";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { isDatabaseTransientError } from "@/lib/db-capacity";
import { getAuthSettings } from "@/services/auth/settings";
import { getTurnstilePublicConfig } from "@/services/security/turnstile";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function SignupPage() {
  let auth;
  try {
    auth = await resolveAuthContext();
  } catch (error) {
    if (isDatabaseTransientError(error)) {
      return <DatabaseUnavailable />;
    }
    throw error;
  }
  if (auth) {
    redirect(onboardingPathForStep(auth.user.onboardingStep));
  }

  const t = getDictionary(await getLocale());
  let settings;
  try {
    settings = await getAuthSettings();
  } catch (error) {
    if (isDatabaseTransientError(error)) {
      return <DatabaseUnavailable />;
    }
    throw error;
  }

  if (!settings.registrationEnabled) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12 text-center text-sm text-muted">
        Registration is temporarily disabled. Please check back later or sign in.
      </div>
    );
  }

  return (
    <AuthSplitShell headline={t.auth.sideHeadline} body={t.auth.sideBody}>
      <Suspense>
        <AuthForm
          mode="signup"
          googleEnabled={settings.googleEnabled}
          microsoftEnabled={settings.microsoftEnabled}
          turnstileSiteKey={getTurnstilePublicConfig().siteKey}
          labels={{ ...t.auth, signIn: t.nav.signIn, startFree: t.nav.startFree }}
        />
      </Suspense>
    </AuthSplitShell>
  );
}
