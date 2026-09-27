/**
 * Google OAuth account resolution + Bidvera session creation.
 * Reuses the shared OAuth account/session path (same as Microsoft).
 */

import {
  completeOAuthLogin,
  resolveUserForOAuthClaims,
  type OAuthIdClaims,
  type OAuthLoginResult,
} from "@/application/oauth-account-service";
import { GOOGLE_OAUTH_PROVIDER, type GoogleIdClaims } from "@/services/auth/google-oauth";

export type GoogleOAuthLoginResult = OAuthLoginResult;

export async function resolveUserForGoogleClaims(
  claims: GoogleIdClaims,
): Promise<{ userId: string; companyId: string | null; created: boolean; onboardingStep: string }> {
  return resolveUserForOAuthClaims(GOOGLE_OAUTH_PROVIDER, claims);
}

export async function completeGoogleOAuthLogin(input: {
  claims: GoogleIdClaims;
  nextPath?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
}): Promise<GoogleOAuthLoginResult> {
  return completeOAuthLogin({
    provider: GOOGLE_OAUTH_PROVIDER,
    claims: input.claims as OAuthIdClaims,
    nextPath: input.nextPath,
    ip: input.ip,
    userAgent: input.userAgent,
    deviceFingerprint: input.deviceFingerprint,
  });
}
