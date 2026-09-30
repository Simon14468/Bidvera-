/**
 * PayPal / Stripe credentials for Bidvera billing.
 *
 * Precedence (mandatory):
 *   production/process environment secrets  >  encrypted DB vault
 *
 * Never return raw secrets to clients, logs, or audit payloads.
 * Super Admin UI receives masked hints only (e.g. ************abcd).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getAuthSecret } from "@/lib/auth-secret";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { sanitizeSecretKey } from "@/services/ai/assistant-settings";
import { getSetting, setSetting } from "@/services/settings";
import { z } from "zod";

export const BILLING_PAYPAL_VAULT_KEY = "billing.paypal.vault";
export const BILLING_STRIPE_VAULT_KEY = "billing.stripe.vault";
export const BILLING_PROVIDER_META_KEY = "billing.providers.meta";

export type CredentialSource = "env" | "vault" | "none";

export type ConnectionStatus =
  | "unconfigured"
  | "configured"
  | "verified"
  | "invalid"
  | "error";

type PaypalVault = {
  clientId?: string;
  clientSecret?: string;
  webhookId?: string;
  /** sandbox | live — vault preference when env is unset */
  environment?: "sandbox" | "live";
};

type StripeVault = {
  secretKey?: string;
  publishableKey?: string;
  webhookSecret?: string;
};

export const providerMetaSchema = z.object({
  paypal: z
    .object({
      lastTestAt: z.string().datetime().nullable().optional(),
      lastTestOk: z.boolean().nullable().optional(),
      lastErrorSafe: z.string().max(400).nullable().optional(),
      connectionStatus: z
        .enum(["unconfigured", "configured", "verified", "invalid", "error"])
        .default("unconfigured"),
    })
    .default({
      lastTestAt: null,
      lastTestOk: null,
      lastErrorSafe: null,
      connectionStatus: "unconfigured",
    }),
  stripe: z
    .object({
      lastTestAt: z.string().datetime().nullable().optional(),
      lastTestOk: z.boolean().nullable().optional(),
      lastErrorSafe: z.string().max(400).nullable().optional(),
      connectionStatus: z
        .enum(["unconfigured", "configured", "verified", "invalid", "error"])
        .default("unconfigured"),
    })
    .default({
      lastTestAt: null,
      lastTestOk: null,
      lastErrorSafe: null,
      connectionStatus: "unconfigured",
    }),
});

export type ProviderMeta = z.infer<typeof providerMetaSchema>;

const DEFAULT_META: ProviderMeta = {
  paypal: {
    lastTestAt: null,
    lastTestOk: null,
    lastErrorSafe: null,
    connectionStatus: "unconfigured",
  },
  stripe: {
    lastTestAt: null,
    lastTestOk: null,
    lastErrorSafe: null,
    connectionStatus: "unconfigured",
  },
};

export const paypalCredentialsSaveSchema = z.object({
  clientId: z.string().max(200).optional().nullable(),
  clientSecret: z.string().max(500).optional().nullable(),
  webhookId: z.string().max(200).optional().nullable(),
  environment: z.enum(["sandbox", "live"]).optional(),
  clearClientSecret: z.boolean().optional(),
  clearWebhookId: z.boolean().optional(),
  clearAll: z.boolean().optional(),
});

export const stripeCredentialsSaveSchema = z.object({
  publishableKey: z.string().max(300).optional().nullable(),
  secretKey: z.string().max(500).optional().nullable(),
  webhookSecret: z.string().max(500).optional().nullable(),
  clearSecretKey: z.boolean().optional(),
  clearWebhookSecret: z.boolean().optional(),
  clearAll: z.boolean().optional(),
});

function vaultKeyMaterial(namespace: string): Buffer {
  return createHash("sha256").update(`${namespace}:${getAuthSecret()}`).digest();
}

export function encryptBillingVault(
  namespace: string,
  value: Record<string, string | undefined>,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKeyMaterial(namespace), iv);
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    const s = sanitizeSecretKey(v);
    if (s) cleaned[k] = s;
  }
  const plain = Buffer.from(JSON.stringify(cleaned), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptBillingVault(
  namespace: string,
  payload: string,
): Record<string, string> {
  try {
    const buf = Buffer.from(payload, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      vaultKeyMaterial(namespace),
      iv,
    );
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

async function readVaultObject(key: string, namespace: string): Promise<Record<string, string>> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row || typeof row.value !== "object" || row.value === null) return {};
  const cipher = (row.value as { ciphertext?: string }).ciphertext;
  if (!cipher || typeof cipher !== "string") return {};
  return decryptBillingVault(namespace, cipher);
}

async function writeVaultObject(
  key: string,
  namespace: string,
  value: Record<string, string | undefined>,
  description: string,
): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value: { ciphertext: encryptBillingVault(namespace, value) } as object,
      description,
    },
    update: {
      value: { ciphertext: encryptBillingVault(namespace, value) } as object,
      description,
    },
  });
}

/** Mask secrets for Super Admin UI — never full value. */
export function maskSecretHint(value: string | null | undefined): string | null {
  const v = sanitizeSecretKey(value);
  if (!v) return null;
  if (v.length <= 4) return "************";
  return `************${v.slice(-4)}`;
}

export async function getProviderMeta(): Promise<ProviderMeta> {
  const raw = await getSetting<unknown>(BILLING_PROVIDER_META_KEY, DEFAULT_META);
  const parsed = providerMetaSchema.safeParse(raw);
  return parsed.success ? parsed.data : { ...DEFAULT_META };
}

async function saveProviderMeta(meta: ProviderMeta): Promise<ProviderMeta> {
  const value = providerMetaSchema.parse(meta);
  await setSetting(
    BILLING_PROVIDER_META_KEY,
    value,
    "PayPal/Stripe connection test metadata (no secrets)",
  );
  return value;
}

function pickEnv(name: string): string {
  return sanitizeSecretKey(process.env[name]) ?? "";
}

/**
 * Resolve PayPal environment.
 * Env PAYPAL_ENVIRONMENT / PAYPAL_MODE wins; else vault; else sandbox in non-prod.
 */
export async function resolvePaypalEnvironmentAsync(): Promise<"sandbox" | "live"> {
  const raw = (
    process.env.PAYPAL_ENVIRONMENT ??
    process.env.PAYPAL_MODE ??
    ""
  )
    .trim()
    .toLowerCase();
  if (raw === "production" || raw === "live") return "live";
  if (process.env.NODE_ENV === "production") {
    // Env unset or sandbox under production → fail closed (same as sync resolver).
    if (raw && raw !== "production" && raw !== "live") {
      throw new AppError(
        ErrorCode.UPSTREAM,
        "PayPal is misconfigured for production. Set PAYPAL_ENVIRONMENT=production (or live) with valid live credentials. Sandbox is not allowed when NODE_ENV=production.",
        503,
      );
    }
    throw new AppError(
      ErrorCode.UPSTREAM,
      "PayPal is misconfigured for production. Set PAYPAL_ENVIRONMENT=production (or live) with valid live credentials. Sandbox is not allowed when NODE_ENV=production.",
      503,
    );
  }
  if (raw === "sandbox") return "sandbox";

  const vault = (await readVaultObject(
    BILLING_PAYPAL_VAULT_KEY,
    "billing-paypal",
  )) as PaypalVault;
  if (vault.environment === "live" || vault.environment === "sandbox") {
    return vault.environment;
  }

  return "sandbox";
}

export type ResolvedPaypalCredentials = {
  clientId: string;
  clientSecret: string;
  webhookId: string;
  environment: "sandbox" | "live";
  clientIdSource: CredentialSource;
  clientSecretSource: CredentialSource;
  webhookIdSource: CredentialSource;
};

/** Env secrets always win over vault. */
export async function resolvePaypalCredentials(): Promise<ResolvedPaypalCredentials> {
  const vault = (await readVaultObject(
    BILLING_PAYPAL_VAULT_KEY,
    "billing-paypal",
  )) as PaypalVault;

  const envClientId = pickEnv("PAYPAL_CLIENT_ID");
  const envSecret = pickEnv("PAYPAL_CLIENT_SECRET");
  const envWebhook = pickEnv("PAYPAL_WEBHOOK_ID");

  const vaultClientId = sanitizeSecretKey(vault.clientId) ?? "";
  const vaultSecret = sanitizeSecretKey(vault.clientSecret) ?? "";
  const vaultWebhook = sanitizeSecretKey(vault.webhookId) ?? "";

  const environment = await resolvePaypalEnvironmentAsync();

  return {
    clientId: envClientId || vaultClientId,
    clientSecret: envSecret || vaultSecret,
    webhookId: envWebhook || vaultWebhook,
    environment,
    clientIdSource: envClientId ? "env" : vaultClientId ? "vault" : "none",
    clientSecretSource: envSecret ? "env" : vaultSecret ? "vault" : "none",
    webhookIdSource: envWebhook ? "env" : vaultWebhook ? "vault" : "none",
  };
}

export type ResolvedStripeCredentials = {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  secretKeySource: CredentialSource;
  publishableKeySource: CredentialSource;
  webhookSecretSource: CredentialSource;
};

export async function resolveStripeCredentials(): Promise<ResolvedStripeCredentials> {
  const vault = (await readVaultObject(
    BILLING_STRIPE_VAULT_KEY,
    "billing-stripe",
  )) as StripeVault;

  const envSecret = pickEnv("STRIPE_SECRET_KEY");
  const envPublishable =
    pickEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") ||
    pickEnv("STRIPE_PUBLISHABLE_KEY");
  const envWebhook = pickEnv("STRIPE_WEBHOOK_SECRET");

  const vaultSecret = sanitizeSecretKey(vault.secretKey) ?? "";
  const vaultPublishable = sanitizeSecretKey(vault.publishableKey) ?? "";
  const vaultWebhook = sanitizeSecretKey(vault.webhookSecret) ?? "";

  return {
    secretKey: envSecret || vaultSecret,
    publishableKey: envPublishable || vaultPublishable,
    webhookSecret: envWebhook || vaultWebhook,
    secretKeySource: envSecret ? "env" : vaultSecret ? "vault" : "none",
    publishableKeySource: envPublishable
      ? "env"
      : vaultPublishable
        ? "vault"
        : "none",
    webhookSecretSource: envWebhook ? "env" : vaultWebhook ? "vault" : "none",
  };
}

function deriveConnectionStatus(
  configured: boolean,
  metaStatus: ConnectionStatus | undefined,
): ConnectionStatus {
  if (!configured) return "unconfigured";
  if (metaStatus === "verified" || metaStatus === "error" || metaStatus === "invalid") {
    return metaStatus;
  }
  return "configured";
}

export async function getPaypalCredentialsAdminSnapshot() {
  const creds = await resolvePaypalCredentials();
  const meta = await getProviderMeta();
  const credentialsConfigured = Boolean(creds.clientId && creds.clientSecret);
  const looksSandboxClient =
    creds.clientId.startsWith("sb-") || /sandbox/i.test(creds.clientId);
  const invalidLive =
    creds.environment === "live" && looksSandboxClient && credentialsConfigured;

  return {
    environment: creds.environment,
    environmentLockedByEnv: Boolean(
      (process.env.PAYPAL_ENVIRONMENT ?? process.env.PAYPAL_MODE ?? "").trim(),
    ),
    credentialsConfigured: credentialsConfigured && !invalidLive,
    webhookConfigured: Boolean(creds.webhookId),
    clientIdHint: maskSecretHint(creds.clientId),
    clientSecretHint: maskSecretHint(creds.clientSecret),
    webhookIdHint: maskSecretHint(creds.webhookId),
    clientIdSource: creds.clientIdSource,
    clientSecretSource: creds.clientSecretSource,
    webhookIdSource: creds.webhookIdSource,
    connectionStatus: invalidLive
      ? ("invalid" as ConnectionStatus)
      : deriveConnectionStatus(
          credentialsConfigured,
          meta.paypal.connectionStatus as ConnectionStatus,
        ),
    lastTestAt: meta.paypal.lastTestAt ?? null,
    lastTestOk: meta.paypal.lastTestOk ?? null,
    lastErrorSafe: meta.paypal.lastErrorSafe ?? null,
    productionReady:
      creds.environment === "live" &&
      credentialsConfigured &&
      !looksSandboxClient &&
      Boolean(creds.webhookId),
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}

export async function getStripeCredentialsAdminSnapshot() {
  const creds = await resolveStripeCredentials();
  const meta = await getProviderMeta();
  const credentialsConfigured = Boolean(creds.secretKey);

  return {
    credentialsConfigured,
    publishableConfigured: Boolean(creds.publishableKey),
    webhookConfigured: Boolean(creds.webhookSecret),
    secretKeyHint: maskSecretHint(creds.secretKey),
    publishableKeyHint: maskSecretHint(creds.publishableKey),
    webhookSecretHint: maskSecretHint(creds.webhookSecret),
    secretKeySource: creds.secretKeySource,
    publishableKeySource: creds.publishableKeySource,
    webhookSecretSource: creds.webhookSecretSource,
    connectionStatus: deriveConnectionStatus(
      credentialsConfigured,
      meta.stripe.connectionStatus as ConnectionStatus,
    ),
    lastTestAt: meta.stripe.lastTestAt ?? null,
    lastTestOk: meta.stripe.lastTestOk ?? null,
    lastErrorSafe: meta.stripe.lastErrorSafe ?? null,
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}

export type PaypalCredentialsAdminSnapshot = Awaited<
  ReturnType<typeof getPaypalCredentialsAdminSnapshot>
>;
export type StripeCredentialsAdminSnapshot = Awaited<
  ReturnType<typeof getStripeCredentialsAdminSnapshot>
>;

/** Safe fields for admin audit logs — never secrets. */
export function paypalCredentialsAuditSafe(
  snap: PaypalCredentialsAdminSnapshot,
) {
  return {
    environment: snap.environment,
    credentialsConfigured: snap.credentialsConfigured,
    webhookConfigured: snap.webhookConfigured,
    clientIdSource: snap.clientIdSource,
    clientSecretSource: snap.clientSecretSource,
    webhookIdSource: snap.webhookIdSource,
    connectionStatus: snap.connectionStatus,
    clientIdHint: snap.clientIdHint,
    clientSecretHint: snap.clientSecretHint,
    webhookIdHint: snap.webhookIdHint,
  };
}

export function stripeCredentialsAuditSafe(
  snap: StripeCredentialsAdminSnapshot,
) {
  return {
    credentialsConfigured: snap.credentialsConfigured,
    publishableConfigured: snap.publishableConfigured,
    webhookConfigured: snap.webhookConfigured,
    secretKeySource: snap.secretKeySource,
    publishableKeySource: snap.publishableKeySource,
    webhookSecretSource: snap.webhookSecretSource,
    connectionStatus: snap.connectionStatus,
    secretKeyHint: snap.secretKeyHint,
    publishableKeyHint: snap.publishableKeyHint,
    webhookSecretHint: snap.webhookSecretHint,
  };
}

export async function savePaypalCredentialsAdmin(
  raw: unknown,
): Promise<PaypalCredentialsAdminSnapshot> {
  const data = paypalCredentialsSaveSchema.parse(raw);
  const current = (await readVaultObject(
    BILLING_PAYPAL_VAULT_KEY,
    "billing-paypal",
  )) as PaypalVault;

  if (data.clearAll) {
    await writeVaultObject(
      BILLING_PAYPAL_VAULT_KEY,
      "billing-paypal",
      {},
      "Encrypted PayPal billing credentials (server-only)",
    );
  } else {
    const next: PaypalVault = { ...current };
    if (data.clientId !== undefined && data.clientId !== null) {
      const id = data.clientId.trim();
      if (id) next.clientId = id;
    }
    if (data.clientSecret?.trim()) {
      next.clientSecret = data.clientSecret.trim();
    }
    if (data.clearClientSecret) {
      delete next.clientSecret;
    }
    if (data.webhookId !== undefined && data.webhookId !== null) {
      const wid = data.webhookId.trim();
      if (wid) next.webhookId = wid;
      else delete next.webhookId;
    }
    if (data.clearWebhookId) {
      delete next.webhookId;
    }
    if (data.environment) {
      next.environment = data.environment;
    }
    await writeVaultObject(
      BILLING_PAYPAL_VAULT_KEY,
      "billing-paypal",
      next,
      "Encrypted PayPal billing credentials (server-only)",
    );
  }

  const meta = await getProviderMeta();
  const snap = await getPaypalCredentialsAdminSnapshot();
  await saveProviderMeta({
    ...meta,
    paypal: {
      ...meta.paypal,
      connectionStatus: snap.credentialsConfigured ? "configured" : "unconfigured",
      lastErrorSafe: null,
    },
  });
  return getPaypalCredentialsAdminSnapshot();
}

export async function saveStripeCredentialsAdmin(
  raw: unknown,
): Promise<StripeCredentialsAdminSnapshot> {
  const data = stripeCredentialsSaveSchema.parse(raw);
  const current = (await readVaultObject(
    BILLING_STRIPE_VAULT_KEY,
    "billing-stripe",
  )) as StripeVault;

  if (data.clearAll) {
    await writeVaultObject(
      BILLING_STRIPE_VAULT_KEY,
      "billing-stripe",
      {},
      "Encrypted Stripe billing credentials (server-only)",
    );
  } else {
    const next: StripeVault = { ...current };
    if (data.publishableKey !== undefined && data.publishableKey !== null) {
      const pk = data.publishableKey.trim();
      if (pk) next.publishableKey = pk;
      else delete next.publishableKey;
    }
    if (data.secretKey?.trim()) {
      next.secretKey = data.secretKey.trim();
    }
    if (data.clearSecretKey) {
      delete next.secretKey;
    }
    if (data.webhookSecret?.trim()) {
      next.webhookSecret = data.webhookSecret.trim();
    }
    if (data.clearWebhookSecret) {
      delete next.webhookSecret;
    }
    await writeVaultObject(
      BILLING_STRIPE_VAULT_KEY,
      "billing-stripe",
      next,
      "Encrypted Stripe billing credentials (server-only)",
    );
  }

  const meta = await getProviderMeta();
  const snap = await getStripeCredentialsAdminSnapshot();
  await saveProviderMeta({
    ...meta,
    stripe: {
      ...meta.stripe,
      connectionStatus: snap.credentialsConfigured ? "configured" : "unconfigured",
      lastErrorSafe: null,
    },
  });
  return getStripeCredentialsAdminSnapshot();
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message.slice(0, 400);
  if (error instanceof Error) {
    const msg = error.message.replace(/sk_live_[A-Za-z0-9]+/g, "[redacted]");
    return msg.slice(0, 400);
  }
  return "Connection test failed.";
}

export async function testPaypalConnection(): Promise<{
  ok: boolean;
  snapshot: PaypalCredentialsAdminSnapshot;
}> {
  const meta = await getProviderMeta();
  try {
    const creds = await resolvePaypalCredentials();
    if (!creds.clientId || !creds.clientSecret) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Configure PayPal Client ID and Client Secret before testing.",
        400,
      );
    }
    if (
      creds.environment === "live" &&
      (creds.clientId.startsWith("sb-") || /sandbox/i.test(creds.clientId))
    ) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Live environment requires live PayPal credentials.",
        400,
      );
    }

    const base =
      creds.environment === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
    const auth = Buffer.from(
      `${creds.clientId}:${creds.clientSecret}`,
    ).toString("base64");
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      throw new AppError(
        ErrorCode.UPSTREAM,
        "PayPal rejected the credentials (token request failed).",
        502,
      );
    }
    const json = (await response.json()) as { access_token?: string };
    if (!json.access_token) {
      throw new AppError(ErrorCode.UPSTREAM, "PayPal token missing.", 502);
    }

    await saveProviderMeta({
      ...meta,
      paypal: {
        lastTestAt: new Date().toISOString(),
        lastTestOk: true,
        lastErrorSafe: null,
        connectionStatus: "verified",
      },
    });
    return { ok: true, snapshot: await getPaypalCredentialsAdminSnapshot() };
  } catch (error) {
    await saveProviderMeta({
      ...meta,
      paypal: {
        lastTestAt: new Date().toISOString(),
        lastTestOk: false,
        lastErrorSafe: safeErrorMessage(error),
        connectionStatus: "error",
      },
    });
    return { ok: false, snapshot: await getPaypalCredentialsAdminSnapshot() };
  }
}

export async function testStripeConnection(): Promise<{
  ok: boolean;
  snapshot: StripeCredentialsAdminSnapshot;
}> {
  const meta = await getProviderMeta();
  try {
    const creds = await resolveStripeCredentials();
    if (!creds.secretKey) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Configure Stripe Secret Key before testing.",
        400,
      );
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(creds.secretKey);
    // Lightweight authenticated call — does not mutate account state.
    await stripe.balance.retrieve();

    await saveProviderMeta({
      ...meta,
      stripe: {
        lastTestAt: new Date().toISOString(),
        lastTestOk: true,
        lastErrorSafe: null,
        connectionStatus: "verified",
      },
    });
    return { ok: true, snapshot: await getStripeCredentialsAdminSnapshot() };
  } catch (error) {
    await saveProviderMeta({
      ...meta,
      stripe: {
        lastTestAt: new Date().toISOString(),
        lastTestOk: false,
        lastErrorSafe: safeErrorMessage(error),
        connectionStatus: "error",
      },
    });
    return { ok: false, snapshot: await getStripeCredentialsAdminSnapshot() };
  }
}
