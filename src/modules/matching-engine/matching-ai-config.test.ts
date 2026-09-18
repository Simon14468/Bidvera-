/**
 * Matching AI provider configuration — security & fallback tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  filterAiOrderToEligible,
  refineEligibleWithAiAssist,
  scoreCompanyOpportunityMatch,
  type MatchingProfileSnapshot,
} from "@/domain/matching-engine";
import { SECRET_SETTING_KEYS } from "@/config/super-admin";
import { prisma } from "@/lib/db";
import {
  MATCHING_AI_DEFAULT_MODEL,
  MATCHING_AI_SETTINGS_KEY,
  MATCHING_AI_VAULT_KEY,
  decryptMatchingAiVault,
  encryptMatchingAiVault,
  getMatchingAiAdminSnapshot,
  getMatchingAiRuntimeConfig,
  matchingAiApiKeyHint,
  sanitizeMatchingAiErrorMessage,
  saveMatchingAiAdminSettings,
} from "@/modules/matching-engine/internal/ai-config";
import {
  createMatchingAiReorderFn,
  getMatchingAIProvider,
} from "@/modules/matching-engine/internal/ai-provider";
import { listPublicSettings } from "@/services/settings";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Matching AI config — secrets & defaults", () => {
  it("keeps vault key secret and default model low-cost", () => {
    assert.ok(SECRET_SETTING_KEYS.has(MATCHING_AI_VAULT_KEY));
    assert.equal(MATCHING_AI_DEFAULT_MODEL, "gpt-4o-mini");
    assert.equal(MATCHING_AI_SETTINGS_KEY, "matching.ai.settings");
  });

  it("encrypts API key at rest and never exposes full key in snapshot", async () => {
    const cipher = encryptMatchingAiVault({
      apiKey: "sk-test_secret_key_matching_abc123",
    });
    assert.ok(!cipher.includes("sk-test_secret"));
    const plain = decryptMatchingAiVault(cipher);
    assert.equal(plain.apiKey, "sk-test_secret_key_matching_abc123");

    await prisma.systemSetting.deleteMany({
      where: { key: { in: [MATCHING_AI_SETTINGS_KEY, MATCHING_AI_VAULT_KEY] } },
    });

    const snap = await saveMatchingAiAdminSettings({
      enabled: false,
      provider: "openai",
      model: MATCHING_AI_DEFAULT_MODEL,
      apiKey: "sk-live_matching_test_key_xyz999",
    });

    assert.equal(snap.hasApiKey, true);
    assert.equal(snap.apiKeyHint, matchingAiApiKeyHint("sk-live_matching_test_key_xyz999"));
    assert.ok(!JSON.stringify(snap).includes("sk-live_matching_test_key_xyz999"));
    assert.ok(!("apiKey" in snap));

    const publicRows = await listPublicSettings();
    assert.ok(!publicRows.some((r) => r.key === MATCHING_AI_VAULT_KEY));

    await prisma.systemSetting.deleteMany({
      where: { key: { in: [MATCHING_AI_SETTINGS_KEY, MATCHING_AI_VAULT_KEY] } },
    });
  });

  it("redacts secrets from error messages and never logs keys in source", () => {
    const scrubbed = sanitizeMatchingAiErrorMessage(
      new Error("AI_HTTP_401: Invalid sk-proj-ABCDEFGHIJKLMNOPQRSTUV Bearer tokensecret123456"),
    );
    assert.ok(!scrubbed.includes("sk-proj-ABCDEFGHIJKLMNOPQRSTUV"));
    assert.ok(scrubbed.includes("[redacted]"));

    const providerSrc = readSrc(
      "src/modules/matching-engine/internal/ai-provider.ts",
    );
    const configSrc = readSrc(
      "src/modules/matching-engine/internal/ai-config.ts",
    );
    assert.ok(!providerSrc.includes("console.log"));
    assert.ok(!configSrc.includes("console.log"));
    assert.ok(providerSrc.includes("MatchingAIProvider"));
    assert.ok(providerSrc.includes("openai"));
    assert.ok(providerSrc.includes("google"));
    assert.ok(providerSrc.includes("anthropic"));
    assert.ok(providerSrc.includes("deepseek"));
    assert.ok(providerSrc.includes("qwen"));
  });

  it("disabled / missing key makes runtime not ready (no provider call path)", async () => {
    await prisma.systemSetting.deleteMany({
      where: { key: { in: [MATCHING_AI_SETTINGS_KEY, MATCHING_AI_VAULT_KEY] } },
    });

    await saveMatchingAiAdminSettings({
      enabled: false,
      provider: "openai",
      model: MATCHING_AI_DEFAULT_MODEL,
      apiKey: "sk-disabled_path_key_abc",
    });

    const runtime = await getMatchingAiRuntimeConfig();
    assert.equal(runtime.ready, false);
    assert.equal(runtime.reason, "disabled");

    let called = false;
    const reorder = createMatchingAiReorderFn({
      provider: "openai",
      model: MATCHING_AI_DEFAULT_MODEL,
      apiKey: "sk-should_not_matter",
    });
    // Simulate generate path: when !ready, aiReorder is null and enableAi false
    const result = await refineEligibleWithAiAssist({
      companyServices: ["Cybersecurity"],
      candidates: [
        {
          opportunityId: "a",
          title: "A",
          services: ["Cybersecurity"],
          relevanceScore: 70,
        },
        {
          opportunityId: "b",
          title: "B",
          services: ["Cloud"],
          relevanceScore: 65,
        },
      ],
      enableAi: runtime.ready,
      aiReorder: async (args) => {
        called = true;
        return reorder(args);
      },
    });
    assert.equal(called, false);
    assert.equal(result.usedAi, false);
    assert.equal(result.reason, "deterministic_only");

    await prisma.systemSetting.deleteMany({
      where: { key: { in: [MATCHING_AI_SETTINGS_KEY, MATCHING_AI_VAULT_KEY] } },
    });
  });
});

describe("Matching AI — gate & fallback", () => {
  it("provider failure falls back; AI cannot inject non-eligible IDs", async () => {
    const failing = await refineEligibleWithAiAssist({
      companyServices: ["Cybersecurity"],
      candidates: [
        {
          opportunityId: "a",
          title: "SOC",
          services: ["Cybersecurity"],
          relevanceScore: 80,
        },
        {
          opportunityId: "b",
          title: "Cloud",
          services: ["Cloud"],
          relevanceScore: 70,
        },
      ],
      enableAi: true,
      aiReorder: async () => {
        throw new Error("provider timeout");
      },
    });
    assert.equal(failing.usedAi, false);
    assert.equal(failing.reason, "ai_error_fallback");

    const injected = await refineEligibleWithAiAssist({
      companyServices: ["Cybersecurity"],
      candidates: [
        {
          opportunityId: "a",
          title: "SOC",
          services: ["Cybersecurity"],
          relevanceScore: 80,
        },
        {
          opportunityId: "b",
          title: "Cloud",
          services: ["Cloud"],
          relevanceScore: 70,
        },
      ],
      enableAi: true,
      aiReorder: async () => ({
        order: ["evil-new", "b", "a"],
        confidence: 0.95,
      }),
    });
    assert.equal(injected.usedAi, true);
    assert.ok(!("evil-new" in injected.boosts));
    assert.deepEqual(
      filterAiOrderToEligible(["evil-new", "b", "a"], new Set(["a", "b"])),
      ["b", "a"],
    );
  });

  it("AI cannot bypass 8C hard relevance", () => {
    const profile: MatchingProfileSnapshot = {
      services: [{ value: "Cybersecurity", trust: "strong", source: "sq" }],
      industries: [{ value: "Technology", trust: "normal", source: "p" }],
      geographies: [{ value: "Morocco", trust: "normal", source: "p" }],
      certifications: [],
      size: null,
      experienceYears: null,
      dcmCategories: [],
      softNotes: [],
    };
    const mismatch = scoreCompanyOpportunityMatch({
      profile,
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

    // Provider abstraction exists for openai / google / anthropic / deepseek / qwen
    assert.equal(getMatchingAIProvider("openai").key, "openai");
    assert.equal(getMatchingAIProvider("google").key, "google");
    assert.equal(getMatchingAIProvider("anthropic").key, "anthropic");
    assert.equal(getMatchingAIProvider("deepseek").key, "deepseek");
    assert.equal(getMatchingAIProvider("qwen").key, "qwen");

    const configSrc = readSrc(
      "src/modules/matching-engine/internal/ai-config.ts",
    );
    assert.ok(configSrc.includes("deepseek-v4-flash"));
    assert.ok(configSrc.includes("qwen3.5-flash"));
    assert.ok(configSrc.includes("https://api.deepseek.com"));
    assert.ok(
      configSrc.includes("dashscope-intl.aliyuncs.com/compatible-mode/v1"),
    );
  });

  it("company-facing matching APIs do not expose AI config/key routes", () => {
    const events = readSrc("src/app/api/matching-engine/events/route.ts");
    const analytics = readSrc("src/app/api/matching-engine/analytics/route.ts");
    const gen = readSrc(
      "src/app/api/matching-engine/recommendations/generate/route.ts",
    );
    for (const src of [events, analytics, gen]) {
      assert.ok(!src.includes("MATCHING_AI_VAULT"));
      assert.ok(!src.includes("resolveMatchingAiApiKey"));
      assert.ok(!src.includes("saSaveMatchingAiSettings"));
    }
    const actions = readSrc("src/app/actions/super-admin.ts");
    assert.ok(actions.includes("saSaveMatchingAiSettings"));
    assert.ok(actions.includes("requireWritableSuperAdmin"));
    assert.ok(actions.includes("saTestMatchingAiConnection"));
  });

  it("generate path uses runtime config and never calls AI on strip", () => {
    const service = readSrc("src/modules/matching-engine/internal/service.ts");
    assert.ok(service.includes("getMatchingAiRuntimeConfig"));
    assert.ok(service.includes("createMatchingAiReorderFn"));
    assert.ok(service.includes("meetsRelevanceThreshold"));
    const strip = readSrc("src/modules/matching-engine/ui/matched-strip.tsx");
    assert.ok(!strip.includes("getMatchingAiRuntimeConfig"));
    assert.ok(!strip.includes("providerChatCompletion"));
  });
});

describe("Matching AI — admin snapshot isolation cleanup", () => {
  before(async () => {
    await prisma.systemSetting.deleteMany({
      where: { key: { in: [MATCHING_AI_SETTINGS_KEY, MATCHING_AI_VAULT_KEY] } },
    });
  });
  after(async () => {
    await prisma.systemSetting.deleteMany({
      where: { key: { in: [MATCHING_AI_SETTINGS_KEY, MATCHING_AI_VAULT_KEY] } },
    });
  });

  it("missing key while enabled is not ready", async () => {
    await saveMatchingAiAdminSettings({
      enabled: true,
      provider: "openai",
      model: MATCHING_AI_DEFAULT_MODEL,
      clearApiKey: true,
    });
    const runtime = await getMatchingAiRuntimeConfig();
    assert.equal(runtime.ready, false);
    assert.equal(runtime.reason, "missing_api_key");
    const snap = await getMatchingAiAdminSnapshot();
    assert.equal(snap.hasApiKey, false);
    assert.ok(!JSON.stringify(snap).toLowerCase().includes("sk-"));
  });
});
