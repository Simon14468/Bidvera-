import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import {
  AI_PROVIDER_OPTIONS,
  getProviderOption,
  type AiProviderOptionKey,
} from "@/config/ai-providers";
import { getAuthSecret } from "@/lib/auth-secret";
import { prisma } from "@/lib/db";
import { sanitizeSecretKey } from "@/services/ai/assistant-settings";

/** Encrypted provider keys for tender-analysis AI — Super Admin only. */
export const AI_PROVIDER_VAULT_KEY = "ai.providers.vault";

type ProviderVault = Partial<Record<AiProviderOptionKey, string>>;

function vaultKeyMaterial(): Buffer {
  return createHash("sha256").update(`ai-providers:${getAuthSecret()}`).digest();
}

function encryptJson(value: ProviderVault): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKeyMaterial(), iv);
  const plain = Buffer.from(JSON.stringify(value), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function decryptJson(payload: string): ProviderVault {
  try {
    const buf = Buffer.from(payload, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", vaultKeyMaterial(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as ProviderVault;
  } catch {
    return {};
  }
}

async function readVault(): Promise<ProviderVault> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: AI_PROVIDER_VAULT_KEY },
  });
  if (!row || typeof row.value !== "object" || row.value === null) return {};
  const cipher = (row.value as { ciphertext?: string }).ciphertext;
  if (!cipher || typeof cipher !== "string") return {};
  return decryptJson(cipher);
}

async function writeVault(vault: ProviderVault): Promise<void> {
  const cleaned: ProviderVault = {};
  for (const option of AI_PROVIDER_OPTIONS) {
    const next = sanitizeSecretKey(vault[option.key]);
    if (next) cleaned[option.key] = next;
  }

  await prisma.systemSetting.upsert({
    where: { key: AI_PROVIDER_VAULT_KEY },
    create: {
      key: AI_PROVIDER_VAULT_KEY,
      value: { ciphertext: encryptJson(cleaned) } as object,
      description: "Encrypted OpenAI / Anthropic / Google API keys (server-only)",
    },
    update: {
      value: { ciphertext: encryptJson(cleaned) } as object,
      description: "Encrypted OpenAI / Anthropic / Google API keys (server-only)",
    },
  });
}

export function isProviderKey(value: string): value is AiProviderOptionKey {
  return AI_PROVIDER_OPTIONS.some((p) => p.key === value);
}

/** Resolve vault key first, then env vars. Never log the return value. */
export async function resolveProviderApiKey(
  providerKey: string,
  apiKeyEnvVar?: string | null,
): Promise<string> {
  if (isProviderKey(providerKey)) {
    const vault = await readVault();
    const fromVault = sanitizeSecretKey(vault[providerKey]);
    if (fromVault) return fromVault;
  }

  const option = getProviderOption(providerKey);
  const candidates = [
    apiKeyEnvVar,
    option?.apiKeyEnvVar,
    ...(option?.apiKeyEnvAliases ?? []),
  ].filter(Boolean) as string[];

  for (const name of candidates) {
    const value = sanitizeSecretKey(process.env[name]);
    if (value) return value;
  }
  return "";
}

export async function getProviderKeyStatus(): Promise<
  Record<
    AiProviderOptionKey,
    { hasVaultKey: boolean; hasEnvKey: boolean; configured: boolean }
  >
> {
  const vault = await readVault();
  const out = {} as Record<
    AiProviderOptionKey,
    { hasVaultKey: boolean; hasEnvKey: boolean; configured: boolean }
  >;

  for (const option of AI_PROVIDER_OPTIONS) {
    const hasVaultKey = Boolean(sanitizeSecretKey(vault[option.key]));
    const hasEnvKey = Boolean(
      sanitizeSecretKey(process.env[option.apiKeyEnvVar]) ||
        option.apiKeyEnvAliases.some((a) => Boolean(sanitizeSecretKey(process.env[a]))),
    );
    out[option.key] = {
      hasVaultKey,
      hasEnvKey,
      configured: hasVaultKey || hasEnvKey,
    };
  }
  return out;
}

export async function saveProviderApiKey(
  providerKey: AiProviderOptionKey,
  apiKey: string,
): Promise<{ configured: boolean }> {
  const vault = await readVault();
  const cleaned = sanitizeSecretKey(apiKey);
  if (!cleaned) {
    delete vault[providerKey];
  } else {
    vault[providerKey] = cleaned;
  }
  await writeVault(vault);
  return { configured: Boolean(cleaned) };
}

export async function clearProviderApiKey(
  providerKey: AiProviderOptionKey,
): Promise<void> {
  const vault = await readVault();
  delete vault[providerKey];
  await writeVault(vault);
}
