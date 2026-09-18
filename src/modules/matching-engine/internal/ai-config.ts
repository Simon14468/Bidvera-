/**
 * Matching Engine AI assistant configuration (Super Admin).
 * Secrets encrypted at rest — never returned to clients or logs.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getAuthSecret } from "@/lib/auth-secret";
import { prisma } from "@/lib/db";
import { getSetting, setSetting } from "@/services/settings";
import {
  sanitizeModelName,
  sanitizeSecretKey,
} from "@/services/ai/assistant-settings";
import { z } from "zod";

export const MATCHING_AI_SETTINGS_KEY = "matching.ai.settings";
export const MATCHING_AI_VAULT_KEY = "matching.ai.vault";

export const MATCHING_AI_PROVIDERS = [
  "openai",
  "google",
  "anthropic",
  "deepseek",
  "qwen",
] as const;
export type MatchingAiProviderKey = (typeof MATCHING_AI_PROVIDERS)[number];

/** Low-cost default for semantic ranking assist — not the primary matcher. */
export const MATCHING_AI_DEFAULT_MODEL = "gpt-4o-mini";

export const MATCHING_AI_PROVIDER_DEFAULT_MODELS: Record<
  MatchingAiProviderKey,
  string
> = {
  openai: MATCHING_AI_DEFAULT_MODEL,
  google: "gemini-2.0-flash",
  anthropic: "claude-3-5-haiku-latest",
  deepseek: "deepseek-v4-flash",
  qwen: "qwen3.5-flash",
};

export function isMatchingAiProviderKey(
  value: unknown,
): value is MatchingAiProviderKey {
  return (
    typeof value === "string" &&
    (MATCHING_AI_PROVIDERS as readonly string[]).includes(value)
  );
}

/**
 * OpenAI-compatible base URLs for Matching AI providers.
 * openai / anthropic / google use the shared providerChatCompletion defaults.
 */
export const MATCHING_AI_PROVIDER_BASE_URLS: Record<
  MatchingAiProviderKey,
  string | null
> = {
  openai: null,
  google: null,
  anthropic: null,
  deepseek: "https://api.deepseek.com",
  qwen: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
};

export type MatchingAiConnectionStatus =
  | "unconfigured"
  | "configured"
  | "verified"
  | "error"
  | "disabled";

export const matchingAiPublicSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(MATCHING_AI_PROVIDERS).default("openai"),
  model: z.string().min(1).max(120).default(MATCHING_AI_DEFAULT_MODEL),
  lastTestAt: z.string().datetime().nullable().optional(),
  lastTestOk: z.boolean().nullable().optional(),
  lastErrorSafe: z.string().max(400).nullable().optional(),
  connectionStatus: z
    .enum(["unconfigured", "configured", "verified", "error", "disabled"])
    .default("unconfigured"),
});

export type MatchingAiPublicSettings = z.infer<
  typeof matchingAiPublicSettingsSchema
>;

export const DEFAULT_MATCHING_AI_SETTINGS: MatchingAiPublicSettings = {
  enabled: false,
  provider: "openai",
  model: MATCHING_AI_DEFAULT_MODEL,
  lastTestAt: null,
  lastTestOk: null,
  lastErrorSafe: null,
  connectionStatus: "unconfigured",
};

export const matchingAiAdminSaveSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(MATCHING_AI_PROVIDERS),
  model: z.string().trim().min(1).max(120),
  /** Empty / omitted = keep existing key */
  apiKey: z.string().max(500).optional().nullable(),
  clearApiKey: z.boolean().optional(),
});

type MatchingAiVault = { apiKey?: string };

function vaultKeyMaterial(): Buffer {
  return createHash("sha256")
    .update(`matching-ai:${getAuthSecret()}`)
    .digest();
}

export function encryptMatchingAiVault(value: MatchingAiVault): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKeyMaterial(), iv);
  const plain = Buffer.from(JSON.stringify(value), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptMatchingAiVault(payload: string): MatchingAiVault {
  try {
    const buf = Buffer.from(payload, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", vaultKeyMaterial(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as MatchingAiVault;
  } catch {
    return {};
  }
}

async function readVault(): Promise<MatchingAiVault> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: MATCHING_AI_VAULT_KEY },
  });
  if (!row || typeof row.value !== "object" || row.value === null) return {};
  const cipher = (row.value as { ciphertext?: string }).ciphertext;
  if (!cipher || typeof cipher !== "string") return {};
  return decryptMatchingAiVault(cipher);
}

async function writeVault(vault: MatchingAiVault): Promise<void> {
  const cleaned: MatchingAiVault = {};
  const key = sanitizeSecretKey(vault.apiKey);
  if (key) cleaned.apiKey = key;

  await prisma.systemSetting.upsert({
    where: { key: MATCHING_AI_VAULT_KEY },
    create: {
      key: MATCHING_AI_VAULT_KEY,
      value: { ciphertext: encryptMatchingAiVault(cleaned) } as object,
      description: "Encrypted Matching Engine AI API key (server-only)",
    },
    update: {
      value: { ciphertext: encryptMatchingAiVault(cleaned) } as object,
      description: "Encrypted Matching Engine AI API key (server-only)",
    },
  });
}

export function matchingAiApiKeyHint(
  apiKey: string | null | undefined,
): string | null {
  const k = sanitizeSecretKey(apiKey);
  if (!k || k.length < 8) return null;
  return `••••${k.slice(-4)}`;
}

/** Strip secrets / key-like tokens from provider error text. */
export function sanitizeMatchingAiErrorMessage(raw: unknown): string {
  let msg = raw instanceof Error ? raw.message : String(raw ?? "Unknown error");
  msg = msg
    .replace(/sk-[a-zA-Z0-9_-]{10,}/g, "[redacted]")
    .replace(/Bearer\s+[a-zA-Z0-9._-]{8,}/gi, "Bearer [redacted]")
    .replace(/key[=:]\s*["']?[^"',\s]{8,}/gi, "key=[redacted]");
  return msg.replace(/\s+/g, " ").trim().slice(0, 400) || "Provider error";
}

export async function getMatchingAiPublicSettings(): Promise<MatchingAiPublicSettings> {
  const raw = await getSetting<unknown>(
    MATCHING_AI_SETTINGS_KEY,
    DEFAULT_MATCHING_AI_SETTINGS,
  );
  const parsed = matchingAiPublicSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : { ...DEFAULT_MATCHING_AI_SETTINGS };
}

/** Resolve API key from vault only (Matching AI is dedicated). Never log return. */
export async function resolveMatchingAiApiKey(): Promise<string> {
  const vault = await readVault();
  return sanitizeSecretKey(vault.apiKey);
}

export async function getMatchingAiAdminSnapshot() {
  const settings = await getMatchingAiPublicSettings();
  const vault = await readVault();
  const vaultKey = sanitizeSecretKey(vault.apiKey);
  const hasApiKey = Boolean(vaultKey);

  return {
    enabled: settings.enabled,
    provider: settings.provider,
    model: settings.model,
    connectionStatus: settings.connectionStatus as MatchingAiConnectionStatus,
    lastTestAt: settings.lastTestAt ?? null,
    lastTestOk: settings.lastTestOk ?? null,
    lastErrorSafe: settings.lastErrorSafe ?? null,
    hasApiKey,
    apiKeyHint: matchingAiApiKeyHint(vaultKey),
    defaultModels: MATCHING_AI_PROVIDER_DEFAULT_MODELS,
    /** Never include raw key */
  };
}

export type MatchingAiAdminSnapshot = Awaited<
  ReturnType<typeof getMatchingAiAdminSnapshot>
>;

export function matchingAiAuditSafeSnapshot(snap: MatchingAiAdminSnapshot) {
  return {
    enabled: snap.enabled,
    provider: snap.provider,
    model: snap.model,
    connectionStatus: snap.connectionStatus,
    hasApiKey: snap.hasApiKey,
    apiKeyHint: snap.apiKeyHint,
    lastTestOk: snap.lastTestOk,
    lastTestAt: snap.lastTestAt,
  };
}

export async function saveMatchingAiAdminSettings(
  raw: z.infer<typeof matchingAiAdminSaveSchema> | unknown,
): Promise<MatchingAiAdminSnapshot> {
  const input = matchingAiAdminSaveSchema.parse(raw);
  const model = sanitizeModelName(input.model) || MATCHING_AI_DEFAULT_MODEL;
  const existing = await getMatchingAiPublicSettings();

  if (input.clearApiKey) {
    await writeVault({});
  } else {
    const nextKey = sanitizeSecretKey(input.apiKey);
    if (nextKey) {
      await writeVault({ apiKey: nextKey });
    }
  }

  const afterVault = await readVault();
  const hasKey = Boolean(sanitizeSecretKey(afterVault.apiKey));
  let connectionStatus: MatchingAiConnectionStatus = existing.connectionStatus;
  if (!input.enabled) {
    connectionStatus = "disabled";
  } else if (!hasKey) {
    connectionStatus = "unconfigured";
  } else if (
    connectionStatus === "unconfigured" ||
    connectionStatus === "disabled"
  ) {
    connectionStatus = "configured";
  }

  await setSetting(MATCHING_AI_SETTINGS_KEY, {
    enabled: input.enabled,
    provider: input.provider,
    model,
    lastTestAt: existing.lastTestAt ?? null,
    lastTestOk: existing.lastTestOk ?? null,
    lastErrorSafe: existing.lastErrorSafe ?? null,
    connectionStatus,
  } satisfies MatchingAiPublicSettings);

  return getMatchingAiAdminSnapshot();
}

export async function recordMatchingAiTestResult(input: {
  ok: boolean;
  errorSafe?: string | null;
}): Promise<MatchingAiAdminSnapshot> {
  const settings = await getMatchingAiPublicSettings();
  const snap = await getMatchingAiAdminSnapshot();
  await setSetting(MATCHING_AI_SETTINGS_KEY, {
    ...settings,
    lastTestAt: new Date().toISOString(),
    lastTestOk: input.ok,
    lastErrorSafe: input.ok ? null : (input.errorSafe ?? "Connection failed"),
    connectionStatus: !snap.enabled
      ? "disabled"
      : input.ok
        ? "verified"
        : "error",
  } satisfies MatchingAiPublicSettings);
  return getMatchingAiAdminSnapshot();
}

/**
 * Runtime config for generate-time AI refine.
 * ready === false → caller must use deterministic path only.
 */
export async function getMatchingAiRuntimeConfig(): Promise<{
  ready: boolean;
  enabled: boolean;
  provider: MatchingAiProviderKey;
  model: string;
  apiKey: string;
  reason: string;
}> {
  const settings = await getMatchingAiPublicSettings();
  if (!settings.enabled) {
    return {
      ready: false,
      enabled: false,
      provider: settings.provider,
      model: settings.model,
      apiKey: "",
      reason: "disabled",
    };
  }
  const apiKey = await resolveMatchingAiApiKey();
  if (!apiKey) {
    return {
      ready: false,
      enabled: true,
      provider: settings.provider,
      model: settings.model,
      apiKey: "",
      reason: "missing_api_key",
    };
  }
  return {
    ready: true,
    enabled: true,
    provider: settings.provider,
    model: settings.model,
    apiKey,
    reason: "ready",
  };
}
