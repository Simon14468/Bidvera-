/**
 * Document Compliance module access — Super Admin global kill switch + company entitlements.
 *
 * When the module is globally OFF, Super Admin enter-sessions may still access
 * so operators can enable/disable and test without exposing the product to users.
 */

import { isVerifiedSuperAdminEnterSession } from "@/auth/super-admin-enter";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { hasFeature } from "@/services/entitlements";
import {
  DOCUMENT_COMPLIANCE_FEATURE_KEY,
  DOCUMENT_COMPLIANCE_MODULE_NAME,
} from "./constants";
import { cache } from "react";

/** Request-scoped global kill-switch read. */
export const isDocumentComplianceGloballyEnabled = cache(async (): Promise<boolean> => {
  const feature = await prisma.feature.findUnique({
    where: { key: DOCUMENT_COMPLIANCE_FEATURE_KEY },
    select: { enabledGlobal: true },
  });
  return feature?.enabledGlobal ?? true;
});


export async function isSuperAdminEnterSession(): Promise<boolean> {
  return isVerifiedSuperAdminEnterSession();
}

/**
 * Whether Document Compliance is available for this company in the current session.
 * - Normal path: `hasFeature(companyId, document_compliance)` (override → global → plan).
 * - Super Admin enter-session while globally disabled: allowed for testing only.
 */
export async function isDocumentComplianceAvailable(
  companyId: string,
): Promise<boolean> {
  if (await hasFeature(companyId, DOCUMENT_COMPLIANCE_FEATURE_KEY)) return true;

  const globallyOn = await isDocumentComplianceGloballyEnabled();
  if (!globallyOn && (await isSuperAdminEnterSession())) return true;

  return false;
}

export async function assertDocumentComplianceAvailable(
  companyId: string,
): Promise<void> {
  if (await isDocumentComplianceAvailable(companyId)) return;
  throw new AppError(
    ErrorCode.FORBIDDEN,
    `${DOCUMENT_COMPLIANCE_MODULE_NAME} is not available.`,
    403,
  );
}

export async function documentComplianceUnavailableReason(
  companyId: string,
): Promise<string | null> {
  if (await isDocumentComplianceAvailable(companyId)) return null;
  if (!(await isDocumentComplianceGloballyEnabled())) {
    return `${DOCUMENT_COMPLIANCE_MODULE_NAME} is temporarily unavailable.`;
  }
  return `${DOCUMENT_COMPLIANCE_MODULE_NAME} is not available on your current plan.`;
}
