/**
 * Super Admin Matching activation workflow:
 * enable Feature.matching_engine → optional TED ingest → generate for eligible companies.
 */

import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { setFeatureGlobal } from "@/services/entitlements";
import { matchingNonFixtureCompanyFilter } from "../fixtures";
import { MATCHING_ENGINE_FEATURE_KEY } from "../constants";
import { isMatchingEngineGloballyEnabled } from "../access";
import { generateMatchRecommendations } from "./service";
import { reconcileExpiredMatchingOpportunities } from "./lifecycle";
import { runTedOpportunityIngest } from "../ted/ingest";
import { getTedPublicSettings } from "../ted/config";
import {
  acquireMatchingPlatformRunLock,
  completeMatchingPlatformRun,
  failMatchingPlatformRun,
  getMatchingPlatformRunState,
  type MatchingPlatformRunState,
  type MatchingPlatformRunSummary,
} from "./platform-run";
import { getMatchingActivationReadiness } from "./activation-readiness";

const DEFAULT_COMPANY_LIMIT = 200;

export type MatchingActivationStatus = {
  matchingEnabledGlobal: boolean;
  run: MatchingPlatformRunState;
  activeOpportunities: number;
  eligibleProfiles: number;
  recommendationsVisible: number;
  readiness: Awaited<ReturnType<typeof getMatchingActivationReadiness>>;
  tedIngestEnabled: boolean;
  tedFiltersConfigured: boolean;
};

export async function getMatchingActivationStatus(): Promise<MatchingActivationStatus> {
  const [matchingEnabledGlobal, run, readiness, ted, activeOpportunities, recommendationsVisible] =
    await Promise.all([
      isMatchingEngineGloballyEnabled(),
      getMatchingPlatformRunState(),
      getMatchingActivationReadiness(),
      getTedPublicSettings(),
      prisma.matchingOpportunity.count({ where: { status: "ACTIVE" } }),
      prisma.matchRecommendation.count({
        where: { status: { in: ["ACTIVE", "READ"] } },
      }),
    ]);

  return {
    matchingEnabledGlobal,
    run,
    activeOpportunities,
    eligibleProfiles: readiness.eligibleCompanies,
    recommendationsVisible,
    readiness,
    tedIngestEnabled: ted.enabled === true,
    tedFiltersConfigured:
      ted.geographies.length > 0 || ted.cpvFilters.length > 0,
  };
}

async function listEligibleCompanyIds(limit: number): Promise<string[]> {
  const rows = await prisma.companyMatchingProfile.findMany({
    where: {
      eligible: true,
      company: matchingNonFixtureCompanyFilter(),
    },
    select: { companyId: true },
    take: Math.max(1, Math.min(limit, 500)),
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => r.companyId);
}

export type MatchingPlatformWorkflowResult = {
  matchingEnabledGlobal: boolean;
  run: MatchingPlatformRunState;
  summary: MatchingPlatformRunSummary;
};

/**
 * Opportunity refresh (TED) + recommendation generation for eligible companies.
 * Idempotent: opportunity upserts use source+externalRef; generate is locked per company.
 */
export async function runMatchingPlatformWorkflow(options?: {
  /** Attempt TED ingest (skipped cleanly when TED OFF / filters missing). */
  ingest?: boolean;
  /** Generate recommendations for eligible companies. */
  generate?: boolean;
  companyLimit?: number;
  /** Require Matching Feature globally ON before generate. */
  requireEnabled?: boolean;
}): Promise<MatchingPlatformWorkflowResult> {
  const ingest = options?.ingest !== false;
  const generate = options?.generate !== false;
  const companyLimit = options?.companyLimit ?? DEFAULT_COMPANY_LIMIT;
  const requireEnabled = options?.requireEnabled !== false;

  const enabled = await isMatchingEngineGloballyEnabled();
  if (requireEnabled && !enabled && generate) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Enable Matching before running generation.",
      403,
    );
  }

  const token = await acquireMatchingPlatformRunLock();
  const summary: MatchingPlatformRunSummary = {
    companiesProcessed: 0,
    companiesSucceeded: 0,
    companiesFailed: 0,
    recommendationsWritten: 0,
  };
  let opportunityRefreshed = false;

  try {
    await reconcileExpiredMatchingOpportunities(100).catch(() => undefined);

    if (ingest) {
      const tedResult = await runTedOpportunityIngest({
        // SA-triggered refresh may run even when worker schedule is OFF,
        // but still respects TED enabled + filter safety inside ingest
        // unless settings.enabled — then skippedReason is returned.
        force: false,
        writeActiveOnly: true,
      });
      summary.ingestRan = tedResult.ran;
      summary.ingestSkippedReason = tedResult.skippedReason ?? null;
      summary.opportunitiesUpserted = tedResult.upserted;
      summary.opportunitiesCreated = tedResult.created;
      summary.opportunitiesUpdated = tedResult.updated;
      if (tedResult.ran) opportunityRefreshed = true;
    }

    if (generate) {
      const companyIds = await listEligibleCompanyIds(companyLimit);
      for (const companyId of companyIds) {
        summary.companiesProcessed += 1;
        try {
          const result = await generateMatchRecommendations(companyId, {
            rebuildProfile: true,
          });
          summary.companiesSucceeded += 1;
          summary.recommendationsWritten += result.length;
        } catch {
          summary.companiesFailed += 1;
        }
      }
    }

    const run = await completeMatchingPlatformRun({
      token,
      summary,
      opportunityRefreshed,
    });

    return {
      matchingEnabledGlobal: await isMatchingEngineGloballyEnabled(),
      run,
      summary,
    };
  } catch (err) {
    const message =
      err instanceof AppError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Matching platform run failed.";
    const run = await failMatchingPlatformRun({
      token,
      error: message,
      summary,
    });
    if (err instanceof AppError && err.code === ErrorCode.CONFLICT) {
      throw err;
    }
    throw new AppError(ErrorCode.INTERNAL, run.lastErrorSafe ?? message, 500);
  }
}

/**
 * Enable or disable Matching Engine globally (Feature row).
 * On enable: runs opportunity refresh + generation workflow.
 * Idempotent enable when already ON (still may re-run workflow).
 */
export async function setMatchingEngineGlobalEnabled(input: {
  enabled: boolean;
  /** When enabling, run ingest+generate (default true). */
  runWorkflowOnEnable?: boolean;
}): Promise<MatchingPlatformWorkflowResult & { enabled: boolean }> {
  await setFeatureGlobal(MATCHING_ENGINE_FEATURE_KEY, input.enabled);

  if (!input.enabled) {
    const run = await getMatchingPlatformRunState();
    return {
      enabled: false,
      matchingEnabledGlobal: false,
      run,
      summary: {
        companiesProcessed: 0,
        companiesSucceeded: 0,
        companiesFailed: 0,
        recommendationsWritten: 0,
      },
    };
  }

  if (input.runWorkflowOnEnable === false) {
    const run = await getMatchingPlatformRunState();
    return {
      enabled: true,
      matchingEnabledGlobal: true,
      run,
      summary: {
        companiesProcessed: 0,
        companiesSucceeded: 0,
        companiesFailed: 0,
        recommendationsWritten: 0,
      },
    };
  }

  const result = await runMatchingPlatformWorkflow({
    ingest: true,
    generate: true,
    requireEnabled: true,
  });
  return { ...result, enabled: true };
}

/** Force TED ingest refresh only (still uses platform lock). */
export async function refreshMatchingOpportunitiesForAdmin(): Promise<MatchingPlatformWorkflowResult> {
  return runMatchingPlatformWorkflow({
    ingest: true,
    generate: false,
    requireEnabled: false,
  });
}

/** Run Matching Now — ingest (if TED allows) + generate. Requires Matching enabled. */
export async function runMatchingNowForAdmin(): Promise<MatchingPlatformWorkflowResult> {
  return runMatchingPlatformWorkflow({
    ingest: true,
    generate: true,
    requireEnabled: true,
  });
}
