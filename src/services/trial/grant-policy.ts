import { AppError, ErrorCode } from "@/lib/errors";
import { getAuthSettings } from "@/services/auth/settings";
import { getBillingGatewaySettings } from "@/services/billing/settings";
import { assertTrialAllowed, type TrialRiskResult } from "@/services/trial/risk";

function isLikelyPersonalEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return [
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "icloud.com",
    "proton.me",
    "protonmail.com",
  ].includes(domain);
}

/** Server-side trial grant gate — used on every path that auto-grants trial. */
export async function enforceTrialGrantPolicy(input: {
  risk: TrialRiskResult;
  email: string;
  companyCreatedAt: Date;
  emailVerified: boolean;
}) {
  const [billingSettings, authSettings] = await Promise.all([
    getBillingGatewaySettings(),
    getAuthSettings(),
  ]);

  if (!billingSettings.trialEnabled) {
    throw new AppError(ErrorCode.FORBIDDEN, "Trials are currently disabled.", 403);
  }

  if (input.risk.verdict === "BLOCK" && authSettings.highRiskBlockTrial) {
    assertTrialAllowed(input.risk);
  }

  if (
    input.risk.verdict === "STEP_UP" &&
    authSettings.mediumRiskRequireBusinessEmail &&
    isLikelyPersonalEmail(input.email)
  ) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Please use a business email to activate a trial.",
      403,
    );
  }

  if (
    (input.risk.verdict === "STEP_UP" || input.risk.verdict === "REVIEW") &&
    authSettings.mediumRiskTrialDelayHours > 0
  ) {
    const eligibleAt = new Date(
      input.companyCreatedAt.getTime() +
        authSettings.mediumRiskTrialDelayHours * 60 * 60 * 1000,
    );
    if (eligibleAt > new Date()) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        `Trial activation is delayed for risk review until ${eligibleAt.toISOString()}.`,
        403,
      );
    }
  }
}
