import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getAuthSecret } from "@/lib/auth-secret";
import { prisma } from "@/lib/db";
import { getSetting, setSetting } from "@/services/settings";
import { z } from "zod";

export const AUTH_SETTINGS_KEY = "auth.registration";
/** Encrypted Google OAuth secret — never returned to clients. */
export const AUTH_GOOGLE_VAULT_KEY = "auth.google.vault";
/** Encrypted Microsoft OAuth secret — never returned to clients. */
export const AUTH_MICROSOFT_VAULT_KEY = "auth.microsoft.vault";

export const authSettingsSchema = z.object({
  registrationEnabled: z.boolean().default(true),
  requireEmailVerification: z.boolean().default(true),
  googleEnabled: z.boolean().default(false),
  /** OAuth 2.0 Client ID (not a secret; safe in settings). */
  googleClientId: z.string().max(500).optional().nullable(),
  microsoftEnabled: z.boolean().default(false),
  /** Azure AD / Entra app (client) ID — not a secret. */
  microsoftClientId: z.string().max(500).optional().nullable(),
  /** Medium risk: delay trial activation hours (0 = no delay) */
  mediumRiskTrialDelayHours: z.number().int().min(0).max(168).default(0),
  /** Medium risk: require business-looking email domain */
  mediumRiskRequireBusinessEmail: z.boolean().default(false),
  /** High risk: block free/trial activation (account can still exist) */
  highRiskBlockTrial: z.boolean().default(true),
});

export type AuthSettings = z.infer<typeof authSettingsSchema>;

export const DEFAULT_AUTH_SETTINGS: AuthSettings = {
  registrationEnabled: true,
  requireEmailVerification: true,
  googleEnabled: false,
  googleClientId: null,
  microsoftEnabled: false,
  microsoftClientId: null,
  mediumRiskTrialDelayHours: 0,
  mediumRiskRequireBusinessEmail: false,
  highRiskBlockTrial: true,
};

export const authAdminSaveSchema = authSettingsSchema.extend({
  /** Empty / omitted = keep existing secret */
  googleClientSecret: z.string().max(500).optional().nullable(),
  clearGoogleClientSecret: z.boolean().optional(),
  microsoftClientSecret: z.string().max(500).optional().nullable(),
  clearMicrosoftClientSecret: z.boolean().optional(),
});

type OAuthVault = {
  clientSecret?: string;
};

function sanitize(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/^\uFEFF/, "").replace(/[\r\n\t]/g, "").trim();
}

function vaultKeyMaterial(): Buffer {
  return createHash("sha256").update(getAuthSecret()).digest();
}

function encryptJson(value: OAuthVault): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKeyMaterial(), iv);
  const plain = Buffer.from(JSON.stringify(value), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function decryptJson(payload: string): OAuthVault {
  try {
    const buf = Buffer.from(payload, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", vaultKeyMaterial(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as OAuthVault;
  } catch {
    return {};
  }
}

async function readOAuthVault(key: string): Promise<OAuthVault> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row || typeof row.value !== "object" || row.value === null) return {};
  const cipher = (row.value as { ciphertext?: string }).ciphertext;
  if (!cipher || typeof cipher !== "string") return {};
  return decryptJson(cipher);
}

async function writeOAuthVault(
  key: string,
  vault: OAuthVault,
  description: string,
): Promise<void> {
  const cleaned: OAuthVault = {};
  const secret = sanitize(vault.clientSecret);
  if (secret) cleaned.clientSecret = secret;

  await prisma.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value: { ciphertext: encryptJson(cleaned) } as object,
      description,
    },
    update: {
      value: { ciphertext: encryptJson(cleaned) } as object,
      description,
    },
  });
}

export async function getAuthSettings(): Promise<AuthSettings> {
  const raw = await getSetting<unknown>(AUTH_SETTINGS_KEY, DEFAULT_AUTH_SETTINGS);
  const parsed = authSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : { ...DEFAULT_AUTH_SETTINGS };
}

/** Safe for Super Admin UI — never includes raw client secrets. */
export async function getAuthAdminSnapshot() {
  const settings = await getAuthSettings();
  const googleVault = await readOAuthVault(AUTH_GOOGLE_VAULT_KEY);
  const microsoftVault = await readOAuthVault(AUTH_MICROSOFT_VAULT_KEY);
  return {
    ...settings,
    googleClientId: settings.googleClientId?.trim() || null,
    microsoftClientId: settings.microsoftClientId?.trim() || null,
    hasGoogleClientSecret: Boolean(
      googleVault.clientSecret || sanitize(process.env.GOOGLE_CLIENT_SECRET),
    ),
    hasMicrosoftClientSecret: Boolean(
      microsoftVault.clientSecret || sanitize(process.env.MICROSOFT_CLIENT_SECRET),
    ),
  };
}

export async function saveAuthSettings(input: AuthSettings): Promise<AuthSettings> {
  const value = authSettingsSchema.parse(input);
  await setSetting(
    AUTH_SETTINGS_KEY,
    {
      ...value,
      googleClientId: value.googleClientId?.trim() || null,
      microsoftClientId: value.microsoftClientId?.trim() || null,
    },
    "Registration, email verification, Google and Microsoft OAuth controls",
  );
  return value;
}

export async function saveAuthAdminConfig(
  raw: unknown,
): Promise<Awaited<ReturnType<typeof getAuthAdminSnapshot>>> {
  const data = authAdminSaveSchema.parse(raw);
  const {
    googleClientSecret,
    clearGoogleClientSecret,
    microsoftClientSecret,
    clearMicrosoftClientSecret,
    ...settings
  } = data;

  await saveAuthSettings({
    ...settings,
    googleClientId: settings.googleClientId?.trim() || null,
    microsoftClientId: settings.microsoftClientId?.trim() || null,
  });

  const googleVault = await readOAuthVault(AUTH_GOOGLE_VAULT_KEY);
  if (clearGoogleClientSecret) delete googleVault.clientSecret;
  else {
    const next = sanitize(googleClientSecret);
    if (next) googleVault.clientSecret = next;
  }
  await writeOAuthVault(
    AUTH_GOOGLE_VAULT_KEY,
    googleVault,
    "Encrypted Google OAuth client secret (server-only)",
  );

  const microsoftVault = await readOAuthVault(AUTH_MICROSOFT_VAULT_KEY);
  if (clearMicrosoftClientSecret) delete microsoftVault.clientSecret;
  else {
    const next = sanitize(microsoftClientSecret);
    if (next) microsoftVault.clientSecret = next;
  }
  await writeOAuthVault(
    AUTH_MICROSOFT_VAULT_KEY,
    microsoftVault,
    "Encrypted Microsoft OAuth client secret (server-only)",
  );

  return getAuthAdminSnapshot();
}

/** Resolve Google OAuth credentials for login handlers. */
export async function resolveGoogleOAuthCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  const settings = await getAuthSettings();
  if (!settings.googleEnabled) return null;
  const clientId =
    settings.googleClientId?.trim() ||
    sanitize(process.env.GOOGLE_CLIENT_ID) ||
    "";
  const vault = await readOAuthVault(AUTH_GOOGLE_VAULT_KEY);
  const clientSecret =
    sanitize(vault.clientSecret) || sanitize(process.env.GOOGLE_CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Resolve Microsoft (Entra ID) OAuth credentials for login handlers. */
export async function resolveMicrosoftOAuthCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  const settings = await getAuthSettings();
  if (!settings.microsoftEnabled) return null;
  const clientId =
    settings.microsoftClientId?.trim() ||
    sanitize(process.env.MICROSOFT_CLIENT_ID) ||
    "";
  const vault = await readOAuthVault(AUTH_MICROSOFT_VAULT_KEY);
  const clientSecret =
    sanitize(vault.clientSecret) || sanitize(process.env.MICROSOFT_CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
