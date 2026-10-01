/**
 * Project-centric opportunity identity for corpus deduplication.
 * Same real-world project must not become multiple MatchingOpportunity rows.
 * No schema migration — fingerprint is stored in signalsJson.projectIdentityKey.
 */

import { createHash } from "crypto";
import { normalizeMatchingToken, tokens } from "./normalize";

export type ProjectIdentityInput = {
  title: string;
  source?: string | null;
  externalRef?: string | null;
  category?: string | null;
  industry?: string | null;
  geographies?: string[] | null;
  services?: string[] | null;
  deadline?: Date | string | null;
  signalsJson?: unknown;
};

const TITLE_STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "onto",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "by",
  "or",
  "lot",
  "lots",
  "tender",
  "notice",
  "contract",
  "procurement",
]);

/** Strip noise so equivalent project titles collide. */
export function normalizeProjectTitle(title: string): string {
  const toks = tokens(title).filter((t) => !TITLE_STOP.has(t) && t.length > 1);
  return toks.slice(0, 16).join(" ");
}

function deadlineDay(deadline: Date | string | null | undefined): string | null {
  if (deadline == null || deadline === "") return null;
  const d = deadline instanceof Date ? deadline : new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function readSignals(signalsJson: unknown): Record<string, unknown> {
  if (signalsJson && typeof signalsJson === "object" && !Array.isArray(signalsJson)) {
    return signalsJson as Record<string, unknown>;
  }
  return {};
}

function authorityFromSignals(signals: Record<string, unknown>, source: string): string {
  const ted =
    signals.ted && typeof signals.ted === "object"
      ? (signals.ted as Record<string, unknown>)
      : null;
  if (ted && typeof ted.buyerNamePublic === "string" && ted.buyerNamePublic.trim()) {
    return normalizeMatchingToken(ted.buyerNamePublic).slice(0, 80);
  }
  if (typeof signals.authority === "string" && signals.authority.trim()) {
    return normalizeMatchingToken(signals.authority).slice(0, 80);
  }
  if (typeof signals.buyer === "string" && signals.buyer.trim()) {
    return normalizeMatchingToken(signals.buyer).slice(0, 80);
  }
  return normalizeMatchingToken(source || "unknown").slice(0, 40);
}

function primaryLocation(input: ProjectIdentityInput, signals: Record<string, unknown>): string {
  const geos = input.geographies ?? [];
  if (geos[0]) return normalizeMatchingToken(geos[0]);
  if (typeof signals.country === "string") return normalizeMatchingToken(signals.country);
  const ted =
    signals.ted && typeof signals.ted === "object"
      ? (signals.ted as Record<string, unknown>)
      : null;
  if (ted && Array.isArray(ted.iso3) && typeof ted.iso3[0] === "string") {
    return normalizeMatchingToken(ted.iso3[0]);
  }
  return "";
}

function categoryOrCpv(input: ProjectIdentityInput, signals: Record<string, unknown>): string {
  if (input.category?.trim()) return normalizeMatchingToken(input.category);
  const ted =
    signals.ted && typeof signals.ted === "object"
      ? (signals.ted as Record<string, unknown>)
      : null;
  if (ted && Array.isArray(ted.cpv) && typeof ted.cpv[0] === "string") {
    return normalizeMatchingToken(String(ted.cpv[0]));
  }
  if (input.services?.[0]) return normalizeMatchingToken(input.services[0]);
  if (input.industry?.trim()) return normalizeMatchingToken(input.industry);
  return "";
}

/**
 * Stable project identity key — same real-world project → same key across ingest runs.
 * Prefer source+externalRef when present (strongest natural key); otherwise fingerprint.
 */
export function buildProjectIdentityKey(input: ProjectIdentityInput): string {
  const source = (input.source ?? "INTERNAL").trim() || "INTERNAL";
  const externalRef = input.externalRef?.trim() || "";
  if (externalRef) {
    return createHash("sha256")
      .update(`ref:${source}|${externalRef}`)
      .digest("hex")
      .slice(0, 40);
  }

  const signals = readSignals(input.signalsJson);
  const payload = [
    "fp",
    source,
    normalizeProjectTitle(input.title),
    authorityFromSignals(signals, source),
    primaryLocation(input, signals),
    categoryOrCpv(input, signals),
    deadlineDay(input.deadline) ?? "",
  ].join("|");

  return createHash("sha256").update(payload).digest("hex").slice(0, 40);
}

/**
 * Soft content similarity for near-duplicate detection when refs differ
 * but the same project was republished under another id.
 */
export function projectContentSimilarity(
  a: ProjectIdentityInput,
  b: ProjectIdentityInput,
): number {
  const titleA = normalizeProjectTitle(a.title);
  const titleB = normalizeProjectTitle(b.title);
  if (!titleA || !titleB) return 0;
  if (titleA === titleB) {
    const dayA = deadlineDay(a.deadline);
    const dayB = deadlineDay(b.deadline);
    if (dayA && dayB && dayA !== dayB) return 0.55;
    const locA = primaryLocation(a, readSignals(a.signalsJson));
    const locB = primaryLocation(b, readSignals(b.signalsJson));
    if (locA && locB && locA === locB) return 0.97;
    return 0.88;
  }

  const ta = new Set(titleA.split(" ").filter(Boolean));
  const tb = new Set(titleB.split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hits = 0;
  for (const t of ta) if (tb.has(t)) hits += 1;
  const overlap = hits / Math.max(ta.size, tb.size);
  const dayA = deadlineDay(a.deadline);
  const dayB = deadlineDay(b.deadline);
  const sameDay = Boolean(dayA && dayB && dayA === dayB);
  const locA = primaryLocation(a, readSignals(a.signalsJson));
  const locB = primaryLocation(b, readSignals(b.signalsJson));
  const sameLoc = Boolean(locA && locB && locA === locB);
  let score = overlap;
  if (sameDay) score += 0.12;
  if (sameLoc) score += 0.1;
  return Math.min(1, Math.round(score * 100) / 100);
}

/** Threshold above which two opportunities are treated as the same project. */
export const PROJECT_NEAR_DUPLICATE_THRESHOLD = 0.9;

/**
 * Merge projectIdentityKey into signalsJson without dropping existing public metadata.
 */
export function withProjectIdentityKey(
  signalsJson: unknown,
  projectIdentityKey: string,
): Record<string, unknown> {
  const base = readSignals(signalsJson);
  return {
    ...base,
    projectIdentityKey,
  };
}
