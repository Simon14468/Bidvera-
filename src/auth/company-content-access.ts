/**
 * In-tenant content mutations — same read/write split as tender analysis.
 * VIEWER may read; OWNER / ADMIN / MEMBER may mutate.
 * Report share links are OWNER / ADMIN only (public URL minting).
 */

import type { UserRole } from "@prisma/client";
import { AppError, ErrorCode } from "@/lib/errors";

export function canViewCompanyContent(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER" || role === "VIEWER";
}

export function canMutateCompanyContent(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER";
}

export function canCreateReportShare(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function assertCanViewCompanyContent(role: UserRole): void {
  if (!canViewCompanyContent(role)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "You do not have permission to view this workspace.",
      403,
    );
  }
}

export function assertCanMutateCompanyContent(role: UserRole): void {
  if (!canMutateCompanyContent(role)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Your role can view this workspace but cannot make changes.",
      403,
    );
  }
}

export function assertCanCreateReportShare(role: UserRole): void {
  if (!canCreateReportShare(role)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Only OWNER or ADMIN can create report share links.",
      403,
    );
  }
}
