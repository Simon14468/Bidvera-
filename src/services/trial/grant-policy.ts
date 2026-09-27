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

export type TrialGrantPolicyKind =
  | "allowed"
  | "config_unavailable"
  | "deferred"
  | "blocked";

export function resolveTrialGrantPolicy(input: {
  trialEnabled: boolean;
  highRiskBlockTrial: boolean;
  mediumRiskRequireBusinessEmail: boolean;
  mediumRiskTrialDelayHours: number;
  risk: TrialRiskResult;
  email: string;
  companyCreatedAt: Date;
  now?: Date;
}): { kind: TrialGrantPolicyKind; allow: boolean } {
  if (!input.trialEnabled) {
    return { kind: "config_unavailable", allow: false };
  }

  if (input.risk.verdict === "BLOCK" && input.highRiskBlockTrial) {
    return { kind: "blocked", allow: false };
  }

  if (
    input.risk.verdict === "STEP_UP" &&
    input.mediumRiskRequireBusinessEmail &&
    isLikelyPersonalEmail(input.email)
  ) {
    return { kind: "blocked", allow: false };
  }

  if (
    (input.risk.verdict === "STEP_UP" || input.risk.verdict === "REVIEW") &&
    input.mediumRiskTrialDelayHours > 0
  ) {
    const eligibleAt = new Date(
      input.companyCreatedAt.getTime() +
        input.mediumRiskTrialDelayHours * 60 * 60 * 1000,
    );
    if (eligibleAt > (input.now ?? new Date())) {
      return { kind: "deferred", allow: false };
    }
  }

  return { kind: "allowed", allow: true };
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

  const decision = resolveTrialGrantPolicy({
    trialEnabled: billingSettings.trialEnabled,
    highRiskBlockTrial: authSettings.highRiskBlockTrial,
    mediumRiskRequireBusinessEmail: authSettings.mediumRiskRequireBusinessEmail,
    mediumRiskTrialDelayHours: authSettings.mediumRiskTrialDelayHours,
    risk: input.risk,
    email: input.email,
    companyCreatedAt: input.companyCreatedAt,
  });

  if (decision.kind === "config_unavailable") {
    throw new AppError(ErrorCode.FORBIDDEN, "Trials are currently disabled.", 403);
  }

  if (decision.kind === "blocked" && input.risk.verdict === "BLOCK") {
    assertTrialAllowed(input.risk);
  }

  if (decision.kind === "blocked") {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Please use a business email to activate a trial.",
      403,
    );
  }

  if (decision.kind === "deferred") {
    const eligibleAt = new Date(
      input.companyCreatedAt.getTime() +
        authSettings.mediumRiskTrialDelayHours * 60 * 60 * 1000,
    );
    throw new AppError(
      ErrorCode.FORBIDDEN,
      `Trial activation is delayed for risk review until ${eligibleAt.toISOString()}.`,
      403,
    );
  }
}
