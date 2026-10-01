import { createHash } from "crypto";
import type {
  MatchingProfileSnapshot,
  MatchingSizeBand,
  MatchingTrustSummary,
} from "./types";
import { MATCHING_SIZE_BANDS } from "./types";

export function normalizeMatchingToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return normalizeMatchingToken(s)
    .split(" ")
    .filter((t) => t.length > 2);
}

export function hashMatchingSnapshot(snapshot: MatchingProfileSnapshot): string {
  const payload = JSON.stringify(snapshot);
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export function countTrustSummary(snapshot: MatchingProfileSnapshot): MatchingTrustSummary {
  const summary: MatchingTrustSummary = { strong: 0, normal: 0, soft: 0 };
  const bump = (trust: keyof MatchingTrustSummary) => {
    summary[trust] += 1;
  };
  for (const s of snapshot.services) bump(s.trust);
  for (const s of snapshot.industries) bump(s.trust);
  for (const s of snapshot.countries ?? []) bump(s.trust);
  for (const s of snapshot.geographies) bump(s.trust);
  for (const s of snapshot.certifications) bump(s.trust);
  for (const s of snapshot.dcmCategories) bump(s.trust);
  if (snapshot.size) bump(snapshot.size.trust);
  if (snapshot.experienceYears) bump(snapshot.experienceYears.trust);
  if (snapshot.timezone) bump(snapshot.timezone.trust);
  return summary;
}

export function computeMatchingCompleteness(snapshot: MatchingProfileSnapshot): number {
  const hasCountryOrGeo =
    (snapshot.countries?.length ?? 0) > 0 || snapshot.geographies.length > 0;
  const checks = [
    snapshot.services.some((s) => s.trust !== "soft"),
    snapshot.industries.some((s) => s.trust !== "soft") ||
      snapshot.services.some((s) => s.trust === "strong"),
    hasCountryOrGeo,
    snapshot.certifications.some((s) => s.trust !== "soft") ||
      snapshot.dcmCategories.some((s) => s.trust === "strong"),
    snapshot.size != null,
    snapshot.experienceYears != null,
    snapshot.timezone != null,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/**
 * Eligible for Matching Engine pool: enough non-soft structured signals.
 * Missing data never invents eligibility.
 */
export function isMatchingProfileEligible(snapshot: MatchingProfileSnapshot): boolean {
  const hardServices = snapshot.services.filter((s) => s.trust !== "soft");
  const hardCerts = snapshot.certifications.filter((s) => s.trust !== "soft");
  const hardDcm = snapshot.dcmCategories.filter((s) => s.trust === "strong");
  const hasCapability = hardServices.length > 0 || hardCerts.length > 0 || hardDcm.length > 0;
  const hasGeo =
    snapshot.geographies.length > 0 || (snapshot.countries?.length ?? 0) > 0;
  return hasCapability && hasGeo;
}

export function overlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b.map(normalizeMatchingToken));
  const hits = a
    .map(normalizeMatchingToken)
    .filter(
      (t) => setB.has(t) || [...setB].some((x) => x.includes(t) || t.includes(x)),
    ).length;
  return Math.round((hits / a.length) * 100);
}

export function listOverlapScore(
  companyValues: string[],
  opportunityValues: string[],
): number {
  if (companyValues.length === 0 || opportunityValues.length === 0) return 0;
  let best = 0;
  for (const c of companyValues) {
    const cn = normalizeMatchingToken(c);
    for (const o of opportunityValues) {
      const on = normalizeMatchingToken(o);
      if (!cn || !on) continue;
      if (cn === on) best = Math.max(best, 100);
      else if (cn.includes(on) || on.includes(cn)) best = Math.max(best, 85);
      else {
        const ot = tokens(o);
        const ct = tokens(c);
        best = Math.max(best, overlapScore(ct, ot));
      }
    }
  }
  return Math.min(100, best);
}

/** Map free-text / legacy size labels onto canonical Matching bands. */
export function normalizeSizeBand(raw: string | null | undefined): MatchingSizeBand | null {
  if (!raw) return null;
  const n = normalizeMatchingToken(raw);
  if (!n) return null;

  const direct = MATCHING_SIZE_BANDS.find((b) => normalizeMatchingToken(b) === n);
  if (direct) return direct;

  // Numeric range like "10-49" / "50 to 250"
  const range = n.match(/(\d+)\s*(?:-|to|–)\s*(\d+)/);
  if (range) {
    const mid = (Number(range[1]) + Number(range[2])) / 2;
    return sizeBandFromEmployeeCount(mid);
  }
  const plus = n.match(/(\d+)\s*\+/);
  if (plus) return sizeBandFromEmployeeCount(Number(plus[1]));
  const single = n.match(/^(\d+)$/);
  if (single) return sizeBandFromEmployeeCount(Number(single[1]));

  if (
    /\b(micro|solo|startup|self employed|1 10|under 10|less than 10)\b/.test(n) ||
    n === "xs" ||
    n === "very small"
  ) {
    return "1-10";
  }
  if (/\b(small|sme|smb|11 50|under 50)\b/.test(n) || n === "s") {
    return "11-50";
  }
  if (/\b(medium|mid size|midmarket|51 200|under 200)\b/.test(n) || n === "m") {
    return "51-200";
  }
  if (/\b(large|201 1000|enterprise mid)\b/.test(n) || n === "l") {
    return "201-1000";
  }
  if (/\b(enterprise|corporate|1000|multinational|global)\b/.test(n) || n === "xl") {
    return "1000+";
  }
  return null;
}

export function sizeBandFromEmployeeCount(n: number): MatchingSizeBand {
  if (n <= 10) return "1-10";
  if (n <= 50) return "11-50";
  if (n <= 200) return "51-200";
  if (n <= 1000) return "201-1000";
  return "1000+";
}

export function sizeBandDistance(
  a: MatchingSizeBand,
  b: MatchingSizeBand,
): number {
  return Math.abs(MATCHING_SIZE_BANDS.indexOf(a) - MATCHING_SIZE_BANDS.indexOf(b));
}

/**
 * Geography hierarchy groups — parent region contains child countries/markets.
 * Used for soft hierarchy scoring (not hard gates).
 */
export const GEOGRAPHY_HIERARCHY: Record<string, string[]> = {
  "north africa": ["morocco", "algeria", "tunisia", "libya", "egypt", "mauritania"],
  maghreb: ["morocco", "algeria", "tunisia", "libya", "mauritania"],
  "middle east": [
    "uae",
    "united arab emirates",
    "saudi arabia",
    "qatar",
    "kuwait",
    "bahrain",
    "oman",
    "jordan",
    "lebanon",
    "egypt",
  ],
  gcc: [
    "uae",
    "united arab emirates",
    "saudi arabia",
    "qatar",
    "kuwait",
    "bahrain",
    "oman",
  ],
  europe: [
    "france",
    "germany",
    "spain",
    "italy",
    "portugal",
    "belgium",
    "netherlands",
    "uk",
    "united kingdom",
    "ireland",
    "poland",
    "austria",
    "switzerland",
  ],
  eu: [
    "france",
    "germany",
    "spain",
    "italy",
    "portugal",
    "belgium",
    "netherlands",
    "ireland",
    "poland",
    "austria",
  ],
  "southeast asia": [
    "vietnam",
    "singapore",
    "thailand",
    "malaysia",
    "indonesia",
    "philippines",
  ],
  "north america": ["usa", "united states", "canada", "mexico"],
  africa: [
    "morocco",
    "algeria",
    "tunisia",
    "egypt",
    "nigeria",
    "kenya",
    "south africa",
    "ghana",
  ],
  global: [],
  worldwide: [],
  international: [],
};

/**
 * Soft hierarchy proximity score 0–100 between company and opportunity geography tokens.
 * Exact match > child-in-parent > sibling-in-region > none.
 * Does not invent matches.
 */
export function geographyHierarchyScore(
  companyValues: string[],
  opportunityValues: string[],
): number {
  if (companyValues.length === 0 || opportunityValues.length === 0) return 0;

  let best = listOverlapScore(companyValues, opportunityValues);
  if (best >= 85) return best;

  const cn = companyValues.map(normalizeMatchingToken);
  const on = opportunityValues.map(normalizeMatchingToken);

  for (const [region, children] of Object.entries(GEOGRAPHY_HIERARCHY)) {
    const regionN = normalizeMatchingToken(region);
    const childSet = new Set(children.map(normalizeMatchingToken));
    const isGlobal = children.length === 0;

    const companyInRegion =
      cn.some((c) => c === regionN || childSet.has(c)) ||
      (isGlobal && cn.some((c) => c === regionN));
    const oppInRegion =
      on.some((o) => o === regionN || childSet.has(o)) ||
      (isGlobal && on.some((o) => o === regionN));

    if (!companyInRegion || !oppInRegion) continue;

    const companyIsParent = cn.some((c) => c === regionN);
    const oppIsParent = on.some((o) => o === regionN);
    const companyIsChild = cn.some((c) => childSet.has(c));
    const oppIsChild = on.some((o) => childSet.has(o));

    if (isGlobal && (companyIsParent || oppIsParent)) {
      best = Math.max(best, 55);
      continue;
    }
    if ((companyIsParent && oppIsChild) || (oppIsParent && companyIsChild)) {
      best = Math.max(best, 72);
    } else if (companyIsChild && oppIsChild) {
      best = Math.max(best, 60);
    } else if (companyIsParent && oppIsParent) {
      best = Math.max(best, 80);
    }
  }

  return Math.min(100, best);
}

/** Certification coverage: all / partial / none relative to required list. */
export type CertificationCoverage = "all" | "partial" | "none" | "n/a";

export function certificationCoverage(
  companyCerts: string[],
  requiredCerts: string[],
): { coverage: CertificationCoverage; hitCount: number; requiredCount: number; score: number } {
  if (requiredCerts.length === 0) {
    return { coverage: "n/a", hitCount: 0, requiredCount: 0, score: 0 };
  }
  const companyN = companyCerts.map(normalizeMatchingToken);
  let hits = 0;
  for (const req of requiredCerts) {
    const rn = normalizeMatchingToken(req);
    if (!rn) continue;
    const matched = companyN.some(
      (c) => c === rn || c.includes(rn) || rn.includes(c),
    );
    if (matched) hits += 1;
  }
  const requiredCount = requiredCerts.filter((r) => normalizeMatchingToken(r)).length;
  if (hits <= 0) {
    return { coverage: "none", hitCount: 0, requiredCount, score: 8 };
  }
  if (hits >= requiredCount) {
    return { coverage: "all", hitCount: hits, requiredCount, score: 96 };
  }
  const ratio = hits / requiredCount;
  return {
    coverage: "partial",
    hitCount: hits,
    requiredCount,
    score: Math.round(35 + ratio * 50),
  };
}

/**
 * Parse experience years from free-text hints ("5+", "at least 3 years", "10-15 years").
 */
export function parseExperienceYearsHint(hint: string | null | undefined): number | null {
  if (!hint) return null;
  const t = hint.toLowerCase();
  const range = t.match(/(\d+)\s*(?:-|to|–)\s*(\d+)/);
  if (range) return Number(range[1]);
  const plus = t.match(/(\d+)\s*\+/);
  if (plus) return Number(plus[1]);
  const atLeast = t.match(/(?:at least|minimum|min\.?|>=)\s*(\d+)/);
  if (atLeast) return Number(atLeast[1]);
  const plain = t.match(/(\d+)\s*(?:years?|yrs?|y\b)?/);
  if (plain) return Number(plain[1]);
  return null;
}

/** Stable content hash for AI refine cache keys. */
export function hashAiRefinePayload(payload: unknown): string {
  const canonical = JSON.stringify(payload);
  return createHash("sha256").update(canonical).digest("hex").slice(0, 40);
}
