import { isVerifiedSuperAdminEnterSession } from "@/auth/super-admin-enter";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { hasFeature } from "@/services/entitlements";
import {
  CLIENT_REQUESTS_FEATURE_KEY,
  CLIENT_REQUESTS_MODULE_NAME,
} from "./constants";

export async function isClientRequestsGloballyEnabled(): Promise<boolean> {
  const feature = await prisma.feature.findUnique({
    where: { key: CLIENT_REQUESTS_FEATURE_KEY },
    select: { enabledGlobal: true },
  });
  return feature?.enabledGlobal ?? true;
}

export async function isSuperAdminEnterSession(): Promise<boolean> {
  return isVerifiedSuperAdminEnterSession();
}

export async function isClientRequestsAvailable(companyId: string): Promise<boolean> {
  if (await hasFeature(companyId, CLIENT_REQUESTS_FEATURE_KEY)) return true;
  const globallyOn = await isClientRequestsGloballyEnabled();
  if (!globallyOn && (await isSuperAdminEnterSession())) return true;
  return false;
}

export async function assertClientRequestsAvailable(companyId: string): Promise<void> {
  if (await isClientRequestsAvailable(companyId)) return;
  throw new AppError(
    ErrorCode.FORBIDDEN,
    `${CLIENT_REQUESTS_MODULE_NAME} is not available.`,
    403,
  );
}

export async function clientRequestsUnavailableReason(
  companyId: string,
): Promise<string | null> {
  if (await isClientRequestsAvailable(companyId)) return null;
  if (!(await isClientRequestsGloballyEnabled())) {
    return `${CLIENT_REQUESTS_MODULE_NAME} is temporarily unavailable.`;
  }
  return `${CLIENT_REQUESTS_MODULE_NAME} is not available on your current plan.`;
}
