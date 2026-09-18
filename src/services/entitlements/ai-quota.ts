/**
 * Smallest AI quota enforcement using Plan.aiTokensLimit + AiUsageLog.
 * null limit = unlimited (existing paid plans until Super Admin sets a cap).
 * 0 = no AI operations (Free Workspace default).
 */

import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { getEffectiveEntitlements } from "@/services/entitlements";
import type { AiTaskType } from "@prisma/client";

export function isAiQuotaExceeded(
  usedTokens: number,
  limit: number | null | undefined,
): boolean {
  if (limit == null) return false;
  return usedTokens >= limit;
}

export async function sumCompanyAiTokensInPeriod(
  companyId: string,
  periodStart: Date | null | undefined,
): Promise<number> {
  const since = periodStart ?? new Date(0);
  const rows = await prisma.aiUsageLog.aggregate({
    where: {
      companyId,
      createdAt: { gte: since },
      success: true,
    },
    _sum: { tokensIn: true, tokensOut: true },
  });
  return (rows._sum.tokensIn ?? 0) + (rows._sum.tokensOut ?? 0);
}

export async function assertAiQuotaAvailable(companyId: string): Promise<{
  used: number;
  limit: number | null;
}> {
  const entitlements = await getEffectiveEntitlements(companyId);
  const used = await sumCompanyAiTokensInPeriod(
    companyId,
    // Align to billing period when CompanyUsage has a window.
    (
      await prisma.companyUsage.findUnique({
        where: { companyId },
        select: { periodStart: true },
      })
    )?.periodStart,
  );
  if (isAiQuotaExceeded(used, entitlements.aiTokensLimit)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "AI usage limit reached for this billing period. Upgrade or wait for the next period.",
      403,
      { used, limit: entitlements.aiTokensLimit },
    );
  }
  return { used, limit: entitlements.aiTokensLimit };
}

/** Record a billed AI operation after it succeeds (or a 1-token unit for local AI ops). */
export async function recordAiQuotaUsage(input: {
  companyId: string;
  tenderId?: string | null;
  task: AiTaskType;
  operation: "questionnaire_assistant" | "decision_simulator";
  tokensIn?: number;
  tokensOut?: number;
}) {
  await prisma.aiUsageLog.create({
    data: {
      companyId: input.companyId,
      tenderId: input.tenderId ?? null,
      task: input.task,
      providerKey: "quota",
      modelName: input.operation,
      success: true,
      tokensIn: input.tokensIn ?? 0,
      tokensOut: input.tokensOut ?? 1,
      costCentsEst: 0,
      metadata: { operation: input.operation, source: "ai_quota" },
    },
  });
}

export async function consumeAiQuota(input: {
  companyId: string;
  tenderId?: string | null;
  task: AiTaskType;
  operation: "questionnaire_assistant" | "decision_simulator";
  tokensIn?: number;
  tokensOut?: number;
}) {
  await assertAiQuotaAvailable(input.companyId);
  await recordAiQuotaUsage(input);
}
