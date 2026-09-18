import { hashPassword, verifyPassword, verifyPasswordAgainstKnownOrDummy } from "@/auth/password";
import {
  createAdminSession,
  destroyAdminSession,
  getAdminSessionToken,
  requestIpHash,
  requireFullSuperAdmin,
  requireSuperAdmin,
  setAdminSessionCookie,
  type SuperAdminContext,
} from "@/auth/super-admin-session";
import { adminLoginSchema, adminReauthSchema } from "@/domain/schemas/admin";
import { hashIdentifier } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { authRateLimiter } from "@/lib/rate-limit";
import { writeAdminAudit } from "@/services/admin/audit";
import { recordFailedLoginAttempt } from "@/services/auth/failed-login";
import { headers } from "next/headers";

export async function adminLoginAction(raw: unknown) {
  const data = adminLoginSchema.parse(raw);
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  await authRateLimiter.check(`sa-login:${ip}`);
  await authRateLimiter.check(
    `sa-login-email:${hashIdentifier(data.email.toLowerCase()) ?? "unknown"}`,
  );

  let admin;
  try {
    admin = await prisma.adminUser.findUnique({ where: { email: data.email.toLowerCase() } });
  } catch {
    throw new AppError(
      ErrorCode.INTERNAL,
      "Database unavailable. Super Admin login cannot complete until the database is reachable.",
      503,
    );
  }
  const passwordOk = await verifyPasswordAgainstKnownOrDummy(
    data.password,
    admin?.passwordHash,
  );
  if (!admin || !admin.active || !passwordOk) {
    await recordFailedLoginAttempt({
      email: data.email,
      ip,
      scope: "super_admin",
      adminUserId: admin?.id,
    }).catch(() => undefined);
    throw new AppError(ErrorCode.UNAUTHENTICATED, "Invalid credentials.", 401);
  }

  const ipHash = hashIdentifier(ip);
  const ua = h.get("user-agent");
  const token = await createAdminSession({
    adminUserId: admin.id,
    ipHash,
    userAgentHash: hashIdentifier(ua),
  });
  await setAdminSessionCookie(token);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });
  await writeAdminAudit({
    adminUserId: admin.id,
    action: "ADMIN_LOGIN",
    targetType: "admin_user",
    targetId: admin.id,
    ipHash,
  });

  return { email: admin.email, name: admin.name, role: admin.role };
}

export async function adminLogoutAction() {
  const token = await getAdminSessionToken();
  const ctx = await requireSuperAdmin().catch(() => null);
  if (ctx) {
    await writeAdminAudit({
      adminUserId: ctx.admin.id,
      action: "ADMIN_LOGOUT",
      targetType: "admin_user",
      targetId: ctx.admin.id,
      ipHash: await requestIpHash(),
    });
  }
  await destroyAdminSession(token);
}

/** Re-authenticate before sensitive mutations */
export async function confirmAdminPassword(
  ctx: SuperAdminContext,
  raw: unknown,
): Promise<void> {
  const data = adminReauthSchema.parse(raw);
  const admin = await prisma.adminUser.findUniqueOrThrow({
    where: { id: ctx.admin.id },
  });
  const ok = await verifyPassword(data.password, admin.passwordHash);
  if (!ok) {
    throw new AppError(ErrorCode.FORBIDDEN, "Re-authentication failed.", 403);
  }
}

export async function ensureSeedAdminUser(input: {
  email: string;
  password: string;
  name: string;
}) {
  const email = input.email.toLowerCase().trim();
  const passwordHash = await hashPassword(input.password);

  const byEmail = await prisma.adminUser.findUnique({ where: { email } });
  if (byEmail) {
    const passwordMatches = await verifyPassword(input.password, byEmail.passwordHash);
    const updated = await prisma.adminUser.update({
      where: { id: byEmail.id },
      data: {
        passwordHash,
        name: input.name,
        role: "SUPER_ADMIN",
        active: true,
      },
    });
    if (!passwordMatches) {
      await prisma.adminSession.deleteMany({ where: { adminUserId: byEmail.id } });
    }
    return updated;
  }

  // Email rotation without code changes: update the sole SUPER_ADMIN bootstrap row.
  const bootstraps = await prisma.adminUser.findMany({
    where: { role: "SUPER_ADMIN" },
    orderBy: { createdAt: "asc" },
    take: 2,
  });
  if (bootstraps.length === 1) {
    const only = bootstraps[0]!;
    const updated = await prisma.adminUser.update({
      where: { id: only.id },
      data: {
        email,
        passwordHash,
        name: input.name,
        active: true,
      },
    });
    await prisma.adminSession.deleteMany({ where: { adminUserId: only.id } });
    return updated;
  }

  // Create bootstrap AdminUser only — never promote a company User.
  return prisma.adminUser.create({
    data: {
      email,
      name: input.name,
      passwordHash,
      role: "SUPER_ADMIN",
      active: true,
    },
  });
}

/**
 * Sync Super Admin identity from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD.
 * Safe to re-run after rotating env vars on a VPS (no code change required).
 */
export async function syncSuperAdminFromEnv(
  env: Record<string, string | undefined> = process.env,
) {
  const { resolveSeedSuperAdminEmail, resolveSeedSuperAdminPassword } = await import(
    "@/application/admin/seed-super-admin-password"
  );
  const email = resolveSeedSuperAdminEmail(env);
  const password = resolveSeedSuperAdminPassword(env);
  const admin = await ensureSeedAdminUser({
    email,
    password,
    name: "Bidvera Super Admin",
  });
  return { id: admin.id, email: admin.email, role: admin.role };
}

export { requireSuperAdmin, requireFullSuperAdmin };
