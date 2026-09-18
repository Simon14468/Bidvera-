/**
 * Decision Memory service — tenant-isolated store/retrieve/relevance.
 * Never invents historical data; never mutates current tender scores.
 */

import {
  DECISION_MEMORY_DISCLAIMER,
  EMPTY_DECISION_MEMORY_INSIGHTS,
  decisionMemoryContentHash,
  decisionMemoryLabel,
  isCorruptOrEmptyMemoryPayload,
  rankRelevantMemories,
  type DecisionMemoryInsightsBundle,
  type DecisionMemoryRequirementsSnapshot,
  type DecisionMemoryRiskSnapshot,
  type DecisionMemoryScoresSnapshot,
} from "@/domain/decision-memory";
import type { LearningFeatures } from "@/domain/learning";
import { privacyFilterFeatures } from "@/domain/learning";
import type { ConfidenceLevel, DecisionType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { trackEvent } from "@/services/observability";

export type RecordDecisionMemoryInput = {
  companyId: string;
  tenderId: string;
  title: string;
  client: string | null;
  country: string | null;
  industry: string | null;
  decision: DecisionType;
  fitScore: number | null;
  readinessScore: number | null;
  bidScore: number | null;
  confidence: ConfidenceLevel;
  reasoning: string;
  requirementsSnapshot: DecisionMemoryRequirementsSnapshot;
  risksSnapshot: DecisionMemoryRiskSnapshot[];
  scoresSnapshot: DecisionMemoryScoresSnapshot;
  features: LearningFeatures;
  featureKey: string;
  analyzedAt: Date;
  userId?: string | null;
  /** ANALYSIS | TEAM_VERIFIED_EVIDENCE — revision trail only */
  revisionSource?: string;
  triggerTaskId?: string | null;
};

function asFeatures(raw: unknown): LearningFeatures {
  const f = raw as Partial<LearningFeatures>;
  return privacyFilterFeatures({
    industryBucket: f.industryBucket ?? "unknown",
    countryBucket: f.countryBucket ?? "unknown",
    sizeBand: f.sizeBand ?? "unknown",
    fitBand: f.fitBand ?? "unknown",
    readinessBand: f.readinessBand ?? "unknown",
    decisionAtAnalysis: (f.decisionAtAnalysis as LearningFeatures["decisionAtAnalysis"]) ?? "REVIEW",
    mandatoryGapBand: f.mandatoryGapBand ?? "unknown",
    valueBand: f.valueBand ?? "unknown",
  });
}

/**
 * Idempotent upsert of a Decision Memory snapshot after analysis completes.
 * Blocks corrupt/empty overwrites of existing good records.
 */
export async function recordDecisionMemory(
  input: RecordDecisionMemoryInput,
): Promise<{ id: string; created: boolean; skipped: boolean }> {
  if (
    isCorruptOrEmptyMemoryPayload({
      reasoning: input.reasoning,
      requirementsSnapshot: input.requirementsSnapshot,
    })
  ) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Cannot record Decision Memory with empty or corrupt analysis payload.",
      400,
    );
  }

  const tender = await prisma.tender.findFirst({
    where: { id: input.tenderId, companyId: input.companyId },
    select: { id: true },
  });
  if (!tender) {
    throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  }

  const filtered = privacyFilterFeatures(input.features);
  const contentHash = decisionMemoryContentHash({
    decision: input.decision,
    fitScore: input.fitScore,
    readinessScore: input.readinessScore,
    bidScore: input.bidScore,
    reasoning: input.reasoning,
    requirementsSnapshot: input.requirementsSnapshot,
    risksSnapshot: input.risksSnapshot,
  });

  const existing = await prisma.decisionMemory.findUnique({
    where: { tenderId: input.tenderId },
  });

  async function appendRevision(memoryId: string) {
    try {
      await prisma.decisionMemoryRevision.create({
        data: {
          companyId: input.companyId,
          tenderId: input.tenderId,
          memoryId,
          decision: input.decision,
          title: input.title,
          client: input.client,
          country: input.country,
          industry: input.industry,
          fitScore: input.fitScore,
          readinessScore: input.readinessScore,
          bidScore: input.bidScore,
          confidence: input.confidence,
          reasoning: input.reasoning,
          requirementsSnapshot: input.requirementsSnapshot as object,
          risksSnapshot: input.risksSnapshot as object,
          scoresSnapshot: input.scoresSnapshot as object,
          relevanceFeatures: filtered as object,
          featureKey: input.featureKey,
          analyzedAt: input.analyzedAt,
          contentHash,
          source: input.revisionSource ?? "ANALYSIS",
          triggerTaskId: input.triggerTaskId ?? null,
        },
      });
      await trackEvent({
        action: "DECISION_MEMORY_REVISION",
        companyId: input.companyId,
        userId: input.userId ?? undefined,
        metadata: {
          memoryId,
          tenderId: input.tenderId,
          contentHash,
          source: input.revisionSource ?? "ANALYSIS",
          triggerTaskId: input.triggerTaskId ?? null,
        },
      });
    } catch (error) {
      // Duplicate contentHash for tender — historical already preserved
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return;
      }
      throw error;
    }
  }

  if (existing) {
    if (existing.companyId !== input.companyId) {
      throw new AppError(ErrorCode.FORBIDDEN, "Tenant isolation violation.", 403);
    }
    if (existing.contentHash === contentHash) {
      await appendRevision(existing.id);
      return { id: existing.id, created: false, skipped: true };
    }
    // Re-analysis may update memory with the latest canonical snapshot
    const updated = await prisma.decisionMemory.update({
      where: { id: existing.id },
      data: {
        decision: input.decision,
        title: input.title,
        client: input.client,
        country: input.country,
        industry: input.industry,
        fitScore: input.fitScore,
        readinessScore: input.readinessScore,
        bidScore: input.bidScore,
        confidence: input.confidence,
        reasoning: input.reasoning,
        requirementsSnapshot: input.requirementsSnapshot as object,
        risksSnapshot: input.risksSnapshot as object,
        scoresSnapshot: input.scoresSnapshot as object,
        relevanceFeatures: filtered as object,
        featureKey: input.featureKey,
        analyzedAt: input.analyzedAt,
        contentHash,
      },
    });
    await appendRevision(updated.id);
    await trackEvent({
      action: "DECISION_MEMORY_RECORDED",
      companyId: input.companyId,
      userId: input.userId ?? undefined,
      metadata: {
        memoryId: updated.id,
        tenderId: input.tenderId,
        decision: input.decision,
        updated: true,
      },
    });
    return { id: updated.id, created: false, skipped: false };
  }

  const created = await prisma.decisionMemory.create({
    data: {
      companyId: input.companyId,
      tenderId: input.tenderId,
      decision: input.decision,
      title: input.title,
      client: input.client,
      country: input.country,
      industry: input.industry,
      fitScore: input.fitScore,
      readinessScore: input.readinessScore,
      bidScore: input.bidScore,
      confidence: input.confidence,
      reasoning: input.reasoning,
      requirementsSnapshot: input.requirementsSnapshot as object,
      risksSnapshot: input.risksSnapshot as object,
      scoresSnapshot: input.scoresSnapshot as object,
      relevanceFeatures: filtered as object,
      featureKey: input.featureKey,
      analyzedAt: input.analyzedAt,
      contentHash,
    },
  });

  await appendRevision(created.id);

  await trackEvent({
    action: "DECISION_MEMORY_RECORDED",
    companyId: input.companyId,
    userId: input.userId ?? undefined,
    metadata: {
      memoryId: created.id,
      tenderId: input.tenderId,
      decision: input.decision,
      created: true,
    },
  });

  return { id: created.id, created: true, skipped: false };
}

/** List company Decision Memory — newest first. Strict tenant filter. */
export async function listDecisionMemory(companyId: string, limit = 50) {
  const { assertFeature } = await import("@/services/entitlements");
  await assertFeature(
    companyId,
    "decision_memory",
    "Decision Memory is not included in your plan.",
  );
  const rows = await prisma.decisionMemory.findMany({
    where: { companyId },
    orderBy: { analyzedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return rows.map((r) => ({
    id: r.id,
    tenderId: r.tenderId,
    title: r.title,
    client: r.client,
    decision: r.decision,
    decisionLabel: decisionMemoryLabel(r.decision),
    fitScore: r.fitScore,
    readinessScore: r.readinessScore,
    bidScore: r.bidScore,
    confidence: r.confidence,
    analyzedAt: r.analyzedAt.toISOString(),
    disclaimer: DECISION_MEMORY_DISCLAIMER,
  }));
}

export async function getDecisionMemory(companyId: string, memoryId: string) {
  const { assertFeature } = await import("@/services/entitlements");
  await assertFeature(
    companyId,
    "decision_memory",
    "Decision Memory is not included in your plan.",
  );
  const row = await prisma.decisionMemory.findFirst({
    where: { id: memoryId, companyId },
  });
  if (!row) {
    throw new AppError(ErrorCode.NOT_FOUND, "Decision Memory not found.", 404);
  }
  return {
    id: row.id,
    tenderId: row.tenderId,
    title: row.title,
    client: row.client,
    country: row.country,
    industry: row.industry,
    decision: row.decision,
    decisionLabel: decisionMemoryLabel(row.decision),
    fitScore: row.fitScore,
    readinessScore: row.readinessScore,
    bidScore: row.bidScore,
    confidence: row.confidence,
    reasoning: row.reasoning,
    requirementsSnapshot: row.requirementsSnapshot as DecisionMemoryRequirementsSnapshot,
    risksSnapshot: row.risksSnapshot as DecisionMemoryRiskSnapshot[],
    scoresSnapshot: row.scoresSnapshot as DecisionMemoryScoresSnapshot,
    analyzedAt: row.analyzedAt.toISOString(),
    disclaimer: DECISION_MEMORY_DISCLAIMER,
  };
}

/**
 * Compare current tender features against company Decision Memory.
 * Returns insights only — does not change current decision or scores.
 */
export async function findRelevantDecisionMemories(input: {
  companyId: string;
  currentFeatures: LearningFeatures;
  excludeTenderId: string;
}): Promise<DecisionMemoryInsightsBundle> {
  const prior = await prisma.decisionMemory.findMany({
    where: {
      companyId: input.companyId,
      NOT: { tenderId: input.excludeTenderId },
    },
    orderBy: { analyzedAt: "desc" },
    take: 100,
  });

  if (prior.length === 0) {
    return { ...EMPTY_DECISION_MEMORY_INSIGHTS };
  }

  const bundle = rankRelevantMemories({
    currentFeatures: privacyFilterFeatures(input.currentFeatures),
    excludeTenderId: input.excludeTenderId,
    candidates: prior.map((p) => ({
      id: p.id,
      tenderId: p.tenderId,
      title: p.title,
      client: p.client,
      decision: p.decision,
      fitScore: p.fitScore,
      readinessScore: p.readinessScore,
      bidScore: p.bidScore,
      reasoning: p.reasoning,
      features: asFeatures(p.relevanceFeatures),
      analyzedAt: p.analyzedAt,
    })),
  });

  const { enrichMemoryInsightsWithOutcomes } = await import(
    "@/services/decision-outcome-learning"
  );
  const enriched = await enrichMemoryInsightsWithOutcomes({
    companyId: input.companyId,
    bundle,
  });

  await trackEvent({
    action: "DECISION_MEMORY_COMPARED",
    companyId: input.companyId,
    metadata: {
      excludeTenderId: input.excludeTenderId,
      matchCount: enriched.matches.length,
      memoryIds: enriched.matches.map((m: { memoryId: string }) => m.memoryId),
    },
  });

  return enriched;
}

export type { DecisionMemoryInsightsBundle };
