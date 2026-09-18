/**
 * Semantic identity — never category/title/filename alone.
 */

import { lifecycleIdentityFamily } from "./phase";

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201A\u2032\u02BC]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strip table chrome / response-column residue so one obligation keeps one identity
 * across row, cell, heading, and spreadsheet representations.
 */
export function normalizeSemanticSurface(text: string): string {
  return fold(text)
    .replace(/\[[^\]]*(?:row|column|unit|threshold|lot)[^\]]*\]/g, " ")
    .replace(/\[(?:spreadsheet|sheet|cells):[^\]]*\]/g, " ")
    .replace(/(?:^|[\s|,;])[a-z]{1,3}\d{1,4}=/g, " ")
    .replace(/[☐☑✓✗]\s*(?:yes|no)/g, " ")
    .replace(/\b(?:yes|no)\s+(?:yes|no)\b/g, " ")
    .replace(/\binsert\s+details\b[\s\S]{0,120}/g, " ")
    .replace(/\b(?:tick|check)\s+(?:yes|no|as\s+applicable)\b/g, " ")
    .replace(
      /^(?:[-–—•*]+\s*)?(?:important|note|n\.?b\.?|attention|remark|warning)\s*[:\-–—]\s*/,
      "",
    )
    .replace(/^(?:[-–—•*]+\s*)+/, "")
    .replace(/^\d{1,3}(?:\.\d{1,3})+\s*/, "")
    .replace(/^\d{1,3}[\.)]\s+/, "")
    .replace(
      /^\d{1,3}\s+(?!(?:units?|pcs|pieces|sets?|qty|quantity|days?|weeks?|months?|years?|hours?|usd|eur|gbp|mad|dh)\b)/,
      "",
    )
    .replace(/^\([a-z0-9]{1,3}\)\s+/, "")
    .replace(
      /^(?:requirement|description|specification|item|compliance|remarks?|comments?|response)\s+/,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "for",
  "in",
  "on",
  "by",
  "with",
  "from",
  "that",
  "this",
  "shall",
  "must",
  "will",
  "be",
  "is",
  "are",
  "le",
  "la",
  "les",
  "des",
  "du",
  "de",
  "et",
  "ou",
  "doit",
  "devra",
  "bidder",
  "bidders",
  "tenderer",
  "tenderers",
  "supplier",
  "contractor",
  "soumissionnaire",
  "soumissionnaires",
  "required",
  "mandatory",
  "obligatoire",
]);

/** Stable semantic fingerprint for cross-document dedupe. */
export function buildSemanticIdentity(input: {
  text: string;
  actor: string;
  contentKind: string;
  lotLabel?: string | null;
  conditionText?: string | null;
  procurementPhase?: string | null;
}): string {
  const tokens = normalizeSemanticSurface(input.text)
    .replace(/[^a-z0-9\u0600-\u06ff\s]/gi, " ")
    .split(/\s+/)
    .filter((t) => (t.length > 2 || /^\d/.test(t)) && !STOP.has(t));
  const core = tokens.slice(0, 24).join(" ");
  const lot = input.lotLabel?.trim() ? fold(input.lotLabel) : "lot:unspecified";
  const cond = input.conditionText?.trim()
    ? fold(input.conditionText).slice(0, 80)
    : "cond:none";
  const life = lifecycleIdentityFamily(input.procurementPhase ?? "UNKNOWN");
  const facets = semanticIdentityFacets(input.text);
  return [fold(input.actor), fold(input.contentKind), lot, cond, life, facets, core].join("|");
}

/** Quantity, duration and currency stay in identity so thresholds cannot collapse. */
export function semanticIdentityFacets(text: string): string {
  return identityFacets(text);
}

function identityFacets(text: string): string {
  const t = fold(text);
  const qty = t.match(/\b(\d+(?:[.,]\d+)?)\s*(?:units?|pcs|pieces|sets?|qty|quantity)\b/);
  const dur = t.match(/\b(\d+)\s*(?:calendar\s+|working\s+)?(?:days?|weeks?|months?|years?|hours?)\b/);
  const cur = t.match(/\b(?:usd|eur|gbp|mad|dh)\s*[\d,.]+|[\d,.]+\s*(?:usd|eur|gbp|mad|dh)\b/);
  const bits = [qty?.[0], dur?.[0], cur?.[0]]
    .filter(Boolean)
    .map((s) => String(s).replace(/[.,]+$/g, "").trim());
  return bits.length ? `facet:${bits.join("/")}` : "facet:none";
}
