/**
 * TED dry-run — Search + normalize + filter + validate, NO MatchingOpportunity writes.
 * Does not enable Matching Engine. Does not create recommendations.
 */

import { hashOpportunityMatchingContent } from "@/domain/matching-engine";
import { validateOpportunityIngest } from "@/domain/matching-engine/opportunity-validation";
import { AppError, ErrorCode } from "@/lib/errors";
import { logError, logInfo } from "@/services/observability";
import type { UpsertOpportunityInput } from "../internal/types";
import type { TedClientOptions } from "./client";
import {
  getTedPublicSettings,
  sanitizeTedErrorMessage,
  tedFiltersConfigured,
  type TedPublicSettings,
} from "./config";
import { TED_SOURCE } from "./constants";
import { fetchTedNoticesBounded } from "./fetch";
import { filterTedOpportunity, type TedRelevanceFilterConfig } from "./filter";
import {
  freshnessCutoffDate,
  formatTedPublicationDateYmd,
  isPublicationWithinFreshness,
} from "./freshness";
import { resolveIso3ToCountry } from "./geography";
import { normalizeTedNotice, type TedNormalizeMeta } from "./normalize";
import {
  evaluateTedPilotQuality,
  type TedPilotQualityCriteria,
  type TedPilotQualityResult,
  type TedPilotQualityVerdict,
} from "./quality";
import type { TedNoticeRaw } from "./types";

export type TedDryRunPreview = {
  externalRef: string;
  title: string;
  summary: string | null;
  status: "ACTIVE" | "DRAFT";
  services: string[];
  category: string | null;
  industry: string | null;
  geographies: string[];
  certifications: string[];
  sizeBand: string | null;
  experienceHint: string | null;
  deadline: string | null;
  publicationDate: string | null;
  source: string;
  sourceUrl: string;
  contentHash: string;
  formType: string | null;
  noticeType: string | null;
};

export type TedDryRunQualityMetrics = {
  freshnessDays: number;
  freshnessCutoffYmd: string | null;
  publicationDateMin: string | null;
  publicationDateMax: string | null;
  freshnessCompliancePct: number | null;
  deadlineCoveragePct: number;
  missingCriticalFields: {
    missingTitle: number;
    missingPublicationNumber: number;
    missingCpv: number;
    missingGeography: number;
    missingDeadline: number;
    missingPublicationDate: number;
  };
  countryCounts: Record<string, number>;
  zeroResultCountries: string[];
  countriesWithHits: string[];
};

export type TedDryRunReport = {
  mode: "dry-run";
  wroteToDatabase: false;
  matchingEngineTouched: false;
  query: string;
  pagesFetched: number;
  fetched: number;
  normalized: number;
  malformed: number;
  filteredOut: number;
  validationRejected: number;
  activeCandidates: number;
  draftCandidates: number;
  acceptedCandidates: number;
  rejectionReasons: Record<string, number>;
  cpvDistribution: Record<string, number>;
  geographyDistribution: Record<string, number>;
  deadlineDistribution: {
    withDeadline: number;
    withoutDeadline: number;
    future: number;
    past: number;
  };
  duplicatesInBatch: number;
  quality: TedDryRunQualityMetrics;
  qualityVerdict: TedPilotQualityVerdict;
  qualityEvaluation: TedPilotQualityResult;
  preview: TedDryRunPreview[];
  durationMs: number;
};

export type TedDryRunOptions = {
  settings?: TedPublicSettings;
  client?: TedClientOptions;
  notices?: TedNoticeRaw[];
  now?: Date;
  previewLimit?: number;
  qualityCriteria?: TedPilotQualityCriteria;
};

function toFilterConfig(
  settings: TedPublicSettings,
  now: Date,
): TedRelevanceFilterConfig {
  return {
    geographies: settings.geographies,
    cpvFilters: settings.cpvFilters,
    formTypes: settings.formTypes,
    requireDeadline: settings.requireDeadline,
    excludePastDeadline: settings.excludePastDeadline,
    freshnessDays: settings.freshnessDays ?? 0,
    now,
  };
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

function configuredCountryLabels(geographies: string[]): string[] {
  const labels = new Set<string>();
  for (const raw of geographies) {
    const t = raw.trim();
    if (!t) continue;
    if (/^[A-Za-z]{3}$/.test(t)) {
      const name = resolveIso3ToCountry(t);
      if (name) labels.add(name);
    } else if (!/^[A-Za-z]{2}$/.test(t)) {
      labels.add(t);
    } else {
      const name = resolveIso3ToCountry(t);
      if (name) labels.add(name);
    }
  }
  return [...labels].sort();
}

function toPreview(
  input: UpsertOpportunityInput,
  meta: TedNormalizeMeta,
): TedDryRunPreview {
  const contentHash = hashOpportunityMatchingContent({
    title: input.title,
    summary: input.summary,
    category: input.category,
    industry: input.industry,
    services: input.services,
    industries: input.industries,
    geographies: input.geographies,
    certifications: input.certifications,
    sizeBand: input.sizeBand,
    experienceHint: input.experienceHint,
    deadline: input.deadline,
    signalsJson: input.signalsJson,
    sponsored: false,
  });
  return {
    externalRef: input.externalRef ?? meta.publicationNumber,
    title: input.title,
    summary: input.summary ?? null,
    status: input.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
    services: input.services ?? [],
    category: input.category ?? null,
    industry: input.industry ?? null,
    geographies: input.geographies ?? [],
    certifications: input.certifications ?? [],
    sizeBand: input.sizeBand ?? null,
    experienceHint: input.experienceHint ?? null,
    deadline: input.deadline
      ? typeof input.deadline === "string"
        ? input.deadline
        : input.deadline.toISOString()
      : null,
    publicationDate: meta.publicationDateRaw,
    source: input.source ?? TED_SOURCE,
    sourceUrl: meta.sourceUrl,
    contentHash,
    formType: meta.formType,
    noticeType: meta.noticeType,
  };
}

/**
 * Controlled dry-run. Never upserts. Never enables Matching Engine.
 */
export async function runTedOpportunityDryRun(
  options?: TedDryRunOptions,
): Promise<TedDryRunReport> {
  const settings = options?.settings ?? (await getTedPublicSettings());
  const startedAt = Date.now();
  const previewLimit = Math.min(Math.max(options?.previewLimit ?? 10, 1), 25);
  const now = options?.now ?? new Date();

  if (settings.requireFiltersConfigured && !tedFiltersConfigured(settings)) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "TED dry-run requires geography or CPV filters when requireFiltersConfigured=true.",
      400,
    );
  }

  const rejectionReasons: Record<string, number> = {};
  const cpvDistribution: Record<string, number> = {};
  const geographyDistribution: Record<string, number> = {};
  const deadlineDistribution = {
    withDeadline: 0,
    withoutDeadline: 0,
    future: 0,
    past: 0,
  };
  const missingCriticalFields = {
    missingTitle: 0,
    missingPublicationNumber: 0,
    missingCpv: 0,
    missingGeography: 0,
    missingDeadline: 0,
    missingPublicationDate: 0,
  };

  let normalized = 0;
  let malformed = 0;
  let filteredOut = 0;
  let validationRejected = 0;
  let activeCandidates = 0;
  let draftCandidates = 0;
  let duplicatesInBatch = 0;
  let freshAccepted = 0;
  let acceptedWithFutureDeadline = 0;
  const seenRefs = new Set<string>();
  const accepted: TedDryRunPreview[] = [];
  const pubDates: Date[] = [];
  const filterConfig = toFilterConfig(settings, now);
  const configuredCountries = configuredCountryLabels(settings.geographies);

  try {
    const fetchedBundle = await fetchTedNoticesBounded(settings, {
      client: options?.client,
      notices: options?.notices,
    });
    const notices = fetchedBundle.notices;

    for (const notice of notices) {
      const result = normalizeTedNotice(notice, { now });
      if (!result.ok) {
        malformed += 1;
        bump(rejectionReasons, `malformed: ${result.reason}`);
        if (/publication-number/i.test(result.reason)) {
          missingCriticalFields.missingPublicationNumber += 1;
        }
        if (/notice-title/i.test(result.reason)) {
          missingCriticalFields.missingTitle += 1;
        }
        continue;
      }
      normalized += 1;

      if (!result.meta.rawCpvs.length) missingCriticalFields.missingCpv += 1;
      if (!(result.input.geographies ?? []).length) {
        missingCriticalFields.missingGeography += 1;
      }
      if (!result.input.deadline) missingCriticalFields.missingDeadline += 1;
      if (!result.meta.publicationDateParsed) {
        missingCriticalFields.missingPublicationDate += 1;
      }

      const ref = result.input.externalRef ?? result.meta.publicationNumber;
      if (seenRefs.has(ref)) {
        duplicatesInBatch += 1;
        bump(rejectionReasons, "duplicate publication-number in batch");
        continue;
      }
      seenRefs.add(ref);

      const decision = filterTedOpportunity(
        result.input,
        result.meta,
        filterConfig,
      );
      if (!decision.accept) {
        filteredOut += 1;
        bump(rejectionReasons, `filter: ${decision.reason}`);
        continue;
      }

      const validation = validateOpportunityIngest(result.input);
      if (!validation.ok) {
        validationRejected += 1;
        bump(
          rejectionReasons,
          `validation: ${validation.reasons.join("; ")}`,
        );
        continue;
      }

      for (const svc of result.input.services ?? []) bump(cpvDistribution, svc);
      for (const geo of result.input.geographies ?? []) {
        bump(geographyDistribution, geo);
      }

      if (result.meta.publicationDateParsed) {
        pubDates.push(result.meta.publicationDateParsed);
        if (
          isPublicationWithinFreshness(
            result.meta.publicationDateParsed,
            settings.freshnessDays ?? 0,
            now,
          )
        ) {
          freshAccepted += 1;
        }
      }

      if (result.input.deadline) {
        deadlineDistribution.withDeadline += 1;
        const d =
          typeof result.input.deadline === "string"
            ? new Date(result.input.deadline)
            : result.input.deadline;
        if (!Number.isNaN(d.getTime()) && d.getTime() > now.getTime()) {
          deadlineDistribution.future += 1;
          acceptedWithFutureDeadline += 1;
        } else {
          deadlineDistribution.past += 1;
        }
      } else {
        deadlineDistribution.withoutDeadline += 1;
      }

      if (result.input.status === "ACTIVE") activeCandidates += 1;
      else draftCandidates += 1;

      accepted.push(toPreview(result.input, result.meta));
    }

    const acceptedCount = accepted.length;
    const deadlineCoveragePct =
      acceptedCount === 0
        ? 0
        : (acceptedWithFutureDeadline / acceptedCount) * 100;
    const freshnessCompliancePct =
      (settings.freshnessDays ?? 0) > 0
        ? acceptedCount === 0
          ? 0
          : (freshAccepted / acceptedCount) * 100
        : null;

    const countriesWithHits = Object.keys(geographyDistribution).sort();
    const zeroResultCountries = configuredCountries.filter(
      (c) => !countriesWithHits.includes(c),
    );

    const cutoff = freshnessCutoffDate(settings.freshnessDays ?? 0, now);
    const quality: TedDryRunQualityMetrics = {
      freshnessDays: settings.freshnessDays ?? 0,
      freshnessCutoffYmd: cutoff ? formatTedPublicationDateYmd(cutoff) : null,
      publicationDateMin: pubDates.length
        ? formatTedPublicationDateYmd(
            new Date(Math.min(...pubDates.map((d) => d.getTime()))),
          )
        : null,
      publicationDateMax: pubDates.length
        ? formatTedPublicationDateYmd(
            new Date(Math.max(...pubDates.map((d) => d.getTime()))),
          )
        : null,
      freshnessCompliancePct,
      deadlineCoveragePct,
      missingCriticalFields,
      countryCounts: { ...geographyDistribution },
      zeroResultCountries,
      countriesWithHits,
    };

    const qualityEvaluation = evaluateTedPilotQuality(
      {
        activeCandidates,
        acceptedCandidates: acceptedCount,
        deadlineCoveragePct,
        freshnessCompliancePct,
        freshnessDays: settings.freshnessDays ?? 0,
        countriesWithHits,
        configuredCountries,
        zeroResultCountries,
      },
      options?.qualityCriteria,
    );

    const report: TedDryRunReport = {
      mode: "dry-run",
      wroteToDatabase: false,
      matchingEngineTouched: false,
      query: fetchedBundle.query,
      pagesFetched: fetchedBundle.pagesFetched,
      fetched: notices.length,
      normalized,
      malformed,
      filteredOut,
      validationRejected,
      activeCandidates,
      draftCandidates,
      acceptedCandidates: acceptedCount,
      rejectionReasons,
      cpvDistribution,
      geographyDistribution,
      deadlineDistribution,
      duplicatesInBatch,
      quality,
      qualityVerdict: qualityEvaluation.verdict,
      qualityEvaluation,
      preview: accepted.slice(0, previewLimit),
      durationMs: Date.now() - startedAt,
    };

    logInfo("matching_engine.ted.dry_run.completed", {
      source: TED_SOURCE,
      fetched: report.fetched,
      acceptedCandidates: report.acceptedCandidates,
      activeCandidates: report.activeCandidates,
      filteredOut: report.filteredOut,
      qualityVerdict: report.qualityVerdict,
      deadlineCoveragePct,
      freshnessCompliancePct,
      durationMs: report.durationMs,
      wroteToDatabase: false,
    });

    return report;
  } catch (error) {
    const safe = sanitizeTedErrorMessage(error);
    logError("matching_engine.ted.dry_run.failed", {
      source: TED_SOURCE,
      error: safe,
      durationMs: Date.now() - startedAt,
    });
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.INTERNAL, `TED dry-run failed: ${safe}`, 502);
  }
}
