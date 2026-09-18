import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { assertSafeAiBaseUrl } from "@/domain/security/safe-outbound-url";
import { getAuthSecret } from "@/lib/auth-secret";
import { prisma } from "@/lib/db";
import { getSetting, setSetting } from "@/services/settings";
import { z } from "zod";

export const ASSISTANT_SETTINGS_KEY = "ai.assistant.settings";
/** Encrypted secrets — never returned to clients; blocked from public settings list. */
export const ASSISTANT_VAULT_KEY = "ai.assistant.vault";

export const assistantSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  voiceEnabled: z.boolean().default(true),
  providerKey: z.enum(["openai", "anthropic", "google"]).default("openai"),
  modelName: z.string().min(1).max(120).default("gpt-4o-mini"),
  baseUrl: z.string().max(500).optional().nullable(),
});

export type AssistantSettings = z.infer<typeof assistantSettingsSchema>;

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  enabled: true,
  voiceEnabled: true,
  providerKey: "openai",
  modelName: "gpt-4o-mini",
  baseUrl: null,
};

/** Sensible defaults when switching Answer provider in Super Admin. */
export const ASSISTANT_PROVIDER_DEFAULT_MODELS: Record<
  AssistantSettings["providerKey"],
  string
> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
  google: "gemini-2.0-flash",
};

/** Normalize pasted keys (Bearer prefix, newlines, zero-width chars). */
export function sanitizeSecretKey(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/^Bearer\s+/i, "")
    .replace(/[\r\n\t]/g, "")
    .replace(/\u200b/g, "")
    .trim();
}

/** Model ids often get a trailing period from paste/autocomplete. */
export function sanitizeModelName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\.+$/, "")
    .replace(/^models\//, "")
    .trim();
}

type AssistantVault = {
  assistantApiKey?: string;
  elevenLabsApiKey?: string;
};

function vaultKeyMaterial(): Buffer {
  return createHash("sha256").update(getAuthSecret()).digest();
}

function encryptJson(value: AssistantVault): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKeyMaterial(), iv);
  const plain = Buffer.from(JSON.stringify(value), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function decryptJson(payload: string): AssistantVault {
  try {
    const buf = Buffer.from(payload, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", vaultKeyMaterial(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as AssistantVault;
  } catch {
    return {};
  }
}

export async function getAssistantSettings(): Promise<AssistantSettings> {
  const raw = await getSetting<unknown>(
    ASSISTANT_SETTINGS_KEY,
    DEFAULT_ASSISTANT_SETTINGS,
  );
  const parsed = assistantSettingsSchema.safeParse(raw);
  const base = parsed.success ? parsed.data : { ...DEFAULT_ASSISTANT_SETTINGS };
  const modelName = sanitizeModelName(base.modelName) || DEFAULT_ASSISTANT_SETTINGS.modelName;
  if (modelName !== base.modelName) {
    const fixed = { ...base, modelName };
    await setSetting(
      ASSISTANT_SETTINGS_KEY,
      fixed,
      "Bidvera AI Assistant public controls (no secrets)",
    ).catch(() => undefined);
    return fixed;
  }
  return { ...base, modelName };
}

async function readVault(): Promise<AssistantVault> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: ASSISTANT_VAULT_KEY },
  });
  if (!row || typeof row.value !== "object" || row.value === null) return {};
  const cipher = (row.value as { ciphertext?: string }).ciphertext;
  if (!cipher || typeof cipher !== "string") return {};
  return decryptJson(cipher);
}

async function writeVault(vault: AssistantVault): Promise<void> {
  const cleaned: AssistantVault = {};
  const assistant = sanitizeSecretKey(vault.assistantApiKey);
  const eleven = sanitizeSecretKey(vault.elevenLabsApiKey);
  if (assistant) cleaned.assistantApiKey = assistant;
  if (eleven) cleaned.elevenLabsApiKey = eleven;

  await prisma.systemSetting.upsert({
    where: { key: ASSISTANT_VAULT_KEY },
    create: {
      key: ASSISTANT_VAULT_KEY,
      value: { ciphertext: encryptJson(cleaned) } as object,
      description: "Encrypted Bidvera AI Assistant secrets (server-only)",
    },
    update: {
      value: { ciphertext: encryptJson(cleaned) } as object,
      description: "Encrypted Bidvera AI Assistant secrets (server-only)",
    },
  });
}

/** Safe for Super Admin UI — never includes raw secret values. */
export async function getAssistantAdminSnapshot() {
  const settings = await getAssistantSettings();
  const vault = await readVault();
  return {
    enabled: settings.enabled,
    voiceEnabled: settings.voiceEnabled,
    providerKey: settings.providerKey,
    modelName: settings.modelName,
    baseUrl: settings.baseUrl ?? null,
    hasAssistantApiKey: Boolean(vault.assistantApiKey),
    hasElevenLabsApiKey: Boolean(vault.elevenLabsApiKey),
  };
}

/** Safe for public layouts — only enablement flags. */
export async function getPublicAssistantFlags() {
  const settings = await getAssistantSettings();
  const vault = await readVault();
  const voiceReady = Boolean(
    settings.voiceEnabled &&
      (vault.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY),
  );
  return {
    enabled: settings.enabled,
    voiceEnabled: voiceReady,
  };
}

export async function resolveAssistantAiCredentials(): Promise<{
  settings: AssistantSettings;
  apiKey: string;
}> {
  const settings = await getAssistantSettings();
  if (!settings.enabled) {
    throw new Error("ASSISTANT_DISABLED");
  }
  const vault = await readVault();
  const apiKey =
    sanitizeSecretKey(vault.assistantApiKey) ||
    sanitizeSecretKey(process.env.AI_API_KEY) ||
    (settings.providerKey === "openai"
      ? sanitizeSecretKey(process.env.OPENAI_API_KEY)
      : settings.providerKey === "anthropic"
        ? sanitizeSecretKey(process.env.ANTHROPIC_API_KEY)
        : sanitizeSecretKey(process.env.GOOGLE_AI_API_KEY) ||
          sanitizeSecretKey(process.env.GEMINI_API_KEY)) ||
    "";
  return { settings, apiKey };
}

export async function resolveAssistantElevenLabsKey(): Promise<string | null> {
  const settings = await getAssistantSettings();
  if (!settings.voiceEnabled) return null;
  const vault = await readVault();
  return (
    sanitizeSecretKey(vault.elevenLabsApiKey) ||
    sanitizeSecretKey(process.env.ELEVENLABS_API_KEY) ||
    null
  );
}

export const assistantAdminSaveSchema = z.object({
  enabled: z.boolean(),
  voiceEnabled: z.boolean(),
  providerKey: z.enum(["openai", "anthropic", "google"]),
  modelName: z.string().min(1).max(120),
  baseUrl: z.string().max(500).optional().nullable(),
  /** Empty / omitted = keep existing. Long project keys supported. */
  assistantApiKey: z.string().max(2000).optional().nullable(),
  elevenLabsApiKey: z.string().max(2000).optional().nullable(),
  clearAssistantApiKey: z.boolean().optional(),
  clearElevenLabsApiKey: z.boolean().optional(),
});

export const assistantTestSchema = z.object({
  providerKey: z.enum(["openai", "anthropic", "google"]),
  modelName: z.string().min(1).max(120),
  baseUrl: z.string().max(500).optional().nullable(),
  /** Optional override — otherwise uses vault / env */
  assistantApiKey: z.string().max(2000).optional().nullable(),
});

export const elevenLabsTestSchema = z.object({
  /** Optional override — otherwise uses vault / env */
  elevenLabsApiKey: z.string().max(2000).optional().nullable(),
});

export async function saveAssistantAdminConfig(
  raw: unknown,
): Promise<Awaited<ReturnType<typeof getAssistantAdminSnapshot>>> {
  const data = assistantAdminSaveSchema.parse(raw);
  const vault = await readVault();

  if (data.clearAssistantApiKey) delete vault.assistantApiKey;
  else {
    const next = sanitizeSecretKey(data.assistantApiKey);
    if (next) vault.assistantApiKey = next;
  }
  if (data.clearElevenLabsApiKey) delete vault.elevenLabsApiKey;
  else {
    const next = sanitizeSecretKey(data.elevenLabsApiKey);
    if (next) vault.elevenLabsApiKey = next;
  }

  const hasEleven =
    Boolean(sanitizeSecretKey(vault.elevenLabsApiKey)) ||
    Boolean(sanitizeSecretKey(process.env.ELEVENLABS_API_KEY));
  const pastedEleven = Boolean(sanitizeSecretKey(data.elevenLabsApiKey));

  // Saving a voice key turns Voice ON; Voice ON without any key stays off.
  let voiceEnabled = data.voiceEnabled;
  if (pastedEleven) voiceEnabled = true;
  if (
    data.clearElevenLabsApiKey &&
    !sanitizeSecretKey(process.env.ELEVENLABS_API_KEY)
  ) {
    voiceEnabled = false;
  }
  if (voiceEnabled && !hasEleven) voiceEnabled = false;

  const settings: AssistantSettings = {
    enabled: data.enabled,
    voiceEnabled,
    providerKey: data.providerKey,
    modelName:
      sanitizeModelName(data.modelName) ||
      ASSISTANT_PROVIDER_DEFAULT_MODELS[data.providerKey],
    baseUrl: assertSafeAiBaseUrl(data.baseUrl),
  };
  await setSetting(
    ASSISTANT_SETTINGS_KEY,
    settings,
    "Bidvera AI Assistant public controls (no secrets)",
  );
  await writeVault(vault);

  return getAssistantAdminSnapshot();
}

export async function testAssistantProviderConnection(raw: unknown): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  const data = assistantTestSchema.parse(raw);
  const vault = await readVault();
  const apiKey =
    sanitizeSecretKey(data.assistantApiKey) ||
    sanitizeSecretKey(vault.assistantApiKey) ||
    sanitizeSecretKey(process.env.AI_API_KEY) ||
    (data.providerKey === "openai"
      ? sanitizeSecretKey(process.env.OPENAI_API_KEY)
      : data.providerKey === "anthropic"
        ? sanitizeSecretKey(process.env.ANTHROPIC_API_KEY)
        : sanitizeSecretKey(process.env.GOOGLE_AI_API_KEY) ||
          sanitizeSecretKey(process.env.GEMINI_API_KEY));

  if (!apiKey) {
    return {
      ok: false,
      latencyMs: 0,
      message:
        "No API key to test. Paste a key above (or save one first), matching the selected provider.",
    };
  }

  const { providerChatCompletion } = await import("@/services/ai/providers");
  const started = Date.now();
  try {
    const result = await providerChatCompletion({
      providerKey: data.providerKey,
      baseUrl: assertSafeAiBaseUrl(data.baseUrl),
      apiKey,
      model: sanitizeModelName(data.modelName) || ASSISTANT_PROVIDER_DEFAULT_MODELS[data.providerKey],
      system: "Reply with a short confirmation only.",
      user: "ping",
      temperature: 0,
      maxTokens: 32,
      responseFormat: "text",
    });
    const latencyMs = Date.now() - started;
    if (!result.content?.trim()) {
      return { ok: false, latencyMs, message: "Provider returned an empty response." };
    }
    return {
      ok: true,
      latencyMs,
      message: `Connected (${latencyMs}ms). Provider and key look valid.`,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const msg = error instanceof Error ? error.message : "Connection failed";
    if (msg.startsWith("AI_HTTP_401") || msg.startsWith("AI_HTTP_403")) {
      return {
        ok: false,
        latencyMs,
        message:
          "Provider rejected the key. Match Answer provider to the key type (OpenAI vs Anthropic vs Gemini). " +
          msg.replace(/^AI_HTTP_\d+:\s*/, ""),
      };
    }
    if (msg.startsWith("AI_HTTP_404") || msg.startsWith("AI_HTTP_400")) {
      return {
        ok: false,
        latencyMs,
        message:
          "Provider rejected the request (bad model name or params). " +
          "Check Model name has no trailing punctuation. " +
          msg.replace(/^AI_HTTP_\d+:\s*/, ""),
      };
    }
    return { ok: false, latencyMs, message: msg };
  }
}

export async function testElevenLabsConnection(raw: unknown): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  const data = elevenLabsTestSchema.parse(raw);
  const vault = await readVault();
  const apiKey =
    sanitizeSecretKey(data.elevenLabsApiKey) ||
    sanitizeSecretKey(vault.elevenLabsApiKey) ||
    sanitizeSecretKey(process.env.ELEVENLABS_API_KEY);

  if (!apiKey) {
    return {
      ok: false,
      latencyMs: 0,
      message:
        "No ElevenLabs key to test. Paste a key above (or save one first).",
    };
  }

  const started = Date.now();
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/user", {
      method: "GET",
      headers: { "xi-api-key": apiKey },
    });
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      const body = (await response.text().catch(() => "")).slice(0, 180);
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          latencyMs,
          message: "ElevenLabs rejected the key (401/403). Check the API key.",
        };
      }
      return {
        ok: false,
        latencyMs,
        message: `ElevenLabs HTTP ${response.status}${body ? `: ${body}` : ""}`,
      };
    }
    return {
      ok: true,
      latencyMs,
      message: `Voice connected (${latencyMs}ms). Save with Voice ON to enable speech on the assistant.`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: error instanceof Error ? error.message : "ElevenLabs connection failed",
    };
  }
}

/** Super Admin only — reveal vault secrets for verification in the panel. */
export async function revealAssistantVaultSecrets(): Promise<{
  assistantApiKey: string | null;
  elevenLabsApiKey: string | null;
}> {
  const vault = await readVault();
  return {
    assistantApiKey: sanitizeSecretKey(vault.assistantApiKey) || null,
    elevenLabsApiKey: sanitizeSecretKey(vault.elevenLabsApiKey) || null,
  };
}
