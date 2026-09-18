import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { DatabaseUnavailable } from "@/components/system/database-unavailable";
import { resolveAuthContext } from "@/auth/session";
import { onboardingPathForStep } from "@/auth/onboarding";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { isDatabaseTransientError } from "@/lib/db-capacity";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

const STEPS = ["VERIFY_EMAIL", "COMPANY", "PLAN"] as const;

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let auth;
  try {
    auth = await resolveAuthContext();
  } catch (error) {
    if (isDatabaseTransientError(error)) {
      return <DatabaseUnavailable />;
    }
    throw error;
  }
  if (!auth) redirect("/login");
  if (auth.user.onboardingStep === "DONE") redirect("/dashboard");

  const locale = await getLocale();
  const t = getDictionary(locale).app.onboarding;
  const current = auth.user.onboardingStep;
  const currentIdx = Math.max(
    0,
    STEPS.indexOf(current as (typeof STEPS)[number]),
  );

  return (
    <div className="relative flex min-h-full flex-col bg-[radial-gradient(ellipse_at_top,_var(--primary-muted)_0%,_var(--background)_55%)]">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-6">
        <BrandLogo href="/" height={32} />
        <div className="flex items-center gap-2">
          <p className="hidden text-sm text-muted sm:block">{auth.user.email}</p>
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t.signOutHint}
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <nav aria-label="Onboarding progress" className="mb-8">
          <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {STEPS.map((step, i) => {
              const active = i === currentIdx;
              const done = i < currentIdx;
              const href = onboardingPathForStep(step);
              const label =
                step === "VERIFY_EMAIL"
                  ? t.stepVerify
                  : step === "COMPANY"
                    ? t.stepCompany
                    : t.stepPlan;
              return (
                <li key={step} className="flex flex-1 items-center gap-2">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      active
                        ? "bg-primary text-white"
                        : done
                          ? "bg-primary/20 text-primary"
                          : "bg-border text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`text-sm ${active ? "font-semibold text-foreground" : "text-muted"}`}
                  >
                    {label}
                  </span>
                  {i < STEPS.length - 1 ? (
                    <span
                      className="mx-2 hidden h-px flex-1 bg-border sm:block"
                      aria-hidden
                    />
                  ) : null}
                  {done ? (
                    <Link href={href} className="sr-only">
                      {label}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </nav>
        {children}
      </div>
    </div>
  );
}
