/**
 * Apple OAuth account resolution + Bidvera session creation.
 * Reuses the shared OAuth account/session path (same as Google / Microsoft).
 */

import {
  completeOAuthLogin,
  resolveUserForOAuthClaims,
  type OAuthIdClaims,
  type OAuthLoginResult,
} from "@/application/oauth-account-service";
import { APPLE_OAUTH_PROVIDER, type AppleIdClaims } from "@/services/auth/apple-oauth";

export type AppleOAuthLoginResult = OAuthLoginResult;

export async function resolveUserForAppleClaims(
  claims: AppleIdClaims,
): Promise<{ userId: string; companyId: string | null; created: boolean; onboardingStep: string }> {
  return resolveUserForOAuthClaims(APPLE_OAUTH_PROVIDER, claims);
}

export async function completeAppleOAuthLogin(input: {
  claims: AppleIdClaims;
  nextPath?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
}): Promise<AppleOAuthLoginResult> {
  return completeOAuthLogin({
    provider: APPLE_OAUTH_PROVIDER,
    claims: input.claims as OAuthIdClaims,
    nextPath: input.nextPath,
    ip: input.ip,
    userAgent: input.userAgent,
    deviceFingerprint: input.deviceFingerprint,
  });
}
