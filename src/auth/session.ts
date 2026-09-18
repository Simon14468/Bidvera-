import { SESSION } from "@/config/server";
import { generateToken, hashToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { rethrowDatabaseCapacityError } from "@/lib/db-capacity";
import { AppError, ErrorCode } from "@/lib/errors";
import type { OnboardingStep, UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isCompanySuspended } from "@/auth/company-suspension";
import { onboardingPathForStep } from "@/auth/onboarding";
import { isAuthorizedSaEnterFingerprint } from "@/auth/super-admin-enter";

/** Avoid a write on every RSC render — session reads already dominate Neon transfer. */
const LAST_SEEN_THROTTLE_MS = 15 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string | null;
  emailVerified: boolean;
  onboardingStep: OnboardingStep;
  /** Public profile photo path, or null for the default mark. */
  avatarUrl: string | null;
}

export interface AuthContext {
  user: SessionUser;
  sessionId: string;
}

function sessionExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + SESSION.ttlDays);
  return d;
}

export async function createSession(input: {
  userId: string;
  ipHash?: string | null;
  userAgentHash?: string | null;
  deviceFingerprint?: string | null;
}): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  try {
    await prisma.session.create({
      data: {
        userId: input.userId,
        tokenHash,
        expiresAt: sessionExpiry(),
        ipHash: input.ipHash ?? null,
        userAgentHash: input.userAgentHash ?? null,
        deviceFingerprint: input.deviceFingerprint ?? null,
      },
    });
  } catch (error) {
    rethrowDatabaseCapacityError(error);
  }
  return token;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION.cookieName, token, sessionCookieOptions());
}

/** Attach company session cookie to a Route Handler response (e.g. Enter account redirect). */
export function applySessionCookie(
  response: { cookies: { set: (name: string, value: string, options: ReturnType<typeof sessionCookieOptions>) => void } },
  token: string,
) {
  response.cookies.set(SESSION.cookieName, token, sessionCookieOptions());
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: sessionExpiry(),
  };
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION.cookieName);
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  await clearSessionCookie();
}

export async function getSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION.cookieName)?.value;
}

async function resolveAuthContextUncached(): Promise<AuthContext | null> {
  const token = await getSessionToken();
  if (!token) return null;

  let session;
  try {
    session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        expiresAt: true,
        lastSeenAt: true,
        deviceFingerprint: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            companyId: true,
            emailVerified: true,
            onboardingStep: true,
            avatarUrl: true,
            company: { select: { status: true } },
          },
        },
      },
    });
  } catch (error) {
    rethrowDatabaseCapacityError(error);
  }

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    await clearSessionCookie().catch(() => undefined);
    return null;
  }

  // Suspended tenants lose normal app sessions (fail closed). Verified Super Admin
  // enter-company sessions remain for recovery; Super Admin panel uses a separate cookie.
  if (
    session.user.companyId &&
    isCompanySuspended(session.user.company?.status)
  ) {
    const saEnter = await isAuthorizedSaEnterFingerprint(session.deviceFingerprint);
    if (!saEnter) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      await clearSessionCookie().catch(() => undefined);
      return null;
    }
  }

  if (Date.now() - session.lastSeenAt.getTime() >= LAST_SEEN_THROTTLE_MS) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => undefined);
  }

  const user = session.user;
  return {
    sessionId: session.id,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      emailVerified: user.emailVerified,
      onboardingStep: user.onboardingStep,
      avatarUrl: user.avatarUrl,
    },
  };
}

/** One DB session read per React request — nested layouts must not multiply Neon egress. */
export const resolveAuthContext = cache(resolveAuthContextUncached);

/**
 * For RSC pages: redirect to login when session is missing/expired.
 * Avoids uncaught AppError overlays in the Next.js portal.
 */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await resolveAuthContext();
  if (!ctx) {
    redirect("/login");
  }
  return ctx;
}

/** Require auth and redirect into the correct onboarding step when incomplete. */
export async function requireOnboardedAuth(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ctx.user.onboardingStep !== "DONE") {
    redirect(onboardingPathForStep(ctx.user.onboardingStep));
  }
  if (!ctx.user.companyId) {
    redirect("/onboarding/company");
  }
  return ctx;
}

/** Throw JSON-friendly 401 — use in API routes / handlers that catch AppError. */
export async function requireAuthApi(): Promise<AuthContext> {
  const ctx = await resolveAuthContext();
  if (!ctx) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, "Please sign in to continue.", 401);
  }
  return ctx;
}

/** Never trust client-supplied companyId — always use the session company. */
export async function requireCompanyId(): Promise<{ auth: AuthContext; companyId: string }> {
  const auth = await requireOnboardedAuth();
  if (!auth.user.companyId) {
    redirect("/onboarding/company");
  }
  return { auth, companyId: auth.user.companyId };
}

export async function requireCompanyIdApi(): Promise<{
  auth: AuthContext;
  companyId: string;
}> {
  const auth = await requireAuthApi();
  if (auth.user.onboardingStep !== "DONE" || !auth.user.companyId) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Complete onboarding before using the API.",
      403,
    );
  }
  return { auth, companyId: auth.user.companyId };
}

export function assertSameCompany(resourceCompanyId: string, sessionCompanyId: string) {
  if (resourceCompanyId !== sessionCompanyId) {
    throw new AppError(ErrorCode.FORBIDDEN, "You do not have access to this resource.", 403);
  }
}

/** Revoke every session for this user except the current one. */
export async function revokeOtherSessions(
  userId: string,
  currentSessionId: string,
): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      userId,
      id: { not: currentSessionId },
    },
  });
  return result.count;
}
