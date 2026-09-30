/**
 * Optional notification channels — Super Admin visibility + provider credentials.
 * Meta WhatsApp Cloud API + SMS (Twilio) secrets are encrypted at rest and never
 * returned to clients, logs, or audit payloads.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getAuthSecret } from "@/lib/auth-secret";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { sanitizeSecretKey } from "@/services/ai/assistant-settings";
import { getSetting, setSetting } from "@/services/settings";
import { z } from "zod";

export const NOTIFICATION_CHANNEL_SETTINGS_KEY = "notifications.channels";
export const NOTIFICATION_CHANNEL_VAULT_KEY = "notifications.channels.vault";

const emptyToNull = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};

export const notificationChannelSettingsSchema = z.object({
  whatsappVisible: z.boolean().default(false),
  /** Meta WhatsApp Cloud API phone number id (not a secret). */
  whatsappPhoneNumberId: z.string().max(80).nullable().optional().default(null),
  /** Meta WhatsApp Business Account id (not a secret). */
  whatsappBusinessAccountId: z
    .string()
    .max(80)
    .nullable()
    .optional()
    .default(null),
  /** Graph API version, e.g. v21.0 */
  whatsappApiVersion: z.string().max(20).default("v21.0"),

  smsVisible: z.boolean().default(false),
  smsProvider: z.enum(["none", "twilio"]).default("none"),
  /** Twilio Account SID (identifier; treated as non-secret like a client id). */
  smsAccountSid: z.string().max(80).nullable().optional().default(null),
  /** E.164 sender / Messaging Service identity. */
  smsFromNumber: z.string().max(40).nullable().optional().default(null),

  pushVisible: z.boolean().default(false),
});

export type NotificationChannelSettings = z.infer<
  typeof notificationChannelSettingsSchema
>;

export const DEFAULT_NOTIFICATION_CHANNEL_SETTINGS: NotificationChannelSettings =
  {
    whatsappVisible: false,
    whatsappPhoneNumberId: null,
    whatsappBusinessAccountId: null,
    whatsappApiVersion: "v21.0",
    smsVisible: false,
    smsProvider: "none",
    smsAccountSid: null,
    smsFromNumber: null,
    pushVisible: false,
  };

export const notificationChannelAdminSaveSchema = z.object({
  whatsappVisible: z.boolean(),
  whatsappPhoneNumberId: z.string().max(80).optional().nullable(),
  whatsappBusinessAccountId: z.string().max(80).optional().nullable(),
  whatsappApiVersion: z.string().trim().min(1).max(20).default("v21.0"),
  /** Empty / omitted = keep existing Meta token */
  whatsappAccessToken: z.string().max(2000).optional().nullable(),
  clearWhatsappAccessToken: z.boolean().optional(),

  smsVisible: z.boolean(),
  smsProvider: z.enum(["none", "twilio"]),
  smsAccountSid: z.string().max(80).optional().nullable(),
  smsFromNumber: z.string().max(40).optional().nullable(),
  /** Empty / omitted = keep existing SMS auth token */
  smsAuthToken: z.string().max(500).optional().nullable(),
  clearSmsAuthToken: z.boolean().optional(),

  pushVisible: z.boolean(),
});

type ChannelVault = {
  whatsappAccessToken?: string;
  smsAuthToken?: string;
};

function vaultKeyMaterial(): Buffer {
  return createHash("sha256")
    .update(`notifications-channels:${getAuthSecret()}`)
    .digest();
}

export function encryptChannelVault(value: ChannelVault): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKeyMaterial(), iv);
  const plain = Buffer.from(JSON.stringify(value), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptChannelVault(payload: string): ChannelVault {
  try {
    const buf = Buffer.from(payload, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", vaultKeyMaterial(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as ChannelVault;
  } catch {
    return {};
  }
}

async function readVault(): Promise<ChannelVault> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: NOTIFICATION_CHANNEL_VAULT_KEY },
  });
  if (!row || typeof row.value !== "object" || row.value === null) return {};
  const cipher = (row.value as { ciphertext?: string }).ciphertext;
  if (!cipher || typeof cipher !== "string") return {};
  return decryptChannelVault(cipher);
}

async function writeVault(vault: ChannelVault): Promise<void> {
  const cleaned: ChannelVault = {};
  const wa = sanitizeSecretKey(vault.whatsappAccessToken);
  const sms = sanitizeSecretKey(vault.smsAuthToken);
  if (wa) cleaned.whatsappAccessToken = wa;
  if (sms) cleaned.smsAuthToken = sms;

  await prisma.systemSetting.upsert({
    where: { key: NOTIFICATION_CHANNEL_VAULT_KEY },
    create: {
      key: NOTIFICATION_CHANNEL_VAULT_KEY,
      value: { ciphertext: encryptChannelVault(cleaned) } as object,
      description:
        "Encrypted Meta WhatsApp / SMS provider secrets (server-only)",
    },
    update: {
      value: { ciphertext: encryptChannelVault(cleaned) } as object,
      description:
        "Encrypted Meta WhatsApp / SMS provider secrets (server-only)",
    },
  });
}

export function secretHint(secret: string | null | undefined): string | null {
  const k = sanitizeSecretKey(secret);
  if (!k || k.length < 8) return null;
  return `••••${k.slice(-4)}`;
}

export async function getNotificationChannelSettings(): Promise<NotificationChannelSettings> {
  const raw = await getSetting<unknown>(
    NOTIFICATION_CHANNEL_SETTINGS_KEY,
    DEFAULT_NOTIFICATION_CHANNEL_SETTINGS,
  );
  const parsed = notificationChannelSettingsSchema.safeParse(raw);
  return parsed.success
    ? parsed.data
    : { ...DEFAULT_NOTIFICATION_CHANNEL_SETTINGS };
}

export async function getNotificationChannelAdminSnapshot() {
  const settings = await getNotificationChannelSettings();
  const vault = await readVault();
  const waToken =
    sanitizeSecretKey(vault.whatsappAccessToken) ||
    sanitizeSecretKey(process.env.WHATSAPP_ACCESS_TOKEN) ||
    sanitizeSecretKey(process.env.META_WHATSAPP_TOKEN);
  const smsToken =
    sanitizeSecretKey(vault.smsAuthToken) ||
    sanitizeSecretKey(process.env.TWILIO_AUTH_TOKEN);

  return {
    ...settings,
    hasWhatsappAccessToken: Boolean(waToken),
    whatsappAccessTokenHint: secretHint(waToken),
    whatsappAccessTokenSource: sanitizeSecretKey(vault.whatsappAccessToken)
      ? ("vault" as const)
      : waToken
        ? ("env" as const)
        : ("none" as const),
    hasSmsAuthToken: Boolean(smsToken),
    smsAuthTokenHint: secretHint(smsToken),
    smsAuthTokenSource: sanitizeSecretKey(vault.smsAuthToken)
      ? ("vault" as const)
      : smsToken
        ? ("env" as const)
        : ("none" as const),
  };
}

export type NotificationChannelAdminSnapshot = Awaited<
  ReturnType<typeof getNotificationChannelAdminSnapshot>
>;

/** Safe audit payload — never includes raw tokens. */
export function notificationChannelAuditSafeSnapshot(
  snap: NotificationChannelAdminSnapshot,
) {
  return {
    whatsappVisible: snap.whatsappVisible,
    whatsappPhoneNumberId: snap.whatsappPhoneNumberId,
    whatsappBusinessAccountId: snap.whatsappBusinessAccountId,
    whatsappApiVersion: snap.whatsappApiVersion,
    hasWhatsappAccessToken: snap.hasWhatsappAccessToken,
    whatsappAccessTokenHint: snap.whatsappAccessTokenHint,
    whatsappAccessTokenSource: snap.whatsappAccessTokenSource,
    smsVisible: snap.smsVisible,
    smsProvider: snap.smsProvider,
    smsAccountSid: snap.smsAccountSid,
    smsFromNumber: snap.smsFromNumber,
    hasSmsAuthToken: snap.hasSmsAuthToken,
    smsAuthTokenHint: snap.smsAuthTokenHint,
    smsAuthTokenSource: snap.smsAuthTokenSource,
    pushVisible: snap.pushVisible,
  };
}

export async function saveNotificationChannelSettings(
  raw: unknown,
): Promise<NotificationChannelAdminSnapshot> {
  const data = notificationChannelAdminSaveSchema.parse(raw);
  const vault = await readVault();

  let waToken = sanitizeSecretKey(vault.whatsappAccessToken);
  if (data.clearWhatsappAccessToken) {
    waToken = "";
  } else if (sanitizeSecretKey(data.whatsappAccessToken)) {
    waToken = sanitizeSecretKey(data.whatsappAccessToken);
  }

  let smsToken = sanitizeSecretKey(vault.smsAuthToken);
  if (data.clearSmsAuthToken) {
    smsToken = "";
  } else if (sanitizeSecretKey(data.smsAuthToken)) {
    smsToken = sanitizeSecretKey(data.smsAuthToken);
  }

  await writeVault({
    whatsappAccessToken: waToken || undefined,
    smsAuthToken: smsToken || undefined,
  });

  const envWa =
    sanitizeSecretKey(process.env.WHATSAPP_ACCESS_TOKEN) ||
    sanitizeSecretKey(process.env.META_WHATSAPP_TOKEN);
  const envSms = sanitizeSecretKey(process.env.TWILIO_AUTH_TOKEN);
  const effectiveWa = waToken || envWa;
  const effectiveSms = smsToken || envSms;

  const phoneNumberId = emptyToNull(data.whatsappPhoneNumberId);
  const businessAccountId = emptyToNull(data.whatsappBusinessAccountId);
  const apiVersion = (data.whatsappApiVersion || "v21.0").trim() || "v21.0";
  const smsAccountSid = emptyToNull(data.smsAccountSid);
  const smsFromNumber = emptyToNull(data.smsFromNumber);

  if (data.whatsappVisible) {
    if (!effectiveWa) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Cannot show WhatsApp without a Meta access token.",
        400,
      );
    }
    if (!phoneNumberId) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Cannot show WhatsApp without a Meta Phone Number ID.",
        400,
      );
    }
  }

  if (data.smsVisible) {
    if (data.smsProvider !== "twilio") {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Select an SMS provider (Twilio) before showing SMS to companies.",
        400,
      );
    }
    if (!smsAccountSid) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Cannot show SMS without a Twilio Account SID.",
        400,
      );
    }
    if (!effectiveSms) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Cannot show SMS without a Twilio Auth Token.",
        400,
      );
    }
    if (!smsFromNumber) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Cannot show SMS without a From number.",
        400,
      );
    }
  }

  const next: NotificationChannelSettings = {
    whatsappVisible: data.whatsappVisible,
    whatsappPhoneNumberId: phoneNumberId,
    whatsappBusinessAccountId: businessAccountId,
    whatsappApiVersion: apiVersion,
    smsVisible: data.smsVisible,
    smsProvider: data.smsVisible ? data.smsProvider : data.smsProvider,
    smsAccountSid,
    smsFromNumber,
    pushVisible: data.pushVisible,
  };

  await setSetting(
    NOTIFICATION_CHANNEL_SETTINGS_KEY,
    next,
    "Platform visibility + public IDs for WhatsApp / SMS / Push channels",
  );

  return getNotificationChannelAdminSnapshot();
}

/**
 * Server-only credentials for WhatsApp Cloud API delivery.
 * Never expose this object to clients.
 */
export async function resolveWhatsAppDeliveryConfig(): Promise<{
  ready: boolean;
  accessToken: string | null;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  apiVersion: string;
  reason?: string;
}> {
  const settings = await getNotificationChannelSettings();
  const vault = await readVault();
  const accessToken =
    sanitizeSecretKey(vault.whatsappAccessToken) ||
    sanitizeSecretKey(process.env.WHATSAPP_ACCESS_TOKEN) ||
    sanitizeSecretKey(process.env.META_WHATSAPP_TOKEN) ||
    null;
  const phoneNumberId = settings.whatsappPhoneNumberId?.trim() || null;
  const businessAccountId = settings.whatsappBusinessAccountId?.trim() || null;
  const apiVersion = settings.whatsappApiVersion?.trim() || "v21.0";

  if (!settings.whatsappVisible) {
    return {
      ready: false,
      accessToken: null,
      phoneNumberId,
      businessAccountId,
      apiVersion,
      reason: "hidden",
    };
  }
  if (!accessToken || !phoneNumberId) {
    return {
      ready: false,
      accessToken: null,
      phoneNumberId,
      businessAccountId,
      apiVersion,
      reason: "missing_credentials",
    };
  }
  return {
    ready: true,
    accessToken,
    phoneNumberId,
    businessAccountId,
    apiVersion,
  };
}

/**
 * Server-only credentials for SMS delivery (Twilio).
 * Never expose this object to clients.
 */
export async function resolveSmsDeliveryConfig(): Promise<{
  ready: boolean;
  provider: "none" | "twilio";
  accountSid: string | null;
  authToken: string | null;
  fromNumber: string | null;
  reason?: string;
}> {
  const settings = await getNotificationChannelSettings();
  const vault = await readVault();
  const authToken =
    sanitizeSecretKey(vault.smsAuthToken) ||
    sanitizeSecretKey(process.env.TWILIO_AUTH_TOKEN) ||
    null;
  const accountSid =
    settings.smsAccountSid?.trim() ||
    sanitizeSecretKey(process.env.TWILIO_ACCOUNT_SID) ||
    null;
  const fromNumber = settings.smsFromNumber?.trim() || null;

  if (!settings.smsVisible) {
    return {
      ready: false,
      provider: settings.smsProvider,
      accountSid,
      authToken: null,
      fromNumber,
      reason: "hidden",
    };
  }
  if (settings.smsProvider !== "twilio") {
    return {
      ready: false,
      provider: settings.smsProvider,
      accountSid,
      authToken: null,
      fromNumber,
      reason: "no_provider",
    };
  }
  if (!accountSid || !authToken || !fromNumber) {
    return {
      ready: false,
      provider: "twilio",
      accountSid,
      authToken: null,
      fromNumber,
      reason: "missing_credentials",
    };
  }
  return {
    ready: true,
    provider: "twilio",
    accountSid,
    authToken,
    fromNumber,
  };
}

export type OptionalOutboundChannelKey = "whatsapp" | "sms" | "push";

export function isOptionalChannelVisible(
  settings: NotificationChannelSettings,
  key: OptionalOutboundChannelKey,
): boolean {
  switch (key) {
    case "whatsapp":
      return settings.whatsappVisible;
    case "sms":
      return settings.smsVisible;
    case "push":
      return settings.pushVisible;
    default:
      return false;
  }
}

export function applyPlatformChannelGates<
  T extends {
    whatsappEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
  },
>(prefs: T, settings: NotificationChannelSettings): T {
  return {
    ...prefs,
    whatsappEnabled: settings.whatsappVisible ? prefs.whatsappEnabled : false,
    smsEnabled: settings.smsVisible ? prefs.smsEnabled : false,
    pushEnabled: settings.pushVisible ? prefs.pushEnabled : false,
  };
}
