import { logout } from "@/app/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveAuthContext } from "@/auth/session";
import { onboardingPathForStep } from "@/auth/onboarding";
import { DatabaseUnavailable } from "@/components/system/database-unavailable";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { isDatabaseTransientError } from "@/lib/db-capacity";
import { prisma } from "@/lib/db";
import { getAuthSettings } from "@/services/auth/settings";
import { getTurnstilePublicConfig } from "@/services/security/turnstile";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function signOutAndStay() {
  "use server";
  await logout();
  redirect("/login");
}

export default async function LoginPage() {
  const t = getDictionary(await getLocale());
  let auth;
  let settings;
  try {
    auth = await resolveAuthContext();
    settings = await getAuthSettings();
  } catch (error) {
    if (isDatabaseTransientError(error)) {
      return (
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <DatabaseUnavailable />
        </div>
      );
    }
    throw error;
  }

  if (auth) {
    if (auth.user.onboardingStep !== "DONE") {
      redirect(onboardingPathForStep(auth.user.onboardingStep));
    }
    let company: { name: string } | null = null;
    try {
      company = auth.user.companyId
        ? await prisma.company.findUnique({
            where: { id: auth.user.companyId },
            select: { name: true },
          })
        : null;
    } catch (error) {
      if (!isDatabaseTransientError(error)) throw error;
    }
    const companyName = company?.name?.trim() || "Your company";

    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="mx-auto w-full max-w-md shadow-[var(--shadow-lift)] animate-scale-in">
          <CardHeader className="items-center text-center">
            <BrandLogo href="/dashboard" height={40} priority={false} />
            <CardTitle className="mt-4">You&apos;re already signed in</CardTitle>
            <CardDescription>
              Signed in as <span className="font-medium text-foreground">{auth.user.email}</span>
              {" · "}
              {companyName}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-white hover:bg-primary-hover"
            >
              Go to dashboard
            </Link>
            <form action={signOutAndStay}>
              <Button type="submit" variant="outline" className="w-full">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AuthSplitShell headline={t.auth.sideHeadline} body={t.auth.sideBody}>
      <Suspense
        fallback={
          <Card className="mx-auto w-full max-w-md animate-pulse">
            <CardHeader>
              <CardTitle>{t.auth.loginTitle}</CardTitle>
              <CardDescription>{t.auth.loginBody}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-10 rounded-xl bg-border/60" />
              <div className="h-10 rounded-xl bg-border/60" />
              <div className="h-10 rounded-xl bg-primary/30" />
            </CardContent>
          </Card>
        }
      >
        <AuthForm
          mode="login"
          googleEnabled={settings.googleEnabled}
          microsoftEnabled={settings.microsoftEnabled}
          registrationEnabled={settings.registrationEnabled}
          turnstileSiteKey={getTurnstilePublicConfig().siteKey}
          labels={{ ...t.auth, signIn: t.nav.signIn, startFree: t.nav.startFree }}
        />
      </Suspense>
    </AuthSplitShell>
  );
}
