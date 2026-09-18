import type { CompanyStatus } from "@prisma/client";
import { AppError, ErrorCode } from "@/lib/errors";

export function isCompanySuspended(status: CompanyStatus | null | undefined): boolean {
  return status === "SUSPENDED";
}

/** Fail closed for normal app access when the tenant is suspended. */
export function assertCompanyActiveForAppAccess(
  status: CompanyStatus | null | undefined,
): void {
  if (isCompanySuspended(status)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "This company account is suspended. Contact support if you need access.",
      403,
    );
  }
}
