/**
 * Resend Super Admin configuration — API key encrypted at rest.
 * Never returns raw keys to clients, logs, or audit payloads.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getAuthSecret } from "@/lib/auth-secret";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { sanitizeSecretKey } from "@/services/ai/assistant-settings";
import { getSetting, setSetting } from "@/services/settings";
import { z } from "zod";

export const EMAIL_RESEND_SETTINGS_KEY = "email.resend.settings";
export const EMAIL_RESEND_VAULT_KEY = "email.resend.vault";

export type ResendConnectionStatus =
  | "unconfigured"
  | "configured"
  | "verified"
  | "error"
  | "disabled";

export const resendPublicSettingsSchema = z.object({
  fromEmail: z.string().email().max(320).or(z.literal("")).default(""),
  fromName: z.string().max(120).default("Bidvera"),
  replyTo: z.string().email().max(320).nullable().optional(),
  enabled: z.boolean().default(false),
  lastTestAt: z.string().datetime().nullable().optional(),
  lastTestOk: z.boolean().nullable().optional(),
  lastTestToMasked: z.string().max(120).nullable().optional(),
  lastErrorSafe: z.string().max(400).nullable().optional(),
  connectionStatus: z
    .enum(["unconfigured", "configured", "verified", "error", "disabled"])
    .default("unconfigured"),
});

export type ResendPublicSettings = z.infer<typeof resendPublicSettingsSchema>;

export const DEFAULT_RESEND_SETTINGS: ResendPublicSettings = {
  fromEmail: "",
  fromName: "Bidvera",
  replyTo: null,
  enabled: false,
  lastTestAt: null,
  lastTestOk: null,
  lastTestToMasked: null,
  lastErrorSafe: null,
  connectionStatus: "unconfigured",
};

export const resendAdminSaveSchema = z.object({
  fromEmail: z.string().trim().min(3).max(320),
  fromName: z.string().trim().min(1).max(120),
  replyTo: z
    .string()
    .trim()
    .max(320)
    .optional()
    .nullable()
    .transform((v) => {
      if (!v) return null;
      const t = v.trim();
      return t.length ? t : null;
    }),
  enabled: z.boolean(),
  /** Empty / omitted = keep existing key */
  apiKey: z.string().max(500).optional().nullable(),
  clearApiKey: z.boolean().optional(),
});

type ResendVault = { apiKey?: string };

function vaultKeyMaterial(): Buffer {
  return createHash("sha256").update(`email-resend:${getAuthSecret()}`).digest();
}

export function encryptResendVault(value: ResendVault): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKeyMaterial(), iv);
  const plain = Buffer.from(JSON.stringify(value), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptResendVault(payload: string): ResendVault {
  try {
    const buf = Buffer.from(payload, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", vaultKeyMaterial(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as ResendVault;
  } catch {
    return {};
  }
}

async function readVault(): Promise<ResendVault> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: EMAIL_RESEND_VAULT_KEY },
  });
  if (!row || typeof row.value !== "object" || row.value === null) return {};
  const cipher = (row.value as { ciphertext?: string }).ciphertext;
  if (!cipher || typeof cipher !== "string") return {};
  return decryptResendVault(cipher);
}

async function writeVault(vault: ResendVault): Promise<void> {
  const cleaned: ResendVault = {};
  const key = sanitizeSecretKey(vault.apiKey);
  if (key) cleaned.apiKey = key;

  await prisma.systemSetting.upsert({
    where: { key: EMAIL_RESEND_VAULT_KEY },
    create: {
      key: EMAIL_RESEND_VAULT_KEY,
      value: { ciphertext: encryptResendVault(cleaned) } as object,
      description: "Encrypted Resend API key (server-only)",
    },
    update: {
      value: { ciphertext: encryptResendVault(cleaned) } as object,
      description: "Encrypted Resend API key (server-only)",
    },
  });
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const keep = Math.min(2, local.length);
  return `${local.slice(0, keep)}***@${domain}`;
}

export function apiKeyHint(apiKey: string | null | undefined): string | null {
  const k = sanitizeSecretKey(apiKey);
  if (!k || k.length < 8) return null;
  return `••••${k.slice(-4)}`;
}

export async function getResendPublicSettings(): Promise<ResendPublicSettings> {
  const raw = await getSetting<unknown>(
    EMAIL_RESEND_SETTINGS_KEY,
    DEFAULT_RESEND_SETTINGS,
  );
  const parsed = resendPublicSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : { ...DEFAULT_RESEND_SETTINGS };
}

/** Resolve API key: vault first, then env (never log return). */
export async function resolveResendApiKey(): Promise<string> {
  const vault = await readVault();
  const fromVault = sanitizeSecretKey(vault.apiKey);
  if (fromVault) return fromVault;
  return sanitizeSecretKey(process.env.RESEND_API_KEY);
}

function formatFrom(fromName: string, fromEmail: string): string {
  const name = fromName.trim() || "Bidvera";
  const email = fromEmail.trim();
  if (!email) return "";
  // Resend accepts "Name <email@domain>"
  if (/[<>"]/.test(name)) return email;
  return `${name} <${email}>`;
}

export async function getResendAdminSnapshot() {
  const settings = await getResendPublicSettings();
  const vault = await readVault();
  const vaultKey = sanitizeSecretKey(vault.apiKey);
  const envKey = sanitizeSecretKey(process.env.RESEND_API_KEY);
  const hasApiKey = Boolean(vaultKey || envKey);
  const source: "vault" | "env" | "none" = vaultKey
    ? "vault"
    : envKey
      ? "env"
      : "none";

  return {
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    replyTo: settings.replyTo ?? null,
    enabled: settings.enabled,
    connectionStatus: settings.connectionStatus as ResendConnectionStatus,
    lastTestAt: settings.lastTestAt ?? null,
    lastTestOk: settings.lastTestOk ?? null,
    lastTestToMasked: settings.lastTestToMasked ?? null,
    lastErrorSafe: settings.lastErrorSafe ?? null,
    hasApiKey,
    apiKeyHint: apiKeyHint(vaultKey || envKey),
    apiKeySource: source,
    /** Never include raw key */
  };
}

export type ResendAdminSnapshot = Awaited<
  ReturnType<typeof getResendAdminSnapshot>
>;

/**
 * Build delivery config for the mailer.
 * ready=false means callers must not send.
 */
export async function resolveEmailDeliveryConfig(): Promise<{
  providerId: "resend" | "dev" | "none";
  from: string;
  replyTo: string | null;
  apiKey: string | null;
  ready: boolean;
  reason?: string;
}> {
  const settings = await getResendPublicSettings();
  const apiKey = await resolveResendApiKey();

  const fromEmail =
    settings.fromEmail.trim() ||
    extractEmail(process.env.EMAIL_FROM) ||
    "";
  const fromName = settings.fromName.trim() || "Bidvera";
  const from = formatFrom(fromName, fromEmail);
  const replyTo = settings.replyTo?.trim() || null;

  if (!settings.enabled) {
    // Legacy env-only bootstrap: allow Resend if admin never configured but env key present
    if (!settings.fromEmail && apiKey && process.env.RESEND_API_KEY) {
      const envFrom =
        process.env.EMAIL_FROM?.trim() || "Bidvera <noreply@bidvera.com>";
      return {
        providerId: "resend",
        from: envFrom,
        replyTo: null,
        apiKey,
        ready: true,
        reason: "env_bootstrap",
      };
    }
    return {
      providerId: "none",
      from,
      replyTo,
      apiKey: null,
      ready: false,
      reason: "disabled",
    };
  }

  if (!apiKey) {
    return {
      providerId: "none",
      from,
      replyTo,
      apiKey: null,
      ready: false,
      reason: "missing_api_key",
    };
  }
  if (!fromEmail || !from.includes("@")) {
    return {
      providerId: "none",
      from,
      replyTo,
      apiKey: null,
      ready: false,
      reason: "invalid_from",
    };
  }

  return {
    providerId: "resend",
    from,
    replyTo,
    apiKey,
    ready: true,
  };
}

function extractEmail(from?: string | null): string {
  if (!from) return "";
  const m = from.match(/<([^>]+)>/);
  if (m?.[1]) return m[1].trim();
  if (from.includes("@")) return from.trim();
  return "";
}

export async function saveResendAdminSettings(input: {
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
  enabled: boolean;
  apiKey?: string | null;
  clearApiKey?: boolean;
}): Promise<ResendAdminSnapshot> {
  const data = resendAdminSaveSchema.parse(input);

  // Validate reply-to / from as emails when provided
  if (!z.string().email().safeParse(data.fromEmail).success) {
    throw new AppError(ErrorCode.VALIDATION, "From email is invalid.", 400);
  }
  if (data.replyTo && !z.string().email().safeParse(data.replyTo).success) {
    throw new AppError(ErrorCode.VALIDATION, "Reply-To email is invalid.", 400);
  }

  const vault = await readVault();
  let nextKey = sanitizeSecretKey(vault.apiKey);

  if (data.clearApiKey) {
    nextKey = "";
    await writeVault({});
  } else if (sanitizeSecretKey(data.apiKey)) {
    nextKey = sanitizeSecretKey(data.apiKey);
    await writeVault({ apiKey: nextKey });
  }

  const envFallback = sanitizeSecretKey(process.env.RESEND_API_KEY);
  const effectiveKey = nextKey || envFallback;

  if (data.enabled) {
    if (!effectiveKey) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Cannot enable Resend without an API key.",
        400,
      );
    }
    const { validateResendApiKey } = await import(
      "@/services/email/providers/resend"
    );
    const check = await validateResendApiKey(effectiveKey);
    if (!check.ok) {
      throw new AppError(
        ErrorCode.VALIDATION,
        check.error ?? "Resend API key validation failed.",
        400,
      );
    }
  }

  const prev = await getResendPublicSettings();
  const next: ResendPublicSettings = {
    ...prev,
    fromEmail: data.fromEmail.trim().toLowerCase(),
    fromName: data.fromName.trim(),
    replyTo: data.replyTo,
    enabled: data.enabled,
    connectionStatus: !effectiveKey
      ? "unconfigured"
      : data.enabled
        ? prev.connectionStatus === "verified"
          ? "verified"
          : "configured"
        : "disabled",
    lastErrorSafe: null,
  };

  await setSetting(
    EMAIL_RESEND_SETTINGS_KEY,
    next,
    "Resend email provider public settings (no secrets)",
  );

  return getResendAdminSnapshot();
}

export async function recordResendTestResult(input: {
  ok: boolean;
  to: string;
  errorSafe?: string | null;
}): Promise<void> {
  const prev = await getResendPublicSettings();
  const next: ResendPublicSettings = {
    ...prev,
    lastTestAt: new Date().toISOString(),
    lastTestOk: input.ok,
    lastTestToMasked: maskEmail(input.to),
    lastErrorSafe: input.ok ? null : (input.errorSafe ?? "Test failed").slice(0, 400),
    connectionStatus: input.ok
      ? "verified"
      : prev.enabled
        ? "error"
        : prev.connectionStatus,
  };
  await setSetting(EMAIL_RESEND_SETTINGS_KEY, next);
}

/** Safe audit payload — never includes API key material */
export function resendAuditSafeSnapshot(snap: ResendAdminSnapshot) {
  return {
    fromEmail: snap.fromEmail,
    fromName: snap.fromName,
    replyTo: snap.replyTo,
    enabled: snap.enabled,
    connectionStatus: snap.connectionStatus,
    hasApiKey: snap.hasApiKey,
    apiKeyHint: snap.apiKeyHint,
    apiKeySource: snap.apiKeySource,
    lastTestAt: snap.lastTestAt,
    lastTestOk: snap.lastTestOk,
  };
}
