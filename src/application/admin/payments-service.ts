import { billingGatewayAdminSchema } from "@/domain/schemas/admin";
import type { SuperAdminContext } from "@/auth/super-admin-session";
import { prisma } from "@/lib/db";
import { writeAdminAudit } from "@/services/admin/audit";
import {
  getBillingGatewaySettings,
  saveBillingGatewaySettings,
  type BillingGatewaySettings,
} from "@/services/billing/settings";
import { getPaypalIntegrationStatus } from "@/services/billing/paypal";

export async function getPaymentsAdminDashboard() {
  const settings = await getBillingGatewaySettings();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    activeSubs,
    trialSubs,
    failedSubs,
    canceledSubs,
    paymentsSucceeded,
    paymentsMonth,
    byProvider,
    byPlan,
    recentPayments,
    plans,
  ] = await Promise.all([
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "TRIALING" } }),
    prisma.subscription.count({
      where: { status: { in: ["PAST_DUE", "PAYMENT_FAILED", "UNPAID"] } },
    }),
    prisma.subscription.count({ where: { status: "CANCELED" } }),
    prisma.billingPayment.aggregate({
      where: { status: "SUCCEEDED" },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.billingPayment.aggregate({
      where: { status: "SUCCEEDED", createdAt: { gte: monthStart } },
      _sum: { amountCents: true },
    }),
    prisma.billingPayment.groupBy({
      by: ["provider"],
      where: { status: "SUCCEEDED" },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.billingPayment.groupBy({
      by: ["planSlug"],
      where: { status: "SUCCEEDED" },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.billingPayment.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { company: { select: { name: true, slug: true } } },
    }),
    prisma.plan.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        visibleToPublic: true,
        isFree: true,
        monthlyPriceCents: true,
        annualPriceCents: true,
        monthlyEnabled: true,
        annualEnabled: true,
        currency: true,
        stripeEnabled: true,
        paypalEnabled: true,
        trialEligible: true,
        trialDays: true,
        stripePriceMonthly: true,
        stripePriceAnnual: true,
        paypalPlanMonthly: true,
        paypalPlanAnnual: true,
        _count: { select: { subscriptions: true } },
      },
    }),
  ]);

  const yearlyRevenue = await prisma.billingPayment.aggregate({
    where: { status: "SUCCEEDED", billingInterval: "YEAR" },
    _sum: { amountCents: true },
  });
  const monthlyRevenue = await prisma.billingPayment.aggregate({
    where: { status: "SUCCEEDED", billingInterval: "MONTH" },
    _sum: { amountCents: true },
  });

  return {
    settings,
    metrics: {
      totalRevenueCents: paymentsSucceeded._sum.amountCents ?? 0,
      monthRevenueCents: paymentsMonth._sum.amountCents ?? 0,
      paymentCount: paymentsSucceeded._count,
      activeSubscriptions: activeSubs,
      trialUsers: trialSubs,
      failedPayments: failedSubs,
      canceledSubscriptions: canceledSubs,
      revenueByGateway: byProvider.map((r) => ({
        gateway: r.provider,
        amountCents: r._sum.amountCents ?? 0,
        count: r._count,
      })),
      revenueByPlan: byPlan.map((r) => ({
        planSlug: r.planSlug ?? "unknown",
        amountCents: r._sum.amountCents ?? 0,
        count: r._count,
      })),
      monthlyCycleRevenueCents: monthlyRevenue._sum.amountCents ?? 0,
      yearlyCycleRevenueCents: yearlyRevenue._sum.amountCents ?? 0,
    },
    recentPayments,
    plans,
    paypalIntegration: getPaypalIntegrationStatus(),
  };
}

export async function updateBillingGatewaySettingsForAdmin(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = billingGatewayAdminSchema.parse(raw) as BillingGatewaySettings;
  const previous = await getBillingGatewaySettings();
  const next = await saveBillingGatewaySettings(data);
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "BILLING_GATEWAY_SETTINGS_UPDATED",
    targetType: "billing_settings",
    targetId: "billing.gateways",
    previousValue: previous,
    newValue: next,
    ipHash,
  });
  return next;
}
