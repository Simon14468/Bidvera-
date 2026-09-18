import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { nextMatchQualityState } from "@/domain/matching-engine";
import type {
  MatchRecommendationType,
  MatchingBehaviorEventType,
  MatchQualityState,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { incrementMatchingDailyRollups } from "./analytics";
import { scheduleMatchingPreferenceRebuild } from "./preferences";

const ALLOWED: MatchingBehaviorEventType[] = [
  "IMPRESSION",
  "VIEW",
  "CLICK",
  "INTEREST",
  "DISMISS",
];

/** Engagement events must be tied to an owned recommendation (analytics integrity). */
const REQUIRES_RECOMMENDATION: MatchingBehaviorEventType[] = [
  "VIEW",
  "CLICK",
  "INTEREST",
  "DISMISS",
];

export type RecordMatchingBehaviorEventInput = {
  companyId: string;
  opportunityId: string;
  recommendationId?: string | null;
  eventType: MatchingBehaviorEventType | string;
  actorUserId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type MatchingBehaviorEventDto = {
  id: string;
  companyId: string;
  opportunityId: string;
  recommendationId: string | null;
  eventType: MatchingBehaviorEventType;
  recommendationType: MatchRecommendationType | null;
  createdAt: string;
  duplicate: boolean;
};

/**
 * Record a tenant-scoped matching behavior event.
 * Never stores private company profile/evidence payloads.
 * Side effects: qualityState, daily rollups, async preference rebuild.
 */
export async function recordMatchingBehaviorEvent(
  input: RecordMatchingBehaviorEventInput,
): Promise<MatchingBehaviorEventDto> {
  const eventType = input.eventType as MatchingBehaviorEventType;
  if (!ALLOWED.includes(eventType)) {
    throw new AppError(ErrorCode.VALIDATION, "Invalid event type.", 400);
  }

  if (REQUIRES_RECOMMENDATION.includes(eventType) && !input.recommendationId) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "recommendationId is required for this event type.",
      400,
    );
  }

  const recommendation = input.recommendationId
    ? await prisma.matchRecommendation.findFirst({
        where: {
          id: input.recommendationId,
          companyId: input.companyId,
        },
        select: {
          id: true,
          opportunityId: true,
          type: true,
          qualityState: true,
        },
      })
    : null;

  if (input.recommendationId && !recommendation) {
    throw new AppError(ErrorCode.NOT_FOUND, "Recommendation not found.", 404);
  }

  if (REQUIRES_RECOMMENDATION.includes(eventType) && !recommendation) {
    throw new AppError(ErrorCode.NOT_FOUND, "Recommendation not found.", 404);
  }

  const opportunityId =
    recommendation?.opportunityId ?? input.opportunityId;
  if (recommendation && recommendation.opportunityId !== input.opportunityId) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "opportunityId does not match recommendation.",
      400,
    );
  }

  const opportunity = await prisma.matchingOpportunity.findFirst({
    where: { id: opportunityId },
    select: { id: true },
  });
  if (!opportunity) {
    throw new AppError(ErrorCode.NOT_FOUND, "Opportunity not found.", 404);
  }

  const idempotencyKey = input.idempotencyKey?.trim() || null;
  if (idempotencyKey) {
    const existing = await prisma.matchingBehaviorEvent.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId: input.companyId,
          idempotencyKey,
        },
      },
    });
    if (existing) {
      return {
        id: existing.id,
        companyId: existing.companyId,
        opportunityId: existing.opportunityId,
        recommendationId: existing.recommendationId,
        eventType: existing.eventType,
        recommendationType: existing.recommendationType,
        createdAt: existing.createdAt.toISOString(),
        duplicate: true,
      };
    }
  }

  const meta =
    input.metadata && typeof input.metadata === "object"
      ? (sanitizeMetadata(input.metadata) as Prisma.InputJsonValue)
      : undefined;

  let row;
  try {
    row = await prisma.matchingBehaviorEvent.create({
      data: {
        companyId: input.companyId,
        opportunityId,
        recommendationId: recommendation?.id ?? null,
        eventType,
        recommendationType: recommendation?.type ?? null,
        actorUserId: input.actorUserId ?? null,
        idempotencyKey,
        metadata: meta,
      },
    });
  } catch (error) {
    if (
      idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.matchingBehaviorEvent.findUnique({
        where: {
          companyId_idempotencyKey: {
            companyId: input.companyId,
            idempotencyKey,
          },
        },
      });
      if (existing) {
        return {
          id: existing.id,
          companyId: existing.companyId,
          opportunityId: existing.opportunityId,
          recommendationId: existing.recommendationId,
          eventType: existing.eventType,
          recommendationType: existing.recommendationType,
          createdAt: existing.createdAt.toISOString(),
          duplicate: true,
        };
      }
    }
    throw error;
  }

  if (recommendation) {
    const nextQuality = nextMatchQualityState(
      recommendation.qualityState as MatchQualityState,
      eventType,
    );
    const clearNew =
      eventType === "VIEW" ||
      eventType === "CLICK" ||
      eventType === "INTEREST" ||
      eventType === "DISMISS";
    await prisma.matchRecommendation.update({
      where: { id: recommendation.id },
      data: {
        qualityState: nextQuality,
        ...(clearNew ? { isNew: false } : {}),
        ...(eventType === "DISMISS" ? { status: "DISMISSED" as const } : {}),
      },
    });
  }

  await incrementMatchingDailyRollups({
    opportunityId,
    eventType,
    recommendationType: recommendation?.type ?? null,
  }).catch(() => {
    /* rollup best-effort */
  });

  if (
    eventType === "VIEW" ||
    eventType === "CLICK" ||
    eventType === "INTEREST" ||
    eventType === "DISMISS"
  ) {
    scheduleMatchingPreferenceRebuild(input.companyId);
  }

  return {
    id: row.id,
    companyId: row.companyId,
    opportunityId: row.opportunityId,
    recommendationId: row.recommendationId,
    eventType: row.eventType,
    recommendationType: row.recommendationType,
    createdAt: row.createdAt.toISOString(),
    duplicate: false,
  };
}

function sanitizeMetadata(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const allow = ["target", "surface", "day"];
  for (const key of allow) {
    if (typeof meta[key] === "string" && meta[key].length <= 64) {
      out[key] = meta[key];
    }
  }
  return out;
}

export function impressionIdempotencyKey(
  companyId: string,
  recommendationId: string,
  dayIso: string,
): string {
  return `impression:${companyId}:${recommendationId}:${dayIso}`;
}

export function engagementIdempotencyKey(
  eventType: MatchingBehaviorEventType | string,
  companyId: string,
  recommendationId: string,
): string {
  return `${String(eventType).toLowerCase()}:${companyId}:${recommendationId}`;
}
