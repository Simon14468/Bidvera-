/**
 * Shared OAuth account resolution + Bidvera session creation.
 * Used by Google and Microsoft — same session cookie, same linking rules.
 */

import { assertCompanyActiveForAppAccess } from "@/auth/company-suspension";
import { onboardingPathForStep } from "@/auth/onboarding";
import { createSession } from "@/auth/session";
import { sanitizePublicDeviceFingerprint } from "@/auth/super-admin-enter";
import { prisma } from "@/lib/db";
import { hashIdentifier } from "@/lib/crypto";
import { AppError, ErrorCode } from "@/lib/errors";
import { getAuthSettings } from "@/services/auth/settings";
import { trackEvent } from "@/services/observability";
import { safeInternalPath } from "@/domain/security/safe-redirect";

export type OAuthIdClaims = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export type OAuthLoginResult = {
  sessionToken: string;
  redirectTo: string;
  created: boolean;
};

function displayName(claims: OAuthIdClaims): string {
  if (claims.name && claims.name.length > 0) return claims.name.slice(0, 120);
  const local = claims.email.split("@")[0];
  return (local && local.length > 0 ? local : "User").slice(0, 120);
}

/**
 * Resolve or create a Bidvera user for a verified OAuth identity.
 *
 * Linking rules (safe):
 * 1. Existing OAuthIdentity (provider + sub) → that user.
 * 2. Else existing User with same email → attach identity (IdP proved email).
 *    Does not overwrite passwordHash.
 * 3. Else create user if registration is enabled (OAuth-only: passwordHash null).
 */
export async function resolveUserForOAuthClaims(
  provider: string,
  claims: OAuthIdClaims,
): Promise<{
  userId: string;
  companyId: string | null;
  created: boolean;
  onboardingStep: string;
}> {
  const settings = await getAuthSettings();

  const existingIdentity = await prisma.oAuthIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider,
        providerUserId: claims.sub,
      },
    },
    include: {
      user: { select: { id: true, companyId: true, onboardingStep: true, email: true } },
    },
  });

  if (existingIdentity) {
    return {
      userId: existingIdentity.user.id,
      companyId: existingIdentity.user.companyId,
      created: false,
      onboardingStep: existingIdentity.user.onboardingStep,
    };
  }

  const emailOwner = await prisma.user.findUnique({
    where: { email: claims.email },
    select: {
      id: true,
      companyId: true,
      onboardingStep: true,
      emailVerified: true,
    },
  });

  if (emailOwner) {
    await prisma.$transaction(async (tx) => {
      await tx.oAuthIdentity.create({
        data: {
          userId: emailOwner.id,
          provider,
          providerUserId: claims.sub,
          email: claims.email,
        },
      });
      if (!emailOwner.emailVerified) {
        await tx.user.update({
          where: { id: emailOwner.id },
          data: {
            emailVerified: true,
            ...(emailOwner.onboardingStep === "VERIFY_EMAIL"
              ? { onboardingStep: "COMPANY" }
              : {}),
          },
        });
      }
    });

    const refreshed = await prisma.user.findUniqueOrThrow({
      where: { id: emailOwner.id },
      select: { id: true, companyId: true, onboardingStep: true },
    });

    return {
      userId: refreshed.id,
      companyId: refreshed.companyId,
      created: false,
      onboardingStep: refreshed.onboardingStep,
    };
  }

  if (!settings.registrationEnabled) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Registration is temporarily disabled.",
      403,
    );
  }

  const user = await prisma.user.create({
    data: {
      name: displayName(claims),
      email: claims.email,
      passwordHash: null,
      role: "OWNER",
      emailVerified: true,
      onboardingStep: "COMPANY",
      acceptedTermsAt: new Date(),
      companyId: null,
      oauthIdentities: {
        create: {
          provider,
          providerUserId: claims.sub,
          email: claims.email,
        },
      },
    },
    select: { id: true, companyId: true, onboardingStep: true },
  });

  return {
    userId: user.id,
    companyId: user.companyId,
    created: true,
    onboardingStep: user.onboardingStep,
  };
}

export async function completeOAuthLogin(input: {
  provider: string;
  claims: OAuthIdClaims;
  nextPath?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
}): Promise<OAuthLoginResult> {
  const resolved = await resolveUserForOAuthClaims(input.provider, input.claims);

  if (resolved.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: resolved.companyId },
      select: { status: true },
    });
    assertCompanyActiveForAppAccess(company?.status);
  }

  const sessionToken = await createSession({
    userId: resolved.userId,
    ipHash: hashIdentifier(input.ip),
    userAgentHash: hashIdentifier(input.userAgent),
    deviceFingerprint: sanitizePublicDeviceFingerprint(input.deviceFingerprint),
  });

  await trackEvent({
    action: resolved.created ? "SIGNUP" : "LOGIN",
    companyId: resolved.companyId,
    userId: resolved.userId,
    ipHash: hashIdentifier(input.ip),
    metadata: { provider: input.provider },
  });

  const onboardingRedirect = onboardingPathForStep(
    resolved.onboardingStep as "VERIFY_EMAIL" | "COMPANY" | "PLAN" | "DONE",
  );
  const redirectTo =
    resolved.onboardingStep === "DONE"
      ? safeInternalPath(input.nextPath, "/dashboard")
      : onboardingRedirect;

  return {
    sessionToken,
    redirectTo,
    created: resolved.created,
  };
}
