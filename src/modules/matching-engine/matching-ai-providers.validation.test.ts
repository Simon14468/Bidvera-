/**
 * Matching Engine — Live AI Provider Validation (all five providers).
 * Does not change scoring/relevance/lifecycle — validation & fallback coverage only.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { AiRefineCandidate } from "@/domain/matching-engine";
import {
  AI_REFINE_MIN_CONFIDENCE,
  filterAiOrderToEligible,
  refineEligibleWithAiAssist,
  scoreCompanyOpportunityMatch,
  type MatchingProfileSnapshot,
} from "@/domain/matching-engine";
import { SECRET_SETTING_KEYS } from "@/config/super-admin";
import { prisma } from "@/lib/db";
import {
  MATCHING_AI_DEFAULT_MODEL,
  MATCHING_AI_PROVIDER_BASE_URLS,
  MATCHING_AI_PROVIDER_DEFAULT_MODELS,
  MATCHING_AI_PROVIDERS,
  MATCHING_AI_SETTINGS_KEY,
  MATCHING_AI_VAULT_KEY,
  encryptMatchingAiVault,
  getMatchingAiAdminSnapshot,
  getMatchingAiRuntimeConfig,
  isMatchingAiProviderKey,
  matchingAiApiKeyHint,
  sanitizeMatchingAiErrorMessage,
  saveMatchingAiAdminSettings,
} from "@/modules/matching-engine/internal/ai-config";
import {
  getMatchingAIProvider,
  testMatchingAiConnection,
} from "@/modules/matching-engine/internal/ai-provider";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const ELIGIBLE: AiRefineCandidate[] = [
  {
    opportunityId: "elig-a",
    title: "Cyber SOC",
    summary: "Security operations",
    services: ["Cybersecurity"],
    category: "Security",
    relevanceScore: 80,
  },
  {
    opportunityId: "elig-b",
    title: "Cloud harden",
    summary: "Cloud security",
    services: ["Cloud"],
    category: "Cloud",
    relevanceScore: 70,
  },
];

const CYBER_PROFILE: MatchingProfileSnapshot = {
  services: [{ value: "Cybersecurity", trust: "strong", source: "sq" }],
  industries: [{ value: "Technology", trust: "normal", source: "p" }],
  geographies: [{ value: "Morocco", trust: "normal", source: "p" }],
  certifications: [],
  size: null,
  experienceYears: null,
  dcmCategories: [],
  softNotes: [],
};

async function clearMatchingAiSettings() {
  await prisma.systemSetting.deleteMany({
    where: { key: { in: [MATCHING_AI_SETTINGS_KEY, MATCHING_AI_VAULT_KEY] } },
  });
}

function mockProviderFetch(handler: (url: string, init?: RequestInit) => Response) {
  const original = globalThis.fetch;
  const calls: { url: string; body?: string; headers?: HeadersInit }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      body: typeof init?.body === "string" ? init.body : undefined,
      headers: init?.headers,
    });
    return handler(url, init);
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function openaiStyleOkResponse(content = '{"ok":true}') {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function anthropicOkResponse(content = '{"ok":true}') {
  return new Response(
    JSON.stringify({
      content: [{ type: "text", text: content }],
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function geminiOkResponse(content = '{"ok":true}') {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: content }] } }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("Matching AI — five-provider live validation", () => {
  before(async () => {
    await clearMatchingAiSettings();
  });
  after(async () => {
    await clearMatchingAiSettings();
  });

  it("registers all five providers with defaults and correct OpenAI-compatible endpoints", () => {
    assert.deepEqual([...MATCHING_AI_PROVIDERS], [
      "openai",
      "google",
      "anthropic",
      "deepseek",
      "qwen",
    ]);
    assert.equal(MATCHING_AI_PROVIDER_DEFAULT_MODELS.openai, MATCHING_AI_DEFAULT_MODEL);
    assert.equal(MATCHING_AI_PROVIDER_DEFAULT_MODELS.google, "gemini-2.0-flash");
    assert.equal(
      MATCHING_AI_PROVIDER_DEFAULT_MODELS.anthropic,
      "claude-3-5-haiku-latest",
    );
    assert.equal(MATCHING_AI_PROVIDER_DEFAULT_MODELS.deepseek, "deepseek-v4-flash");
    assert.equal(MATCHING_AI_PROVIDER_DEFAULT_MODELS.qwen, "qwen3.5-flash");

    assert.equal(MATCHING_AI_PROVIDER_BASE_URLS.deepseek, "https://api.deepseek.com");
    assert.equal(
      MATCHING_AI_PROVIDER_BASE_URLS.qwen,
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    );
    assert.equal(MATCHING_AI_PROVIDER_BASE_URLS.openai, null);
    assert.equal(MATCHING_AI_PROVIDER_BASE_URLS.google, null);
    assert.equal(MATCHING_AI_PROVIDER_BASE_URLS.anthropic, null);

    for (const key of MATCHING_AI_PROVIDERS) {
      assert.ok(isMatchingAiProviderKey(key));
      assert.equal(getMatchingAIProvider(key).key, key);
    }
  });

  it("resolves each provider from Super Admin runtime config without exposing API keys", async () => {
    assert.ok(SECRET_SETTING_KEYS.has(MATCHING_AI_VAULT_KEY));

    for (const provider of MATCHING_AI_PROVIDERS) {
      const rawKey = `sk-valid_${provider}_secret_key_zzzz`;
      const snap = await saveMatchingAiAdminSettings({
        enabled: true,
        provider,
        model: MATCHING_AI_PROVIDER_DEFAULT_MODELS[provider],
        apiKey: rawKey,
      });

      assert.equal(snap.provider, provider);
      assert.equal(snap.model, MATCHING_AI_PROVIDER_DEFAULT_MODELS[provider]);
      assert.equal(snap.enabled, true);
      assert.equal(snap.hasApiKey, true);
      assert.equal(snap.apiKeyHint, matchingAiApiKeyHint(rawKey));
      assert.ok(!JSON.stringify(snap).includes(rawKey));
      assert.ok(!("apiKey" in snap));

      const runtime = await getMatchingAiRuntimeConfig();
      assert.equal(runtime.ready, true);
      assert.equal(runtime.provider, provider);
      assert.equal(runtime.model, MATCHING_AI_PROVIDER_DEFAULT_MODELS[provider]);
      assert.equal(runtime.apiKey, rawKey);
      assert.equal(runtime.reason, "ready");

      // Vault ciphertext must not contain plaintext key
      const vaultRow = await prisma.systemSetting.findUnique({
        where: { key: MATCHING_AI_VAULT_KEY },
      });
      const cipher = (vaultRow?.value as { ciphertext?: string } | null)?.ciphertext;
      assert.ok(cipher);
      assert.ok(!cipher.includes(rawKey));
      assert.ok(encryptMatchingAiVault({ apiKey: rawKey }).length > 20);
    }

    await clearMatchingAiSettings();
  });

  it("connection-test works for each provider (mocked HTTP) and hits correct endpoints", async () => {
    // Missing key — no network
    for (const provider of MATCHING_AI_PROVIDERS) {
      const missing = await testMatchingAiConnection({
        provider,
        model: MATCHING_AI_PROVIDER_DEFAULT_MODELS[provider],
        apiKey: "",
      });
      assert.equal(missing.ok, false);
      assert.match(missing.message, /API key not configured/i);
    }

    const mock = mockProviderFetch((url) => {
      if (url.includes("api.anthropic.com")) return anthropicOkResponse();
      if (url.includes("generativelanguage.googleapis.com")) {
        return geminiOkResponse();
      }
      // OpenAI-compatible: openai, deepseek, qwen
      return openaiStyleOkResponse();
    });

    try {
      for (const provider of MATCHING_AI_PROVIDERS) {
        const result = await testMatchingAiConnection({
          provider,
          model: MATCHING_AI_PROVIDER_DEFAULT_MODELS[provider],
          apiKey: `sk-test_${provider}_xxxxxx`,
        });
        assert.equal(result.ok, true, `${provider} connection should succeed`);
        assert.ok(result.latencyMs >= 0);
        assert.ok(!result.message.toLowerCase().includes("sk-test_"));
      }

      const urls = mock.calls.map((c) => c.url);
      assert.ok(urls.some((u) => u.includes("api.openai.com")));
      assert.ok(urls.some((u) => u.includes("api.anthropic.com") && u.includes("/v1/messages")));
      assert.ok(
        urls.some(
          (u) =>
            u.includes("generativelanguage.googleapis.com") &&
            u.includes(":generateContent"),
        ),
      );
      assert.ok(
        urls.some(
          (u) =>
            u.startsWith("https://api.deepseek.com/chat/completions") ||
            u.includes("api.deepseek.com/chat/completions"),
        ),
      );
      assert.ok(
        urls.some((u) =>
          u.includes(
            "dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
          ),
        ),
      );

      // DeepSeek / Qwen must use OpenAI-compatible Authorization bearer path (not Gemini key query / Anthropic x-api-key only)
      const deepseekCall = mock.calls.find((c) => c.url.includes("api.deepseek.com"));
      const qwenCall = mock.calls.find((c) =>
        c.url.includes("dashscope-intl.aliyuncs.com"),
      );
      assert.ok(deepseekCall);
      assert.ok(qwenCall);
      const dsHeaders = JSON.stringify(deepseekCall!.headers ?? {});
      const qwHeaders = JSON.stringify(qwenCall!.headers ?? {});
      assert.ok(/Bearer/i.test(dsHeaders));
      assert.ok(/Bearer/i.test(qwHeaders));
    } finally {
      mock.restore();
    }
  });

  it("connection-test provider errors fall back safely without leaking keys", async () => {
    const secret = "sk-leaky_secret_should_never_appear_in_output";
    const mock = mockProviderFetch(() => {
      return new Response(
        JSON.stringify({ error: { message: `Invalid key ${secret}` } }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    });
    try {
      for (const provider of MATCHING_AI_PROVIDERS) {
        const result = await testMatchingAiConnection({
          provider,
          model: MATCHING_AI_PROVIDER_DEFAULT_MODELS[provider],
          apiKey: secret,
        });
        assert.equal(result.ok, false, `${provider} should fail on 401`);
        assert.ok(!result.message.includes(secret));
        assert.equal(
          sanitizeMatchingAiErrorMessage(result.message).includes(secret),
          false,
        );
      }
    } finally {
      mock.restore();
    }
  });

  it("AI refine runs only after 8C gate in generate path; cannot unlock mismatches", () => {
    const service = readSrc("src/modules/matching-engine/internal/service.ts");
    const generateStart = service.indexOf(
      "export async function generateMatchRecommendations",
    );
    assert.ok(generateStart > 0);
    const generateBody = service.slice(generateStart);
    const gateIdx = generateBody.indexOf("meetsRelevanceThreshold");
    const aiIdx = generateBody.indexOf("refineEligibleWithAiAssist");
    const runtimeIdx = generateBody.indexOf("getMatchingAiRuntimeConfig");
    assert.ok(gateIdx > 0);
    assert.ok(aiIdx > gateIdx, "AI refine must appear after relevance gate");
    assert.ok(runtimeIdx > gateIdx);

    const mismatch = scoreCompanyOpportunityMatch({
      profile: CYBER_PROFILE,
      opportunity: {
        services: ["Catering"],
        industries: ["Hospitality"],
        geographies: ["Morocco"],
        certifications: [],
        sizeBand: null,
        experienceYearsRequired: null,
        category: "Food",
        industry: "Hospitality",
      },
    });
    assert.equal(mismatch.meetsRelevanceThreshold, false);

    const match = scoreCompanyOpportunityMatch({
      profile: CYBER_PROFILE,
      opportunity: {
        services: ["Cybersecurity"],
        industries: ["Technology"],
        geographies: ["Vietnam"],
        certifications: [],
        sizeBand: null,
        experienceYearsRequired: null,
        category: "Security",
        industry: "Technology",
      },
    });
    assert.equal(match.meetsRelevanceThreshold, true);
  });

  it("AI may only reorder eligible IDs — never inject or invent eligibility", async () => {
    for (const provider of MATCHING_AI_PROVIDERS) {
      const result = await refineEligibleWithAiAssist({
        companyServices: ["Cybersecurity"],
        candidates: ELIGIBLE,
        enableAi: true,
        aiReorder: async () => ({
          order: [`injected-${provider}`, "elig-b", "elig-a", "also-fake"],
          confidence: 0.95,
        }),
      });
      assert.equal(result.usedAi, true);
      assert.ok(!(`injected-${provider}` in result.boosts));
      assert.ok(!("also-fake" in result.boosts));
      assert.ok("elig-a" in result.boosts || "elig-b" in result.boosts);
      assert.deepEqual(
        filterAiOrderToEligible(
          [`injected-${provider}`, "elig-b", "elig-a"],
          new Set(["elig-a", "elig-b"]),
        ),
        ["elig-b", "elig-a"],
      );
    }
  });

  it("timeout, invalid response, low confidence, disabled, missing key fall back to deterministic", async () => {
    const timeout = await refineEligibleWithAiAssist({
      companyServices: ["Cybersecurity"],
      candidates: ELIGIBLE,
      enableAi: true,
      aiReorder: async () => {
        throw new Error("provider timeout");
      },
    });
    assert.equal(timeout.usedAi, false);
    assert.equal(timeout.reason, "ai_error_fallback");

    const invalid = await refineEligibleWithAiAssist({
      companyServices: ["Cybersecurity"],
      candidates: ELIGIBLE,
      enableAi: true,
      aiReorder: async () => ({ order: ["not-eligible-only"], confidence: 0.99 }),
    });
    assert.equal(invalid.usedAi, false);
    assert.equal(invalid.reason, "invalid_ai_order");

    const low = await refineEligibleWithAiAssist({
      companyServices: ["Cybersecurity"],
      candidates: ELIGIBLE,
      enableAi: true,
      aiReorder: async () => ({
        order: ["elig-b", "elig-a"],
        confidence: AI_REFINE_MIN_CONFIDENCE - 0.2,
      }),
    });
    assert.equal(low.usedAi, false);
    assert.equal(low.reason, "low_confidence_fallback");

    const nullResp = await refineEligibleWithAiAssist({
      companyServices: ["Cybersecurity"],
      candidates: ELIGIBLE,
      enableAi: true,
      aiReorder: async () => null,
    });
    assert.equal(nullResp.usedAi, false);
    assert.equal(nullResp.reason, "low_confidence_fallback");

    await saveMatchingAiAdminSettings({
      enabled: false,
      provider: "openai",
      model: MATCHING_AI_DEFAULT_MODEL,
      apiKey: "sk-disabled_fallback_key_aaaa",
    });
    const disabledRuntime = await getMatchingAiRuntimeConfig();
    assert.equal(disabledRuntime.ready, false);
    assert.equal(disabledRuntime.reason, "disabled");
    let calledWhenDisabled = false;
    const disabledRefine = await refineEligibleWithAiAssist({
      companyServices: ["Cybersecurity"],
      candidates: ELIGIBLE,
      enableAi: disabledRuntime.ready,
      aiReorder: async () => {
        calledWhenDisabled = true;
        return { order: ["elig-b", "elig-a"], confidence: 0.9 };
      },
    });
    assert.equal(calledWhenDisabled, false);
    assert.equal(disabledRefine.usedAi, false);
    assert.equal(disabledRefine.reason, "deterministic_only");

    await saveMatchingAiAdminSettings({
      enabled: true,
      provider: "deepseek",
      model: MATCHING_AI_PROVIDER_DEFAULT_MODELS.deepseek,
      clearApiKey: true,
    });
    const missingKeyRuntime = await getMatchingAiRuntimeConfig();
    assert.equal(missingKeyRuntime.ready, false);
    assert.equal(missingKeyRuntime.reason, "missing_api_key");
    const snap = await getMatchingAiAdminSnapshot();
    assert.equal(snap.hasApiKey, false);

    await clearMatchingAiSettings();
  });
});
