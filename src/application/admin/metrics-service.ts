import { prisma } from "@/lib/db";
import { PLANS } from "@/config/plans";

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export async function getPlatformOverview() {
  const since30 = daysAgo(30);
  const monthStart = startOfMonth();

  const [
    totalCompanies,
    newCompanies,
    activeSubs,
    trialCompanies,
    paidEver,
    decisionGroups,
    analysesCompleted,
    analysesFailed,
    aiUsageAgg,
    aiFailed,
    pendingJobs,
    deadJobs,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { createdAt: { gte: since30 } } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "TRIALING" } }),
    prisma.subscription.count({
      where: { status: { in: ["ACTIVE", "PAST_DUE", "CANCELED"] }, plan: { not: "TRIAL" } },
    }),
    prisma.tenderDecision.groupBy({ by: ["decision"], _count: true }),
    prisma.tender.count({ where: { analysisStatus: "COMPLETED" } }),
    prisma.tender.count({ where: { analysisStatus: "FAILED" } }),
    prisma.aiUsageLog.aggregate({
      _sum: { tokensIn: true, tokensOut: true, costCentsEst: true },
      _count: true,
    }),
    prisma.aiUsageLog.count({ where: { success: false } }),
    prisma.job.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
    prisma.job.count({ where: { status: "DEAD" } }),
  ]);

  const activePaid = await prisma.subscription.findMany({
    where: { status: "ACTIVE", plan: { not: "TRIAL" } },
    include: { billingPlan: true, company: { include: { planOverride: true } } },
  });

  let mrrCents = 0;
  for (const sub of activePaid) {
    const override = sub.company.planOverride;
    if (override?.active && override.monthlyPriceCents != null) {
      mrrCents += override.monthlyPriceCents;
      continue;
    }
    if (sub.billingPlan) {
      mrrCents += sub.billingPlan.monthlyPriceCents;
      continue;
    }
    const cfg = Object.values(PLANS).find((p) => p.prismaPlan === sub.plan);
    mrrCents += cfg?.priceMonthlyCents ?? 0;
  }

  const monthRevenue = await prisma.aiUsageLog.aggregate({
    where: { createdAt: { gte: monthStart } },
    _sum: { costCentsEst: true },
  });

  // Revenue proxy: MRR * months is subscription; show MRR + recognized month
  const conversionRate =
    trialCompanies + paidEver > 0
      ? Math.round((paidEver / Math.max(trialCompanies + paidEver, 1)) * 1000) / 10
      : 0;

  const count = (d: "BID" | "REVIEW" | "NO_BID") =>
    decisionGroups.find((x) => x.decision === d)?._count ?? 0;

  return {
    totalCompanies,
    newCompanies30d: newCompanies,
    activeSubscriptions: activeSubs,
    trialCompanies,
    trialToPaidConversionPct: conversionRate,
    mrrCents,
    revenueMonthCents: mrrCents, // subscription MRR as revenue signal
    aiCostMonthCents: monthRevenue._sum.costCentsEst ?? 0,
    tenderAnalyses: analysesCompleted,
    bidCount: count("BID"),
    reviewCount: count("REVIEW"),
    noBidCount: count("NO_BID"),
    aiRequests: aiUsageAgg._count,
    aiTokens: (aiUsageAgg._sum.tokensIn ?? 0) + (aiUsageAgg._sum.tokensOut ?? 0),
    aiCostCents: aiUsageAgg._sum.costCentsEst ?? 0,
    failedAnalyses: analysesFailed,
    failedAiRequests: aiFailed,
    systemHealth: {
      pendingJobs,
      deadJobs,
      status: deadJobs > 0 ? "degraded" : pendingJobs > 50 ? "busy" : "healthy",
    },
  };
}

export async function getAiCostBreakdown() {
  const byModel = await prisma.aiUsageLog.groupBy({
    by: ["modelName", "providerKey"],
    _sum: { tokensIn: true, tokensOut: true, costCentsEst: true },
    _count: true,
  });

  const byCompany = await prisma.aiUsageLog.groupBy({
    by: ["companyId"],
    _sum: { costCentsEst: true, tokensIn: true, tokensOut: true },
    _count: true,
    orderBy: { _sum: { costCentsEst: "desc" } },
    take: 25,
  });

  const companies = await prisma.company.findMany({
    where: { id: { in: byCompany.map((c) => c.companyId).filter(Boolean) as string[] } },
    select: { id: true, name: true, subscription: { select: { plan: true } } },
  });

  const failed = await prisma.aiUsageLog.count({ where: { success: false } });

  return {
    byModel: byModel.map((m) => ({
      model: m.modelName,
      provider: m.providerKey,
      requests: m._count,
      tokensIn: m._sum.tokensIn ?? 0,
      tokensOut: m._sum.tokensOut ?? 0,
      costCents: m._sum.costCentsEst ?? 0,
    })),
    byCompany: byCompany.map((c) => {
      const co = companies.find((x) => x.id === c.companyId);
      return {
        companyId: c.companyId,
        companyName: co?.name ?? "Unknown",
        plan: co?.subscription?.plan ?? null,
        requests: c._count,
        costCents: c._sum.costCentsEst ?? 0,
        tokens: (c._sum.tokensIn ?? 0) + (c._sum.tokensOut ?? 0),
      };
    }),
    failedAiRequests: failed,
  };
}
