/**
 * AI-assisted semantic refinement — ranking assistant ONLY (Feature 8E).
 * Must run after the 8C relevance gate. Never creates capabilities or bypasses mismatches.
 */

import { capabilityMatchesText, CAPABILITY_GROUPS } from "@/domain/company-knowledge/normalize";
import { hashAiRefinePayload, normalizeMatchingToken } from "./normalize";

export const AI_REFINE_BOOST_MAX = 3;
export const AI_REFINE_MIN_CONFIDENCE = 0.55;
/** Cap AI-refined candidates per company per generate run (token/cost control). */
export const AI_REFINE_MAX_CANDIDATES = 25;

export type AiRefineCandidate = {
  opportunityId: string;
  title: string;
  summary?: string | null;
  services: string[];
  category?: string | null;
  industries?: string[];
  certifications?: string[];
  countries?: string[];
  geographies?: string[];
  relevanceScore: number;
};

/** Strict structured AI output contract (approved design). */
export type AiStructuredRefineOutput = {
  opportunityId: string;
  semanticServiceFit: number;
  semanticIndustryFit: number;
  requirementFit: number;
  detectedGaps: string[];
  explanation: string;
  boundedRefineScore: number;
  confidence: number;
};

export type AiRefineResult = {
  /** Per-opportunity soft boost (0..AI_REFINE_BOOST_MAX). */
  boosts: Record<string, number>;
  /** Sanitized structured outputs keyed by opportunityId (when AI used). */
  structured: Record<string, AiStructuredRefineOutput>;
  confidence: number;
  usedAi: boolean;
  reason: string;
  /** Content hashes that were served from cache (no provider call). */
  cacheHits: string[];
  /** Hashes newly computed via provider. */
  cacheMisses: string[];
};

/**
 * Deterministic synonym / terminology refine among already-eligible candidates.
 * Uses existing capability synonym groups — does not invent new capabilities.
 */
export function deterministicSemanticRefineBoost(input: {
  companyServices: string[];
  candidate: AiRefineCandidate;
}): number {
  const company = input.companyServices
    .map(normalizeMatchingToken)
    .filter(Boolean);
  if (company.length === 0) return 0;

  const corpus = [
    input.candidate.title,
    input.candidate.summary ?? "",
    input.candidate.category ?? "",
    ...input.candidate.services,
  ]
    .join(" ")
    .toLowerCase();

  let hits = 0;
  for (const svc of company) {
    const group = CAPABILITY_GROUPS.find(
      (g) =>
        normalizeMatchingToken(g.normalized) === svc ||
        capabilityMatchesText(g.normalized, svc),
    );
    const normalized = group?.normalized ?? svc;
    if (capabilityMatchesText(normalized, corpus)) hits += 1;
  }

  if (hits <= 0) return 0;
  return Math.min(AI_REFINE_BOOST_MAX, Math.round((0.8 + hits * 0.7) * 100) / 100);
}

export type AiReorderFn = (input: {
  companyServices: string[];
  companyTimezone?: string | null;
  candidates: AiRefineCandidate[];
}) => Promise<{ order: string[]; confidence: number } | null>;

export type AiStructuredRefineFn = (input: {
  companyServices: string[];
  companyIndustries: string[];
  companyCertifications: string[];
  companyCountries: string[];
  companyTimezone?: string | null;
  candidates: AiRefineCandidate[];
}) => Promise<AiStructuredRefineOutput[] | null>;

export type AiRefineCacheStore = {
  get(hash: string): AiStructuredRefineOutput | null;
  set(hash: string, value: AiStructuredRefineOutput): void;
};

const defaultAiCache = createAiRefineMemoryCache();

export function getDefaultAiRefineCache(): AiRefineCacheStore {
  return defaultAiCache;
}

/** Clear process cache — tests only. */
export function clearDefaultAiRefineCache(): void {
  // Drain by overwriting with empty via max-1 trick: create fresh map on module is hard;
  // use set/get with sentinel eviction by recreating through size overflow of known keys.
  // Prefer: store reference mutation via undocumented clear when Map-backed.
  const store = defaultAiCache as AiRefineCacheStore & { _clear?: () => void };
  if (typeof store._clear === "function") {
    store._clear();
  }
}

/** In-memory LRU-ish cache (no DB migration). Process-local only. */
export function createAiRefineMemoryCache(maxEntries = 500): AiRefineCacheStore & {
  _clear: () => void;
  size: () => number;
} {
  const map = new Map<string, AiStructuredRefineOutput>();
  return {
    get(hash) {
      const v = map.get(hash);
      if (!v) return null;
      map.delete(hash);
      map.set(hash, v);
      return v;
    },
    set(hash, value) {
      if (map.has(hash)) map.delete(hash);
      map.set(hash, value);
      while (map.size > maxEntries) {
        const oldest = map.keys().next().value;
        if (oldest == null) break;
        map.delete(oldest);
      }
    },
    _clear() {
      map.clear();
    },
    size() {
      return map.size;
    },
  };
}

/** Build minimal normalized AI input (public opportunity + matching signals only). */
export function buildAiRefineNormalizedInput(input: {
  companyServices: string[];
  companyIndustries?: string[];
  companyCertifications?: string[];
  companyCountries?: string[];
  companyTimezone?: string | null;
  candidate: AiRefineCandidate;
}): {
  hash: string;
  company: Record<string, unknown>;
  opportunity: Record<string, unknown>;
} {
  const company = {
    services: dedupeStrings(input.companyServices, 12, 64),
    industries: dedupeStrings(input.companyIndustries ?? [], 8, 64),
    certifications: dedupeStrings(input.companyCertifications ?? [], 8, 64),
    countries: dedupeStrings(input.companyCountries ?? [], 4, 48),
    timezone: input.companyTimezone
      ? String(input.companyTimezone).slice(0, 80)
      : null,
  };
  const opportunity = {
    id: input.candidate.opportunityId,
    title: String(input.candidate.title ?? "").slice(0, 160),
    summary: String(input.candidate.summary ?? "").slice(0, 240),
    services: dedupeStrings(input.candidate.services ?? [], 8, 64),
    category: input.candidate.category
      ? String(input.candidate.category).slice(0, 64)
      : null,
    industries: dedupeStrings(input.candidate.industries ?? [], 6, 64),
    certifications: dedupeStrings(input.candidate.certifications ?? [], 6, 64),
    countries: dedupeStrings(input.candidate.countries ?? [], 4, 48),
    geographies: dedupeStrings(input.candidate.geographies ?? [], 6, 48),
    relevanceScore: input.candidate.relevanceScore,
  };
  const hash = hashAiRefinePayload({ company, opportunity });
  return { hash, company, opportunity };
}

function dedupeStrings(values: string[], maxItems: number, maxLen: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = String(raw ?? "")
      .trim()
      .slice(0, maxLen);
    if (!v) continue;
    const key = normalizeMatchingToken(v);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * Validate and sanitize raw model JSON into the approved contract.
 * Never trusts raw model output. Returns null when invalid.
 */
export function sanitizeAiStructuredRefineOutput(
  raw: unknown,
  eligibleIds: Set<string>,
): AiStructuredRefineOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const opportunityId =
    typeof obj.opportunityId === "string"
      ? obj.opportunityId
      : typeof obj.id === "string"
        ? obj.id
        : null;
  if (!opportunityId || !eligibleIds.has(opportunityId)) return null;

  const clamp01 = (v: unknown, fallback = 0): number => {
    if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
    return Math.max(0, Math.min(1, v));
  };

  const semanticServiceFit = clamp01(obj.semanticServiceFit);
  const semanticIndustryFit = clamp01(obj.semanticIndustryFit);
  const requirementFit = clamp01(obj.requirementFit);
  const confidence = clamp01(obj.confidence, 0);

  const detectedGaps = Array.isArray(obj.detectedGaps)
    ? obj.detectedGaps
        .filter((g): g is string => typeof g === "string")
        .map((g) => g.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const explanation =
    typeof obj.explanation === "string"
      ? obj.explanation.trim().slice(0, 280)
      : "";

  let bounded = 0;
  if (typeof obj.boundedRefineScore === "number" && Number.isFinite(obj.boundedRefineScore)) {
    bounded = obj.boundedRefineScore;
  } else {
    // Derive from fit signals when model omits boundedRefineScore
    const avg = (semanticServiceFit + semanticIndustryFit + requirementFit) / 3;
    bounded = avg * AI_REFINE_BOOST_MAX;
  }
  bounded = Math.max(0, Math.min(AI_REFINE_BOOST_MAX, Math.round(bounded * 100) / 100));

  if (confidence < AI_REFINE_MIN_CONFIDENCE) {
    bounded = 0;
  }

  return {
    opportunityId,
    semanticServiceFit,
    semanticIndustryFit,
    requirementFit,
    detectedGaps,
    explanation,
    boundedRefineScore: bounded,
    confidence,
  };
}

export function sanitizeAiStructuredRefineBatch(
  raw: unknown,
  eligibleIds: Set<string>,
): AiStructuredRefineOutput[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.refinements)) list = obj.refinements;
    else if (Array.isArray(obj.results)) list = obj.results;
    else list = [raw];
  }

  const out: AiStructuredRefineOutput[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const sanitized = sanitizeAiStructuredRefineOutput(item, eligibleIds);
    if (!sanitized) continue;
    if (seen.has(sanitized.opportunityId)) continue;
    seen.add(sanitized.opportunityId);
    out.push(sanitized);
  }
  return out;
}

/**
 * Assert payload never contains private/secret fields (test + runtime guard).
 */
export function assertAiPayloadIsPublicSafe(payload: unknown): string[] {
  const banned = [
    "apiKey",
    "api_key",
    "password",
    "secret",
    "token",
    "email",
    "phone",
    "stripe",
    "privateKey",
    "accessToken",
    "refreshToken",
    "bank",
    "taxId",
    "ssn",
  ];
  const json = JSON.stringify(payload).toLowerCase();
  const hits: string[] = [];
  for (const b of banned) {
    // key-style presence
    if (json.includes(`"${b.toLowerCase()}"`) || json.includes(`"${b.toLowerCase()}:`)) {
      hits.push(b);
    }
  }
  return hits;
}

/**
 * Optional AI refine of already-eligible candidates.
 * Low confidence / failure → empty AI boosts (keep deterministic ranking).
 * Never adds new opportunity IDs; never resurrects gate failures.
 */
export async function refineEligibleWithAiAssist(input: {
  companyServices: string[];
  companyIndustries?: string[];
  companyCertifications?: string[];
  companyCountries?: string[];
  companyTimezone?: string | null;
  candidates: AiRefineCandidate[];
  aiReorder?: AiReorderFn | null;
  aiStructuredRefine?: AiStructuredRefineFn | null;
  /** When false, skip AI and use deterministic synonym boosts only. */
  enableAi?: boolean;
  cache?: AiRefineCacheStore | null;
  maxAiCandidates?: number;
}): Promise<AiRefineResult> {
  const eligibleIds = new Set(input.candidates.map((c) => c.opportunityId));
  const boosts: Record<string, number> = {};
  const structured: Record<string, AiStructuredRefineOutput> = {};
  const cacheHits: string[] = [];
  const cacheMisses: string[] = [];

  // Always apply deterministic synonym assist first
  for (const c of input.candidates) {
    const b = deterministicSemanticRefineBoost({
      companyServices: input.companyServices,
      candidate: c,
    });
    if (b > 0) boosts[c.opportunityId] = b;
  }

  if (!input.enableAi) {
    return {
      boosts,
      structured,
      confidence: 1,
      usedAi: false,
      reason: "deterministic_only",
      cacheHits,
      cacheMisses,
    };
  }

  // Prefer structured refine; fall back to legacy reorder.
  if (input.aiStructuredRefine) {
    try {
      const max = input.maxAiCandidates ?? AI_REFINE_MAX_CANDIDATES;
      const ranked = [...input.candidates].sort(
        (a, b) => b.relevanceScore - a.relevanceScore,
      );
      const capped = ranked.slice(0, max);
      const cache = input.cache ?? getDefaultAiRefineCache();

      const uncached: AiRefineCandidate[] = [];
      for (const c of capped) {
        const { hash } = buildAiRefineNormalizedInput({
          companyServices: input.companyServices,
          companyIndustries: input.companyIndustries,
          companyCertifications: input.companyCertifications,
          companyCountries: input.companyCountries,
          companyTimezone: input.companyTimezone,
          candidate: c,
        });
        const cached = cache.get(hash);
        if (cached && cached.opportunityId === c.opportunityId) {
          cacheHits.push(hash);
          structured[c.opportunityId] = cached;
          boosts[c.opportunityId] = Math.min(
            AI_REFINE_BOOST_MAX,
            Math.max(boosts[c.opportunityId] ?? 0, cached.boundedRefineScore),
          );
        } else {
          uncached.push(c);
          cacheMisses.push(hash);
        }
      }

      if (uncached.length > 0) {
        const ai = await input.aiStructuredRefine({
          companyServices: input.companyServices,
          companyIndustries: input.companyIndustries ?? [],
          companyCertifications: input.companyCertifications ?? [],
          companyCountries: input.companyCountries ?? [],
          companyTimezone: input.companyTimezone ?? null,
          candidates: uncached,
        });

        if (ai) {
          const sanitized = sanitizeAiStructuredRefineBatch(ai, eligibleIds);
          for (const item of sanitized) {
            structured[item.opportunityId] = item;
            boosts[item.opportunityId] = Math.min(
              AI_REFINE_BOOST_MAX,
              Math.max(boosts[item.opportunityId] ?? 0, item.boundedRefineScore),
            );
            const cand = uncached.find((c) => c.opportunityId === item.opportunityId);
            if (cand) {
              const { hash } = buildAiRefineNormalizedInput({
                companyServices: input.companyServices,
                companyIndustries: input.companyIndustries,
                companyCertifications: input.companyCertifications,
                companyCountries: input.companyCountries,
                companyTimezone: input.companyTimezone,
                candidate: cand,
              });
              cache.set(hash, item);
            }
          }
        }
      }

      const usedAi = Object.keys(structured).length > 0;
      return {
        boosts,
        structured,
        confidence: usedAi ? 0.8 : 1,
        usedAi,
        reason: usedAi
          ? cacheMisses.length === 0
            ? "ai_cache_hit"
            : "ai_structured"
          : "ai_empty_fallback",
        cacheHits,
        cacheMisses,
      };
    } catch {
      return {
        boosts,
        structured,
        confidence: 0,
        usedAi: false,
        reason: "ai_error_fallback",
        cacheHits,
        cacheMisses,
      };
    }
  }

  if (!input.aiReorder || input.candidates.length < 2) {
    return {
      boosts,
      structured,
      confidence: 1,
      usedAi: false,
      reason: "deterministic_only",
      cacheHits,
      cacheMisses,
    };
  }

  try {
    const max = input.maxAiCandidates ?? AI_REFINE_MAX_CANDIDATES;
    const ranked = [...input.candidates]
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, max);

    const ai = await input.aiReorder({
      companyServices: input.companyServices,
      companyTimezone: input.companyTimezone ?? null,
      candidates: ranked,
    });
    if (!ai || ai.confidence < AI_REFINE_MIN_CONFIDENCE) {
      return {
        boosts,
        structured,
        confidence: ai?.confidence ?? 0,
        usedAi: false,
        reason: "low_confidence_fallback",
        cacheHits,
        cacheMisses,
      };
    }

    const order = ai.order.filter((id) => eligibleIds.has(id));
    if (order.length === 0) {
      return {
        boosts,
        structured,
        confidence: ai.confidence,
        usedAi: false,
        reason: "invalid_ai_order",
        cacheHits,
        cacheMisses,
      };
    }

    const n = order.length;
    order.forEach((id, idx) => {
      const rankBoost = ((n - idx) / n) * AI_REFINE_BOOST_MAX * 0.5;
      boosts[id] = Math.min(
        AI_REFINE_BOOST_MAX,
        (boosts[id] ?? 0) + Math.round(rankBoost * 100) / 100,
      );
    });

    return {
      boosts,
      structured,
      confidence: ai.confidence,
      usedAi: true,
      reason: "ai_assisted",
      cacheHits,
      cacheMisses,
    };
  } catch {
    return {
      boosts,
      structured,
      confidence: 0,
      usedAi: false,
      reason: "ai_error_fallback",
      cacheHits,
      cacheMisses,
    };
  }
}

/**
 * Guard used by tests: AI refine must never introduce non-eligible IDs.
 */
export function filterAiOrderToEligible(
  order: string[],
  eligibleIds: Set<string>,
): string[] {
  return order.filter((id) => eligibleIds.has(id));
}
