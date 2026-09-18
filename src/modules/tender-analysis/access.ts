/**
 * Tender Analysis module access — Super Admin global kill switch + company entitlements.
 *
 * Resolution order matches platform entitlements, with one module-specific rule:
 * when the module is globally OFF, Super Admin enter-sessions may still access
 * so operators can enable/disable and test without exposing the product to users.
 */

import { isVerifiedSuperAdminEnterSession } from "@/auth/super-admin-enter";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { hasFeature } from "@/services/entitlements";
import {
  TENDER_ANALYSIS_FEATURE_KEY,
  TENDER_ANALYSIS_MODULE_NAME,
} from "./constants";

export async function isTenderAnalysisGloballyEnabled(): Promise<boolean> {
  const feature = await prisma.feature.findUnique({
    where: { key: TENDER_ANALYSIS_FEATURE_KEY },
    select: { enabledGlobal: true },
  });
  // Missing row defaults to enabled — ensureFeatureRows creates it on first hasFeature.
  return feature?.enabledGlobal ?? true;
}

export async function isSuperAdminEnterSession(): Promise<boolean> {
  return isVerifiedSuperAdminEnterSession();
}

/**
 * Whether Tender Analysis is available for this company in the current session.
 * - Normal path: `hasFeature` (company override → global → plan). Plans never sell
 *   this key (`commerciallyAvailable: false`), so normal users stay denied.
 * - Super Admin enter-company sessions: always allowed for internal testing
 *   (global ON or OFF), since plan entitlements no longer grant the module.
 */
export async function isTenderAnalysisAvailable(companyId: string): Promise<boolean> {
  if (await hasFeature(companyId, TENDER_ANALYSIS_FEATURE_KEY)) return true;

  // Internal/admin-only module — SA enter must be able to open /tenders to test.
  if (await isSuperAdminEnterSession()) return true;

  return false;
}

export async function assertTenderAnalysisAvailable(companyId: string): Promise<void> {
  if (await isTenderAnalysisAvailable(companyId)) return;
  throw new AppError(
    ErrorCode.FORBIDDEN,
    `${TENDER_ANALYSIS_MODULE_NAME} is not available.`,
    403,
  );
}

/** Human-readable block reason for upload / UI empty states. */
export async function tenderAnalysisUnavailableReason(
  companyId: string,
): Promise<string | null> {
  if (await isTenderAnalysisAvailable(companyId)) return null;
  if (!(await isTenderAnalysisGloballyEnabled())) {
    return `${TENDER_ANALYSIS_MODULE_NAME} is temporarily unavailable.`;
  }
  return `${TENDER_ANALYSIS_MODULE_NAME} is not available on your current plan.`;
}
