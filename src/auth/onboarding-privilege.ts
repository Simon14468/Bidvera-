import type { OnboardingStep, UserRole } from "@prisma/client";
import { AppError, ErrorCode } from "@/lib/errors";

/**
 * Existing-company onboarding must never promote MEMBER/VIEWER/ADMIN → OWNER.
 * Only the current OWNER may continue an incomplete onboarding; DONE/ambiguous → fail closed.
 */
export function assertEligibleExistingCompanyOnboarding(user: {
  companyId: string | null;
  role: UserRole;
  onboardingStep: OnboardingStep;
}): void {
  if (!user.companyId) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Existing-company onboarding requires a company.",
      400,
    );
  }
  if (user.onboardingStep === "DONE") {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Company onboarding is already complete.",
      403,
    );
  }
  if (user.onboardingStep !== "COMPANY" && user.onboardingStep !== "PLAN") {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Invalid onboarding state for company setup.",
      403,
    );
  }
  if (user.role !== "OWNER") {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Only the workspace owner can complete company onboarding.",
      403,
    );
  }
}

/** True when creating a brand-new company may assign OWNER (genuine signup onboarding). */
export function mayAssignOwnerOnCompanyCreate(user: {
  companyId: string | null;
}): boolean {
  return user.companyId == null;
}
