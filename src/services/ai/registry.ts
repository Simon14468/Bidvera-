import { AI_MODELS, AI_PROVIDER } from "@/config/server";
import { prisma } from "@/lib/db";
import { logError, logInfo } from "@/services/observability";
import type { AiTaskType } from "@prisma/client";

export interface ResolvedAiModel {
  modelId: string | null;
  providerKey: string;
  baseUrl: string | null;
  apiKeyEnvVar: string | null;
  modelName: string;
  version: string | null;
  maxTokens: number | null;
  temperature: number | null;
  inputCostPer1k: number | null;
  outputCostPer1k: number | null;
  fallbackModelName: string | null;
  fallbackProviderKey: string | null;
}

const ENV_FALLBACK: Record<AiTaskType, string> = {
  PDF_EXTRACTION: AI_MODELS.extraction,
  REQUIREMENT_EXTRACTION: AI_MODELS.extraction,
  CLASSIFICATION: AI_MODELS.extraction,
  COMPANY_MATCHING: AI_MODELS.extraction,
  RISK_ANALYSIS: AI_MODELS.reasoning,
  FINAL_REASONING: AI_MODELS.reasoning,
};

/**
 * Resolve model for a task from DB assignments with env fallback.
 * Invalid/missing config never breaks analysis — falls back safely.
 */
export async function resolveModelForTask(task: AiTaskType): Promise<ResolvedAiModel> {
  try {
    const assignment = await prisma.aiModelAssignment.findUnique({
      where: { task },
      include: {
        model: { include: { provider: true } },
        fallbackModel: { include: { provider: true } },
      },
    });

    if (
      assignment?.active &&
      assignment.model.active &&
      assignment.model.provider.active
    ) {
      return {
        modelId: assignment.model.id,
        providerKey: assignment.model.provider.key,
        baseUrl: assignment.model.provider.baseUrl,
        apiKeyEnvVar: assignment.model.provider.apiKeyEnvVar,
        modelName: assignment.model.name,
        version: assignment.model.version,
        maxTokens: assignment.model.maxTokens,
        temperature: assignment.model.temperature,
        inputCostPer1k: assignment.model.inputCostPer1k,
        outputCostPer1k: assignment.model.outputCostPer1k,
        fallbackModelName: assignment.fallbackModel?.name ?? null,
        fallbackProviderKey: assignment.fallbackModel?.provider.key ?? null,
      };
    }

    if (
      assignment?.fallbackModel?.active &&
      assignment.fallbackModel.provider.active
    ) {
      const m = assignment.fallbackModel;
      return {
        modelId: m.id,
        providerKey: m.provider.key,
        baseUrl: m.provider.baseUrl,
        apiKeyEnvVar: m.provider.apiKeyEnvVar,
        modelName: m.name,
        version: m.version,
        maxTokens: m.maxTokens,
        temperature: m.temperature,
        inputCostPer1k: m.inputCostPer1k,
        outputCostPer1k: m.outputCostPer1k,
        fallbackModelName: null,
        fallbackProviderKey: null,
      };
    }
  } catch (error) {
    logError("ai.model.resolve_failed", {
      task,
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  logInfo("ai.model.env_fallback", { task });
  return {
    modelId: null,
    providerKey: AI_PROVIDER,
    baseUrl: process.env.AI_BASE_URL ?? null,
    apiKeyEnvVar: "AI_API_KEY",
    modelName: ENV_FALLBACK[task],
    version: null,
    maxTokens: null,
    temperature: 0.1,
    inputCostPer1k: null,
    outputCostPer1k: null,
    fallbackModelName: null,
    fallbackProviderKey: null,
  };
}

export function estimateCostCents(input: {
  tokensIn: number;
  tokensOut: number;
  inputCostPer1k: number | null;
  outputCostPer1k: number | null;
}): number {
  const inCost = (input.tokensIn / 1000) * (input.inputCostPer1k ?? 0) * 100;
  const outCost = (input.tokensOut / 1000) * (input.outputCostPer1k ?? 0) * 100;
  return Math.round(inCost + outCost);
}

export async function logAiUsage(input: {
  companyId?: string | null;
  tenderId?: string | null;
  task: AiTaskType;
  resolved: ResolvedAiModel;
  success: boolean;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  errorMessage?: string;
}) {
  const tokensIn = input.tokensIn ?? 0;
  const tokensOut = input.tokensOut ?? 0;
  const costCentsEst = estimateCostCents({
    tokensIn,
    tokensOut,
    inputCostPer1k: input.resolved.inputCostPer1k,
    outputCostPer1k: input.resolved.outputCostPer1k,
  });

  await prisma.aiUsageLog.create({
    data: {
      companyId: input.companyId ?? null,
      tenderId: input.tenderId ?? null,
      modelId: input.resolved.modelId,
      task: input.task,
      providerKey: input.resolved.providerKey,
      modelName: input.resolved.modelName,
      success: input.success,
      tokensIn,
      tokensOut,
      costCentsEst,
      latencyMs: input.latencyMs ?? null,
      errorMessage: input.errorMessage?.slice(0, 500) ?? null,
      metadata: {
        version: input.resolved.version,
      },
    },
  });

  return { tokensIn, tokensOut, costCentsEst };
}
