import { isAnalysesBlocked, isUnlimitedAnalyses } from "@/config/usage";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { trackEvent } from "@/services/observability";
import { evaluateSubscriptionAccess } from "@/services/billing/lifecycle";
import type { Prisma, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

export type AnalysisBlockReason =
  | "suspended"
  | "no_feature"
  | "trial_expired"
  | "subscription_inactive"
  | "credits_exhausted";

export interface TrialUsageSnapshot {
  analysesUsed: number;
  analysesLimit: number;
  analysesRemaining: number;
  isUnlimited: boolean;
  plan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  effectiveStatus: string;
  billingInterval: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  periodEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  inGrace: boolean;
  billingWarning: boolean;
  isTrialExpired: boolean;
  accessAllowed: boolean;
  tendersAnalyzed: number;
  decisionsGenerated: number;
  bidCount: number;
  reviewCount: number;
  noBidCount: number;
  risksDetected: number;
  missingDocsDetected: number;
  estimatedHoursSaved: number;
}

async function getUsageRow(companyId: string) {
  const [usage, subscription] = await Promise.all([
    prisma.companyUsage.findUnique({ where: { companyId } }),
    prisma.subscription.findUnique({ where: { companyId } }),
  ]);
  return { usage, subscription };
}

/**
 * Server-side gate — returns why analysis is blocked (if any).
 * Never trust client-side counters.
 */
export async function getAnalysisBlockReason(
  companyId: string,
): Promise<AnalysisBlockReason | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { status: true },
  });
  if (!company || company.status === "SUSPENDED") return "suspended";

  const { reconcileCompanySubscription } = await import(
    "@/services/billing/reconcile"
  );
  const { access } = await reconcileCompanySubscription(companyId);

  if (!access.allowed) {
    if (access.reason === "trial_expired") return "trial_expired";
    return "subscription_inactive";
  }

  const { isTenderAnalysisAvailable } = await import(
    "@/modules/tender-analysis"
  );
  if (!(await isTenderAnalysisAvailable(companyId))) return "no_feature";

  const { usage } = await getUsageRow(companyId);
  if (!usage) return "no_feature";

  // Period-aligned usage window: if periodEnd passed but access still allowed
  // (e.g. mid-reconcile), do not invent calendar-month resets.
  if (
    usage.periodEnd &&
    usage.periodEnd.getTime() < Date.now() &&
    !isUnlimitedAnalyses(usage.analysesLimit)
  ) {
    // Reconcile should have reset; if not, block rather than over-serve
    const sub = await prisma.subscription.findUnique({ where: { companyId } });
    if (
      sub?.currentPeriodStart &&
      usage.periodStart &&
      sub.currentPeriodStart.getTime() > usage.periodStart.getTime()
    ) {
      await prisma.companyUsage.update({
        where: { companyId },
        data: {
          analysesUsed: 0,
          periodStart: sub.currentPeriodStart,
          periodEnd: sub.currentPeriodEnd,
        },
      });
    }
  }

  const fresh = await prisma.companyUsage.findUnique({ where: { companyId } });
  if (!fresh) return "no_feature";

  if (isUnlimitedAnalyses(fresh.analysesLimit)) return null;
  if (isAnalysesBlocked(fresh.analysesLimit) || fresh.analysesUsed >= fresh.analysesLimit) {
    return "credits_exhausted";
  }
  return null;
}

export function analysisBlockMessage(reason: AnalysisBlockReason): string {
  switch (reason) {
    case "trial_expired":
      return "Your free trial has ended. Upgrade to continue analyzing tenders.";
    case "credits_exhausted":
      return "No analysis credits remaining. Upgrade to continue analyzing tenders.";
    case "subscription_inactive":
      return "Your subscription is inactive. Update billing to continue.";
    case "suspended":
      return "This workspace is suspended. Contact support.";
    case "no_feature":
      return "Tender analysis is not available on your current plan.";
  }
}

export async function assertCanAnalyze(companyId: string): Promise<void> {
  const reason = await getAnalysisBlockReason(companyId);
  if (!reason) return;
  const code =
    reason === "trial_expired"
      ? ErrorCode.TRIAL_EXPIRED
      : reason === "credits_exhausted"
        ? ErrorCode.TRIAL_EXHAUSTED
        : ErrorCode.FORBIDDEN;
  throw new AppError(
    code,
    analysisBlockMessage(reason),
    reason === "credits_exhausted" || reason === "trial_expired" ? 402 : 403,
  );
}

/**
 * Atomic, race-safe analysis credit consumption.
 * Unlimited accounts (limit == null) always consume without a ceiling.
 */
export async function consumeAnalysisCredit(companyId: string): Promise<void> {
  await assertCanAnalyze(companyId);

  const { usage } = await getUsageRow(companyId);
  if (!usage) {
    throw new AppError(ErrorCode.FORBIDDEN, "Company usage is not configured.", 403);
  }

  if (isUnlimitedAnalyses(usage.analysesLimit)) {
    await prisma.companyUsage.update({
      where: { companyId },
      data: { analysesUsed: { increment: 1 } },
    });
  } else {
    const updated = await prisma.$executeRaw`
      UPDATE "CompanyUsage"
      SET "analysesUsed" = "analysesUsed" + 1,
          "updatedAt" = NOW()
      WHERE "companyId" = ${companyId}
        AND "analysesUsed" < "analysesLimit"
        AND "analysesLimit" > 0
    `;

    if (updated !== 1) {
      throw new AppError(
        ErrorCode.TRIAL_EXHAUSTED,
        analysisBlockMessage("credits_exhausted"),
        402,
      );
    }
  }

  await prisma.usageRecord.create({
    data: {
      companyId,
      action: "TENDER_ANALYSIS",
      quantity: 1,
      metadata: { source: "consumeAnalysisCredit" },
    },
  });

  await trackEvent({
    action: "TRIAL_USAGE",
    companyId,
    metadata: {
      action: "TENDER_ANALYSIS",
      unlimited: isUnlimitedAnalyses(usage.analysesLimit),
    },
  });
}

/** Refund one analysis credit on system failure only (idempotent per tender). */
export async function refundAnalysisCredit(
  companyId: string,
  tenderId: string,
  reason: "system_error" | "cancelled" = "system_error",
): Promise<void> {
  const priorRefunds = await prisma.usageRecord.findMany({
    where: {
      companyId,
      action: "TENDER_ANALYSIS",
      quantity: -1,
    },
    select: { metadata: true },
    take: 50,
  });
  const alreadyRefunded = priorRefunds.some((row) => {
    const meta = row.metadata as { tenderId?: string } | null;
    return meta?.tenderId === tenderId;
  });
  if (alreadyRefunded) return;

  const usage = await prisma.companyUsage.findUnique({ where: { companyId } });
  if (!usage || usage.analysesUsed <= 0 || isUnlimitedAnalyses(usage.analysesLimit)) return;

  await prisma.companyUsage.update({
    where: { companyId },
    data: { analysesUsed: { decrement: 1 } },
  });

  await prisma.usageRecord.create({
    data: {
      companyId,
      action: "TENDER_ANALYSIS",
      quantity: -1,
      metadata: { source: "refundAnalysisCredit", tenderId, reason },
    },
  });
}

export async function canAnalyze(companyId: string): Promise<boolean> {
  return (await getAnalysisBlockReason(companyId)) === null;
}

/** Pure trial credit gate — mirrors server enforcement for tests. */
export function isAnalysisCreditsExhausted(
  analysesUsed: number,
  analysesLimit: number | null | undefined,
): boolean {
  if (isUnlimitedAnalyses(analysesLimit)) return false;
  if (isAnalysesBlocked(analysesLimit)) return true;
  return analysesUsed >= (analysesLimit as number);
}

export async function getTrialUsage(companyId: string): Promise<TrialUsageSnapshot> {
  const { reconcileCompanySubscription } = await import(
    "@/services/billing/reconcile"
  );
  const { access } = await reconcileCompanySubscription(companyId);

  const [{ usage, subscription }, decisions, decisionGroups, risks, missing, completed] =
    await Promise.all([
      getUsageRow(companyId),
      prisma.tenderDecision.count({ where: { companyId } }),
      prisma.tenderDecision.groupBy({
        by: ["decision"],
        where: { companyId },
        _count: true,
      }),
      prisma.tenderRisk.count({
        where: { tender: { companyId } },
      }),
      prisma.missingDocument.count({
        where: { tender: { companyId } },
      }),
      prisma.tender.count({
        where: { companyId, analysisStatus: "COMPLETED" },
      }),
    ]);

  const analysesUsed = usage?.analysesUsed ?? 0;
  const analysesLimit = usage?.analysesLimit ?? 3;
  const unlimited = isUnlimitedAnalyses(usage == null ? 3 : usage.analysesLimit);
  const count = (d: "BID" | "REVIEW" | "NO_BID") =>
    decisionGroups.find((x) => x.decision === d)?._count ?? 0;

  const liveAccess = subscription
    ? evaluateSubscriptionAccess(subscription)
    : access;

  return {
    analysesUsed,
    analysesLimit: unlimited ? 0 : analysesLimit,
    analysesRemaining: unlimited
      ? 999999
      : Math.max(0, analysesLimit - analysesUsed),
    isUnlimited: unlimited,
    plan: subscription?.plan ?? "TRIAL",
    subscriptionStatus: subscription?.status ?? "TRIALING",
    effectiveStatus: String(liveAccess.effectiveStatus),
    billingInterval: subscription?.billingInterval ?? null,
    trialStartedAt:
      subscription?.startedAt?.toISOString() ??
      subscription?.currentPeriodStart?.toISOString() ??
      null,
    trialEndsAt: subscription?.currentPeriodEnd?.toISOString() ?? null,
    periodEndsAt: subscription?.currentPeriodEnd?.toISOString() ?? null,
    gracePeriodEndsAt: subscription?.gracePeriodEndsAt?.toISOString() ?? null,
    inGrace: liveAccess.inGrace,
    billingWarning: liveAccess.billingWarning,
    isTrialExpired: liveAccess.reason === "trial_expired" || subscription?.status === "EXPIRED",
    accessAllowed: liveAccess.allowed,
    tendersAnalyzed: completed,
    decisionsGenerated: decisions,
    bidCount: count("BID"),
    reviewCount: count("REVIEW"),
    noBidCount: count("NO_BID"),
    risksDetected: risks,
    missingDocsDetected: missing,
    estimatedHoursSaved: decisions * 5,
  };
}

export async function recordUsage(input: {
  companyId: string;
  action:
    | "TENDER_ANALYSIS"
    | "DOCUMENT_UPLOAD"
    | "AI_EXTRACTION"
    | "AI_REASONING"
    | "CHECKOUT_STARTED"
    | "UPGRADE_VIEWED";
  quantity?: number;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.usageRecord.create({
    data: {
      companyId: input.companyId,
      action: input.action,
      quantity: input.quantity ?? 1,
      metadata: input.metadata,
    },
  });
}
