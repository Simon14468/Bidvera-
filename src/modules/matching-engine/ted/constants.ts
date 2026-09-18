/**
 * TED Search API v3 — official constants (Publications Office).
 * Docs: https://docs.ted.europa.eu/api/latest/search.html
 * Gateway: https://api.ted.europa.eu
 */

export const TED_SOURCE = "TED";

export const TED_API_VERSION = "v3";

/** Official Search endpoint for published notices (anonymous). */
export const TED_SEARCH_URL = "https://api.ted.europa.eu/v3/notices/search";

export const TED_SETTINGS_KEY = "matching.ted.settings";
export const TED_VAULT_KEY = "matching.ted.vault";

/** Fair-usage guidance from TED (HTTP requests / minute). */
export const TED_FAIR_USE_HTTP_PER_MINUTE = 700;

/** Search API hard page size (official v3). */
export const TED_SEARCH_MAX_LIMIT = 250;

/** Field-cell budget: fields × limit ≤ 10_000 (incl. implicit publication-number + links). */
export const TED_SEARCH_MAX_FIELD_CELLS = 10_000;

/**
 * Fields requested from TED Search. Keep projection small vs field-cell budget.
 * Verified live against POST /v3/notices/search (2026-09).
 */
export const TED_SEARCH_FIELDS = [
  "publication-number",
  "notice-identifier",
  "notice-title",
  "description-lot",
  "notice-type",
  "form-type",
  "classification-cpv",
  "place-of-performance",
  "buyer-country",
  "deadline-receipt-tender-date-lot",
  "publication-date",
  "buyer-name",
] as const;

/** Preferred language order for multilingual TED fields. */
export const TED_LANG_PREFERENCE = [
  "eng",
  "en",
  "fra",
  "fr",
  "deu",
  "de",
  "spa",
  "es",
] as const;

/**
 * Default form-types for Bidvera matching corpus.
 * Competition notices are the primary actionable procurement form family.
 * Empty config uses this list — documented, not a silent market lock.
 */
export const TED_DEFAULT_FORM_TYPES = ["competition"] as const;
