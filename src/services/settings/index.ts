import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SECRET_SETTING_KEYS } from "@/config/super-admin";

const DEFAULTS: Record<string, unknown> = {
  trial_analyses_limit: 3,
  max_upload_bytes: 25 * 1024 * 1024,
  analysis_rate_per_hour: 10,
  upload_rate_per_hour: 20,
  alert_deadline_days: [7, 3, 1],
  estimated_hours_saved_per_analysis: 5,
  "matching_engine.min_eligible_companies": { n: 45 },
};

export async function getSetting<T = unknown>(key: string, fallback?: T): Promise<T> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) {
    return (fallback ?? (DEFAULTS[key] as T)) as T;
  }
  return row.value as T;
}

export async function setSetting(
  key: string,
  value: unknown,
  description?: string | null,
) {
  if (SECRET_SETTING_KEYS.has(key)) {
    throw new Error("Refusing to store sensitive secret keys in SystemSetting UI store.");
  }
  return prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: value as object, description: description ?? null },
    update: { value: value as object, description: description ?? undefined },
  });
}

export async function listPublicSettings() {
  const rows = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
  return rows.filter(
    (r) =>
      !SECRET_SETTING_KEYS.has(r.key) &&
      r.key !== "backup.settings" &&
      r.key !== "ops.worker.heartbeat",
  );
}

/**
 * Insert-if-absent for SystemSetting.
 * Prisma `upsert({ update: {} })` is a non-atomic SELECT+INSERT and throws P2002
 * under concurrent callers — use a no-op non-empty update so Postgres gets
 * INSERT ... ON CONFLICT, and treat leftover races as success.
 */
async function ensureSettingRow(
  key: string,
  value: unknown,
  description: string,
): Promise<void> {
  try {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as object, description },
      // Touch unique key (no-op) so Prisma emits atomic ON CONFLICT instead of {}.
      update: { key },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
}

let ensureDefaultsInflight: Promise<void> | null = null;

async function seedDefaultSettings(): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await ensureSettingRow(key, value, `Default: ${key}`);
  }
  const {
    BILLING_SETTINGS_KEY,
    DEFAULT_BILLING_GATEWAY_SETTINGS,
    ensurePaypalIsCurrentDefaultProvider,
  } = await import("@/services/billing/settings");
  await ensureSettingRow(
    BILLING_SETTINGS_KEY,
    DEFAULT_BILLING_GATEWAY_SETTINGS,
    "Payment gateway enablement, default provider, trial policy",
  );
  await ensurePaypalIsCurrentDefaultProvider();
  const { AUTH_SETTINGS_KEY, DEFAULT_AUTH_SETTINGS } = await import(
    "@/services/auth/settings"
  );
  await ensureSettingRow(
    AUTH_SETTINGS_KEY,
    DEFAULT_AUTH_SETTINGS,
    "Registration, email verification, and Google / Microsoft OAuth controls",
  );
  const {
    ASSISTANT_KNOWLEDGE_KEY,
    DEFAULT_KNOWLEDGE_BY_LOCALE,
  } = await import("@/services/ai/assistant-knowledge");
  await ensureSettingRow(
    ASSISTANT_KNOWLEDGE_KEY,
    { byLocale: DEFAULT_KNOWLEDGE_BY_LOCALE },
    "Bidvera AI Assistant multilingual knowledge (Super Admin)",
  );
  const {
    ASSISTANT_SETTINGS_KEY,
    DEFAULT_ASSISTANT_SETTINGS,
  } = await import("@/services/ai/assistant-settings");
  await ensureSettingRow(
    ASSISTANT_SETTINGS_KEY,
    DEFAULT_ASSISTANT_SETTINGS,
    "Bidvera AI Assistant public controls (no secrets)",
  );
}

export async function ensureDefaultSettings() {
  if (!ensureDefaultsInflight) {
    ensureDefaultsInflight = seedDefaultSettings().catch((error) => {
      ensureDefaultsInflight = null;
      throw error;
    });
  }
  await ensureDefaultsInflight;
}
