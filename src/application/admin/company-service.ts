import {
  companyFilterSchema,
  companyOverrideSchema,
} from "@/domain/schemas/admin";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { writeAdminAudit } from "@/services/admin/audit";
import { getEffectiveLimits } from "@/services/plans/effective";
import type { SuperAdminContext } from "@/auth/super-admin-session";
import type { Prisma } from "@prisma/client";

export async function listCompaniesForAdmin(rawFilters?: unknown) {
  const filters = companyFilterSchema.parse(rawFilters ?? {});
  const where: Prisma.CompanyWhereInput = {};

  if (filters.query) {
    where.OR = [
      { name: { contains: filters.query, mode: "insensitive" } },
      { slug: { contains: filters.query, mode: "insensitive" } },
      { domain: { contains: filters.query, mode: "insensitive" } },
      { users: { some: { email: { contains: filters.query, mode: "insensitive" } } } },
    ];
  }
  if (filters.status !== "ALL") where.status = filters.status;
  if (filters.subscriptionStatus) {
    where.subscription = { status: filters.subscriptionStatus as never };
  }
  if (filters.plan) {
    where.subscription = {
      ...(typeof where.subscription === "object" && where.subscription
        ? where.subscription
        : {}),
      plan: filters.plan as never,
    };
  }

  const companies = await prisma.company.findMany({
    where,
    include: {
      users: { select: { id: true, email: true, name: true, role: true, createdAt: true } },
      usage: true,
      subscription: { include: { billingPlan: true } },
      planOverride: true,
      _count: { select: { tenders: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // last activity from tenders/updatedAt
  return Promise.all(
    companies.map(async (c) => {
      const lastTender = await prisma.tender.findFirst({
        where: { companyId: c.id },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      });
      const limits = await getEffectiveLimits(c.id);
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        domain: c.domain,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        suspendedAt: c.suspendedAt?.toISOString() ?? null,
        usersCount: c.users.length,
        tendersCount: c._count.tenders,
        analysesUsed: c.usage?.analysesUsed ?? 0,
        analysesLimit: limits.analysesLimit,
        plan: c.subscription?.plan ?? "TRIAL",
        planName: limits.planName,
        subscriptionStatus: c.subscription?.status ?? "TRIALING",
        hasOverride: Boolean(c.planOverride?.active),
        revenueMonthlyCents: limits.monthlyPriceCents,
        lastActivity: (lastTender?.updatedAt ?? c.updatedAt).toISOString(),
      };
    }),
  );
}

export async function getCompanyDetailForAdmin(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      users: true,
      profile: true,
      usage: true,
      subscription: { include: { billingPlan: true, events: { orderBy: { createdAt: "desc" }, take: 20 } } },
      planOverride: { include: { plan: true } },
      featureOverrides: { include: { feature: true } },
      tenders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { decision: true },
      },
    },
  });
  if (!company) throw new AppError(ErrorCode.NOT_FOUND, "Company not found.", 404);
  const limits = await getEffectiveLimits(companyId);
  const aiCost = await prisma.aiUsageLog.aggregate({
    where: { companyId },
    _sum: { costCentsEst: true, tokensIn: true, tokensOut: true },
    _count: true,
  });
  return { company, limits, aiCost };
}

export async function setCompanySuspended(input: {
  ctx: SuperAdminContext;
  companyId: string;
  suspend: boolean;
  reason?: string;
  ipHash?: string | null;
}) {
  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company) throw new AppError(ErrorCode.NOT_FOUND, "Company not found.", 404);

  const updated = await prisma.company.update({
    where: { id: input.companyId },
    data: input.suspend
      ? {
          status: "SUSPENDED",
          suspendedAt: new Date(),
          suspendReason: input.reason?.slice(0, 500) ?? "Suspended by Super Admin",
        }
      : {
          status: "ACTIVE",
          suspendedAt: null,
          suspendReason: null,
        },
  });

  // Fail closed: revoke all normal company-user sessions immediately on suspend.
  // Super Admin panel uses a separate cookie; recovery can re-enter via SA enter.
  if (input.suspend) {
    await prisma.session.deleteMany({
      where: { user: { companyId: input.companyId } },
    });
  }

  await writeAdminAudit({
    adminUserId: input.ctx.admin.id,
    action: input.suspend ? "COMPANY_SUSPENDED" : "COMPANY_REACTIVATED",
    targetType: "company",
    targetId: input.companyId,
    previousValue: { status: company.status },
    newValue: { status: updated.status, reason: input.reason ?? null },
    ipHash: input.ipHash,
  });

  return updated;
}

/**
 * Permanently delete a company and cascaded tenant data.
 * Clears Restrict-child rows first so Postgres FK order cannot block the delete.
 */
export async function deleteCompanyForAdmin(input: {
  ctx: SuperAdminContext;
  companyId: string;
  /** Must match company.slug exactly (case-sensitive). */
  confirmSlug: string;
  ipHash?: string | null;
}) {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      _count: { select: { users: true, tenders: true } },
    },
  });
  if (!company) throw new AppError(ErrorCode.NOT_FOUND, "Company not found.", 404);

  if (input.confirmSlug.trim() !== company.slug) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Type the company slug exactly to confirm permanent deletion.",
      400,
    );
  }

  await prisma.$transaction(async (tx) => {
    // Restrict FKs: requests → pricing plans; documents → categories
    await tx.matchingSponsorshipPricingRequest.deleteMany({
      where: { companyId: company.id },
    });
    await tx.complianceDocument.deleteMany({ where: { companyId: company.id } });
    await tx.session.deleteMany({ where: { user: { companyId: company.id } } });
    await tx.company.delete({ where: { id: company.id } });
  });

  await writeAdminAudit({
    adminUserId: input.ctx.admin.id,
    action: "COMPANY_DELETED",
    targetType: "company",
    targetId: company.id,
    previousValue: {
      name: company.name,
      slug: company.slug,
      status: company.status,
      usersCount: company._count.users,
      tendersCount: company._count.tenders,
    },
    newValue: { deleted: true },
    ipHash: input.ipHash,
  });

  return { id: company.id, slug: company.slug, name: company.name };
}

export async function upsertCompanyPlanOverride(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = companyOverrideSchema.parse(raw);
  const previous = await prisma.companyPlanOverride.findUnique({
    where: { companyId: data.companyId },
  });

  const row = await prisma.companyPlanOverride.upsert({
    where: { companyId: data.companyId },
    create: {
      companyId: data.companyId,
      planId: data.planId ?? null,
      customName: data.customName ?? null,
      monthlyPriceCents: data.monthlyPriceCents ?? null,
      analysesLimit: data.analysesLimit ?? null,
      aiTokensLimit: data.aiTokensLimit ?? null,
      storageMbLimit: data.storageMbLimit ?? null,
      seatsLimit: data.seatsLimit ?? null,
      features: data.features,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      notes: data.notes ?? null,
      active: data.active,
    },
    update: {
      planId: data.planId ?? null,
      customName: data.customName ?? null,
      monthlyPriceCents: data.monthlyPriceCents ?? null,
      analysesLimit: data.analysesLimit ?? null,
      aiTokensLimit: data.aiTokensLimit ?? null,
      storageMbLimit: data.storageMbLimit ?? null,
      seatsLimit: data.seatsLimit ?? null,
      features: data.features,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      notes: data.notes ?? null,
      active: data.active,
    },
  });

  // Sync usage limit when override sets analysesLimit
  if (data.analysesLimit != null) {
    await prisma.companyUsage.upsert({
      where: { companyId: data.companyId },
      create: {
        companyId: data.companyId,
        analysesUsed: 0,
        analysesLimit: data.analysesLimit,
      },
      update: { analysesLimit: data.analysesLimit },
    });
  }

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "CUSTOM_PLAN_UPSERT",
    targetType: "company",
    targetId: data.companyId,
    previousValue: previous as never,
    newValue: row as never,
    ipHash,
  });

  return row;
}
