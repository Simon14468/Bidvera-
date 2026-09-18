/**
 * AI-assisted semantic refinement — ranking assistant ONLY (Feature 8E).
 * Must run after the 8C relevance gate. Never creates capabilities or bypasses mismatches.
 */

import { capabilityMatchesText, CAPABILITY_GROUPS } from "@/domain/company-knowledge/normalize";
import { normalizeMatchingToken } from "./normalize";

export const AI_REFINE_BOOST_MAX = 3;
export const AI_REFINE_MIN_CONFIDENCE = 0.55;

export type AiRefineCandidate = {
  opportunityId: string;
  title: string;
  summary?: string | null;
  services: string[];
  category?: string | null;
  relevanceScore: number;
};

export type AiRefineResult = {
  /** Per-opportunity soft boost (0..AI_REFINE_BOOST_MAX). */
  boosts: Record<string, number>;
  confidence: number;
  usedAi: boolean;
  reason: string;
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
  candidates: AiRefineCandidate[];
}) => Promise<{ order: string[]; confidence: number } | null>;

/**
 * Optional AI reorder of already-eligible candidates.
 * Low confidence / failure → empty boosts (keep deterministic ranking).
 * Never adds new opportunity IDs; never resurrects gate failures.
 */
export async function refineEligibleWithAiAssist(input: {
  companyServices: string[];
  candidates: AiRefineCandidate[];
  aiReorder?: AiReorderFn | null;
  /** When false, skip AI and use deterministic synonym boosts only. */
  enableAi?: boolean;
}): Promise<AiRefineResult> {
  const eligibleIds = new Set(input.candidates.map((c) => c.opportunityId));
  const boosts: Record<string, number> = {};

  // Always apply deterministic synonym assist first
  for (const c of input.candidates) {
    const b = deterministicSemanticRefineBoost({
      companyServices: input.companyServices,
      candidate: c,
    });
    if (b > 0) boosts[c.opportunityId] = b;
  }

  if (!input.enableAi || !input.aiReorder || input.candidates.length < 2) {
    return {
      boosts,
      confidence: 1,
      usedAi: false,
      reason: "deterministic_only",
    };
  }

  try {
    const ai = await input.aiReorder({
      companyServices: input.companyServices,
      candidates: input.candidates,
    });
    if (!ai || ai.confidence < AI_REFINE_MIN_CONFIDENCE) {
      return {
        boosts,
        confidence: ai?.confidence ?? 0,
        usedAi: false,
        reason: "low_confidence_fallback",
      };
    }

    // Only reorder among already-eligible IDs; ignore unknown IDs
    const order = ai.order.filter((id) => eligibleIds.has(id));
    if (order.length === 0) {
      return {
        boosts,
        confidence: ai.confidence,
        usedAi: false,
        reason: "invalid_ai_order",
      };
    }

    const n = order.length;
    order.forEach((id, idx) => {
      // Higher rank → small extra boost; cannot exceed AI_REFINE_BOOST_MAX
      const rankBoost = ((n - idx) / n) * AI_REFINE_BOOST_MAX * 0.5;
      boosts[id] = Math.min(
        AI_REFINE_BOOST_MAX,
        (boosts[id] ?? 0) + Math.round(rankBoost * 100) / 100,
      );
    });

    return {
      boosts,
      confidence: ai.confidence,
      usedAi: true,
      reason: "ai_assisted",
    };
  } catch {
    return {
      boosts,
      confidence: 0,
      usedAi: false,
      reason: "ai_error_fallback",
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
