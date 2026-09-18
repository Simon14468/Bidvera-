import { ForgotPasswordForm } from "@/components/auth/auth-form";
import { DatabaseUnavailable } from "@/components/system/database-unavailable";
import { getAuthSettings } from "@/services/auth/settings";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { isDatabaseTransientError } from "@/lib/db-capacity";
import { getTurnstilePublicConfig } from "@/services/security/turnstile";
import { Suspense } from "react";

export default async function ForgotPasswordPage() {
  const t = getDictionary(await getLocale());
  try {
    await getAuthSettings();
  } catch (error) {
    if (isDatabaseTransientError(error)) {
      return <DatabaseUnavailable />;
    }
    throw error;
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Suspense>
        <ForgotPasswordForm
          labels={{ ...t.auth, signIn: t.nav.signIn, startFree: t.nav.startFree }}
          turnstileSiteKey={getTurnstilePublicConfig().siteKey}
        />
      </Suspense>
    </div>
  );
}
