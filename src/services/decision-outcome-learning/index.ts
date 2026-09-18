import {
  buildDecisionOutcomeView,
  buildOutcomeLearningInsights,
  buildOutcomeUserEvidence,
  lifecycleBucket,
  normalizeOutcomeForLearning,
  outcomeEvidenceChanged,
  parseOutcomeUserEvidence,
  resolveOutcomeAuditAction,
  validateOutcomePayload,
  type DecisionOutcomeValue,
  type DecisionOutcomeView,
  type OutcomeLearningInsightsBundle,
} from "@/domain/decision-outcome-learning";
import type { LearningFeatures } from "@/domain/learning";
import { privacyFilterFeatures } from "@/domain/learning";
import type { DecisionMemoryInsightsBundle } from "@/domain/decision-memory";
import { enrichDecisionMemoryWithOutcomes } from "@/domain/decision-memory/outcome-enrichment";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { recordTenderOutcome } from "@/services/learning";
import { trackEvent } from "@/services/observability";
import type { DecisionType, Prisma } from "@prisma/client";

export type RecordDecisionOutcomeInput = {
  companyId: string;
  tenderId: string;
  userId: string;
  outcome: DecisionOutcomeValue;
  outcomeDate?: string | null;
  reasonCode?: string | null;
  reasonDetail?: string | null;
  attachmentDocumentId?: string | null;
  humanFinalDecision?: DecisionType | null;
  idempotencyKey?: string | null;
  allowReversal?: boolean;
};

function asLearningFeatures(raw: unknown): LearningFeatures {
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

async function resolveAttachment(input: {
  companyId: string;
  tenderId: string;
  attachmentDocumentId?: string | null;
  reasonDetail?: string | null;
}): Promise<{
  evidence: Prisma.InputJsonValue | undefined;
  attachmentFileName: string | null;
}> {
  let attachmentFileName: string | null = null;
  if (input.attachmentDocumentId) {
    const doc = await prisma.tenderDocument.findFirst({
      where: {
        id: input.attachmentDocumentId,
        tenderId: input.tenderId,
        companyId: input.companyId,
      },
      select: { fileName: true },
    });
    if (!doc) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Supporting document not found for this tender.",
        400,
      );
    }
    attachmentFileName = doc.fileName;
  }

  const userEvidence = buildOutcomeUserEvidence({
    attachmentDocumentId: input.attachmentDocumentId,
    attachmentFileName,
    notes: input.reasonDetail,
  });

  return {
    evidence: userEvidence as unknown as Prisma.InputJsonValue,
    attachmentFileName,
  };
}

export async function getDecisionOutcomeView(
  companyId: string,
  tenderId: string,
): Promise<DecisionOutcomeView | null> {
  const tender = await prisma.tender.findFirst({
    where: { id: tenderId, companyId },
    include: { decision: true, decisionOutcome: true },
  });
  if (!tender?.decision) return null;

  const row = tender.decisionOutcome;
  const outcome = (row?.outcome ?? tender.outcome) as DecisionOutcomeValue | null;
  const parsedEvidence = parseOutcomeUserEvidence(row?.evidence);

  return buildDecisionOutcomeView({
    tenderId,
    bidveraDecision: tender.decision.decision,
    humanFinalDecision: row?.humanFinalDecision ?? null,
    outcome,
    outcomeDate: row?.outcomeDate ?? tender.outcomeRecordedAt,
    reasonCode: row?.reasonCode ?? null,
    reasonDetail: row?.reasonDetail ?? null,
    attachmentFileName: parsedEvidence?.attachmentFileName ?? null,
    recordedAt: row?.updatedAt ?? tender.outcomeRecordedAt,
  });
}

export async function recordDecisionOutcome(
  input: RecordDecisionOutcomeInput,
): Promise<{
  view: DecisionOutcomeView;
  learningContributed: boolean;
  created: boolean;
}> {
  const tender = await prisma.tender.findFirst({
    where: { id: input.tenderId, companyId: input.companyId },
    include: { decision: true, decisionOutcome: true },
  });
  if (!tender?.decision || tender.analysisStatus !== "COMPLETED") {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Record an outcome after analysis completes.",
      400,
    );
  }

  const existing = tender.decisionOutcome;
  const fromOutcome = (existing?.outcome ?? tender.outcome) as DecisionOutcomeValue | null;

  const validation = validateOutcomePayload({
    outcome: input.outcome,
    outcomeDate: input.outcomeDate,
    reasonCode: input.reasonCode,
    fromOutcome,
    allowReversal: input.allowReversal,
  });
  if (!validation.ok) {
    throw new AppError(ErrorCode.VALIDATION, validation.message, 400);
  }

  if (input.idempotencyKey) {
    const dup = await prisma.tenderDecisionOutcome.findFirst({
      where: {
        companyId: input.companyId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (dup && dup.tenderId === input.tenderId) {
      const view = await getDecisionOutcomeView(input.companyId, input.tenderId);
      return {
        view: view!,
        learningContributed: false,
        created: false,
      };
    }
    if (dup && dup.tenderId !== input.tenderId) {
      throw new AppError(ErrorCode.CONFLICT, "Idempotency key already used.", 409);
    }
  }

  const normalized = normalizeOutcomeForLearning(input.outcome);
  const outcomeDate =
    input.outcomeDate != null ? new Date(input.outcomeDate) : null;

  const { evidence, attachmentFileName } = await resolveAttachment({
    companyId: input.companyId,
    tenderId: input.tenderId,
    attachmentDocumentId: input.attachmentDocumentId,
    reasonDetail: input.reasonDetail,
  });

  const prevEvidence = parseOutcomeUserEvidence(existing?.evidence ?? null);
  const nextEvidence = parseOutcomeUserEvidence(evidence ?? null);
  const attachmentChanged = outcomeEvidenceChanged(prevEvidence, nextEvidence);
  const isCreate = !existing;

  const auditAction = resolveOutcomeAuditAction({
    isCreate,
    previousOutcome: fromOutcome,
    nextOutcome: input.outcome,
    attachmentChanged,
    allowReversal: input.allowReversal,
  });

  const snapshot = {
    outcome: normalized,
    outcomeDate: outcomeDate?.toISOString() ?? null,
    reasonCode: input.reasonCode ?? null,
    reasonDetail: input.reasonDetail ?? null,
    humanFinalDecision: input.humanFinalDecision ?? null,
    attachmentDocumentId: input.attachmentDocumentId ?? null,
    attachmentFileName,
    auditAction,
  };

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.tenderDecisionOutcome.update({
        where: { id: existing.id },
        data: {
          outcome: normalized,
          outcomeDate,
          reasonCode: input.reasonCode ?? null,
          reasonDetail: input.reasonDetail ?? null,
          evidence: evidence ?? undefined,
          humanFinalDecision: input.humanFinalDecision ?? null,
          recordedById: input.userId,
        },
      });
      await tx.tenderDecisionOutcomeAudit.create({
        data: {
          outcomeId: existing.id,
          companyId: input.companyId,
          userId: input.userId,
          action: auditAction,
          snapshot,
        },
      });
    } else {
      const created = await tx.tenderDecisionOutcome.create({
        data: {
          companyId: input.companyId,
          tenderId: input.tenderId,
          tenderDecisionId: tender.decision!.id,
          outcome: normalized,
          outcomeDate,
          reasonCode: input.reasonCode ?? null,
          reasonDetail: input.reasonDetail ?? null,
          evidence: evidence ?? undefined,
          humanFinalDecision: input.humanFinalDecision ?? null,
          recordedById: input.userId,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });
      await tx.tenderDecisionOutcomeAudit.create({
        data: {
          outcomeId: created.id,
          companyId: input.companyId,
          userId: input.userId,
          action: auditAction,
          snapshot,
        },
      });
    }
  });

  const learning = await recordTenderOutcome({
    tenderId: input.tenderId,
    companyId: input.companyId,
    outcome: normalized as Parameters<typeof recordTenderOutcome>[0]["outcome"],
    userId: input.userId,
  });

  const trackAction =
    auditAction === "OUTCOME_CHANGED" || auditAction === "REVERSAL"
      ? "DECISION_OUTCOME_UPDATED"
      : isCreate
        ? "DECISION_OUTCOME_RECORDED"
        : "DECISION_OUTCOME_UPDATED";

  await trackEvent({
    action: trackAction,
    companyId: input.companyId,
    userId: input.userId,
    metadata: {
      tenderId: input.tenderId,
      outcome: normalized,
      tenderDecisionId: tender.decision.id,
      auditAction,
    },
  }).catch(() => undefined);

  const view = (await getDecisionOutcomeView(input.companyId, input.tenderId))!;

  return {
    view,
    learningContributed: learning.learningContributed,
    created: isCreate,
  };
}

export async function findOutcomeLearningForAnalysis(input: {
  companyId: string;
  currentFeatures: LearningFeatures;
  excludeTenderId: string;
}): Promise<OutcomeLearningInsightsBundle> {
  const rows = await prisma.tenderDecisionOutcome.findMany({
    where: { companyId: input.companyId },
    include: {
      tender: {
        select: {
          id: true,
          title: true,
          learningFeatureKey: true,
          decision: { select: { decision: true } },
          decisionMemory: { select: { relevanceFeatures: true } },
          learningContribution: { select: { features: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const candidates = rows
    .filter((r) => {
      if (!r.tender.decision) return false;
      const featuresRaw =
        r.tender.decisionMemory?.relevanceFeatures ??
        r.tender.learningContribution?.features;
      return Boolean(featuresRaw);
    })
    .map((r) => {
      const featuresRaw =
        r.tender.decisionMemory?.relevanceFeatures ??
        r.tender.learningContribution?.features;
      return {
        tenderId: r.tenderId,
        title: r.tender.title,
        decisionAtAnalysis: r.tender.decision!.decision,
        outcome: lifecycleBucket(r.outcome as DecisionOutcomeValue),
        outcomeDate: r.outcomeDate,
        reasonCode: r.reasonCode,
        reasonDetail: r.reasonDetail,
        features: asLearningFeatures(featuresRaw),
      };
    });

  return buildOutcomeLearningInsights({
    currentFeatures: privacyFilterFeatures(input.currentFeatures),
    excludeTenderId: input.excludeTenderId,
    candidates,
  });
}

export async function enrichMemoryInsightsWithOutcomes(input: {
  companyId: string;
  bundle: DecisionMemoryInsightsBundle;
}): Promise<DecisionMemoryInsightsBundle> {
  if (input.bundle.matches.length === 0) return input.bundle;

  const outcomes = await prisma.tenderDecisionOutcome.findMany({
    where: {
      companyId: input.companyId,
      tenderId: { in: input.bundle.matches.map((m: { tenderId: string }) => m.tenderId) },
    },
  });
  const byTender = new Map(outcomes.map((o) => [o.tenderId, o]));

  return enrichDecisionMemoryWithOutcomes({
    bundle: input.bundle,
    outcomesByTenderId: byTender,
  });
}
