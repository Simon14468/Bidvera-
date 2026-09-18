/**
 * Controlled TED pilot scope preset.
 * NOT applied as permanent DEFAULT_TED_SETTINGS — use applyTedControlledPilotScope()
 * or Super Admin matching.ted.settings geographies / freshnessDays / requireDeadline.
 */

import type { TedPublicSettings } from "./config";
import { DEFAULT_TED_SETTINGS } from "./config";

/**
 * Morocco / France / Spain / Portugal pilot.
 * Includes ISO3 so expert query can constrain buyer-country; names for post-filters.
 */
export const TED_CONTROLLED_PILOT_GEOGRAPHIES = [
  "Morocco",
  "MAR",
  "France",
  "FRA",
  "Spain",
  "ESP",
  "Portugal",
  "PRT",
] as const;

/** Display labels for zero-result reporting (not ISO codes). */
export const TED_CONTROLLED_PILOT_COUNTRY_LABELS = [
  "Morocco",
  "France",
  "Spain",
  "Portugal",
] as const;

/**
 * Optional Bidvera-relevant CPV divisions for pilot quality (configurable; not permanent defaults).
 * Uses existing CPV mapping only — does not invent codes.
 */
export const TED_CONTROLLED_PILOT_CPV_FILTERS = [
  "72", // IT services
  "71", // Architectural / engineering
  "79", // Business services
  "45", // Construction
  "48", // Software
  "32", // Communication equipment
  "33", // Medical
] as const;

export const TED_CONTROLLED_PILOT_LABEL =
  "Controlled pilot: Morocco, France, Spain, Portugal (fresh + deadline)";

/** Safe quality-oriented bounds for dry-run / pilot (still overridable). */
export const TED_CONTROLLED_PILOT_LIMITS = {
  pageLimit: 25,
  maxNoticesPerRun: 50,
  maxPagesPerRun: 3,
  timeoutMs: 45_000,
  maxRetries: 3,
  scope: "ACTIVE" as const,
  formTypes: ["competition"] as string[],
  excludePastDeadline: true,
  requireDeadline: true,
  /** Rolling 90-day publication window — relative, not a hard-coded calendar date. */
  freshnessDays: 90,
  requireFiltersConfigured: true,
  cpvFilters: [...TED_CONTROLLED_PILOT_CPV_FILTERS] as string[],
};

/**
 * Merge controlled pilot geography + quality limits onto settings.
 * Does not persist; does not enable Matching Engine or TED ingest writes.
 */
export function applyTedControlledPilotScope(
  base: TedPublicSettings = DEFAULT_TED_SETTINGS,
  overrides?: Partial<TedPublicSettings>,
): TedPublicSettings {
  return {
    ...base,
    ...TED_CONTROLLED_PILOT_LIMITS,
    geographies: [...TED_CONTROLLED_PILOT_GEOGRAPHIES],
    ...overrides,
    // Pilot helper never enables write ingest or worker scheduling.
    enabled: false,
    workerScheduleAllowed: false,
  };
}
