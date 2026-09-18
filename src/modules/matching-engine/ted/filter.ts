/**
 * Configurable Bidvera relevance filter applied BEFORE upsert.
 * Empty geography/CPV filters do not invent a narrow market — they mean "no extra restriction"
 * but ingest still requires requireFiltersConfigured safety when enabled (see config).
 */

import { normalizeCpvCode, cpvDivision } from "./cpv";
import {
  isPublicationWithinFreshness,
  parseTedPublicationDate,
} from "./freshness";
import { geographyFilterTokens } from "./geography";
import type { TedNormalizeMeta } from "./normalize";
import type { UpsertOpportunityInput } from "../internal/types";

export type TedRelevanceFilterConfig = {
  /** Country names and/or ISO2/ISO3 codes. Empty = no geography restriction. */
  geographies: string[];
  /** CPV codes or prefixes (e.g. "72", "72000000", "72*"). Empty = no CPV restriction. */
  cpvFilters: string[];
  /** Allowed form-type values (e.g. competition). */
  formTypes: string[];
  /**
   * When true, reject notices without a valid future tender deadline.
   * Never invents a deadline.
   */
  requireDeadline: boolean;
  /** Drop notices whose deadline is already past. */
  excludePastDeadline: boolean;
  /** Relative publication freshness window in days (0 = off). */
  freshnessDays: number;
  now?: Date;
};

export type TedFilterDecision =
  | { accept: true }
  | { accept: false; reason: string };

function cpvMatchesFilters(rawCpvs: string[], filters: string[]): boolean {
  if (!filters.length) return true;
  const normalizedFilters = filters
    .map((f) => f.trim().toLowerCase().replace(/\*$/, ""))
    .filter(Boolean);
  if (!normalizedFilters.length) return true;

  for (const code of rawCpvs) {
    const n = normalizeCpvCode(code);
    if (!n) continue;
    const div = cpvDivision(n);
    for (const f of normalizedFilters) {
      const fDigits = f.replace(/\D/g, "");
      if (!fDigits) continue;
      if (n.startsWith(fDigits) || div === fDigits.slice(0, 2)) return true;
    }
  }
  return false;
}

function geographyMatches(
  input: UpsertOpportunityInput,
  meta: TedNormalizeMeta,
  filters: string[],
): boolean {
  if (!filters.length) return true;
  const allowed = geographyFilterTokens(filters);
  for (const g of input.geographies ?? []) {
    if (allowed.has(g.toLowerCase())) return true;
  }
  for (const iso of meta.iso3Codes) {
    if (allowed.has(iso.toLowerCase())) return true;
  }
  return false;
}

export function filterTedOpportunity(
  input: UpsertOpportunityInput,
  meta: TedNormalizeMeta,
  config: TedRelevanceFilterConfig,
): TedFilterDecision {
  const now = config.now ?? new Date();
  const formType = (meta.formType ?? "").toLowerCase();
  const allowedForms = config.formTypes.map((f) => f.trim().toLowerCase()).filter(Boolean);
  if (allowedForms.length && !allowedForms.includes(formType)) {
    return {
      accept: false,
      reason: `form-type "${meta.formType ?? ""}" not in allowed list`,
    };
  }

  const freshnessDays = config.freshnessDays ?? 0;
  if (freshnessDays > 0) {
    const pub =
      meta.publicationDateParsed ??
      parseTedPublicationDate(meta.publicationDateRaw ?? null);
    if (!isPublicationWithinFreshness(pub, freshnessDays, now)) {
      return {
        accept: false,
        reason: pub
          ? "publication-date outside freshness window"
          : "publication-date missing for freshness filter",
      };
    }
  }

  if (config.requireDeadline) {
    if (!input.deadline) {
      return { accept: false, reason: "deadline required by filter" };
    }
    if (meta.deadlinePast) {
      return { accept: false, reason: "deadline not in the future" };
    }
  } else if (config.excludePastDeadline && meta.deadlinePast) {
    return { accept: false, reason: "deadline already past" };
  }

  if (!geographyMatches(input, meta, config.geographies)) {
    return { accept: false, reason: "geography outside configured filter" };
  }

  if (!cpvMatchesFilters(meta.rawCpvs, config.cpvFilters)) {
    return { accept: false, reason: "CPV outside configured filter" };
  }

  // Hard safety: never accept payloads that look like private Bidvera company knowledge.
  const blob = JSON.stringify(input.signalsJson ?? {});
  if (/knowledge|draftText|storageKey|evidenceFile|password|secret|apiKey/i.test(blob)) {
    return { accept: false, reason: "private-data key pattern in signals" };
  }

  return { accept: true };
}
