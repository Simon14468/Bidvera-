import type { UserRole } from "@prisma/client";
import { AppError, ErrorCode } from "@/lib/errors";

export function canManageCompanySettings(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function assertCanManageCompanySettings(role: UserRole): void {
  if (!canManageCompanySettings(role)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Only OWNER or ADMIN can change company settings.",
      403,
    );
  }
}
