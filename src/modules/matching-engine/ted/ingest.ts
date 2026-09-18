/**
 * TED → MatchingOpportunity ingest orchestrator.
 * Isolated from scoring / ranking / 8C–8G. Reuses upsertOpportunityBatch only.
 *
 * Live ingest stays OFF by default; call explicitly with settings.enabled.
 * Worker entry is gated and not an uncontrolled cron.
 */

import { validateOpportunityIngest } from "@/domain/matching-engine/opportunity-validation";
import { AppError, ErrorCode } from "@/lib/errors";
import { logError, logInfo } from "@/services/observability";
import { upsertMatchingOpportunityBatch } from "../internal/service";
import type { UpsertOpportunityInput } from "../internal/types";
import type { TedClientOptions } from "./client";
import {
  getTedPublicSettings,
  recordTedRunStats,
  sanitizeTedErrorMessage,
  tedFiltersConfigured,
  type TedPublicSettings,
} from "./config";
import { TED_SOURCE } from "./constants";
import { fetchTedNoticesBounded } from "./fetch";
import { filterTedOpportunity, type TedRelevanceFilterConfig } from "./filter";
import { normalizeTedNotice } from "./normalize";
import type { TedNoticeRaw } from "./types";

export type TedIngestRunResult = {
  ran: boolean;
  skippedReason?: string;
  fetched: number;
  normalized: number;
  filteredOut: number;
  validationRejected: number;
  draftSkipped: number;
  accepted: number;
  upserted: number;
  created: number;
  updated: number;
  upsertErrors: { index: number; message: string }[];
  malformed: number;
  rejectionReasons: Record<string, number>;
  acceptedExternalRefs: string[];
};

export type TedIngestRunOptions = {
  /** Override settings (tests). */
  settings?: TedPublicSettings;
  client?: TedClientOptions;
  /** Inject notices (unit tests) — skips HTTP. */
  notices?: TedNoticeRaw[];
  /** Force run even when enabled=false (tests only). */
  force?: boolean;
  /**
   * When true, only ACTIVE opportunities are written (validated + filtered).
   * DRAFT/incomplete rows are counted but not upserted.
   */
  writeActiveOnly?: boolean;
  now?: Date;
};

function toFilterConfig(settings: TedPublicSettings): TedRelevanceFilterConfig {
  return {
    geographies: settings.geographies,
    cpvFilters: settings.cpvFilters,
    formTypes: settings.formTypes,
    requireDeadline: settings.requireDeadline,
    excludePastDeadline: settings.excludePastDeadline,
    freshnessDays: settings.freshnessDays ?? 0,
  };
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

function emptyResult(skippedReason?: string): TedIngestRunResult {
  return {
    ran: false,
    skippedReason,
    fetched: 0,
    normalized: 0,
    filteredOut: 0,
    validationRejected: 0,
    draftSkipped: 0,
    accepted: 0,
    upserted: 0,
    created: 0,
    updated: 0,
    upsertErrors: [],
    malformed: 0,
    rejectionReasons: {},
    acceptedExternalRefs: [],
  };
}

/**
 * One bounded TED ingest pass → existing batch upsert.
 * Does not enable Matching Engine. Does not scrape.
 */
export async function runTedOpportunityIngest(
  options?: TedIngestRunOptions,
): Promise<TedIngestRunResult> {
  const settings = options?.settings ?? (await getTedPublicSettings());
  const writeActiveOnly = options?.writeActiveOnly ?? false;

  if (!options?.force && !settings.enabled) {
    return emptyResult("ted_ingest_disabled");
  }

  if (settings.requireFiltersConfigured && !tedFiltersConfigured(settings)) {
    const msg =
      "TED ingest requires at least one geography or CPV filter when requireFiltersConfigured=true.";
    if (!options?.settings) {
      await recordTedRunStats({ ok: false, errorSafe: msg }).catch(() => undefined);
    }
    return emptyResult("filters_not_configured");
  }

  const startedAt = Date.now();
  let fetched = 0;
  let normalized = 0;
  let filteredOut = 0;
  let malformed = 0;
  let validationRejected = 0;
  let draftSkipped = 0;
  const rejectionReasons: Record<string, number> = {};
  const accepted: UpsertOpportunityInput[] = [];
  const filterConfig = toFilterConfig(settings);

  try {
    const bundle = await fetchTedNoticesBounded(settings, {
      client: options?.client,
      notices: options?.notices,
    });
    fetched = bundle.notices.length;

    for (const notice of bundle.notices) {
      const result = normalizeTedNotice(notice, { now: options?.now });
      if (!result.ok) {
        malformed += 1;
        bump(rejectionReasons, `malformed: ${result.reason}`);
        continue;
      }
      normalized += 1;
      const decision = filterTedOpportunity(result.input, result.meta, filterConfig);
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

      if (writeActiveOnly && result.input.status !== "ACTIVE") {
        draftSkipped += 1;
        bump(rejectionReasons, "draft_skipped: writeActiveOnly");
        continue;
      }

      accepted.push(result.input);
    }

    let upserted = 0;
    let created = 0;
    let updated = 0;
    let upsertErrors: { index: number; message: string }[] = [];
    if (accepted.length) {
      for (let i = 0; i < accepted.length; i += 100) {
        const chunk = accepted.slice(i, i + 100);
        const batch = await upsertMatchingOpportunityBatch(chunk);
        upserted += batch.upserted.length;
        created += batch.created;
        updated += batch.updated;
        upsertErrors = upsertErrors.concat(
          batch.errors.map((e) => ({
            index: i + e.index,
            message: e.message,
          })),
        );
      }
    }

    const result: TedIngestRunResult = {
      ran: true,
      fetched,
      normalized,
      filteredOut,
      validationRejected,
      draftSkipped,
      accepted: accepted.length,
      upserted,
      created,
      updated,
      upsertErrors,
      malformed,
      rejectionReasons,
      acceptedExternalRefs: accepted
        .map((a) => a.externalRef)
        .filter((r): r is string => Boolean(r)),
    };

    logInfo("matching_engine.ted.ingest.completed", {
      source: TED_SOURCE,
      durationMs: Date.now() - startedAt,
      fetched,
      normalized,
      filteredOut,
      validationRejected,
      draftSkipped,
      accepted: accepted.length,
      upserted,
      created,
      updated,
      upsertErrors: upsertErrors.length,
      malformed,
      pagesFetched: bundle.pagesFetched,
      writeActiveOnly,
    });

    if (!options?.settings) {
      await recordTedRunStats({
        ok: true,
        upserted,
        filtered: filteredOut,
      }).catch(() => undefined);
    }

    return result;
  } catch (error) {
    const safe = sanitizeTedErrorMessage(error);
    logError("matching_engine.ted.ingest.failed", {
      source: TED_SOURCE,
      durationMs: Date.now() - startedAt,
      error: safe,
    });
    if (!options?.settings) {
      await recordTedRunStats({ ok: false, errorSafe: safe }).catch(() => undefined);
    }
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCode.INTERNAL, `TED ingest failed: ${safe}`, 502);
  }
}

/**
 * Safe worker entry — call only when SA sets enabled + workerScheduleAllowed.
 * Not an uncontrolled cron.
 */
export async function runTedOpportunityIngestIfScheduled(): Promise<TedIngestRunResult | null> {
  const settings = await getTedPublicSettings();
  if (!settings.enabled || !settings.workerScheduleAllowed) {
    return null;
  }
  return runTedOpportunityIngest({ settings });
}
