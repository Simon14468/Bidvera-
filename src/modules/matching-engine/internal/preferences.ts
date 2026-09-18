import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  buildPreferenceWeightsFromEngagements,
  hashPreferenceWeights,
  type MatchingPreferenceWeights,
} from "@/domain/matching-engine";
import type { Prisma } from "@prisma/client";

export type CompanyMatchingPreferenceDto = {
  companyId: string;
  weights: MatchingPreferenceWeights;
  contentHash: string;
  version: number;
  builtAt: string;
};

/**
 * Rebuild soft preference snapshot from this company's behavior + public opp dims.
 * Never copies private company knowledge into the snapshot.
 */
export async function rebuildCompanyMatchingPreferences(
  companyId: string,
): Promise<CompanyMatchingPreferenceDto> {
  const events = await prisma.matchingBehaviorEvent.findMany({
    where: {
      companyId,
      eventType: { in: ["VIEW", "CLICK", "INTEREST", "DISMISS"] },
    },
    select: {
      eventType: true,
      opportunity: {
        select: {
          category: true,
          services: true,
          industries: true,
          industry: true,
          geographies: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const weights = buildPreferenceWeightsFromEngagements(
    events.map((e) => ({
      eventType: e.eventType,
      category: e.opportunity.category,
      services: e.opportunity.services,
      industries: e.opportunity.industries,
      industry: e.opportunity.industry,
      geographies: e.opportunity.geographies,
    })),
  );

  const contentHash = hashPreferenceWeights(weights);
  const existing = await prisma.companyMatchingPreferenceSnapshot.findUnique({
    where: { companyId },
  });

  const row =
    existing && existing.contentHash === contentHash
      ? await prisma.companyMatchingPreferenceSnapshot.update({
          where: { companyId },
          data: { builtAt: new Date() },
        })
      : await prisma.companyMatchingPreferenceSnapshot.upsert({
          where: { companyId },
          create: {
            companyId,
            weightsJson: weights as unknown as Prisma.InputJsonValue,
            contentHash,
            version: 1,
            builtAt: new Date(),
          },
          update: {
            weightsJson: weights as unknown as Prisma.InputJsonValue,
            contentHash,
            version: { increment: 1 },
            builtAt: new Date(),
          },
        });

  return {
    companyId: row.companyId,
    weights: row.weightsJson as MatchingPreferenceWeights,
    contentHash: row.contentHash,
    version: row.version,
    builtAt: row.builtAt.toISOString(),
  };
}

export async function getCompanyMatchingPreferences(
  companyId: string,
): Promise<CompanyMatchingPreferenceDto | null> {
  const row = await prisma.companyMatchingPreferenceSnapshot.findUnique({
    where: { companyId },
  });
  if (!row) return null;
  return {
    companyId: row.companyId,
    weights: row.weightsJson as MatchingPreferenceWeights,
    contentHash: row.contentHash,
    version: row.version,
    builtAt: row.builtAt.toISOString(),
  };
}

/** Fire-and-forget preference rebuild — never block event ingest / dashboard. */
export function scheduleMatchingPreferenceRebuild(companyId: string): void {
  if (!companyId) return;
  void rebuildCompanyMatchingPreferences(companyId).catch(() => {
    /* best-effort */
  });
}

/** Content fingerprint helper for tests. */
export function fingerprintPreferencePayload(weights: MatchingPreferenceWeights): string {
  return createHash("sha256").update(JSON.stringify(weights)).digest("hex");
}
