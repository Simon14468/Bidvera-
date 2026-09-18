import { isVerifiedSuperAdminEnterSession } from "@/auth/super-admin-enter";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { hasFeature } from "@/services/entitlements";
import {
  TENDER_CALENDAR_FEATURE_KEY,
  TENDER_CALENDAR_MODULE_NAME,
} from "./constants";

export async function isTenderCalendarGloballyEnabled(): Promise<boolean> {
  const feature = await prisma.feature.findUnique({
    where: { key: TENDER_CALENDAR_FEATURE_KEY },
    select: { enabledGlobal: true },
  });
  return feature?.enabledGlobal ?? true;
}

export async function isSuperAdminEnterSession(): Promise<boolean> {
  return isVerifiedSuperAdminEnterSession();
}

export async function isTenderCalendarAvailable(companyId: string): Promise<boolean> {
  if (await hasFeature(companyId, TENDER_CALENDAR_FEATURE_KEY)) return true;
  const globallyOn = await isTenderCalendarGloballyEnabled();
  if (!globallyOn && (await isSuperAdminEnterSession())) return true;
  return false;
}

export async function assertTenderCalendarAvailable(companyId: string): Promise<void> {
  if (await isTenderCalendarAvailable(companyId)) return;
  throw new AppError(
    ErrorCode.FORBIDDEN,
    `${TENDER_CALENDAR_MODULE_NAME} is not available.`,
    403,
  );
}

export async function tenderCalendarUnavailableReason(
  companyId: string,
): Promise<string | null> {
  if (await isTenderCalendarAvailable(companyId)) return null;
  if (!(await isTenderCalendarGloballyEnabled())) {
    return `${TENDER_CALENDAR_MODULE_NAME} is temporarily unavailable.`;
  }
  return `${TENDER_CALENDAR_MODULE_NAME} is not available on your current plan.`;
}
