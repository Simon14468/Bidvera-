/**
 * TED ingest configuration — SystemSetting + optional encrypted vault.
 * Search API is anonymous; vault holds optional API key for future authenticated TED use.
 * Matching Engine feature flag is independent — this adapter never enables it.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { z } from "zod";
import { getAuthSecret } from "@/lib/auth-secret";
import { prisma } from "@/lib/db";
import { getSetting, setSetting } from "@/services/settings";
import { sanitizeSecretKey } from "@/services/ai/assistant-settings";
import {
  TED_DEFAULT_FORM_TYPES,
  TED_SEARCH_MAX_LIMIT,
  TED_SETTINGS_KEY,
  TED_VAULT_KEY,
} from "./constants";
import {
  buildTedFreshnessQueryClause,
  formatTedPublicationDateYmd,
} from "./freshness";

export const tedPublicSettingsSchema = z.object({
  /** Master switch for TED ingest. Default OFF — no live pulls until enabled. */
  enabled: z.boolean().default(false),
  /**
   * Safety: refuse to run unless at least one geography OR CPV filter is configured.
   * Prevents accidental unbounded EU-wide corpus pulls.
   */
  requireFiltersConfigured: z.boolean().default(true),
  /** Expert-query fragment extras (AND-combined). Empty = none. */
  extraQuery: z.string().max(2000).default(""),
  scope: z.enum(["LATEST", "ACTIVE", "ALL"]).default("ACTIVE"),
  formTypes: z.array(z.string().min(1).max(64)).max(20).default([...TED_DEFAULT_FORM_TYPES]),
  geographies: z.array(z.string().min(1).max(80)).max(100).default([]),
  cpvFilters: z.array(z.string().min(1).max(32)).max(100).default([]),
  requireDeadline: z.boolean().default(false),
  excludePastDeadline: z.boolean().default(true),
  /**
   * Relative freshness window in days (0 = disabled).
   * Adds TED `publication-date >= YYYYMMDD` computed from now — never a hard-coded permanent date.
   */
  freshnessDays: z.number().int().min(0).max(3650).default(0),
  pageLimit: z.number().int().min(1).max(TED_SEARCH_MAX_LIMIT).default(50),
  maxNoticesPerRun: z.number().int().min(1).max(2000).default(100),
  /** Hard page ceiling per run (combined with maxNoticesPerRun). */
  maxPagesPerRun: z.number().int().min(1).max(20).default(5),
  timeoutMs: z.number().int().min(3000).max(120_000).default(30_000),
  maxRetries: z.number().int().min(0).max(6).default(3),
  onlyLatestVersions: z.boolean().default(true),
  /**
   * When true, a future worker tick MAY call ingest.
   * Phase 1 leaves worker unwired — this flag documents intent only.
   */
  workerScheduleAllowed: z.boolean().default(false),
  lastRunAt: z.string().datetime().nullable().optional(),
  lastRunOk: z.boolean().nullable().optional(),
  lastErrorSafe: z.string().max(400).nullable().optional(),
  lastUpserted: z.number().int().nullable().optional(),
  lastFiltered: z.number().int().nullable().optional(),
});

export type TedPublicSettings = z.infer<typeof tedPublicSettingsSchema>;

export const DEFAULT_TED_SETTINGS: TedPublicSettings = {
  enabled: false,
  requireFiltersConfigured: true,
  extraQuery: "",
  scope: "ACTIVE",
  formTypes: [...TED_DEFAULT_FORM_TYPES],
  geographies: [],
  cpvFilters: [],
  requireDeadline: false,
  excludePastDeadline: true,
  freshnessDays: 0,
  pageLimit: 50,
  maxNoticesPerRun: 100,
  maxPagesPerRun: 5,
  timeoutMs: 30_000,
  maxRetries: 3,
  onlyLatestVersions: true,
  workerScheduleAllowed: false,
  lastRunAt: null,
  lastRunOk: null,
  lastErrorSafe: null,
  lastUpserted: null,
  lastFiltered: null,
};

type TedVault = { apiKey?: string };

function vaultKeyMaterial(): Buffer {
  return createHash("sha256")
    .update(`matching-ted:${getAuthSecret()}`)
    .digest();
}

export function encryptTedVault(value: TedVault): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKeyMaterial(), iv);
  const plain = Buffer.from(JSON.stringify(value), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptTedVault(payload: string): TedVault {
  try {
    const buf = Buffer.from(payload, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", vaultKeyMaterial(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as TedVault;
  } catch {
    return {};
  }
}

async function readVault(): Promise<TedVault> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: TED_VAULT_KEY },
  });
  if (!row || typeof row.value !== "object" || row.value === null) return {};
  const cipher = (row.value as { ciphertext?: string }).ciphertext;
  if (!cipher || typeof cipher !== "string") return {};
  return decryptTedVault(cipher);
}

async function writeVault(vault: TedVault): Promise<void> {
  const cleaned: TedVault = {};
  const key = sanitizeSecretKey(vault.apiKey);
  if (key) cleaned.apiKey = key;
  await prisma.systemSetting.upsert({
    where: { key: TED_VAULT_KEY },
    create: {
      key: TED_VAULT_KEY,
      value: { ciphertext: encryptTedVault(cleaned) } as object,
      description: "Encrypted optional TED API key (Search is anonymous)",
    },
    update: {
      value: { ciphertext: encryptTedVault(cleaned) } as object,
    },
  });
}

export function tedApiKeyHint(apiKey: string | null | undefined): string | null {
  const k = sanitizeSecretKey(apiKey);
  if (!k || k.length < 8) return null;
  return `••••${k.slice(-4)}`;
}

export function sanitizeTedErrorMessage(raw: unknown): string {
  let msg = raw instanceof Error ? raw.message : String(raw ?? "Unknown error");
  msg = msg
    .replace(/Bearer\s+[a-zA-Z0-9._-]{8,}/gi, "Bearer [redacted]")
    .replace(/api[_-]?key[=:]\s*["']?[^"',\s]{8,}/gi, "apiKey=[redacted]");
  return msg.replace(/\s+/g, " ").trim().slice(0, 400) || "TED error";
}

export async function getTedPublicSettings(): Promise<TedPublicSettings> {
  const raw = await getSetting<unknown>(TED_SETTINGS_KEY, DEFAULT_TED_SETTINGS);
  const parsed = tedPublicSettingsSchema.safeParse(raw);
  return parsed.success
    ? { ...DEFAULT_TED_SETTINGS, ...parsed.data }
    : { ...DEFAULT_TED_SETTINGS };
}

export async function getTedApiKey(): Promise<string | null> {
  const vault = await readVault();
  return sanitizeSecretKey(vault.apiKey) || null;
}

export type TedAdminSnapshot = {
  settings: TedPublicSettings;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  searchRequiresAuth: false;
  searchEndpoint: string;
  apiVersion: string;
};

export async function getTedAdminSnapshot(): Promise<TedAdminSnapshot> {
  const settings = await getTedPublicSettings();
  const apiKey = await getTedApiKey();
  return {
    settings,
    hasApiKey: Boolean(apiKey),
    apiKeyHint: tedApiKeyHint(apiKey),
    searchRequiresAuth: false,
    searchEndpoint: "https://api.ted.europa.eu/v3/notices/search",
    apiVersion: "v3",
  };
}

export const tedAdminSaveSchema = z.object({
  enabled: z.boolean(),
  requireFiltersConfigured: z.boolean(),
  extraQuery: z.string().max(2000),
  scope: z.enum(["LATEST", "ACTIVE", "ALL"]),
  formTypes: z.array(z.string().min(1).max(64)).max(20),
  geographies: z.array(z.string().min(1).max(80)).max(100),
  cpvFilters: z.array(z.string().min(1).max(32)).max(100),
  requireDeadline: z.boolean(),
  excludePastDeadline: z.boolean(),
  freshnessDays: z.number().int().min(0).max(3650),
  pageLimit: z.number().int().min(1).max(TED_SEARCH_MAX_LIMIT),
  maxNoticesPerRun: z.number().int().min(1).max(2000),
  maxPagesPerRun: z.number().int().min(1).max(20),
  timeoutMs: z.number().int().min(3000).max(120_000),
  maxRetries: z.number().int().min(0).max(6),
  onlyLatestVersions: z.boolean(),
  workerScheduleAllowed: z.boolean(),
  apiKey: z.string().max(500).optional().nullable(),
  clearApiKey: z.boolean().optional(),
});

export async function saveTedAdminSettings(
  raw: z.infer<typeof tedAdminSaveSchema>,
): Promise<TedAdminSnapshot> {
  const data = tedAdminSaveSchema.parse(raw);
  const prev = await getTedPublicSettings();
  const next: TedPublicSettings = {
    ...prev,
    enabled: data.enabled,
    requireFiltersConfigured: data.requireFiltersConfigured,
    extraQuery: data.extraQuery.trim(),
    scope: data.scope,
    formTypes: data.formTypes,
    geographies: data.geographies,
    cpvFilters: data.cpvFilters,
    requireDeadline: data.requireDeadline,
    excludePastDeadline: data.excludePastDeadline,
    freshnessDays: data.freshnessDays,
    pageLimit: data.pageLimit,
    maxNoticesPerRun: data.maxNoticesPerRun,
    maxPagesPerRun: data.maxPagesPerRun,
    timeoutMs: data.timeoutMs,
    maxRetries: data.maxRetries,
    onlyLatestVersions: data.onlyLatestVersions,
    workerScheduleAllowed: data.workerScheduleAllowed,
  };
  await setSetting(TED_SETTINGS_KEY, next, "Matching Engine TED Search ingest settings");

  if (data.clearApiKey) {
    await writeVault({});
  } else if (data.apiKey != null && data.apiKey.trim()) {
    await writeVault({ apiKey: data.apiKey });
  }

  return getTedAdminSnapshot();
}

export async function recordTedRunStats(input: {
  ok: boolean;
  errorSafe?: string | null;
  upserted?: number;
  filtered?: number;
}): Promise<void> {
  const prev = await getTedPublicSettings();
  await setSetting(TED_SETTINGS_KEY, {
    ...prev,
    lastRunAt: new Date().toISOString(),
    lastRunOk: input.ok,
    lastErrorSafe: input.errorSafe ?? null,
    lastUpserted: input.upserted ?? null,
    lastFiltered: input.filtered ?? null,
  });
}

/** Build TED expert query from settings (documented defaults). */
export function buildTedExpertQuery(
  settings: TedPublicSettings,
  now = new Date(),
): string {
  const parts: string[] = [];

  const forms = settings.formTypes.map((f) => f.trim()).filter(Boolean);
  if (forms.length === 1) {
    parts.push(`form-type = ${forms[0]}`);
  } else if (forms.length > 1) {
    parts.push(`form-type IN (${forms.join(" ")})`);
  }

  // Geography filter is applied post-fetch for reliability (NUTS vs buyer-country),
  // but when ISO3 codes are configured we also constrain the expert query.
  const iso3 = settings.geographies
    .map((g) => g.trim().toUpperCase())
    .filter((g) => /^[A-Z]{3}$/.test(g));
  if (iso3.length === 1) {
    parts.push(`buyer-country = ${iso3[0]}`);
  } else if (iso3.length > 1) {
    parts.push(`buyer-country IN (${iso3.join(" ")})`);
  }

  const cpv = settings.cpvFilters.map((c) => c.trim()).filter(Boolean);
  if (cpv.length === 1) {
    const c = cpv[0]!.replace(/\*$/, "");
    parts.push(
      c.length <= 2
        ? `classification-cpv = ${c}*`
        : `classification-cpv = ${c}`,
    );
  } else if (cpv.length > 1) {
    // Configurable multi-CPV: OR prefixes/codes in expert query (no invented mappings).
    const clauses = cpv.map((raw) => {
      const c = raw.replace(/\*$/, "");
      return c.length <= 2
        ? `classification-cpv = ${c}*`
        : `classification-cpv = ${c}`;
    });
    parts.push(`(${clauses.join(" OR ")})`);
  }

  const freshness = buildTedFreshnessQueryClause(settings.freshnessDays ?? 0, now);
  if (freshness) parts.push(freshness);

  // When requireDeadline is on, constrain TED Search to notices with a tender
  // receipt deadline on/after today (relative YMD — not a permanent hard-coded date).
  // Post-filter still rejects missing/unparsable/past deadlines; never invents them.
  if (settings.requireDeadline) {
    parts.push(
      `deadline-receipt-tender-date-lot >= ${formatTedPublicationDateYmd(now)}`,
    );
  }

  const extra = settings.extraQuery.trim();
  if (extra) parts.push(`(${extra})`);

  return parts.length ? parts.join(" AND ") : "form-type = competition";
}

export function tedFiltersConfigured(settings: TedPublicSettings): boolean {
  return settings.geographies.length > 0 || settings.cpvFilters.length > 0;
}
