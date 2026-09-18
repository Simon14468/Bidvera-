import { SUPER_ADMIN_SESSION } from "@/config/super-admin";
import { generateToken, hashToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import type { AdminRole } from "@prisma/client";
import { cookies, headers } from "next/headers";

export interface SuperAdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

export interface SuperAdminContext {
  admin: SuperAdminUser;
  sessionId: string;
}

function sessionExpiry(): Date {
  const d = new Date();
  d.setHours(d.getHours() + SUPER_ADMIN_SESSION.ttlHours);
  return d;
}

export async function createAdminSession(input: {
  adminUserId: string;
  ipHash?: string | null;
  userAgentHash?: string | null;
}): Promise<string> {
  const token = generateToken();
  await prisma.adminSession.create({
    data: {
      adminUserId: input.adminUserId,
      tokenHash: hashToken(token),
      expiresAt: sessionExpiry(),
      ipHash: input.ipHash ?? null,
      userAgentHash: input.userAgentHash ?? null,
    },
  });
  return token;
}

export async function setAdminSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SUPER_ADMIN_SESSION.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: sessionExpiry(),
  });
}

export async function clearAdminSessionCookie() {
  const jar = await cookies();
  jar.delete(SUPER_ADMIN_SESSION.cookieName);
}

export async function getAdminSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SUPER_ADMIN_SESSION.cookieName)?.value;
}

export async function destroyAdminSession(token: string | undefined) {
  if (!token) {
    await clearAdminSessionCookie();
    return;
  }
  await prisma.adminSession.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await clearAdminSessionCookie();
}

export async function resolveSuperAdminContext(): Promise<SuperAdminContext | null> {
  const token = await getAdminSessionToken();
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      adminUser: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
        },
      },
    },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    !session.adminUser.active
  ) {
    if (session) {
      await prisma.adminSession
        .update({ where: { id: session.id }, data: { revokedAt: new Date() } })
        .catch(() => undefined);
    }
    // Clear stale cookie so middleware cannot bounce login ↔ panel forever
    await clearAdminSessionCookie().catch(() => undefined);
    return null;
  }

  await prisma.adminSession
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);

  return {
    sessionId: session.id,
    admin: {
      id: session.adminUser.id,
      email: session.adminUser.email,
      name: session.adminUser.name,
      role: session.adminUser.role,
    },
  };
}

export async function requireSuperAdmin(
  minRole: AdminRole = "READ_ONLY",
): Promise<SuperAdminContext> {
  const ctx = await resolveSuperAdminContext();
  if (!ctx) {
    const { redirect } = await import("next/navigation");
    const { getSuperAdminPath } = await import("@/config/super-admin");
    redirect(`/${getSuperAdminPath()}/login`);
  }
  const adminCtx = ctx as SuperAdminContext;
  const rank: Record<AdminRole, number> = {
    READ_ONLY: 1,
    OPS: 2,
    SUPER_ADMIN: 3,
  };
  if (rank[adminCtx.admin.role] < rank[minRole]) {
    throw new AppError(ErrorCode.FORBIDDEN, "Insufficient Super Admin privileges.", 403);
  }
  return adminCtx;
}

export async function requireWritableSuperAdmin(): Promise<SuperAdminContext> {
  return requireSuperAdmin("OPS");
}

export async function requireFullSuperAdmin(): Promise<SuperAdminContext> {
  return requireSuperAdmin("SUPER_ADMIN");
}

export async function requestIpHash(): Promise<string | null> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  if (!ip) return null;
  const { hashIdentifier } = await import("@/lib/crypto");
  return hashIdentifier(ip);
}
