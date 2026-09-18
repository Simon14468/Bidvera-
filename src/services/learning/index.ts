import {
  applyDecisionPriorityGate,
  buildLearningSignal,
  canLifecycleInfluence,
  computeConsistencyScore,
  computeDataQualityScore,
  evaluatePatternLifecycle,
  extractLearningFeatures,
  featureKeyFrom,
  privacyFilterFeatures,
  type CompanyHistorySignal,
  type LearningFeatures,
  type LearningOutcome,
  type PatternCandidate,
  type SimilarCompanyLearningSignal,
  EMPTY_COMPANY_HISTORY_SIGNAL,
  EMPTY_LEARNING_SIGNAL,
} from "@/domain/learning";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { trackEvent } from "@/services/observability";
import type { Prisma, TenderOutcome } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

function toFeatures(row: {
  industryBucket: string;
  countryBucket: string;
  sizeBand: string;
  fitBand: string;
  readinessBand: string;
  decisionAtAnalysis: "BID" | "REVIEW" | "NO_BID";
  mandatoryGapBand: string;
  valueBand: string;
}): LearningFeatures {
  return privacyFilterFeatures(row);
}

function unknownFeatureCount(features: LearningFeatures): number {
  return Object.values(features).filter((v) => v === "unknown").length;
}

function deltaForOutcome(outcome: TenderOutcome): {
  wonCount?: number;
  lostCount?: number;
  bidSubmittedCount?: number;
  noBidCount?: number;
  withdrawnCount?: number;
} {
  switch (outcome) {
    case "WON":
      return { wonCount: 1 };
    case "LOST":
      return { lostCount: 1 };
    case "PENDING":
    case "BID_SUBMITTED":
      return { bidSubmittedCount: 1 };
    case "NOT_SUBMITTED":
    case "NO_BID_CONFIRMED":
      return { noBidCount: 1 };
    case "WITHDRAWN":
    case "CANCELLED":
      return { withdrawnCount: 1 };
    default:
      return {};
  }
}

function negate(delta: ReturnType<typeof deltaForOutcome>) {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(delta)) {
    if (typeof v === "number") out[k] = -v;
  }
  return out as ReturnType<typeof deltaForOutcome>;
}

/**
 * Recompute diversity + lifecycle from contributions.
 * Company IDs used only for counting — never returned in signals.
 */
async function recomputePatternValidation(
  db: Db,
  featureKey: string,
  features: LearningFeatures,
) {
  const contributions = await db.learningContribution.findMany({
    where: { featureKey },
    select: { companyId: true, outcome: true },
  });

  const byOrg = new Map<string, number>();
  let wonCount = 0;
  let lostCount = 0;
  let bidSubmittedCount = 0;
  let noBidCount = 0;
  let withdrawnCount = 0;

  for (const c of contributions) {
    byOrg.set(c.companyId, (byOrg.get(c.companyId) ?? 0) + 1);
    switch (c.outcome) {
      case "WON":
        wonCount += 1;
        break;
      case "LOST":
        lostCount += 1;
        break;
      case "PENDING":
      case "BID_SUBMITTED":
        bidSubmittedCount += 1;
        break;
      case "NOT_SUBMITTED":
      case "NO_BID_CONFIRMED":
        noBidCount += 1;
        break;
      case "WITHDRAWN":
      case "CANCELLED":
        withdrawnCount += 1;
        break;
    }
  }

  const sampleCount = contributions.length;
  const independentOrgCount = byOrg.size;
  const maxOrgShare =
    sampleCount === 0
      ? 1
      : Math.max(0, ...[...byOrg.values()].map((n) => n / sampleCount));
  const decisiveOutcomeCount = wonCount + lostCount;
  const dataQualityScore = computeDataQualityScore({
    unknownFeatureCount: unknownFeatureCount(features),
    totalFeatureCount: 8,
    sampleCount,
    independentOrgCount,
  });
  const consistencyScore = computeConsistencyScore(wonCount, lostCount);

  const existing = await db.aggregatedLearningPattern.findUnique({
    where: { featureKey },
  });

  const evaluation = evaluatePatternLifecycle({
    sampleCount,
    independentOrgCount,
    decisiveOutcomeCount,
    wonCount,
    lostCount,
    maxOrgShare,
    dataQualityScore,
    consistencyScore,
    previousLifecycle: existing?.lifecycle ?? "CANDIDATE",
  });

  const payload = {
    industryBucket: features.industryBucket,
    countryBucket: features.countryBucket,
    sizeBand: features.sizeBand,
    fitBand: features.fitBand,
    readinessBand: features.readinessBand,
    decisionAtAnalysis: features.decisionAtAnalysis,
    mandatoryGapBand: features.mandatoryGapBand,
    valueBand: features.valueBand,
    sampleCount,
    wonCount,
    lostCount,
    bidSubmittedCount,
    noBidCount,
    withdrawnCount,
    independentOrgCount,
    decisiveOutcomeCount,
    dataQualityScore,
    consistencyScore,
    maxOrgShareBps: Math.round(maxOrgShare * 10000),
    lifecycle: evaluation.lifecycle,
    validated: evaluation.canInfluence,
  };

  if (!existing) {
    if (sampleCount <= 0) return;
    await db.aggregatedLearningPattern.create({
      data: { featureKey, ...payload },
    });
    return;
  }

  if (sampleCount <= 0) {
    await db.aggregatedLearningPattern.update({
      where: { featureKey },
      data: {
        ...payload,
        lifecycle: "CANDIDATE",
        validated: false,
      },
    });
    return;
  }

  await db.aggregatedLearningPattern.update({
    where: { featureKey },
    data: payload,
  });
}

async function applyCountDelta(
  db: Db,
  input: {
    features: LearningFeatures;
    featureKey: string;
    sampleDelta: number;
    countDelta: ReturnType<typeof deltaForOutcome>;
  },
) {
  const existing = await db.aggregatedLearningPattern.findUnique({
    where: { featureKey: input.featureKey },
  });

  if (!existing) {
    if (input.sampleDelta <= 0) return;
    await db.aggregatedLearningPattern.create({
      data: {
        featureKey: input.featureKey,
        industryBucket: input.features.industryBucket,
        countryBucket: input.features.countryBucket,
        sizeBand: input.features.sizeBand,
        fitBand: input.features.fitBand,
        readinessBand: input.features.readinessBand,
        decisionAtAnalysis: input.features.decisionAtAnalysis,
        mandatoryGapBand: input.features.mandatoryGapBand,
        valueBand: input.features.valueBand,
        sampleCount: Math.max(0, input.sampleDelta),
        wonCount: input.countDelta.wonCount ?? 0,
        lostCount: input.countDelta.lostCount ?? 0,
        bidSubmittedCount: input.countDelta.bidSubmittedCount ?? 0,
        noBidCount: input.countDelta.noBidCount ?? 0,
        withdrawnCount: input.countDelta.withdrawnCount ?? 0,
        lifecycle: "CANDIDATE",
        validated: false,
      },
    });
  } else {
    await db.aggregatedLearningPattern.update({
      where: { featureKey: input.featureKey },
      data: {
        sampleCount: Math.max(0, existing.sampleCount + input.sampleDelta),
        wonCount: Math.max(
          0,
          existing.wonCount + (input.countDelta.wonCount ?? 0),
        ),
        lostCount: Math.max(
          0,
          existing.lostCount + (input.countDelta.lostCount ?? 0),
        ),
        bidSubmittedCount: Math.max(
          0,
          existing.bidSubmittedCount + (input.countDelta.bidSubmittedCount ?? 0),
        ),
        noBidCount: Math.max(
          0,
          existing.noBidCount + (input.countDelta.noBidCount ?? 0),
        ),
        withdrawnCount: Math.max(
          0,
          existing.withdrawnCount + (input.countDelta.withdrawnCount ?? 0),
        ),
      },
    });
  }

  await recomputePatternValidation(db, input.featureKey, input.features);
}

/** Build coarse features for a completed tender analysis (no PII). */
export function buildFeaturesForTender(input: {
  industry: string | null;
  country: string | null;
  companySize?: string | null;
  employeeRange?: string | null;
  fitScore: number | null;
  readinessScore: number | null;
  decision: "BID" | "REVIEW" | "NO_BID";
  missingMandatoryCount: number;
  estimatedValue: number | null;
}): { features: LearningFeatures; featureKey: string } {
  const features = extractLearningFeatures(input);
  return { features, featureKey: featureKeyFrom(features) };
}

/**
 * Global similarity lookup — VERIFIED/ACTIVE patterns only.
 * Never returns peer identities. Respects decision priority gate.
 */
export async function lookupSimilarCompanySignal(input: {
  features: LearningFeatures;
  featureKey: string;
  missingMandatoryCount?: number;
  hardNoBid?: boolean;
  forcedReview?: boolean;
  readinessMissing?: number;
}): Promise<SimilarCompanyLearningSignal> {
  const gate = applyDecisionPriorityGate({
    missingMandatoryCount: input.missingMandatoryCount ?? 0,
    hardNoBid: input.hardNoBid ?? false,
    forcedReview: input.forcedReview ?? false,
    readinessMissing: input.readinessMissing ?? 0,
  });

  const exact = await prisma.aggregatedLearningPattern.findUnique({
    where: { featureKey: input.featureKey },
  });

  const nearby = await prisma.aggregatedLearningPattern.findMany({
    where: {
      lifecycle: { in: ["VERIFIED", "ACTIVE"] },
      validated: true,
      OR: [
        { industryBucket: input.features.industryBucket },
        { countryBucket: input.features.countryBucket },
      ],
    },
    take: 40,
    orderBy: { sampleCount: "desc" },
  });

  const byKey = new Map<string, (typeof nearby)[number]>();
  for (const row of nearby) byKey.set(row.featureKey, row);
  if (exact && canLifecycleInfluence(exact.lifecycle)) {
    byKey.set(exact.featureKey, exact);
  }

  const candidates: PatternCandidate[] = [...byKey.values()].map((row) => ({
    id: row.id,
    featureKey: row.featureKey,
    features: toFeatures(row),
    sampleCount: row.sampleCount,
    wonCount: row.wonCount,
    lostCount: row.lostCount,
    bidSubmittedCount: row.bidSubmittedCount,
    noBidCount: row.noBidCount,
    withdrawnCount: row.withdrawnCount,
    lifecycle: row.lifecycle,
    independentOrgCount: row.independentOrgCount,
    dataQualityScore: row.dataQualityScore,
    consistencyScore: row.consistencyScore,
    validated: row.validated,
  }));

  return buildLearningSignal({
    features: input.features,
    featureKey: input.featureKey,
    candidates,
    influenceAllowed: gate.influenceAllowed,
    suppressedReason: gate.suppressedReason,
  });
}

/**
 * Company-specific verified history — strictly tenant-isolated.
 * Never written into global aggregates for other companies.
 */
export async function lookupCompanyHistorySignal(input: {
  companyId: string;
  featureKey: string;
}): Promise<CompanyHistorySignal> {
  const prior = await prisma.learningContribution.count({
    where: {
      companyId: input.companyId,
      featureKey: input.featureKey,
    },
  });
  if (prior <= 0) return { ...EMPTY_COMPANY_HISTORY_SIGNAL };

  const outcomes = await prisma.learningContribution.groupBy({
    by: ["outcome"],
    where: { companyId: input.companyId, featureKey: input.featureKey },
    _count: true,
  });
  const summary = outcomes
    .map((o) => `${o._count} ${o.outcome.toLowerCase().replace(/_/g, " ")}`)
    .join(", ");

  return {
    detected: true,
    priorOutcomes: prior,
    headline: "Your organization has prior outcomes on similar opportunities.",
    detail: `Company-private history only (${summary}). This stays inside your tenant and never exposes other companies.`,
    priorityNote:
      "Company history informs review — it never overrides missing mandatory requirements on the current tender.",
  };
}

/**
 * Record outcome. Global contribution only when company has learning consent.
 */
export async function recordTenderOutcome(input: {
  tenderId: string;
  companyId: string;
  outcome: LearningOutcome;
  userId?: string;
}): Promise<{
  outcome: LearningOutcome;
  learningContributed: boolean;
  consentOptedOut: boolean;
}> {
  const tender = await prisma.tender.findUnique({
    where: { id: input.tenderId },
    include: {
      decision: true,
      company: { include: { profile: true } },
      requirements: true,
      learningContribution: true,
    },
  });

  if (!tender || tender.companyId !== input.companyId) {
    throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  }
  if (!tender.decision || tender.analysisStatus !== "COMPLETED") {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Record an outcome after analysis completes.",
      400,
    );
  }

  const readiness = tender.decision.readinessBreakdown as {
    score?: number | null;
  } | null;
  const missingMandatory = tender.requirements.filter(
    (r) => r.mandatory && (r.status === "FAILED" || r.status === "MISSING"),
  ).length;

  const { features } = buildFeaturesForTender({
    industry: tender.industry ?? tender.company.profile?.industry ?? null,
    country: tender.country ?? tender.company.profile?.country ?? null,
    companySize:
      tender.company.profile?.companySize ?? tender.company.companySize,
    employeeRange: tender.company.profile?.employeeRange ?? null,
    fitScore: tender.decision.fitScore,
    readinessScore: readiness?.score ?? null,
    decision: tender.decision.decision,
    missingMandatoryCount: missingMandatory,
    estimatedValue: tender.estimatedValue,
  });

  const filtered = privacyFilterFeatures(features);
  const key = featureKeyFrom(filtered);
  const outcome = input.outcome as TenderOutcome;
  const prior = tender.learningContribution;
  const consent = tender.company.globalLearningConsent !== false;

  await prisma.tender.update({
    where: { id: tender.id },
    data: {
      outcome,
      outcomeRecordedAt: new Date(),
      learningFeatureKey: key,
    },
  });

  // Always keep company-private contribution record for tenant history.
  // Global aggregate updates only when consent is on.
  await prisma.$transaction(async (tx) => {
    if (prior) {
      if (consent) {
        await applyCountDelta(tx, {
          features: privacyFilterFeatures(
            prior.features as unknown as LearningFeatures,
          ),
          featureKey: prior.featureKey,
          sampleDelta: -1,
          countDelta: negate(deltaForOutcome(prior.outcome)),
        });
      }
      await tx.learningContribution.update({
        where: { tenderId: tender.id },
        data: { featureKey: key, outcome, features: filtered },
      });
    } else {
      await tx.learningContribution.create({
        data: {
          companyId: input.companyId,
          tenderId: tender.id,
          featureKey: key,
          outcome,
          features: filtered,
        },
      });
    }

    if (consent) {
      await applyCountDelta(tx, {
        features: filtered,
        featureKey: key,
        sampleDelta: 1,
        countDelta: deltaForOutcome(outcome),
      });
    }
  });

  await trackEvent({
    action: "TENDER_OUTCOME_RECORDED",
    companyId: input.companyId,
    userId: input.userId,
    metadata: {
      tenderId: input.tenderId,
      outcome,
      featureKeyPrefix: key.slice(0, 8),
      globalLearningConsent: consent,
    },
  }).catch(() => undefined);

  if (consent) {
    await trackEvent({
      action: "LEARNING_CONTRIBUTED",
      companyId: input.companyId,
      metadata: { tenderId: input.tenderId },
    }).catch(() => undefined);
  }

  return {
    outcome: input.outcome,
    learningContributed: consent,
    consentOptedOut: !consent,
  };
}

export async function setGlobalLearningConsent(input: {
  companyId: string;
  consent: boolean;
}) {
  await prisma.company.update({
    where: { id: input.companyId },
    data: { globalLearningConsent: input.consent },
  });
  return { consent: input.consent };
}

export { EMPTY_LEARNING_SIGNAL, EMPTY_COMPANY_HISTORY_SIGNAL };
