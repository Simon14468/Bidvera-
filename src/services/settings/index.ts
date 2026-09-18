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

export async function ensureDefaultSettings() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as object, description: `Default: ${key}` },
      update: {},
    });
  }
  const {
    BILLING_SETTINGS_KEY,
    DEFAULT_BILLING_GATEWAY_SETTINGS,
    ensurePaypalIsCurrentDefaultProvider,
  } = await import("@/services/billing/settings");
  await prisma.systemSetting.upsert({
    where: { key: BILLING_SETTINGS_KEY },
    create: {
      key: BILLING_SETTINGS_KEY,
      value: DEFAULT_BILLING_GATEWAY_SETTINGS as object,
      description: "Payment gateway enablement, default provider, trial policy",
    },
    update: {},
  });
  await ensurePaypalIsCurrentDefaultProvider();
  const { AUTH_SETTINGS_KEY, DEFAULT_AUTH_SETTINGS } = await import(
    "@/services/auth/settings"
  );
  await prisma.systemSetting.upsert({
    where: { key: AUTH_SETTINGS_KEY },
    create: {
      key: AUTH_SETTINGS_KEY,
      value: DEFAULT_AUTH_SETTINGS as object,
      description: "Registration, email verification, and Google / Microsoft OAuth controls",
    },
    update: {},
  });
  const {
    ASSISTANT_KNOWLEDGE_KEY,
    DEFAULT_KNOWLEDGE_BY_LOCALE,
  } = await import("@/services/ai/assistant-knowledge");
  await prisma.systemSetting.upsert({
    where: { key: ASSISTANT_KNOWLEDGE_KEY },
    create: {
      key: ASSISTANT_KNOWLEDGE_KEY,
      value: { byLocale: DEFAULT_KNOWLEDGE_BY_LOCALE } as object,
      description: "Bidvera AI Assistant multilingual knowledge (Super Admin)",
    },
    update: {},
  });
  const {
    ASSISTANT_SETTINGS_KEY,
    DEFAULT_ASSISTANT_SETTINGS,
  } = await import("@/services/ai/assistant-settings");
  await prisma.systemSetting.upsert({
    where: { key: ASSISTANT_SETTINGS_KEY },
    create: {
      key: ASSISTANT_SETTINGS_KEY,
      value: DEFAULT_ASSISTANT_SETTINGS as object,
      description: "Bidvera AI Assistant public controls (no secrets)",
    },
    update: {},
  });
}
