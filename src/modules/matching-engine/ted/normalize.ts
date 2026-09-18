/**
 * TED notice → UpsertOpportunityInput normalizer.
 * Never invents certifications, experience, size, or capabilities from buyer text.
 */

import type { UpsertOpportunityInput } from "../internal/types";
import { TED_LANG_PREFERENCE, TED_SOURCE } from "./constants";
import { mapCpvCodesToServices } from "./cpv";
import { parseTedDateValue, parseTedPublicationDate } from "./freshness";
import { mapTedPlacesToGeographies } from "./geography";
import type { TedNoticeRaw } from "./types";

function asStringArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((v) => (typeof v === "string" ? [v] : asStringArray(v)))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const t = value.trim();
    return t ? [t] : [];
  }
  if (typeof value === "object") {
    const out: string[] = [];
    for (const v of Object.values(value as Record<string, unknown>)) {
      out.push(...asStringArray(v));
    }
    return out;
  }
  return [];
}

/** Pick preferred language string from TED multilingual objects. */
export function pickTedLocalizedText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t || null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const t = pickTedLocalizedText(item);
      if (t) return t;
    }
    return null;
  }
  if (typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;
  for (const lang of TED_LANG_PREFERENCE) {
    if (lang in obj) {
      const t = pickTedLocalizedText(obj[lang]);
      if (t) return t;
    }
  }
  for (const v of Object.values(obj)) {
    const t = pickTedLocalizedText(v);
    if (t) return t;
  }
  return null;
}

/** Normalize publication-number to stable TED public id (digits-year). */
export function normalizeTedPublicationNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).trim().match(/(\d{1,8})-(\d{4})/);
  if (!m) return null;
  const num = String(Number(m[1])); // drop leading zeros: 00177486 → 177486
  return `${num}-${m[2]}`;
}

export function tedNoticeUrl(publicationNumber: string): string {
  return `https://ted.europa.eu/en/notice/-/detail/${publicationNumber}`;
}

export function pickEarliestFutureOrAnyDeadline(
  values: string[],
  now = new Date(),
): Date | null {
  const parsed: Date[] = [];
  for (const raw of values) {
    const d = parseTedDateValue(raw);
    if (d) parsed.push(d);
  }
  if (!parsed.length) return null;
  const future = parsed
    .filter((d) => d.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  if (future.length) return future[0]!;
  return parsed.sort((a, b) => a.getTime() - b.getTime())[0]!;
}

export type TedNormalizeResult =
  | { ok: true; input: UpsertOpportunityInput; meta: TedNormalizeMeta }
  | { ok: false; reason: string };

export type TedNormalizeMeta = {
  publicationNumber: string;
  noticeIdentifier: string | null;
  formType: string | null;
  noticeType: string | null;
  rawCpvs: string[];
  iso3Codes: string[];
  nutsCodes: string[];
  sourceUrl: string;
  deadlinePast: boolean;
  publicationDateRaw: string | null;
  publicationDateParsed: Date | null;
};

/**
 * Normalize one TED Search notice into UpsertOpportunityInput.
 * Incomplete notices become DRAFT (never fabricate ACTIVE dimensions).
 */
export function normalizeTedNotice(
  notice: TedNoticeRaw,
  options?: { now?: Date },
): TedNormalizeResult {
  if (!notice || typeof notice !== "object") {
    return { ok: false, reason: "malformed notice: not an object" };
  }

  const publicationNumber = normalizeTedPublicationNumber(
    typeof notice["publication-number"] === "string"
      ? notice["publication-number"]
      : null,
  );
  if (!publicationNumber) {
    return { ok: false, reason: "malformed notice: missing publication-number" };
  }

  const title = pickTedLocalizedText(notice["notice-title"]);
  if (!title) {
    return { ok: false, reason: "malformed notice: missing notice-title" };
  }

  const description = pickTedLocalizedText(notice["description-lot"]);
  const formType =
    typeof notice["form-type"] === "string" ? notice["form-type"].trim() : null;
  const noticeType =
    typeof notice["notice-type"] === "string" ? notice["notice-type"].trim() : null;
  const noticeIdentifier =
    typeof notice["notice-identifier"] === "string"
      ? notice["notice-identifier"].trim()
      : null;

  const cpv = mapCpvCodesToServices(asStringArray(notice["classification-cpv"]));
  const places = mapTedPlacesToGeographies([
    ...asStringArray(notice["place-of-performance"]),
    ...asStringArray(notice["buyer-country"]),
  ]);

  const deadline = pickEarliestFutureOrAnyDeadline(
    asStringArray(notice["deadline-receipt-tender-date-lot"]),
    options?.now ?? new Date(),
  );
  const now = options?.now ?? new Date();
  const deadlinePast = Boolean(deadline && deadline.getTime() <= now.getTime());

  const sourceUrl = tedNoticeUrl(publicationNumber);
  const buyerName = pickTedLocalizedText(notice["buyer-name"]);
  const publicationDateRaw =
    typeof notice["publication-date"] === "string"
      ? notice["publication-date"]
      : null;
  const publicationDateParsed = parseTedPublicationDate(publicationDateRaw);

  // Buyer is attribution context only — never a capability signal.
  const summaryParts: string[] = [];
  if (description) summaryParts.push(description.slice(0, 4000));
  if (buyerName) summaryParts.push(`Buyer (public TED): ${buyerName.slice(0, 300)}`);
  summaryParts.push(`Source: TED notice ${publicationNumber} — ${sourceUrl}`);
  const summary = summaryParts.join("\n\n");

  const hasCapability = cpv.services.length > 0 || Boolean(cpv.category);
  const hasGeo = places.geographies.length > 0;
  const canBeActive = hasCapability && hasGeo && !deadlinePast;

  const input: UpsertOpportunityInput = {
    title: title.slice(0, 500),
    summary,
    category: cpv.category,
    industry: cpv.industry,
    services: cpv.services,
    industries: cpv.industry ? [cpv.industry] : [],
    geographies: places.geographies,
    // Never invent certifications / size / experience from TED free text.
    certifications: [],
    sizeBand: null,
    experienceHint: null,
    deadline: deadline ? deadline.toISOString() : null,
    source: TED_SOURCE,
    externalRef: publicationNumber,
    status: canBeActive ? "ACTIVE" : "DRAFT",
    signalsJson: {
      ted: {
        apiVersion: "v3",
        publicationNumber,
        noticeIdentifier,
        formType,
        noticeType,
        publicationDate: publicationDateRaw,
        cpv: cpv.rawCpvs,
        nuts: places.nutsCodes,
        iso3: places.iso3Codes,
        sourceUrl,
        // Buyer stored for attribution only — not matching capability.
        buyerNamePublic: buyerName,
      },
    },
  };

  return {
    ok: true,
    input,
    meta: {
      publicationNumber,
      noticeIdentifier,
      formType,
      noticeType,
      rawCpvs: cpv.rawCpvs,
      iso3Codes: places.iso3Codes,
      nutsCodes: places.nutsCodes,
      sourceUrl,
      deadlinePast,
      publicationDateRaw,
      publicationDateParsed,
    },
  };
}
