import type { UserRole } from "@prisma/client";
import { AppError, ErrorCode } from "@/lib/errors";

export function canManageBilling(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function assertCanManageBilling(role: UserRole): void {
  if (!canManageBilling(role)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Only OWNER or ADMIN can manage billing.",
      403,
    );
  }
}
