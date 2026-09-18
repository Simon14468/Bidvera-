import type { OnboardingStep } from "@prisma/client";

export function onboardingPathForStep(step: OnboardingStep): string {
  switch (step) {
    case "VERIFY_EMAIL":
      return "/onboarding/verify";
    case "COMPANY":
      return "/onboarding/company";
    case "PLAN":
      return "/onboarding/plan";
    case "DONE":
    default:
      return "/dashboard";
  }
}

export function isOnboardingPath(pathname: string): boolean {
  return (
    pathname.startsWith("/onboarding") ||
    pathname === "/verify-email" ||
    pathname === "/confirm-email-change" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  );
}
