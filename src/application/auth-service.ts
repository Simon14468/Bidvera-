import { hashPassword, verifyPasswordAgainstKnownOrDummy } from "@/auth/password";
import { assertCanManageBilling } from "@/auth/billing-access";
import {
  assertEligibleExistingCompanyOnboarding,
  mayAssignOwnerOnCompanyCreate,
} from "@/auth/onboarding-privilege";
import { assertCompanyActiveForAppAccess } from "@/auth/company-suspension";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionToken,
  setSessionCookie,
} from "@/auth/session";
import { sanitizePublicDeviceFingerprint } from "@/auth/super-admin-enter";
import { SESSION } from "@/config/server";
import { generateToken, hashIdentifier } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  authRateLimiter,
  authSensitiveRateLimiter,
  emailChangeConfirmRateLimiter,
  emailChangeIpRateLimiter,
  emailChangeUserRateLimiter,
} from "@/lib/rate-limit";
import {
  createAccountSchema,
  companyOnboardingSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  selectPlanSchema,
  updateAccountProfileSchema,
} from "@/domain/schemas";
import { getAuthSettings } from "@/services/auth/settings";
import {
  cancelPendingEmailChange,
  consumeEmailChangeToken,
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  getPendingEmailChange,
  issueEmailChange,
  issueEmailVerification,
  issuePasswordReset,
} from "@/services/auth/tokens";
import { billingService } from "@/services/billing";
import { getBillingGatewaySettings } from "@/services/billing/settings";
import { recordFailedLoginAttempt } from "@/services/auth/failed-login";

import { trackEvent } from "@/services/observability";
import {
  assertTrialAllowed,
  assessTrialRisk,
  persistTrialRisk,
} from "@/services/trial/risk";
import { enforceTrialGrantPolicy } from "@/services/trial/grant-policy";
import { onboardingPathForStep } from "@/auth/onboarding";
import { cookies, headers } from "next/headers";
import {
  assertLoginTurnstileIfRequired,
  assertTurnstileToken,
  extractTurnstileToken,
} from "@/services/security/turnstile";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${base || "company"}-${Math.random().toString(36).slice(2, 7)}`;
}

async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
    userAgent: h.get("user-agent"),
  };
}

export { onboardingPathForStep };

/** Enumeration-safe signup result — identical shape for new and existing emails. */
export function genericSignupSuccess(requireEmailVerification: boolean) {
  const onboardingStep = requireEmailVerification ? "VERIFY_EMAIL" : "COMPANY";
  return {
    ok: true as const,
    onboardingStep,
    redirectTo: onboardingPathForStep(onboardingStep),
  };
}

/** Create account only — no company, no trial yet. */
export async function createAccountAction(raw: unknown) {
  const data = createAccountSchema.parse(raw);
  const meta = await requestMeta();
  await authRateLimiter.check(`signup:${meta.ip ?? "unknown"}`);
  await assertTurnstileToken({
    token: data.turnstileToken,
    action: "signup",
    ip: meta.ip,
  });

  const settings = await getAuthSettings();
  if (!settings.registrationEnabled) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Registration is temporarily disabled.",
      403,
    );
  }

  const email = data.email.toLowerCase();
  const requireVerify = settings.requireEmailVerification;
  const existing = await prisma.user.findUnique({ where: { email } });

  // Equalize work for existing vs new emails (timing + Set-Cookie presence).
  // Existing path never creates a real session — opaque decoy cookie only.
  if (existing) {
    await hashPassword(data.password);
    const decoy = generateToken(32);
    const jar = await cookies();
    jar.set(SESSION.cookieName, decoy, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      expires: (() => {
        const d = new Date();
        d.setDate(d.getDate() + SESSION.ttlDays);
        return d;
      })(),
    });
    return genericSignupSuccess(requireVerify);
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: email.split("@")[0] || "User",
      email,
      passwordHash,
      role: "OWNER",
      emailVerified: !requireVerify,
      onboardingStep: requireVerify ? "VERIFY_EMAIL" : "COMPANY",
      acceptedTermsAt: new Date(),
      companyId: null,
    },
  });

  await trackEvent({
    action: "SIGNUP",
    userId: user.id,
    ipHash: hashIdentifier(meta.ip),
  });

  if (requireVerify) {
    await issueEmailVerification(user.id);
  }

  const token = await createSession({
    userId: user.id,
    ipHash: hashIdentifier(meta.ip),
    userAgentHash: hashIdentifier(meta.userAgent),
    deviceFingerprint: sanitizePublicDeviceFingerprint(data.deviceFingerprint),
  });
  await setSessionCookie(token);

  return {
    ok: true as const,
    onboardingStep: user.onboardingStep,
    redirectTo: onboardingPathForStep(user.onboardingStep),
  };
}

/** @deprecated Prefer createAccountAction — kept for gradual callers */
export async function signupAction(raw: unknown) {
  return createAccountAction(raw);
}

export async function verifyEmailAction(rawToken: string) {
  const meta = await requestMeta();
  await authSensitiveRateLimiter.check(`verify:${meta.ip ?? "unknown"}`);
  const user = await consumeEmailVerificationToken(rawToken);
  return {
    ok: true as const,
    redirectTo: onboardingPathForStep(user.onboardingStep),
  };
}

export async function resendVerificationAction() {
  const { requireAuthApi } = await import("@/auth/session");
  const auth = await requireAuthApi();
  const meta = await requestMeta();
  await authSensitiveRateLimiter.check(`resend:${auth.user.id}`);
  await authSensitiveRateLimiter.check(`resend-ip:${meta.ip ?? "unknown"}`);

  if (auth.user.emailVerified) {
    return { ok: true as const, alreadyVerified: true as const };
  }
  await issueEmailVerification(auth.user.id);
  return { ok: true as const, alreadyVerified: false as const };
}

export async function completeCompanyOnboardingAction(raw: unknown) {
  const { requireAuthApi } = await import("@/auth/session");
  const auth = await requireAuthApi();
  const data = companyOnboardingSchema.parse(raw);
  const meta = await requestMeta();
  await assertTurnstileToken({
    token: data.turnstileToken,
    action: "trial",
    ip: meta.ip,
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
  if (!user.emailVerified) {
    const settings = await getAuthSettings();
    if (settings.requireEmailVerification) {
      throw new AppError(ErrorCode.FORBIDDEN, "Verify your email first.", 403);
    }
  }

  const services = data.services.map((s) => s.trim()).filter(Boolean);
  const experienceLevel = data.experienceLevel ?? null;
  const completeness = computeOnboardingCompleteness({
    industry: data.industry,
    country: data.country,
    companySize: data.companySize,
    services,
    experienceLevel,
  });

  if (user.companyId) {
    assertEligibleExistingCompanyOnboarding(user);
    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: user.companyId! },
        data: {
          name: data.companyName,
          country: data.country,
          companySize: data.companySize,
        },
      });
      await tx.companyProfile.upsert({
        where: { companyId: user.companyId! },
        create: {
          companyId: user.companyId!,
          industry: data.industry,
          country: data.country,
          companySize: data.companySize,
          services,
          experienceLevel,
          completeness,
        },
        update: {
          industry: data.industry,
          country: data.country,
          companySize: data.companySize,
          services,
          experienceLevel,
          completeness,
        },
      });
      // Preserve existing role — never promote MEMBER/VIEWER/ADMIN → OWNER here.
      await tx.user.update({
        where: { id: user.id },
        data: { onboardingStep: "DONE" },
      });
    });
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: user.companyId! },
    });
    const risk = await assessTrialRisk({
      email: user.email,
      companyName: company.name,
      companyDomain: company.domain,
      ip: meta.ip,
      userAgent: meta.userAgent,
      deviceFingerprint: sanitizePublicDeviceFingerprint(data.deviceFingerprint),
      emailVerified: user.emailVerified,
    });
    await persistTrialRisk({
      companyId: user.companyId!,
      email: user.email,
      domain: company.domain,
      ip: meta.ip,
      deviceFingerprint: sanitizePublicDeviceFingerprint(data.deviceFingerprint),
      result: risk,
    });
    let grantTrial = true;
    try {
      await enforceTrialGrantPolicy({
        risk,
        email: user.email,
        companyCreatedAt: company.createdAt,
        emailVerified: user.emailVerified,
      });
    } catch {
      grantTrial = false;
    }
    await billingService.ensureTrialSubscription(user.companyId, { grant: grantTrial });
    const { scheduleMatchingProfileRebuild } = await import(
      "@/application/matching-rebuild"
    );
    scheduleMatchingProfileRebuild(user.companyId!);
    return { ok: true as const, redirectTo: "/dashboard" };
  }

  if (!mayAssignOwnerOnCompanyCreate(user)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Cannot assign workspace ownership in this onboarding state.",
      403,
    );
  }
  const domain = user.email.split("@")[1]?.toLowerCase() ?? null;
  const risk = await assessTrialRisk({
    email: user.email,
    companyName: data.companyName,
    companyDomain: domain,
    ip: meta.ip,
    userAgent: meta.userAgent,
    deviceFingerprint: sanitizePublicDeviceFingerprint(data.deviceFingerprint),
    emailVerified: user.emailVerified,
  });

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: data.companyName,
        slug: slugify(data.companyName),
        domain,
        country: data.country,
        companySize: data.companySize,
        profile: {
          create: {
            industry: data.industry,
            country: data.country,
            companySize: data.companySize,
            services,
            experienceLevel,
            completeness,
          },
        },
        usage: { create: {} },
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        companyId: company.id,
        role: "OWNER",
        onboardingStep: "DONE",
      },
    });

    return { company };
  });

  await persistTrialRisk({
    companyId: result.company.id,
    email: user.email,
    domain,
    ip: meta.ip,
    deviceFingerprint: sanitizePublicDeviceFingerprint(data.deviceFingerprint),
    result: risk,
  });

  let grantTrial = true;
  try {
    await enforceTrialGrantPolicy({
      risk,
      email: user.email,
      companyCreatedAt: result.company.createdAt,
      emailVerified: user.emailVerified,
    });
  } catch {
    grantTrial = false;
  }
  await billingService.ensureTrialSubscription(result.company.id, { grant: grantTrial });

  await trackEvent({
    action: "COMPANY_CREATED",
    companyId: result.company.id,
    userId: user.id,
  });
  await trackEvent({
    action: "ONBOARDING_COMPANY",
    companyId: result.company.id,
    userId: user.id,
    metadata: { experienceLevel, risk: risk.verdict, skipped: false, grantTrial },
  });

  const { scheduleMatchingProfileRebuild } = await import(
    "@/application/matching-rebuild"
  );
  scheduleMatchingProfileRebuild(result.company.id);

  return {
    ok: true as const,
    redirectTo: "/dashboard",
    trialVerdict: risk.verdict,
  };
}

/** Skip detailed company setup — still creates a workspace so Dashboard can load. */
export async function skipCompanyOnboardingAction(raw?: unknown) {
  const { requireAuthApi } = await import("@/auth/session");
  const auth = await requireAuthApi();
  const meta = await requestMeta();
  await assertTurnstileToken({
    token: extractTurnstileToken(raw),
    action: "trial",
    ip: meta.ip,
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
  if (!user.emailVerified) {
    const settings = await getAuthSettings();
    if (settings.requireEmailVerification) {
      throw new AppError(ErrorCode.FORBIDDEN, "Verify your email first.", 403);
    }
  }

  if (user.companyId) {
    assertEligibleExistingCompanyOnboarding(user);
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingStep: "DONE" },
    });
    const company = await prisma.company.findUniqueOrThrow({ where: { id: user.companyId } });
    const risk = await assessTrialRisk({
      email: user.email,
      companyName: company.name,
      companyDomain: company.domain,
      ip: meta.ip,
      userAgent: meta.userAgent,
      emailVerified: user.emailVerified,
    });
    let grantTrial = true;
    try {
      await enforceTrialGrantPolicy({
        risk,
        email: user.email,
        companyCreatedAt: company.createdAt,
        emailVerified: user.emailVerified,
      });
    } catch {
      grantTrial = false;
    }
    await billingService.ensureTrialSubscription(user.companyId, { grant: grantTrial });
    const { scheduleMatchingProfileRebuild } = await import(
      "@/application/matching-rebuild"
    );
    scheduleMatchingProfileRebuild(user.companyId);
    return { ok: true as const, redirectTo: "/dashboard" };
  }

  const fallbackName =
    (user.name?.trim() && `${user.name.trim()}'s company`) ||
    `${user.email.split("@")[0] || "My"} company`;

  const domain = user.email.split("@")[1]?.toLowerCase() ?? null;
  const risk = await assessTrialRisk({
    email: user.email,
    companyName: fallbackName,
    companyDomain: domain,
    ip: meta.ip,
    userAgent: meta.userAgent,
    emailVerified: user.emailVerified,
  });

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: fallbackName.slice(0, 160),
        slug: slugify(fallbackName),
        domain,
        profile: {
          create: {
            completeness: 0,
            services: [],
          },
        },
        usage: { create: {} },
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        companyId: company.id,
        role: "OWNER",
        onboardingStep: "DONE",
      },
    });

    return { company };
  });

  await persistTrialRisk({
    companyId: result.company.id,
    email: user.email,
    domain,
    ip: meta.ip,
    result: risk,
  });

  let grantTrial = true;
  try {
    await enforceTrialGrantPolicy({
      risk,
      email: user.email,
      companyCreatedAt: result.company.createdAt,
      emailVerified: user.emailVerified,
    });
  } catch {
    grantTrial = false;
  }
  await billingService.ensureTrialSubscription(result.company.id, { grant: grantTrial });

  await trackEvent({
    action: "COMPANY_CREATED",
    companyId: result.company.id,
    userId: user.id,
    metadata: { skipped: true },
  });
  await trackEvent({
    action: "ONBOARDING_COMPANY",
    companyId: result.company.id,
    userId: user.id,
    metadata: { skipped: true, risk: risk.verdict },
  });

  const { scheduleMatchingProfileRebuild } = await import(
    "@/application/matching-rebuild"
  );
  scheduleMatchingProfileRebuild(result.company.id);

  return { ok: true as const, redirectTo: "/dashboard" };
}

function computeOnboardingCompleteness(input: {
  industry: string | null;
  country: string | null;
  companySize: string | null;
  services: string[];
  experienceLevel: string | null;
}) {
  const checks = [
    !!input.industry,
    !!input.country,
    !!input.companySize,
    input.services.length > 0,
    !!input.experienceLevel,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export async function activateFreeOrTrialPlanAction(raw: unknown) {
  const { requireAuthApi } = await import("@/auth/session");
  const auth = await requireAuthApi();
  assertCanManageBilling(auth.user.role);
  const data = selectPlanSchema.parse(raw);
  const meta = await requestMeta();

  if (!auth.user.companyId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Complete company setup first.", 403);
  }

  const companyId = auth.user.companyId;
  const billingSettings = await getBillingGatewaySettings();
  const authSettings = await getAuthSettings();

  if (data.kind === "paid") {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Paid plans require checkout.",
      400,
    );
  }

  // Free and trial both require Turnstile (authz already gated OWNER/ADMIN).
  await assertTurnstileToken({
    token: data.turnstileToken,
    action: "trial",
    ip: meta.ip,
  });

  if (data.kind === "free") {
    const { assignFreeWorkspace } = await import(
      "@/services/billing/free-workspace"
    );
    await assignFreeWorkspace(companyId, "onboarding_free");
    await prisma.user.update({
      where: { id: auth.user.id },
      data: { onboardingStep: "DONE" },
    });
    return { ok: true as const, redirectTo: "/dashboard" };
  }

  if (!billingSettings.trialEnabled && data.kind === "trial") {
    throw new AppError(ErrorCode.FORBIDDEN, "Trials are currently disabled.", 403);
  }

  if (billingSettings.requirePaymentMethodForTrial && data.kind === "trial") {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Start a 14-day trial through Stripe checkout. A payment method is required; you will not be charged today.",
      400,
    );
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
  });

  const risk = await assessTrialRisk({
    email: user.email,
    companyName: company.name,
    companyDomain: company.domain,
    ip: meta.ip,
    userAgent: meta.userAgent,
    emailVerified: user.emailVerified,
  });

  if (risk.verdict === "BLOCK" && authSettings.highRiskBlockTrial) {
    assertTrialAllowed(risk);
  }

  if (
    risk.verdict === "STEP_UP" &&
    authSettings.mediumRiskRequireBusinessEmail &&
    isLikelyPersonalEmail(user.email)
  ) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Please use a business email to activate a trial.",
      403,
    );
  }

  if (
    (risk.verdict === "STEP_UP" || risk.verdict === "REVIEW") &&
    authSettings.mediumRiskTrialDelayHours > 0
  ) {
    const eligibleAt = new Date(
      company.createdAt.getTime() +
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

  await billingService.ensureTrialSubscription(companyId);

  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingStep: "DONE" },
  });

  await trackEvent({
    action: "ONBOARDING_PLAN",
    companyId,
    userId: user.id,
    metadata: { kind: data.kind, risk: risk.verdict },
  });

  return { ok: true as const, redirectTo: "/dashboard" };
}

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

export async function markOnboardingDoneIfSubscribed(companyId: string, userId?: string) {
  const { markOnboardingDoneIfSubscribed: mark } = await import(
    "@/services/auth/onboarding-complete"
  );
  return mark(companyId, userId);
}

export async function loginAction(raw: unknown) {
  const data = loginSchema.parse(raw);
  const meta = await requestMeta();
  const email = data.email.toLowerCase();
  const [ipPeek, emailPeek] = await Promise.all([
    authRateLimiter.peek(`login:${meta.ip ?? "unknown"}`),
    authRateLimiter.peek(`login-email:${hashIdentifier(email) ?? "unknown"}`),
  ]);
  await authRateLimiter.check(`login:${meta.ip ?? "unknown"}`);
  await authRateLimiter.check(`login-email:${hashIdentifier(email) ?? "unknown"}`);
  await assertLoginTurnstileIfRequired({
    token: data.turnstileToken,
    ip: meta.ip,
    remainingIp: ipPeek.remaining,
    remainingEmail: emailPeek.remaining,
  });

  const user = await prisma.user.findUnique({
    where: { email },
  });
  const passwordOk = await verifyPasswordAgainstKnownOrDummy(
    data.password,
    user?.passwordHash,
  );
  if (!user || !passwordOk) {
    await recordFailedLoginAttempt({
      email,
      ip: meta.ip,
      scope: "user",
    }).catch(() => undefined);
    throw new AppError(ErrorCode.UNAUTHENTICATED, "Invalid email or password.", 401);
  }

  if (user.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { status: true },
    });
    assertCompanyActiveForAppAccess(company?.status);
  }

  const token = await createSession({
    userId: user.id,
    ipHash: hashIdentifier(meta.ip),
    userAgentHash: hashIdentifier(meta.userAgent),
    deviceFingerprint: sanitizePublicDeviceFingerprint(data.deviceFingerprint),
  });
  await setSessionCookie(token);
  await trackEvent({
    action: "LOGIN",
    companyId: user.companyId,
    userId: user.id,
    ipHash: hashIdentifier(meta.ip),
  });

  return {
    ok: true as const,
    onboardingStep: user.onboardingStep,
    redirectTo: onboardingPathForStep(user.onboardingStep),
  };
}

export async function forgotPasswordAction(raw: unknown) {
  const data = forgotPasswordSchema.parse(raw);
  const meta = await requestMeta();
  await authSensitiveRateLimiter.check(`forgot:${meta.ip ?? "unknown"}`);
  await authSensitiveRateLimiter.check(`forgot-email:${data.email.toLowerCase()}`);
  await assertTurnstileToken({
    token: data.turnstileToken,
    action: "forgot-password",
    ip: meta.ip,
  });
  await issuePasswordReset(data.email);
  return { ok: true as const };
}

export async function resetPasswordAction(raw: unknown) {
  const data = resetPasswordSchema.parse(raw);
  const meta = await requestMeta();
  await authSensitiveRateLimiter.check(`reset:${meta.ip ?? "unknown"}`);
  await assertTurnstileToken({
    token: data.turnstileToken,
    action: "reset-password",
    ip: meta.ip,
  });
  const passwordHash = await hashPassword(data.password);
  await consumePasswordResetToken(data.token, passwordHash);
  await destroySession(await getSessionToken());
  return { ok: true as const };
}

export async function logoutAction() {
  const token = await getSessionToken();
  const { resolveAuthContext } = await import("@/auth/session");
  const ctx = await resolveAuthContext();
  await destroySession(token);
  if (ctx) {
    await trackEvent({
      action: "LOGOUT",
      companyId: ctx.user.companyId,
      userId: ctx.user.id,
    });
  }
  return { ok: true as const };
}

export async function revokeOtherSessionsAction() {
  const { resolveAuthContext, revokeOtherSessions } = await import("@/auth/session");
  const ctx = await resolveAuthContext();
  if (!ctx) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, "Please sign in to continue.", 401);
  }
  const revoked = await revokeOtherSessions(ctx.user.id, ctx.sessionId);
  return { ok: true as const, revoked };
}

export async function updateAccountProfileAction(raw: unknown) {
  const { requireAuthApi } = await import("@/auth/session");
  const auth = await requireAuthApi();
  const data = updateAccountProfileSchema.parse(raw);
  const meta = await requestMeta();
  const ipHash = hashIdentifier(meta.ip);

  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();

  const current = await prisma.user.findUniqueOrThrow({
    where: { id: auth.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      companyId: true,
      passwordHash: true,
    },
  });

  const emailChanging = email !== current.email.toLowerCase();

  if (emailChanging) {
    await emailChangeUserRateLimiter.check(`email-change:${auth.user.id}`);
    await emailChangeIpRateLimiter.check(`email-change-ip:${meta.ip ?? "unknown"}`);

    if (!data.currentPassword) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Enter your current password to change your email.",
        400,
      );
    }
    const passwordOk = await verifyPasswordAgainstKnownOrDummy(
      data.currentPassword,
      current.passwordHash,
    );
    if (!passwordOk) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, "Incorrect password.", 401);
    }
  } else {
    await authSensitiveRateLimiter.check(`account-profile:${auth.user.id}`);
    await authSensitiveRateLimiter.check(`account-profile-ip:${meta.ip ?? "unknown"}`);
  }

  const user = await prisma.user.update({
    where: { id: auth.user.id },
    data: { name },
    select: { id: true, name: true, email: true, companyId: true },
  });

  let emailChange:
    | { status: "unchanged" }
    | { status: "pending"; newEmail: string; expiresAt: string } = {
    status: "unchanged",
  };

  if (emailChanging) {
    const issued = await issueEmailChange(auth.user.id, email, { ipHash });
    emailChange = issued.unchanged
      ? { status: "unchanged" }
      : {
          status: "pending",
          newEmail: issued.newEmail,
          expiresAt: issued.expiresAt.toISOString(),
        };
  }

  await trackEvent({
    action: "ACCOUNT_PROFILE_UPDATED",
    companyId: user.companyId,
    userId: user.id,
    ipHash,
    metadata: { nameChanged: name !== current.name, emailChangeRequested: emailChanging },
  });

  return {
    ok: true as const,
    name: user.name,
    email: user.email,
    emailChange,
  };
}

export async function cancelEmailChangeAction() {
  const { requireAuthApi } = await import("@/auth/session");
  const auth = await requireAuthApi();
  const meta = await requestMeta();
  await emailChangeUserRateLimiter.check(`email-change-cancel:${auth.user.id}`);
  await cancelPendingEmailChange(auth.user.id, {
    companyId: auth.user.companyId,
    ipHash: hashIdentifier(meta.ip),
  });
  return { ok: true as const };
}

export async function resendEmailChangeAction() {
  const { requireAuthApi } = await import("@/auth/session");
  const auth = await requireAuthApi();
  const meta = await requestMeta();
  await emailChangeUserRateLimiter.check(`email-change:${auth.user.id}`);
  await emailChangeIpRateLimiter.check(`email-change-ip:${meta.ip ?? "unknown"}`);

  const pending = await getPendingEmailChange(auth.user.id);
  if (!pending) {
    throw new AppError(ErrorCode.VALIDATION, "No pending email change to resend.", 400);
  }

  const issued = await issueEmailChange(auth.user.id, pending.newEmail, {
    ipHash: hashIdentifier(meta.ip),
  });
  if (issued.unchanged) {
    throw new AppError(ErrorCode.VALIDATION, "No pending email change to resend.", 400);
  }
  return {
    ok: true as const,
    newEmail: issued.newEmail,
    expiresAt: issued.expiresAt.toISOString(),
  };
}

export async function confirmEmailChangeAction(rawToken: string) {
  const meta = await requestMeta();
  await emailChangeConfirmRateLimiter.check(
    `email-change-confirm:${meta.ip ?? "unknown"}`,
  );
  const user = await consumeEmailChangeToken(rawToken, {
    ipHash: hashIdentifier(meta.ip),
  });
  // Sessions were revoked in consume — clear cookie if present.
  await clearSessionCookie().catch(() => undefined);
  return {
    ok: true as const,
    email: user.email,
    redirectTo: "/login?notice=email-changed",
  };
}
