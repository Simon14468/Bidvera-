import { ResetPasswordForm } from "@/components/auth/auth-form";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { getTurnstilePublicConfig } from "@/services/security/turnstile";
import { Suspense } from "react";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = getDictionary(await getLocale());
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12 text-sm text-muted">
        Missing reset token.
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Suspense>
        <ResetPasswordForm
          token={token}
          labels={{ ...t.auth, signIn: t.nav.signIn, startFree: t.nav.startFree }}
          turnstileSiteKey={getTurnstilePublicConfig().siteKey}
        />
      </Suspense>
    </div>
  );
}
