/**
 * Access to tender analysis — company membership + role permissions.
 * Roles never alter analytical conclusions (see canonical.ts).
 */

import type { UserRole } from "@prisma/client";
import { AppError, ErrorCode } from "@/lib/errors";

/** Any company member may view the same canonical analysis. */
export function canViewTenderAnalysis(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER" || role === "VIEWER";
}

/** Upload / queue analysis — viewers are read-only. */
export function canMutateTenderAnalysis(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER";
}

export function assertCanViewTenderAnalysis(role: UserRole) {
  if (!canViewTenderAnalysis(role)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "You do not have permission to view this tender analysis.",
      403,
    );
  }
}

export function assertCanMutateTenderAnalysis(role: UserRole) {
  if (!canMutateTenderAnalysis(role)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Your role can view tender analysis but cannot upload or re-analyze.",
      403,
    );
  }
}
