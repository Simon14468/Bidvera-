import { isVerifiedSuperAdminEnterSession } from "@/auth/super-admin-enter";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { hasFeature } from "@/services/entitlements";
import {
  MATCHING_ENGINE_FEATURE_KEY,
  MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY,
  MATCHING_ENGINE_MODULE_NAME,
} from "./constants";
import { matchingNonFixtureCompanyFilter } from "./fixtures";
import { getSetting, ensureDefaultSettings } from "@/services/settings";
import { cache } from "react";

/** Request-scoped — layout + matching pages share one Feature row read. */
export const isMatchingEngineGloballyEnabled = cache(async (): Promise<boolean> => {
  const feature = await prisma.feature.findUnique({
    where: { key: MATCHING_ENGINE_FEATURE_KEY },
    select: { enabledGlobal: true },
  });
  return feature?.enabledGlobal ?? false;
});


export async function isSuperAdminEnterSession(): Promise<boolean> {
  return isVerifiedSuperAdminEnterSession();
}

export async function getMatchingEngineMinEligibleCompanies(): Promise<number> {
  await ensureDefaultSettings();
  const raw = await getSetting<{ n?: number } | number>(
    MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY,
  );
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.floor(raw);
  }
  if (raw && typeof raw === "object" && typeof raw.n === "number" && raw.n >= 0) {
    return Math.floor(raw.n);
  }
  // Setting missing/corrupt — refuse to invent a business default here;
  // ensureDefaultSettings should have seeded the configured threshold.
  throw new AppError(
    ErrorCode.INTERNAL,
    `${MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY} is not configured.`,
    500,
  );
}

/**
 * Production eligible companies for activation / corpus readiness.
 * Excludes ME8C–ME8G Matching Engine test fixtures (centralized filter).
 * Threshold is read from SystemSetting — never hard-coded here.
 */
export async function countEligibleMatchingCompanies(): Promise<number> {
  return prisma.companyMatchingProfile.count({
    where: {
      eligible: true,
      company: matchingNonFixtureCompanyFilter(),
    },
  });
}

/** Raw eligible rows including fixtures — diagnostics / tests only. */
export async function countEligibleMatchingCompaniesIncludingFixtures(): Promise<number> {
  return prisma.companyMatchingProfile.count({
    where: { eligible: true },
  });
}

export async function isMatchingEngineThresholdMet(): Promise<boolean> {
  const min = await getMatchingEngineMinEligibleCompanies();
  const count = await countEligibleMatchingCompanies();
  return count >= min;
}

/**
 * Feature gate: company entitlement (global / plan / override).
 * Eligible-company threshold is advisory readiness only — not a hard access block.
 * Super Admin enter-company may bypass when the feature is OFF for testing.
 */
export async function isMatchingEngineAvailable(
  companyId: string,
): Promise<boolean> {
  if (await hasFeature(companyId, MATCHING_ENGINE_FEATURE_KEY)) return true;

  const saEnter = await isSuperAdminEnterSession();
  const globallyOn = await isMatchingEngineGloballyEnabled();
  if (!globallyOn && saEnter) return true;
  return false;
}

export async function assertMatchingEngineAvailable(
  companyId: string,
): Promise<void> {
  if (await isMatchingEngineAvailable(companyId)) return;
  throw new AppError(
    ErrorCode.FORBIDDEN,
    `${MATCHING_ENGINE_MODULE_NAME} is not available.`,
    403,
  );
}
