import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  buildMatchingProfileRecord,
  computeFinalRankScore,
  deriveMatchingProfileSnapshot,
  geographyProximityBoost,
  isOpportunityLiveForMatching,
  isOpportunitySponsoredForMatching,
  MATCHING_OPPORTUNITY_BATCH_SIZE,
  normalizeMatchingIntentDirection,
  opportunityToMatchingSignals,
  preferenceAffinityScore,
  refineEligibleWithAiAssist,
  scoreCompanyOpportunityMatch,
  compareMatchRank,
  validateOpportunityIngest,
  AI_REFINE_BOOST_MAX,
  buildProjectIdentityKey,
  withProjectIdentityKey,
  projectContentSimilarity,
  PROJECT_NEAR_DUPLICATE_THRESHOLD,
  publicFitFromMatchedDimensions,
  type MatchingPreferenceWeights,
  type MatchingProfileSnapshot,
} from "@/domain/matching-engine";
import type {
  CompanyMatchingProfileDto,
  MatchRecommendationDto,
  PublicOpportunityDto,
  UpsertOpportunityInput,
} from "./types";
import type { Prisma } from "@prisma/client";
import {
  computeOpportunityContentHash,
  invalidateRecommendationsForOpportunity,
} from "./lifecycle";
import { recordMatchingBehaviorEvent } from "./events";
import { getCompanyMatchingPreferences } from "./preferences";
import {
  getMatchingAiRuntimeConfig,
} from "./ai-config";
import { createMatchingAiStructuredRefineFn } from "./ai-provider";
import { isMatchingSponsorshipGloballyEnabled } from "./sponsorship-settings";
import { withMatchingGenerateLock } from "./generate-lock";
import { reconcileOpportunitySponsoredFlag } from "./sponsorship";
import { logError, logInfo } from "@/services/observability";

function toPublicOpportunity(row: {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  industry: string | null;
  services: string[];
  industries: string[];
  geographies: string[];
  certifications: string[];
  sizeBand: string | null;
  experienceHint: string | null;
  deadline: Date | null;
  source: string;
  externalRef: string | null;
  status: PublicOpportunityDto["status"];
  sponsored: boolean;
  intentDirection?: PublicOpportunityDto["intentDirection"] | null;
}): PublicOpportunityDto {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    industry: row.industry,
    services: row.services,
    industries: row.industries,
    geographies: row.geographies,
    certifications: row.certifications,
    sizeBand: row.sizeBand,
    experienceHint: row.experienceHint,
    deadline: row.deadline?.toISOString() ?? null,
    source: row.source,
    externalRef: row.externalRef,
    status: row.status,
    sponsored: row.sponsored,
    intentDirection: row.intentDirection ?? "UNSPECIFIED",
  };
}

function toRecommendationDto(row: {
  id: string;
  type: MatchRecommendationDto["type"];
  score: number;
  confidence: number;
  reasons: string[];
  explanation: string | null;
  status: MatchRecommendationDto["status"];
  qualityState?: MatchRecommendationDto["qualityState"] | null;
  preferenceBoost?: number | null;
  geographyBoost?: number | null;
  aiRefineBoost?: number | null;
  finalRankScore?: number | null;
  isNew?: boolean | null;
  rankedAt: Date;
  matchedDimensions?: unknown;
  opportunity: Parameters<typeof toPublicOpportunity>[0];
}): MatchRecommendationDto {
  const fit = publicFitFromMatchedDimensions(row.matchedDimensions, {
    opportunityServices: row.opportunity.services,
    reasons: row.reasons,
  });
  return {
    id: row.id,
    type: row.type,
    score: row.score,
    confidence: row.confidence,
    reasons: row.reasons,
    explanation: row.explanation,
    status: row.status,
    qualityState: row.qualityState ?? "NONE",
    preferenceBoost: row.preferenceBoost ?? 0,
    geographyBoost: row.geographyBoost ?? 0,
    aiRefineBoost: row.aiRefineBoost ?? 0,
    finalRankScore: row.finalRankScore ?? row.score,
    isNew: row.isNew ?? false,
    rankedAt: row.rankedAt.toISOString(),
    opportunity: toPublicOpportunity(row.opportunity),
    capabilityChips: fit.capabilityChips,
    gapNotes: fit.gapNotes,
    matchedLabels: fit.matchedLabels,
  };
}

async function loadSourceInput(companyId: string) {
  const [company, sq, verifiedEvidence, dcmDocs, approvedDrafts, notificationPrefs] =
    await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          country: true,
          companySize: true,
          profile: {
            select: {
              industry: true,
              country: true,
              companySize: true,
              experienceLevel: true,
              services: true,
              certifications: true,
              experienceYears: true,
              geographicCoverage: true,
              employeeRange: true,
            },
          },
        },
      }),
      prisma.supplierQualificationProfile.findUnique({
        where: { companyId },
        select: {
          country: true,
          businessSectors: true,
          servicesProducts: true,
          certifications: true,
          geographicCoverage: true,
          employeeCount: true,
          yearEstablished: true,
        },
      }),
      prisma.supplierQualificationEvidence.findMany({
        where: { companyId, verified: true },
        select: { title: true, kind: true },
        take: 100,
      }),
      prisma.complianceDocument.findMany({
        where: {
          companyId,
          status: { in: ["VALID", "EXPIRING_SOON", "NO_EXPIRY"] },
        },
        select: {
          category: { select: { key: true, label: true } },
        },
        take: 100,
      }),
      prisma.questionnaireDraftAnswer.findMany({
        where: {
          companyId,
          status: { in: ["APPROVED", "EDITED"] },
        },
        select: {
          draftText: true,
          editedText: true,
          status: true,
        },
        take: 50,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.companyNotificationPrefs.findUnique({
        where: { companyId },
        select: { timezone: true },
      }),
    ]);

  if (!company) {
    throw new AppError(ErrorCode.NOT_FOUND, "Company not found.", 404);
  }

  const approvedQuestionnaireHints = approvedDrafts
    .map((d) => (d.status === "EDITED" ? d.editedText : d.draftText) ?? "")
    .map((t) => t.trim())
    .filter((t) => t.length >= 8)
    .map((t) => t.slice(0, 120));

  const dcmValidCategories = dcmDocs.map((d) => ({
    key: d.category.key,
    label: d.category.label,
  }));

  const { isValidIanaTimeZone } = await import("@/lib/timezones");
  const rawTimezone = notificationPrefs?.timezone?.trim() ?? "";
  const timezone =
    rawTimezone && isValidIanaTimeZone(rawTimezone) ? rawTimezone : null;

  return {
    company: {
      country: company.country,
      companySize: company.companySize,
    },
    profile: company.profile,
    sq,
    verifiedEvidence,
    dcmValidCategories,
    approvedQuestionnaireHints,
    timezone,
  };
}

export type MatchingProfilePreview = {
  companyId: string;
  derived: {
    snapshot: MatchingProfileSnapshot;
    eligible: boolean;
    completeness: number;
    contentHash: string;
    trustSummary: { strong: number; normal: number; soft: number };
  };
  stored: {
    eligible: boolean;
    completeness: number;
    contentHash: string | null;
    builtAt: string | null;
    version: number;
  } | null;
  /** True when stored row is missing or contentHash differs from live derive. */
  propagationStale: boolean;
  /** Capability/geo present in derived but absent from stored snapshot (when stored exists). */
  lostSignals: string[];
};

/**
 * Read-only Matching Profile preview from live Bidvera sources.
 * Does NOT write CompanyMatchingProfile. Safe for audits / SA diagnostics.
 */
export async function previewCompanyMatchingProfile(
  companyId: string,
): Promise<MatchingProfilePreview> {
  const source = await loadSourceInput(companyId);
  const snapshot = deriveMatchingProfileSnapshot(source);
  const built = buildMatchingProfileRecord(snapshot);
  const existing = await prisma.companyMatchingProfile.findUnique({
    where: { companyId },
  });

  const lostSignals: string[] = [];
  if (existing?.snapshotJson && typeof existing.snapshotJson === "object") {
    const storedSnap = existing.snapshotJson as MatchingProfileSnapshot;
    const storedServices = new Set(
      (storedSnap.services ?? []).map((s) => s.value.toLowerCase()),
    );
    const storedGeos = new Set(
      (storedSnap.geographies ?? []).map((g) => g.value.toLowerCase()),
    );
    for (const s of snapshot.services) {
      if (s.trust === "soft") continue;
      if (!storedServices.has(s.value.toLowerCase())) {
        lostSignals.push(`service:${s.value}`);
      }
    }
    for (const g of snapshot.geographies) {
      if (!storedGeos.has(g.value.toLowerCase())) {
        lostSignals.push(`geography:${g.value}`);
      }
    }
  }

  return {
    companyId,
    derived: {
      snapshot,
      eligible: built.eligible,
      completeness: built.completeness,
      contentHash: built.contentHash,
      trustSummary: built.trustSummary,
    },
    stored: existing
      ? {
          eligible: existing.eligible,
          completeness: existing.completeness,
          contentHash: existing.contentHash,
          builtAt: existing.builtAt.toISOString(),
          version: existing.version,
        }
      : null,
    propagationStale:
      !existing || existing.contentHash !== built.contentHash,
    lostSignals,
  };
}

/**
 * Build or refresh CompanyMatchingProfile from existing Bidvera sources.
 * Idempotent on contentHash — bumps version only when snapshot changes.
 */
export async function rebuildCompanyMatchingProfile(
  companyId: string,
): Promise<CompanyMatchingProfileDto> {
  const source = await loadSourceInput(companyId);
  const snapshot = deriveMatchingProfileSnapshot(source);
  const built = buildMatchingProfileRecord(snapshot);

  const existing = await prisma.companyMatchingProfile.findUnique({
    where: { companyId },
  });

  const row =
    existing && existing.contentHash === built.contentHash
      ? await prisma.companyMatchingProfile.update({
          where: { companyId },
          data: {
            builtAt: new Date(),
            eligible: built.eligible,
            completeness: built.completeness,
            trustSummary: built.trustSummary as Prisma.InputJsonValue,
          },
        })
      : await prisma.companyMatchingProfile.upsert({
          where: { companyId },
          create: {
            companyId,
            snapshotJson: built.snapshotJson as Prisma.InputJsonValue,
            eligible: built.eligible,
            completeness: built.completeness,
            contentHash: built.contentHash,
            version: 1,
            trustSummary: built.trustSummary as Prisma.InputJsonValue,
            builtAt: new Date(),
          },
          update: {
            snapshotJson: built.snapshotJson as Prisma.InputJsonValue,
            eligible: built.eligible,
            completeness: built.completeness,
            contentHash: built.contentHash,
            version: { increment: 1 },
            trustSummary: built.trustSummary as Prisma.InputJsonValue,
            builtAt: new Date(),
          },
        });

  return {
    companyId: row.companyId,
    eligible: row.eligible,
    completeness: row.completeness,
    contentHash: row.contentHash,
    version: row.version,
    builtAt: row.builtAt.toISOString(),
    snapshot: row.snapshotJson as MatchingProfileSnapshot,
  };
}

export async function getCompanyMatchingProfile(
  companyId: string,
): Promise<CompanyMatchingProfileDto | null> {
  const row = await prisma.companyMatchingProfile.findUnique({
    where: { companyId },
  });
  if (!row) return null;
  return {
    companyId: row.companyId,
    eligible: row.eligible,
    completeness: row.completeness,
    contentHash: row.contentHash,
    version: row.version,
    builtAt: row.builtAt.toISOString(),
    snapshot: row.snapshotJson as MatchingProfileSnapshot,
  };
}

function parseDeadline(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function liveOpportunityWhere(now = new Date()) {
  return {
    status: "ACTIVE" as const,
    OR: [{ deadline: null }, { deadline: { gt: now } }],
  };
}

/** Internal opportunity corpus boundary — public fields only.
 * Dedupes by (source, externalRef), then by project identity fingerprint,
 * then by near-duplicate content similarity — merge/update instead of cloning projects.
 */
export async function upsertMatchingOpportunity(
  input: UpsertOpportunityInput,
): Promise<PublicOpportunityDto> {
  const validation = validateOpportunityIngest(input);
  if (!validation.ok) {
    throw new AppError(ErrorCode.VALIDATION, validation.reasons.join(" "), 400);
  }

  const title = input.title?.trim();
  if (!title) {
    throw new AppError(ErrorCode.VALIDATION, "title is required.", 400);
  }

  const source = input.source?.trim() || "INTERNAL";
  const externalRef = input.externalRef?.trim() || null;
  const deadline = parseDeadline(input.deadline);
  const projectIdentityKey = buildProjectIdentityKey({
    title,
    source,
    externalRef,
    category: input.category,
    industry: input.industry,
    geographies: input.geographies,
    services: input.services,
    deadline,
    signalsJson: input.signalsJson,
  });
  const signalsWithIdentity = withProjectIdentityKey(
    input.signalsJson,
    projectIdentityKey,
  );
  const contentHash = computeOpportunityContentHash({
    title,
    summary: input.summary,
    category: input.category,
    industry: input.industry,
    services: input.services,
    industries: input.industries,
    geographies: input.geographies,
    certifications: input.certifications,
    sizeBand: input.sizeBand,
    experienceHint: input.experienceHint,
    deadline,
    signalsJson: signalsWithIdentity,
    // Sponsored is owned exclusively by MatchingSponsorship sync — never from client.
    sponsored: false,
  });

  const status = input.status ?? "DRAFT";
  const intentDirection = normalizeMatchingIntentDirection(input.intentDirection);

  let existing =
    input.id
      ? await prisma.matchingOpportunity.findUnique({ where: { id: input.id } })
      : null;
  if (!existing && externalRef) {
    existing = await prisma.matchingOpportunity.findUnique({
      where: { source_externalRef: { source, externalRef } },
    });
  }
  // Same real-world project under a different ingest path → merge into existing row.
  if (!existing) {
    const byIdentity = await prisma.matchingOpportunity.findFirst({
      where: {
        status: { in: ["DRAFT", "ACTIVE", "PAUSED"] },
        signalsJson: {
          path: ["projectIdentityKey"],
          equals: projectIdentityKey,
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (byIdentity) existing = byIdentity;
  }
  if (!existing && !externalRef) {
    // Bounded near-dup scan: same source + recent ACTIVE/DRAFT with high title similarity.
    const candidates = await prisma.matchingOpportunity.findMany({
      where: {
        source,
        status: { in: ["DRAFT", "ACTIVE", "PAUSED"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        category: true,
        industry: true,
        geographies: true,
        services: true,
        deadline: true,
        signalsJson: true,
        source: true,
        externalRef: true,
        contentHash: true,
        status: true,
      },
    });
    const probe = {
      title,
      source,
      externalRef,
      category: input.category,
      industry: input.industry,
      geographies: input.geographies,
      services: input.services,
      deadline,
      signalsJson: signalsWithIdentity,
    };
    for (const cand of candidates) {
      const sim = projectContentSimilarity(probe, {
        title: cand.title,
        source: cand.source,
        externalRef: cand.externalRef,
        category: cand.category,
        industry: cand.industry,
        geographies: cand.geographies,
        services: cand.services,
        deadline: cand.deadline,
        signalsJson: cand.signalsJson,
      });
      if (sim >= PROJECT_NEAR_DUPLICATE_THRESHOLD) {
        existing = await prisma.matchingOpportunity.findUnique({
          where: { id: cand.id },
        });
        break;
      }
    }
  }

  // When merging into an existing project row, preserve its natural key.
  const writeSource = existing ? existing.source : source;
  const writeExternalRef = existing ? existing.externalRef : externalRef;

  const data = {
    title,
    summary: input.summary?.trim() || null,
    category: input.category?.trim() || null,
    industry: input.industry?.trim() || null,
    services: input.services ?? [],
    industries: input.industries ?? [],
    geographies: input.geographies ?? [],
    certifications: input.certifications ?? [],
    sizeBand: input.sizeBand?.trim() || null,
    experienceHint: input.experienceHint?.trim() || null,
    deadline,
    source: writeSource,
    externalRef: writeExternalRef,
    status,
    intentDirection,
    contentHash,
    sponsorshipMeta:
      input.sponsorshipMeta === undefined
        ? undefined
        : (input.sponsorshipMeta as Prisma.InputJsonValue),
    signalsJson: signalsWithIdentity as Prisma.InputJsonValue,
    ...(status === "ACTIVE" ? { publishedAt: new Date(), expiredAt: null, pausedAt: null } : {}),
  };

  let row;
  let materialChange = true;
  if (existing) {
    materialChange = existing.contentHash !== contentHash || existing.status !== status;
    row = await prisma.matchingOpportunity.update({
      where: { id: existing.id },
      data,
    });
  } else {
    row = await prisma.matchingOpportunity.create({ data });
  }

  // Denormalized sponsored flag: live MatchingSponsorship only (ignore client input).
  const sponsored = await reconcileOpportunitySponsoredFlag(row.id);

  if (!isOpportunityLiveForMatching(row)) {
    // Soft-hide only (list/generate live filter). Never mass-dismiss tenants.
    await invalidateRecommendationsForOpportunity(row.id);
  } else if (materialChange && existing) {
    // Content/status changed while live — leave recs; companies regenerate async.
  }

  return toPublicOpportunity({ ...row, sponsored });
}

const OPPORTUNITY_BATCH_MAX = 100;

/**
 * SA/internal batch upsert for corpus bootstrap — idempotent by (source, externalRef).
 * Stops collecting after OPPORTUNITY_BATCH_MAX items. Does not scrape.
 */
export async function upsertMatchingOpportunityBatch(
  inputs: UpsertOpportunityInput[],
): Promise<{
  upserted: PublicOpportunityDto[];
  created: number;
  updated: number;
  errors: { index: number; message: string }[];
}> {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new AppError(ErrorCode.VALIDATION, "opportunities array is required.", 400);
  }
  const slice = inputs.slice(0, OPPORTUNITY_BATCH_MAX);
  const upserted: PublicOpportunityDto[] = [];
  const errors: { index: number; message: string }[] = [];
  let created = 0;
  let updated = 0;
  for (let i = 0; i < slice.length; i++) {
    try {
      const input = slice[i]!;
      const source = input.source?.trim() || "INTERNAL";
      const externalRef = input.externalRef?.trim() || null;
      let existed = false;
      if (input.id) {
        const row = await prisma.matchingOpportunity.findUnique({
          where: { id: input.id },
          select: { id: true },
        });
        existed = Boolean(row);
      } else if (externalRef) {
        const row = await prisma.matchingOpportunity.findUnique({
          where: { source_externalRef: { source, externalRef } },
          select: { id: true },
        });
        existed = Boolean(row);
      }
      upserted.push(await upsertMatchingOpportunity(input));
      if (existed) updated += 1;
      else created += 1;
    } catch (error) {
      const message =
        error instanceof AppError
          ? error.message
          : error instanceof Error
            ? error.message
            : "upsert failed";
      errors.push({ index: i, message });
    }
  }
  return { upserted, created, updated, errors };
}

export async function getMatchingOpportunityPublic(
  opportunityId: string,
): Promise<PublicOpportunityDto | null> {
  const row = await prisma.matchingOpportunity.findFirst({
    where: { id: opportunityId, ...liveOpportunityWhere() },
  });
  return row ? toPublicOpportunity(row) : null;
}

async function upsertRecommendationPreservingState(input: {
  companyId: string;
  opportunityId: string;
  type: "ORGANIC" | "SPONSORED";
  score: number;
  confidence: number;
  matchedDimensions: Prisma.InputJsonValue;
  reasons: string[];
  explanation: string;
  rankedAt: Date;
  preferenceBoost: number;
  geographyBoost: number;
  aiRefineBoost: number;
  finalRankScore: number;
  existing?: { id: string; status: string; isNew: boolean } | null;
}): Promise<{ id: string; isNew: boolean; created: boolean }> {
  const existing =
    input.existing !== undefined
      ? input.existing
      : await prisma.matchRecommendation.findUnique({
          where: {
            companyId_opportunityId: {
              companyId: input.companyId,
              opportunityId: input.opportunityId,
            },
          },
          select: { id: true, status: true, isNew: true },
        });

  const preservedStatus =
    existing?.status === "DISMISSED" || existing?.status === "READ"
      ? existing.status
      : ("ACTIVE" as const);

  // Retention: brand-new rows are isNew; preserve until engagement clears it.
  const isNew = existing ? existing.isNew : true;

  const row = await prisma.matchRecommendation.upsert({
    where: {
      companyId_opportunityId: {
        companyId: input.companyId,
        opportunityId: input.opportunityId,
      },
    },
    create: {
      companyId: input.companyId,
      opportunityId: input.opportunityId,
      type: input.type,
      score: input.score,
      confidence: input.confidence,
      matchedDimensions: input.matchedDimensions,
      reasons: input.reasons,
      explanation: input.explanation,
      status: "ACTIVE",
      preferenceBoost: input.preferenceBoost,
      geographyBoost: input.geographyBoost,
      aiRefineBoost: input.aiRefineBoost,
      finalRankScore: input.finalRankScore,
      isNew: true,
      rankedAt: input.rankedAt,
    },
    update: {
      type: input.type,
      score: input.score,
      confidence: input.confidence,
      matchedDimensions: input.matchedDimensions,
      reasons: input.reasons,
      explanation: input.explanation,
      status: preservedStatus,
      preferenceBoost: input.preferenceBoost,
      geographyBoost: input.geographyBoost,
      aiRefineBoost: input.aiRefineBoost,
      finalRankScore: input.finalRankScore,
      isNew,
      rankedAt: input.rankedAt,
    },
    select: { id: true, isNew: true },
  });
  return { ...row, created: !existing };
}

type EligiblePending = {
  opportunityId: string;
  type: "ORGANIC" | "SPONSORED";
  score: number;
  confidence: number;
  matchedDimensions: Prisma.InputJsonValue;
  reasons: string[];
  explanation: string;
  title: string;
  summary: string | null;
  services: string[];
  category: string | null;
  industries: string[];
  industry: string | null;
  certifications: string[];
  geographies: string[];
  countries: string[];
};

export async function generateMatchRecommendations(
  companyId: string,
  options?: { rebuildProfile?: boolean; enableAiRefine?: boolean },
): Promise<MatchRecommendationDto[]> {
  return withMatchingGenerateLock(companyId, () =>
    generateMatchRecommendationsUnlocked(companyId, options),
  );
}

/**
 * Evaluate live ACTIVE opportunities against a company profile and upsert recommendations.
 * Batches past the former 500 hard cap. Preserves READ/DISMISSED user state.
 * Soft preference / geography / AI refine apply ONLY after 8C relevance gate.
 */
async function generateMatchRecommendationsUnlocked(
  companyId: string,
  options?: { rebuildProfile?: boolean; enableAiRefine?: boolean },
): Promise<MatchRecommendationDto[]> {
  const startedAt = Date.now();
  let opportunitiesProcessed = 0;
  let recommendationsCreated = 0;
  let recommendationsUpdated = 0;

  try {
    const profileDto =
      options?.rebuildProfile === false
        ? await getCompanyMatchingProfile(companyId)
        : await rebuildCompanyMatchingProfile(companyId);

    if (!profileDto) {
      throw new AppError(ErrorCode.NOT_FOUND, "Matching profile missing.", 404);
    }

    // Fail closed: incomplete / ineligible companies never receive recommendations.
    if (!profileDto.eligible) {
      logInfo("matching_engine.generate.fail_closed", {
        companyId,
        reason: "company_ineligible",
        durationMs: Date.now() - startedAt,
        profileCompleteness: profileDto.completeness,
      });
      return [];
    }

    const prefs = await getCompanyMatchingPreferences(companyId);
    const preferenceWeights: MatchingPreferenceWeights | null =
      prefs?.weights ?? null;
    const sponsorshipGlobalOn = await isMatchingSponsorshipGloballyEnabled();

    const companyGeos = [
      ...profileDto.snapshot.geographies.map((g) => g.value),
      ...(profileDto.snapshot.countries ?? []).map((c) => c.value),
    ];
    const companyServices = profileDto.snapshot.services
      .filter((s) => s.trust !== "soft")
      .map((s) => s.value);
    const servicesForRefine =
      companyServices.length > 0
        ? companyServices
        : profileDto.snapshot.services.map((s) => s.value);
    const companyIndustries = profileDto.snapshot.industries
      .filter((s) => s.trust !== "soft")
      .map((s) => s.value);
    const companyCertifications = [
      ...profileDto.snapshot.certifications,
      ...profileDto.snapshot.dcmCategories,
    ]
      .filter((s) => s.trust !== "soft")
      .map((s) => s.value);
    const companyCountries = (profileDto.snapshot.countries ?? []).map(
      (c) => c.value,
    );

    const now = new Date();
    const failedOpportunityIds: string[] = [];
    const eligible: EligiblePending[] = [];
    let cursorId: string | undefined;

    for (;;) {
      const batch = await prisma.matchingOpportunity.findMany({
        where: liveOpportunityWhere(now),
        take: MATCHING_OPPORTUNITY_BATCH_SIZE,
        orderBy: { id: "asc" },
        ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
      });
      if (batch.length === 0) break;

      for (const opp of batch) {
        opportunitiesProcessed += 1;
        if (!isOpportunityLiveForMatching({ ...opp, now })) {
          failedOpportunityIds.push(opp.id);
          continue;
        }

        const signals = opportunityToMatchingSignals(opp);
        const result = scoreCompanyOpportunityMatch({
          profile: profileDto.snapshot,
          opportunity: signals,
        });

        // Hard gate — AI / preferences must never bypass this.
        if (!result.meetsRelevanceThreshold) {
          failedOpportunityIds.push(opp.id);
          continue;
        }

        eligible.push({
          opportunityId: opp.id,
          type: isOpportunitySponsoredForMatching({
            globalEnabled: sponsorshipGlobalOn,
            opportunitySponsored: opp.sponsored,
          })
            ? "SPONSORED"
            : "ORGANIC",
          score: result.score,
          confidence: result.confidence,
          matchedDimensions: result.dimensions as unknown as Prisma.InputJsonValue,
          reasons: result.reasons,
          explanation: result.explanation,
          title: opp.title,
          summary: opp.summary,
          services: opp.services,
          category: opp.category,
          industries: opp.industries,
          industry: opp.industry,
          certifications: opp.certifications,
          geographies: opp.geographies,
          countries: signals.countries,
        });
      }

      cursorId = batch[batch.length - 1]!.id;
      if (batch.length < MATCHING_OPPORTUNITY_BATCH_SIZE) break;
    }

    const aiRuntime =
      options?.enableAiRefine === false
        ? null
        : await getMatchingAiRuntimeConfig();
    const enableAi = Boolean(aiRuntime?.ready);
    const aiStructuredRefine =
      enableAi && aiRuntime
        ? createMatchingAiStructuredRefineFn({
            provider: aiRuntime.provider,
            model: aiRuntime.model,
            apiKey: aiRuntime.apiKey,
          })
        : null;

    const aiResult = await refineEligibleWithAiAssist({
      companyServices: servicesForRefine,
      companyIndustries,
      companyCertifications,
      companyCountries,
      companyTimezone: profileDto.snapshot.timezone?.value ?? null,
      candidates: eligible.map((e) => ({
        opportunityId: e.opportunityId,
        title: e.title,
        summary: e.summary,
        services: e.services,
        category: e.category,
        industries: e.industries.length > 0 ? e.industries : e.industry ? [e.industry] : [],
        certifications: e.certifications,
        countries: e.countries,
        geographies: e.geographies,
        relevanceScore: e.score,
      })),
      enableAi,
      aiStructuredRefine,
    });

    // Prefetch existing recs once — avoid N+1 findUnique before each upsert.
    const existingRecs = await prisma.matchRecommendation.findMany({
      where: { companyId },
      select: { id: true, opportunityId: true, status: true, isNew: true },
    });
    const existingByOpp = new Map(
      existingRecs.map((r) => [r.opportunityId, r] as const),
    );

    const keptIds: string[] = [];
    const createdMatches: Array<{ opportunityId: string; title: string }> = [];
    for (const e of eligible) {
      const preferenceBoost = preferenceAffinityScore(preferenceWeights, e);
      const geographyBoost = geographyProximityBoost(companyGeos, [
        ...e.geographies,
        ...e.countries,
      ]);
      const aiRefineBoost = Math.min(
        AI_REFINE_BOOST_MAX,
        Math.max(0, aiResult.boosts[e.opportunityId] ?? 0),
      );
      const finalRankScore = computeFinalRankScore({
        relevanceScore: e.score,
        preferenceBoost,
        geographyBoost,
        aiRefineBoost,
      });

      const aiStructured = aiResult.structured[e.opportunityId];
      const explanation =
        aiStructured?.explanation && aiStructured.explanation.trim()
          ? `${e.explanation} AI: ${aiStructured.explanation}`
          : e.explanation;

      const row = await upsertRecommendationPreservingState({
        companyId,
        opportunityId: e.opportunityId,
        type: e.type,
        score: e.score,
        confidence: e.confidence,
        matchedDimensions: e.matchedDimensions,
        reasons: e.reasons,
        explanation,
        rankedAt: now,
        preferenceBoost,
        geographyBoost,
        aiRefineBoost,
        finalRankScore,
        existing: existingByOpp.get(e.opportunityId) ?? null,
      });
      if (row.created) {
        recommendationsCreated += 1;
        createdMatches.push({
          opportunityId: e.opportunityId,
          title: e.title ?? "",
        });
      } else {
        recommendationsUpdated += 1;
      }
      keptIds.push(row.id);
    }

    if (failedOpportunityIds.length > 0) {
      await prisma.matchRecommendation.deleteMany({
        where: {
          companyId,
          opportunityId: { in: failedOpportunityIds },
          status: { in: ["ACTIVE", "READ"] },
        },
      });
    }

    await prisma.matchRecommendation.updateMany({
      where: {
        companyId,
        status: "ACTIVE",
        id: { notIn: keptIds.length ? keptIds : ["__none__"] },
      },
      data: { status: "DISMISSED" },
    });

    const visible = await listMatchRecommendations(companyId, {
      limit: 50,
      offset: 0,
      status: "VISIBLE",
    });

    if (createdMatches.length > 0) {
      try {
        const { emitNewMatchedOpportunityAlerts } = await import(
          "./match-alerts"
        );
        await emitNewMatchedOpportunityAlerts({
          companyId,
          created: createdMatches,
        });
      } catch (alertError) {
        logError("matching_engine.alerts.new_matches_failed", {
          companyId,
          message:
            alertError instanceof Error ? alertError.message : "unknown",
        });
      }
    }

    logInfo("matching_engine.generate.completed", {
      companyId,
      durationMs: Date.now() - startedAt,
      eligibleCompany: profileDto.eligible,
      profileCompleteness: profileDto.completeness,
      opportunitiesProcessed,
      eligibleCount: eligible.length,
      failedCount: failedOpportunityIds.length,
      recommendationsCreated,
      recommendationsUpdated,
      visibleCount: visible.length,
      aiUsed: aiResult.usedAi,
      aiReason: aiResult.reason,
      sponsorshipGlobalOn,
    });

    return visible;
  } catch (error) {
    logError("matching_engine.generate.failed", {
      companyId,
      durationMs: Date.now() - startedAt,
      opportunitiesProcessed,
      recommendationsCreated,
      recommendationsUpdated,
      message: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
}

export async function listMatchRecommendations(
  companyId: string,
  options?: {
    limit?: number;
    offset?: number;
    status?: "ACTIVE" | "READ" | "DISMISSED" | "VISIBLE";
  },
): Promise<MatchRecommendationDto[]> {
  const profile = await getCompanyMatchingProfile(companyId);
  if (!profile?.eligible) return [];

  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);
  const status = options?.status ?? "VISIBLE";
  const now = new Date();

  const statusWhere =
    status === "VISIBLE"
      ? { status: { in: ["ACTIVE" as const, "READ" as const] } }
      : { status };

  const rows = await prisma.matchRecommendation.findMany({
    where: {
      companyId,
      ...statusWhere,
      ...(status !== "DISMISSED"
        ? {
            opportunity: liveOpportunityWhere(now),
          }
        : {}),
    },
    select: {
      id: true,
      type: true,
      score: true,
      confidence: true,
      reasons: true,
      explanation: true,
      status: true,
      qualityState: true,
      preferenceBoost: true,
      geographyBoost: true,
      aiRefineBoost: true,
      finalRankScore: true,
      isNew: true,
      rankedAt: true,
      matchedDimensions: true,
      opportunity: {
        select: {
          id: true,
          title: true,
          summary: true,
          category: true,
          industry: true,
          services: true,
          industries: true,
          geographies: true,
          certifications: true,
          sizeBand: true,
          experienceHint: true,
          deadline: true,
          source: true,
          externalRef: true,
          status: true,
          sponsored: true,
          intentDirection: true,
        },
      },
    },
    orderBy: [
      { finalRankScore: "desc" },
      { score: "desc" },
      { confidence: "desc" },
      { rankedAt: "desc" },
      { id: "asc" },
    ],
    take: limit,
    skip: offset,
  });

  const sorted = [...rows].sort((a, b) => {
    const byRank = compareMatchRank(
      {
        score: a.score,
        confidence: a.confidence,
        finalRankScore: a.finalRankScore,
        type: a.type,
        id: a.id,
      },
      {
        score: b.score,
        confidence: b.confidence,
        finalRankScore: b.finalRankScore,
        type: b.type,
        id: b.id,
      },
    );
    if (byRank !== 0) return byRank;
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    return 0;
  });

  return sorted.map(toRecommendationDto);
}

/** Count net-new relevant matches for retention (no notification spam). */
export async function countNewRelevantMatches(
  companyId: string,
): Promise<number> {
  const now = new Date();
  return prisma.matchRecommendation.count({
    where: {
      companyId,
      isNew: true,
      status: { in: ["ACTIVE", "READ"] },
      opportunity: liveOpportunityWhere(now),
    },
  });
}

/** Lightweight dashboard fetch — persisted recommendations only. */
export async function getDashboardMatchedStrip(
  companyId: string,
  limit = 2,
): Promise<MatchRecommendationDto[]> {
  return listMatchRecommendations(companyId, {
    limit,
    offset: 0,
    status: "VISIBLE",
  });
}

export async function getMatchRecommendationForCompany(
  companyId: string,
  recommendationId: string,
): Promise<MatchRecommendationDto | null> {
  const row = await prisma.matchRecommendation.findFirst({
    where: { id: recommendationId, companyId },
    include: { opportunity: true },
  });
  return row ? toRecommendationDto(row) : null;
}

/** Company-scoped only — never mutates MatchingOpportunity. */
export async function markRecommendationRead(
  companyId: string,
  recommendationId: string,
): Promise<MatchRecommendationDto> {
  const existing = await prisma.matchRecommendation.findFirst({
    where: { id: recommendationId, companyId },
    include: { opportunity: true },
  });
  if (!existing) {
    throw new AppError(ErrorCode.NOT_FOUND, "Recommendation not found.", 404);
  }
  if (existing.status === "DISMISSED") {
    return toRecommendationDto(existing);
  }
  if (existing.status === "READ") {
    return toRecommendationDto(existing);
  }
  const row = await prisma.matchRecommendation.update({
    where: { id: recommendationId },
    data: { status: "READ", isNew: false },
    include: { opportunity: true },
  });
  try {
    const { markMatchedOpportunityAlertRead } = await import("./match-alerts");
    await markMatchedOpportunityAlertRead(companyId, existing.opportunityId);
  } catch {
    // Alert sync is best-effort — recommendation read already succeeded.
  }
  return toRecommendationDto(row);
}

/** Company-scoped only — never mutates MatchingOpportunity. */
export async function dismissRecommendation(
  companyId: string,
  recommendationId: string,
  actorUserId?: string | null,
): Promise<MatchRecommendationDto> {
  const existing = await prisma.matchRecommendation.findFirst({
    where: { id: recommendationId, companyId },
    include: { opportunity: true },
  });
  if (!existing) {
    throw new AppError(ErrorCode.NOT_FOUND, "Recommendation not found.", 404);
  }
  const row =
    existing.status === "DISMISSED"
      ? existing
      : await prisma.matchRecommendation.update({
          where: { id: recommendationId },
          data: { status: "DISMISSED" },
          include: { opportunity: true },
        });

  await recordMatchingBehaviorEvent({
    companyId,
    opportunityId: row.opportunityId,
    recommendationId: row.id,
    eventType: "DISMISS",
    actorUserId,
    idempotencyKey: `dismiss:${companyId}:${row.id}`,
  });

  try {
    const { markMatchedOpportunityAlertRead } = await import("./match-alerts");
    await markMatchedOpportunityAlertRead(companyId, row.opportunityId);
  } catch {
    // best-effort
  }

  return toRecommendationDto(row);
}
