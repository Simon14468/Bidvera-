/**
 * Supplier Qualification access — Super Admin global kill switch + company entitlements.
 */

import { isVerifiedSuperAdminEnterSession } from "@/auth/super-admin-enter";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { hasFeature } from "@/services/entitlements";
import {
  SUPPLIER_QUALIFICATION_FEATURE_KEY,
  SUPPLIER_QUALIFICATION_MODULE_NAME,
} from "./constants";

export async function isSupplierQualificationGloballyEnabled(): Promise<boolean> {
  const feature = await prisma.feature.findUnique({
    where: { key: SUPPLIER_QUALIFICATION_FEATURE_KEY },
    select: { enabledGlobal: true },
  });
  return feature?.enabledGlobal ?? true;
}

export async function isSuperAdminEnterSession(): Promise<boolean> {
  return isVerifiedSuperAdminEnterSession();
}

export async function isSupplierQualificationAvailable(
  companyId: string,
): Promise<boolean> {
  if (await hasFeature(companyId, SUPPLIER_QUALIFICATION_FEATURE_KEY)) return true;

  const globallyOn = await isSupplierQualificationGloballyEnabled();
  if (!globallyOn && (await isSuperAdminEnterSession())) return true;

  return false;
}

export async function assertSupplierQualificationAvailable(
  companyId: string,
): Promise<void> {
  if (await isSupplierQualificationAvailable(companyId)) return;
  throw new AppError(
    ErrorCode.FORBIDDEN,
    `${SUPPLIER_QUALIFICATION_MODULE_NAME} is not available.`,
    403,
  );
}

export async function supplierQualificationUnavailableReason(
  companyId: string,
): Promise<string | null> {
  if (await isSupplierQualificationAvailable(companyId)) return null;
  if (!(await isSupplierQualificationGloballyEnabled())) {
    return `${SUPPLIER_QUALIFICATION_MODULE_NAME} is temporarily unavailable.`;
  }
  return `${SUPPLIER_QUALIFICATION_MODULE_NAME} is not available on your current plan.`;
}
