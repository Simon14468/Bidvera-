/**
 * Provider-agnostic Matching AI assistant.
 * Ranking/semantic refine ONLY — never a source of truth for eligibility.
 */

import {
  providerChatCompletion,
  testProviderModelConnection,
} from "@/services/ai/providers";
import type {
  AiRefineCandidate,
  AiStructuredRefineOutput,
} from "@/domain/matching-engine";
import {
  AI_REFINE_BOOST_MAX,
  AI_REFINE_MAX_CANDIDATES,
  assertAiPayloadIsPublicSafe,
  buildAiRefineNormalizedInput,
  sanitizeAiStructuredRefineBatch,
} from "@/domain/matching-engine";
import {
  sanitizeMatchingAiErrorMessage,
  MATCHING_AI_PROVIDER_BASE_URLS,
  type MatchingAiProviderKey,
} from "./ai-config";

export type MatchingAiReorderInput = {
  model: string;
  apiKey: string;
  companyServices: string[];
  /** Company IANA timezone from matching profile — local deadline context only. */
  companyTimezone?: string | null;
  candidates: AiRefineCandidate[];
};

export type MatchingAiStructuredInput = {
  model: string;
  apiKey: string;
  companyServices: string[];
  companyIndustries: string[];
  companyCertifications: string[];
  companyCountries: string[];
  companyTimezone?: string | null;
  candidates: AiRefineCandidate[];
};

export type MatchingAiReorderResult = {
  order: string[];
  confidence: number;
};

export type MatchingAiTestResult = {
  ok: boolean;
  latencyMs: number;
  message: string;
};

/**
 * Internal interface — Matching Engine calls this abstraction, not a vendor SDK.
 */
export interface MatchingAIProvider {
  readonly key: MatchingAiProviderKey;
  testConnection(input: {
    model: string;
    apiKey: string;
  }): Promise<MatchingAiTestResult>;
  reorderEligible(
    input: MatchingAiReorderInput,
  ): Promise<MatchingAiReorderResult | null>;
  refineEligibleStructured(
    input: MatchingAiStructuredInput,
  ): Promise<AiStructuredRefineOutput[] | null>;
}

function buildStructuredPrompt(input: MatchingAiStructuredInput): {
  system: string;
  user: string;
} {
  const eligibleIds = input.candidates.map((c) => c.opportunityId);
  const candidates = input.candidates.slice(0, AI_REFINE_MAX_CANDIDATES).map((c) => {
    const built = buildAiRefineNormalizedInput({
      companyServices: input.companyServices,
      companyIndustries: input.companyIndustries,
      companyCertifications: input.companyCertifications,
      companyCountries: input.companyCountries,
      companyTimezone: input.companyTimezone,
      candidate: c,
    });
    return built.opportunity;
  });

  const company = {
    services: input.companyServices.slice(0, 12).map((s) => String(s).slice(0, 64)),
    industries: input.companyIndustries.slice(0, 8).map((s) => String(s).slice(0, 64)),
    certifications: input.companyCertifications
      .slice(0, 8)
      .map((s) => String(s).slice(0, 64)),
    countries: input.companyCountries.slice(0, 4).map((s) => String(s).slice(0, 48)),
    timezone: input.companyTimezone
      ? String(input.companyTimezone).slice(0, 80)
      : null,
  };

  const payload = { company, eligibleIds, candidates };
  const unsafe = assertAiPayloadIsPublicSafe(payload);
  if (unsafe.length > 0) {
    throw new Error(`AI payload rejected: banned fields ${unsafe.join(",")}`);
  }

  const system = [
    "You assist Bidvera Matching Engine with semantic refinement ONLY.",
    "All candidates already passed a hard capability/relevance gate.",
    "Compare company matching signals to public opportunity text.",
    "You MUST NOT invent capabilities, certifications, experience, or qualifications.",
    "You MUST NOT add opportunity IDs that are not in eligibleIds.",
    "You MUST NOT override mandatory country, certification, or deadline requirements.",
    "You MUST NOT resurrect opportunities rejected by the hard gate.",
    "Geography may differ across countries; do not reject cross-border matches.",
    "When company.timezone is provided, use it only for local deadline urgency — never invent locations.",
    `boundedRefineScore MUST be between 0 and ${AI_REFINE_BOOST_MAX} inclusive.`,
    "Respond with JSON only:",
    '{"refinements":[{"opportunityId":"id","semanticServiceFit":0-1,"semanticIndustryFit":0-1,"requirementFit":0-1,"detectedGaps":["..."],"explanation":"...","boundedRefineScore":0-3,"confidence":0-1}]}',
  ].join(" ");

  return { system, user: JSON.stringify(payload) };
}

function buildReorderPrompt(input: MatchingAiReorderInput): {
  system: string;
  user: string;
} {
  const eligibleIds = input.candidates.map((c) => c.opportunityId);
  const sanitized = input.candidates.map((c) => ({
    id: c.opportunityId,
    title: (c.title ?? "").slice(0, 160),
    summary: (c.summary ?? "").slice(0, 240),
    services: (c.services ?? []).slice(0, 8).map((s) => String(s).slice(0, 64)),
    category: c.category ? String(c.category).slice(0, 64) : null,
    relevanceScore: c.relevanceScore,
  }));

  const system = [
    "You assist Bidvera Matching Engine with ranking ONLY.",
    "All candidates already passed a hard capability/relevance gate.",
    "Reorder by semantic fit between company offering and opportunity wording.",
    "You MUST NOT invent capabilities, certifications, experience, or qualifications.",
    "You MUST NOT add opportunity IDs that are not in the provided list.",
    "You MUST NOT remove eligibility — only reorder.",
    "Geography may differ across countries; do not reject cross-border matches.",
    "When companyTimezone is provided, treat it as the company's local clock for urgency/deadline context only — never invent locations from it.",
    'Respond with JSON only: {"order":["id",...],"confidence":0.0-1.0}',
  ].join(" ");

  const user = JSON.stringify({
    companyServices: input.companyServices
      .slice(0, 12)
      .map((s) => String(s).slice(0, 64)),
    companyTimezone: input.companyTimezone
      ? String(input.companyTimezone).slice(0, 80)
      : null,
    eligibleIds,
    candidates: sanitized,
  });

  return { system, user };
}

function parseReorderResponse(
  content: string,
  eligibleIds: Set<string>,
): MatchingAiReorderResult | null {
  try {
    const json = JSON.parse(content) as {
      order?: unknown;
      confidence?: unknown;
    };
    if (!Array.isArray(json.order)) return null;
    const order = json.order
      .filter((id): id is string => typeof id === "string")
      .filter((id) => eligibleIds.has(id));
    const seen = new Set<string>();
    const unique = order.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    if (unique.length === 0) return null;
    const confidence =
      typeof json.confidence === "number" && Number.isFinite(json.confidence)
        ? Math.max(0, Math.min(1, json.confidence))
        : 0.6;
    return { order: unique, confidence };
  } catch {
    return null;
  }
}

async function chatStructured(
  providerKey: MatchingAiProviderKey,
  input: MatchingAiStructuredInput,
): Promise<AiStructuredRefineOutput[] | null> {
  if (input.candidates.length === 0) return null;
  const eligibleIds = new Set(input.candidates.map((c) => c.opportunityId));
  const { system, user } = buildStructuredPrompt(input);

  const result = await providerChatCompletion({
    providerKey,
    baseUrl: MATCHING_AI_PROVIDER_BASE_URLS[providerKey],
    model: input.model,
    apiKey: input.apiKey,
    system,
    user,
    temperature: 0,
    maxTokens: 900,
    responseFormat: "json",
  });

  try {
    const parsed = JSON.parse(result.content) as unknown;
    const sanitized = sanitizeAiStructuredRefineBatch(parsed, eligibleIds);
    return sanitized.length > 0 ? sanitized : null;
  } catch {
    return null;
  }
}

async function chatReorder(
  providerKey: MatchingAiProviderKey,
  input: MatchingAiReorderInput,
): Promise<MatchingAiReorderResult | null> {
  if (input.candidates.length < 2) return null;
  const eligibleIds = new Set(input.candidates.map((c) => c.opportunityId));
  const { system, user } = buildReorderPrompt(input);

  const result = await providerChatCompletion({
    providerKey,
    baseUrl: MATCHING_AI_PROVIDER_BASE_URLS[providerKey],
    model: input.model,
    apiKey: input.apiKey,
    system,
    user,
    temperature: 0,
    maxTokens: 400,
    responseFormat: "json",
  });

  return parseReorderResponse(result.content, eligibleIds);
}

async function chatTest(
  providerKey: MatchingAiProviderKey,
  input: { model: string; apiKey: string },
): Promise<MatchingAiTestResult> {
  const started = Date.now();
  try {
    const result = await providerChatCompletion({
      providerKey,
      baseUrl: MATCHING_AI_PROVIDER_BASE_URLS[providerKey],
      model: input.model,
      apiKey: input.apiKey,
      system: "Reply with JSON only.",
      user: JSON.stringify({ ping: true, reply: { ok: true } }),
      temperature: 0,
      maxTokens: 32,
      responseFormat: "json",
    });
    const latencyMs = Date.now() - started;
    if (!result.content) {
      return {
        ok: false,
        latencyMs,
        message: "Empty response from provider.",
      };
    }
    return {
      ok: true,
      latencyMs,
      message: `Connected (${latencyMs}ms). Provider responded.`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: sanitizeMatchingAiErrorMessage(error),
    };
  }
}

function createProvider(key: MatchingAiProviderKey): MatchingAIProvider {
  return {
    key,
    testConnection: (input) => chatTest(key, input),
    reorderEligible: (input) => chatReorder(key, input),
    refineEligibleStructured: (input) => chatStructured(key, input),
  };
}

const PROVIDERS: Record<MatchingAiProviderKey, MatchingAIProvider> = {
  openai: createProvider("openai"),
  google: createProvider("google"),
  anthropic: createProvider("anthropic"),
  deepseek: createProvider("deepseek"),
  qwen: createProvider("qwen"),
};

export function getMatchingAIProvider(
  key: MatchingAiProviderKey,
): MatchingAIProvider {
  return PROVIDERS[key] ?? PROVIDERS.openai;
}

/**
 * Build AiReorderFn for 8E refineEligibleWithAiAssist from runtime config.
 * Never throws — returns null on failure so deterministic path wins.
 */
export function createMatchingAiReorderFn(input: {
  provider: MatchingAiProviderKey;
  model: string;
  apiKey: string;
}): (args: {
  companyServices: string[];
  companyTimezone?: string | null;
  candidates: AiRefineCandidate[];
}) => Promise<{ order: string[]; confidence: number } | null> {
  const provider = getMatchingAIProvider(input.provider);
  return async (args) => {
    try {
      return await provider.reorderEligible({
        model: input.model,
        apiKey: input.apiKey,
        companyServices: args.companyServices,
        companyTimezone: args.companyTimezone ?? null,
        candidates: args.candidates,
      });
    } catch {
      return null;
    }
  };
}

/**
 * Preferred structured refine fn — returns sanitized contract objects only.
 */
export function createMatchingAiStructuredRefineFn(input: {
  provider: MatchingAiProviderKey;
  model: string;
  apiKey: string;
}): (args: {
  companyServices: string[];
  companyIndustries: string[];
  companyCertifications: string[];
  companyCountries: string[];
  companyTimezone?: string | null;
  candidates: AiRefineCandidate[];
}) => Promise<AiStructuredRefineOutput[] | null> {
  const provider = getMatchingAIProvider(input.provider);
  return async (args) => {
    try {
      return await provider.refineEligibleStructured({
        model: input.model,
        apiKey: input.apiKey,
        companyServices: args.companyServices,
        companyIndustries: args.companyIndustries,
        companyCertifications: args.companyCertifications,
        companyCountries: args.companyCountries,
        companyTimezone: args.companyTimezone ?? null,
        candidates: args.candidates,
      });
    } catch {
      return null;
    }
  };
}

/** SA test connection using configured/runtime credentials. */
export async function testMatchingAiConnection(input: {
  provider: MatchingAiProviderKey;
  model: string;
  apiKey: string;
}): Promise<MatchingAiTestResult> {
  if (!input.apiKey) {
    return {
      ok: false,
      latencyMs: 0,
      message: "API key not configured.",
    };
  }
  const provider = getMatchingAIProvider(input.provider);
  return provider.testConnection({
    model: input.model,
    apiKey: input.apiKey,
  });
}

/** Exported for tests — unused production alias keeps providers.ts pattern discoverable. */
export async function probeMatchingAiViaCatalogHelper(input: {
  providerKey: string;
  model: string;
}): Promise<{ ok: boolean; message: string }> {
  const result = await testProviderModelConnection({
    providerKey: input.providerKey,
    model: input.model,
  });
  return {
    ok: result.ok,
    message: sanitizeMatchingAiErrorMessage(result.message),
  };
}
