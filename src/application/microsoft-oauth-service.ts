/**
 * Microsoft OAuth account resolution + Bidvera session creation.
 * Reuses the shared OAuth account/session path (same as Google).
 */

import {
  completeOAuthLogin,
  resolveUserForOAuthClaims,
  type OAuthIdClaims,
  type OAuthLoginResult,
} from "@/application/oauth-account-service";
import {
  MICROSOFT_OAUTH_PROVIDER,
  type MicrosoftIdClaims,
} from "@/services/auth/microsoft-oauth";

export type MicrosoftOAuthLoginResult = OAuthLoginResult;

export async function resolveUserForMicrosoftClaims(
  claims: MicrosoftIdClaims,
): Promise<{ userId: string; companyId: string | null; created: boolean; onboardingStep: string }> {
  return resolveUserForOAuthClaims(MICROSOFT_OAUTH_PROVIDER, claims);
}

export async function completeMicrosoftOAuthLogin(input: {
  claims: MicrosoftIdClaims;
  nextPath?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
}): Promise<MicrosoftOAuthLoginResult> {
  return completeOAuthLogin({
    provider: MICROSOFT_OAUTH_PROVIDER,
    claims: input.claims as OAuthIdClaims,
    nextPath: input.nextPath,
    ip: input.ip,
    userAgent: input.userAgent,
    deviceFingerprint: input.deviceFingerprint,
  });
}
