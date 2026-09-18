import { createSession } from "@/auth/session";
import { SA_ENTER_FINGERPRINT_PREFIX } from "@/auth/super-admin-enter";
import type { SuperAdminContext } from "@/auth/super-admin-session";
import { PLANS, type PlanId } from "@/config/plans";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { writeAdminAudit } from "@/services/admin/audit";
import { issuePasswordReset } from "@/services/auth/tokens";
import { analysesLimitForPlan } from "@/services/entitlements";
import { getEffectiveLimits } from "@/services/plans/effective";
import type { SubscriptionStatus } from "@prisma/client";

/**
 * Issue a secure password-reset email for a company user.
 * Never sets or returns a plaintext password.
 */
export async function adminIssueCompanyUserPasswordReset(input: {
  ctx: SuperAdminContext;
  companyId: string;
  userId: string;
  ipHash?: string | null;
}) {
  const user = await prisma.user.findFirst({
    where: { id: input.userId, companyId: input.companyId },
    select: { id: true, email: true, name: true, role: true, companyId: true },
  });
  if (!user) {
    throw new AppError(ErrorCode.NOT_FOUND, "User not found in this company.", 404);
  }

  await issuePasswordReset(user.email);

  await writeAdminAudit({
    adminUserId: input.ctx.admin.id,
    action: "COMPANY_USER_PASSWORD_RESET_ISSUED",
    targetType: "user",
    targetId: user.id,
    previousValue: undefined,
    newValue: {
      companyId: user.companyId,
      userId: user.id,
      email: user.email,
      role: user.role,
      method: "secure_reset_link",
    },
    ipHash: input.ipHash,
  });

  return {
    userId: user.id,
    email: user.email,
    message:
      "A secure password reset link was issued to the user email. No plaintext password was generated or stored.",
  };
}

/**
 * Create a normal company-user session for Super Admin support access.
 * Does not reveal or change passwords. Fully audited.
 */
export async function adminEnterCompanyAccount(input: {
  ctx: SuperAdminContext;
  companyId: string;
  ipHash?: string | null;
  userAgentHash?: string | null;
}): Promise<{ sessionToken: string; userId: string; email: string; companyName: string }> {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    include: {
      users: {
        where: { emailVerified: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true, name: true, role: true },
      },
    },
  });
  if (!company) throw new AppError(ErrorCode.NOT_FOUND, "Company not found.", 404);

  // Prefer verified users; fall back to any company member so real orgs remain enterable
  // for Super Admin support even if email verification flags are incomplete.
  let users = company.users;
  if (users.length === 0) {
    users = await prisma.user.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true },
    });
  }
  if (users.length === 0) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "This company has no users to enter as.",
      400,
    );
  }

  const preferred =
    users.find((u) => u.role === "OWNER") ??
    users.find((u) => u.role === "ADMIN") ??
    users[0]!;

  const sessionToken = await createSession({
    userId: preferred.id,
    ipHash: input.ipHash,
    userAgentHash: input.userAgentHash,
    deviceFingerprint: `${SA_ENTER_FINGERPRINT_PREFIX}${input.ctx.admin.id}`,
  });

  await writeAdminAudit({
    adminUserId: input.ctx.admin.id,
    action: "COMPANY_ACCOUNT_ENTERED",
    targetType: "company",
    targetId: company.id,
    newValue: {
      companyId: company.id,
      companySlug: company.slug,
      companyStatus: company.status,
      enteredAsUserId: preferred.id,
      enteredAsEmail: preferred.email,
      enteredAsRole: preferred.role,
    },
    ipHash: input.ipHash,
  });

  return {
    sessionToken,
    userId: preferred.id,
    email: preferred.email,
    companyName: company.name,
  };
}

/**
 * Change the company's subscription plan through the normal billing model.
 * Updates legacy enum + Plan relation + usage limit so entitlements change immediately.
 */
export async function adminSetCompanySubscriptionPlan(input: {
  ctx: SuperAdminContext;
  companyId: string;
  planId: PlanId;
  status?: SubscriptionStatus;
  ipHash?: string | null;
}) {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    include: { subscription: true, usage: true },
  });
  if (!company) throw new AppError(ErrorCode.NOT_FOUND, "Company not found.", 404);

  const cfg = PLANS[input.planId];
  if (!cfg) throw new AppError(ErrorCode.VALIDATION, "Unknown plan.", 400);

  const billingPlan = await prisma.plan.findUnique({ where: { slug: cfg.id } });
  if (!billingPlan) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Billing plan catalog missing this slug. Seed plans first.",
      400,
    );
  }

  const previous = {
    plan: company.subscription?.plan ?? null,
    planId: company.subscription?.planId ?? null,
    status: company.subscription?.status ?? null,
    analysesLimit: company.usage?.analysesLimit ?? null,
  };

  const status: SubscriptionStatus =
    input.status ?? (cfg.id === "trial" ? "TRIALING" : "ACTIVE");

  const periodStart = new Date();
  const periodEnd = new Date();
  if (status === "CANCELED" || status === "INCOMPLETE" || status === "EXPIRED") {
    periodEnd.setDate(periodEnd.getDate() - 1);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  const startedAt = company.subscription?.startedAt ?? periodStart;
  const analysesLimit = analysesLimitForPlan(
    billingPlan,
    company.subscription?.billingInterval ?? "MONTH",
  );

  const subscription = await prisma.subscription.upsert({
    where: { companyId: input.companyId },
    create: {
      companyId: input.companyId,
      plan: cfg.prismaPlan,
      planId: billingPlan.id,
      status,
      provider: "manual_admin",
      billingInterval: company.subscription?.billingInterval ?? "MONTH",
      startedAt,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      gracePeriodEndsAt: null,
      cancelAtPeriodEnd: status === "CANCELED",
      canceledAt: status === "CANCELED" ? new Date() : null,
    },
    update: {
      plan: cfg.prismaPlan,
      planId: billingPlan.id,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      gracePeriodEndsAt: null,
      cancelAtPeriodEnd: status === "CANCELED",
      canceledAt: status === "CANCELED" ? new Date() : null,
      provider: "manual_admin",
      startedAt: company.subscription?.startedAt ?? startedAt,
    },
  });

  await prisma.companyUsage.upsert({
    where: { companyId: input.companyId },
    create: {
      companyId: input.companyId,
      analysesUsed: 0,
      analysesLimit,
      periodStart,
      periodEnd,
    },
    update: {
      analysesLimit,
      analysesUsed: 0,
      periodStart,
      periodEnd,
    },
  });

  await prisma.subscriptionEvent.create({
    data: {
      companyId: input.companyId,
      subscriptionId: subscription.id,
      eventType: "ADMIN_PLAN_CHANGE",
      fromStatus: previous.status,
      toStatus: status,
      fromPlan: previous.plan,
      toPlan: cfg.prismaPlan,
      metadata: { source: "super_admin", planSlug: cfg.id },
    },
  });

  await writeAdminAudit({
    adminUserId: input.ctx.admin.id,
    action: "COMPANY_SUBSCRIPTION_PLAN_SET",
    targetType: "company",
    targetId: input.companyId,
    previousValue: previous,
    newValue: {
      plan: cfg.prismaPlan,
      planId: billingPlan.id,
      status,
      analysesLimit: cfg.analysesLimit,
    },
    ipHash: input.ipHash,
  });

  const limits = await getEffectiveLimits(input.companyId);
  return { subscription, limits };
}
