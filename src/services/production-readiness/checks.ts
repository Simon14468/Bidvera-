/**
 * Production readiness probes — no secrets, URLs, or absolute paths in public DTOs.
 * READY only after real backend/config checks; missing values → NOT_CONFIGURED.
 */
import { access, mkdir, rm, writeFile, constants as fsConstants } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { isUnsafeProductionMemoryRateLimit } from "@/lib/rate-limit";
import {
  resolveDumpDatabaseUrl,
  restoreDatabaseUrlIsIsolated,
  resolveStorageRoot,
} from "@/services/backup/config";
import { resolveSuperAdminPath } from "@/config/super-admin";
import {
  getTurnstileServerConfig,
  TURNSTILE_DUMMY_PASS_SECRET,
  TURNSTILE_DUMMY_FAIL_SECRET,
  TURNSTILE_DUMMY_SPENT_SECRET,
} from "@/services/security/turnstile";
import { getResendAdminSnapshot } from "@/services/email/resend-settings";
import { readWorkerHeartbeat } from "@/services/production-readiness/worker-heartbeat";
import { inspectBackupStorage as inspectBackupRootWritable } from "@/services/backup/store";
import { encryptBackupPayload, decryptBackupPayload } from "@/services/backup/crypto";
import { resolvePaypalPlanId, resolveStripePriceId } from "@/services/billing/catalog";
import type { Plan } from "@prisma/client";
import { isInternalPipelineSmokeDisabled } from "@/app/api/internal/cps-pipeline-smoke/guard";
import { BASELINE_SECURITY_HEADERS } from "@/config/security-headers";
import { KNOWN_SUPER_ADMIN_DEMO_PASSWORD, assertProductionSuperAdminEnvConfigured } from "@/application/admin/seed-super-admin-password";

function paypalEnvironmentFrom(
  env: Record<string, string | undefined>,
): "sandbox" | "live" {
  const raw = (env.PAYPAL_ENVIRONMENT ?? env.PAYPAL_MODE ?? "")
    .trim()
    .toLowerCase();
  if (raw === "production" || raw === "live") return "live";
  // Unset or sandbox — readiness treats non-live as ERROR (never a silent production default).
  return "sandbox";
}

export type ReadinessStatus = "READY" | "NOT_CONFIGURED" | "ERROR";

export type ReadinessItem = {
  id: string;
  label: string;
  status: ReadinessStatus;
  /** Safe human message — never secrets, DB URLs, or host paths */
  detail: string;
};

export type ProductionReadinessSnapshot = {
  checkedAt: string;
  nodeEnv: string;
  overall: "READY" | "NOT_READY";
  items: ReadinessItem[];
};

const DUMMY_TURNSTILE_SECRETS = new Set([
  TURNSTILE_DUMMY_PASS_SECRET,
  TURNSTILE_DUMMY_FAIL_SECRET,
  TURNSTILE_DUMMY_SPENT_SECRET,
]);

/** Cloudflare published dummy site keys — never READY for production. */
const DUMMY_TURNSTILE_SITES = new Set([
  "1x00000000000000000000AA",
  "1x00000000000000000000BB",
  "2x00000000000000000000AB",
  "3x00000000000000000000FF",
]);

function checkNodeEnv(env: Record<string, string | undefined>): ReadinessItem {
  const nodeEnv = env.NODE_ENV ?? "";
  if (nodeEnv === "production") {
    return {
      id: "node_env",
      label: "NODE_ENV",
      status: "READY",
      detail: "production",
    };
  }
  if (!nodeEnv) {
    return {
      id: "node_env",
      label: "NODE_ENV",
      status: "NOT_CONFIGURED",
      detail: "Unset — production requires NODE_ENV=production.",
    };
  }
  return {
    id: "node_env",
    label: "NODE_ENV",
    status: "NOT_CONFIGURED",
    detail: `Currently "${nodeEnv}" — set production on the live host.`,
  };
}

function authSecretStatus(
  env: Record<string, string | undefined>,
): ReadinessItem {
  const secret = (env.AUTH_SECRET ?? "").trim();
  if (!secret) {
    return {
      id: "auth_secret",
      label: "AUTH_SECRET",
      status: "NOT_CONFIGURED",
      detail: "Missing — production requires ≥32 random characters.",
    };
  }
  if (secret.length < 32) {
    return {
      id: "auth_secret",
      label: "AUTH_SECRET",
      status: "ERROR",
      detail: `Length ${secret.length} — production requires ≥32.`,
    };
  }
  if (/^(dev-insecure-secret|change-me|secret|password)/i.test(secret)) {
    return {
      id: "auth_secret",
      label: "AUTH_SECRET",
      status: "ERROR",
      detail: "Looks like a placeholder — use a strong random secret.",
    };
  }
  return {
    id: "auth_secret",
    label: "AUTH_SECRET",
    status: "READY",
    detail: "Configured (≥32 characters; value not shown).",
  };
}

async function checkSuperAdmin(
  env: Record<string, string | undefined>,
): Promise<ReadinessItem> {
  const pathRes = resolveSuperAdminPath();
  if (!pathRes.ok) {
    return {
      id: "super_admin",
      label: "Super Admin",
      status: "NOT_CONFIGURED",
      detail: pathRes.reason,
    };
  }

  const seedPassword = (env.SUPER_ADMIN_PASSWORD ?? "").trim();
  if (seedPassword && seedPassword === KNOWN_SUPER_ADMIN_DEMO_PASSWORD) {
    return {
      id: "super_admin",
      label: "Super Admin",
      status: "ERROR",
      detail: "Known demo SUPER_ADMIN_PASSWORD must not be used for production.",
    };
  }

  if (env.NODE_ENV === "production") {
    const envCheck = assertProductionSuperAdminEnvConfigured(env);
    if (!envCheck.ok) {
      return {
        id: "super_admin",
        label: "Super Admin",
        status: "ERROR",
        detail: envCheck.reason,
      };
    }
  }

  try {
    const email = (env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
    const count = await prisma.adminUser.count();
    if (count < 1) {
      return {
        id: "super_admin",
        label: "Super Admin",
        status: "NOT_CONFIGURED",
        detail:
          "Path OK but no AdminUser row — set SUPER_ADMIN_EMAIL/PASSWORD and run seed or sa:sync.",
      };
    }
    if (email) {
      const match = await prisma.adminUser.findUnique({
        where: { email },
        select: { id: true, active: true },
      });
      if (!match || !match.active) {
        return {
          id: "super_admin",
          label: "Super Admin",
          status: "ERROR",
          detail:
            "SUPER_ADMIN_EMAIL does not match an active AdminUser — run npm run sa:sync after setting env.",
        };
      }
    }
    return {
      id: "super_admin",
      label: "Super Admin",
      status: "READY",
      detail: `Path configured; ${count} admin account(s) present (identities not shown).`,
    };
  } catch {
    return {
      id: "super_admin",
      label: "Super Admin",
      status: "ERROR",
      detail: "Could not query AdminUser table.",
    };
  }
}

async function checkDatabase(): Promise<ReadinessItem> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      id: "database",
      label: "Database",
      status: "READY",
      detail: "Connectivity OK (SELECT 1).",
    };
  } catch {
    return {
      id: "database",
      label: "Database",
      status: "ERROR",
      detail: "Database query failed.",
    };
  }
}

async function checkStorage(
  env: Record<string, string | undefined>,
): Promise<ReadinessItem> {
  const configured = Boolean(env.STORAGE_ROOT?.trim());
  if (!configured) {
    return {
      id: "storage",
      label: "Storage",
      status: "NOT_CONFIGURED",
      detail: "STORAGE_ROOT unset — set a persistent volume path for production.",
    };
  }
  const root = resolveStorageRoot(env);
  try {
    await mkdir(root, { recursive: true });
    const probe = path.join(root, `.readiness-write-${process.pid}`);
    await writeFile(probe, "ok", "utf8");
    await rm(probe, { force: true });
    await access(root, fsConstants.W_OK);
  } catch {
    return {
      id: "storage",
      label: "Storage",
      status: "ERROR",
      detail: "STORAGE_ROOT is set but not writable.",
    };
  }
  return {
    id: "storage",
    label: "Storage",
    status: "READY",
    detail: "STORAGE_ROOT set and writable (path not shown).",
  };
}

async function checkBackups(
  env: Record<string, string | undefined>,
): Promise<ReadinessItem> {
  const rootConfigured = Boolean(env.BACKUP_ROOT?.trim());
  if (!rootConfigured) {
    return {
      id: "backups",
      label: "Backups",
      status: "NOT_CONFIGURED",
      detail: "BACKUP_ROOT unset — use durable/off-host storage separate from uploads.",
    };
  }

  const storage = await inspectBackupRootWritable(env);
  if (storage.status === "NOT_WRITABLE" || storage.status === "COLOCATED_WITH_UPLOADS") {
    return {
      id: "backups",
      label: "Backups",
      status: "ERROR",
      detail: storage.label.replace(/[A-Za-z]:\\[^\s]+|\/[^\s]+/g, "[path]").slice(0, 200),
    };
  }

  const secret = (env.AUTH_SECRET ?? "").trim();
  if (secret.length < 32) {
    return {
      id: "backups",
      label: "Backups",
      status: "ERROR",
      detail: "Backup encryption requires AUTH_SECRET ≥32 characters.",
    };
  }

  try {
    const sample = Buffer.from("bidvera-backup-readiness");
    const enc = encryptBackupPayload(sample);
    const dec = decryptBackupPayload(enc);
    if (!dec.equals(sample)) {
      return {
        id: "backups",
        label: "Backups",
        status: "ERROR",
        detail: "Backup encrypt/decrypt round-trip failed.",
      };
    }
  } catch {
    return {
      id: "backups",
      label: "Backups",
      status: "ERROR",
      detail: "Backup encryption probe failed.",
    };
  }

  const dump = resolveDumpDatabaseUrl(env);
  const notes: string[] = ["BACKUP_ROOT writable; AES-GCM encryption OK."];
  if (!env.DATABASE_URL_DIRECT?.trim()) {
    notes.push("DATABASE_URL_DIRECT unset (recommended for pg_dump).");
  } else if (dump.pooled) {
    notes.push("Dump URL looks pooled — prefer a non-pooler direct URL.");
  } else {
    notes.push("Direct dump URL configured.");
  }

  const missingDirect = !env.DATABASE_URL_DIRECT?.trim();
  if (missingDirect) {
    return {
      id: "backups",
      label: "Backups",
      status: "NOT_CONFIGURED",
      detail: notes.join(" "),
    };
  }

  return {
    id: "backups",
    label: "Backups",
    status: "READY",
    detail: notes.join(" "),
  };
}

function checkRestoreIsolation(
  env: Record<string, string | undefined>,
): ReadinessItem {
  const restore = env.BACKUP_RESTORE_DATABASE_URL?.trim();
  if (!restore) {
    return {
      id: "restore_isolation",
      label: "Restore DB isolation",
      status: "NOT_CONFIGURED",
      detail: "BACKUP_RESTORE_DATABASE_URL unset — archive verify still works; isolated pg_restore requires this URL.",
    };
  }
  const isolated = restoreDatabaseUrlIsIsolated(env);
  if (!isolated.ok) {
    return {
      id: "restore_isolation",
      label: "Restore DB isolation",
      status: "ERROR",
      detail: isolated.reason ?? "Restore URL must not equal production DB URLs.",
    };
  }
  return {
    id: "restore_isolation",
    label: "Restore DB isolation",
    status: "READY",
    detail: "Restore URL is set and distinct from production DATABASE_URL(s); restore-test will pg_restore into it when postgres.dump exists.",
  };
}

async function checkRateLimiting(
  env: Record<string, string | undefined>,
): Promise<ReadinessItem> {
  if (isUnsafeProductionMemoryRateLimit(env) || env.RATE_LIMIT_BACKEND?.trim().toLowerCase() === "memory") {
    return {
      id: "rate_limiting",
      label: "Rate limiting",
      status: "ERROR",
      detail: "RATE_LIMIT_BACKEND=memory is not production-safe. Use durable.",
    };
  }
  const forced = env.RATE_LIMIT_BACKEND?.trim().toLowerCase();
  if (forced && forced !== "durable" && forced !== "db") {
    return {
      id: "rate_limiting",
      label: "Rate limiting",
      status: "ERROR",
      detail: `Unknown RATE_LIMIT_BACKEND="${forced}". Use durable.`,
    };
  }
  try {
    const key = `__readiness_probe_${process.pid}`;
    await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 0, resetAt: new Date(Date.now() + 60_000) },
      update: { updatedAt: new Date() },
    });
    await prisma.rateLimitBucket.delete({ where: { key } }).catch(() => undefined);
    return {
      id: "rate_limiting",
      label: "Rate limiting",
      status: "READY",
      detail: forced
        ? "Durable (Postgres) rate-limit backend reachable."
        : "Durable Postgres buckets reachable (set RATE_LIMIT_BACKEND=durable explicitly in production).",
    };
  } catch {
    return {
      id: "rate_limiting",
      label: "Rate limiting",
      status: "ERROR",
      detail: "Durable rate-limit table not reachable.",
    };
  }
}

async function checkWorker(
  env: Record<string, string | undefined>,
): Promise<ReadinessItem> {
  try {
    const hb = await readWorkerHeartbeat();
    if (!hb.at) {
      return {
        id: "worker",
        label: "Worker",
        status: "NOT_CONFIGURED",
        detail: "No worker heartbeat. Run `npm run worker` under a process manager.",
      };
    }
    if (hb.stale) {
      return {
        id: "worker",
        label: "Worker",
        status: "ERROR",
        detail: `Heartbeat stale (~${Math.round((hb.ageMs ?? 0) / 1000)}s). Restart the worker process.`,
      };
    }
    return {
      id: "worker",
      label: "Worker",
      status: "READY",
      detail: `Heartbeat fresh (~${Math.round((hb.ageMs ?? 0) / 1000)}s ago).`,
    };
  } catch {
    return {
      id: "worker",
      label: "Worker",
      status: "ERROR",
      detail: "Could not read worker heartbeat.",
    };
  }
}

async function checkPaypal(
  env: Record<string, string | undefined>,
): Promise<ReadinessItem> {
  const id = (env.PAYPAL_CLIENT_ID ?? "").trim();
  const secret = (env.PAYPAL_CLIENT_SECRET ?? "").trim();
  const webhook = (env.PAYPAL_WEBHOOK_ID ?? "").trim();
  const mode = paypalEnvironmentFrom(env);

  if (!id || !secret) {
    return {
      id: "paypal",
      label: "PayPal",
      status: "NOT_CONFIGURED",
      detail: "Client credentials not set.",
    };
  }

  // Reject obvious sandbox client id prefixes when claiming production live
  const looksSandboxClient = id.startsWith("sb-") || /sandbox/i.test(id);

  if (mode !== "live") {
    const unset =
      !(env.PAYPAL_ENVIRONMENT ?? "").trim() && !(env.PAYPAL_MODE ?? "").trim();
    return {
      id: "paypal",
      label: "PayPal",
      status: "ERROR",
      detail: unset
        ? "PAYPAL_ENVIRONMENT is unset — production requires explicit production/live (never defaults to sandbox)."
        : "PAYPAL_ENVIRONMENT is sandbox — set production/live for real charges.",
    };
  }

  if (looksSandboxClient) {
    return {
      id: "paypal",
      label: "PayPal",
      status: "ERROR",
      detail: "Client ID looks like a sandbox credential while environment is live.",
    };
  }

  if (!webhook) {
    return {
      id: "paypal",
      label: "PayPal",
      status: "NOT_CONFIGURED",
      detail: "Live credentials present; PAYPAL_WEBHOOK_ID missing.",
    };
  }

  try {
    const plans = await prisma.plan.findMany({
      where: { isFree: false, status: "ACTIVE", paypalEnabled: true },
      select: {
        slug: true,
        monthlyEnabled: true,
        annualEnabled: true,
        paypalPlanMonthly: true,
        paypalPlanAnnual: true,
        paypalPlanIdEnv: true,
      },
    });
    if (plans.length === 0) {
      return {
        id: "paypal",
        label: "PayPal",
        status: "NOT_CONFIGURED",
        detail: "Credentials OK; no PayPal-enabled paid plans in DB.",
      };
    }
    const missing: string[] = [];
    for (const plan of plans) {
      if (plan.monthlyEnabled && !resolvePaypalPlanId(plan as Plan, "MONTH")) {
        missing.push(`${plan.slug}/MONTH`);
      }
      if (plan.annualEnabled && !resolvePaypalPlanId(plan as Plan, "YEAR")) {
        missing.push(`${plan.slug}/YEAR`);
      }
    }
    if (missing.length) {
      return {
        id: "paypal",
        label: "PayPal",
        status: "NOT_CONFIGURED",
        detail: `Live creds + webhook OK; missing PayPal plan IDs: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "…" : ""}`,
      };
    }
    return {
      id: "paypal",
      label: "PayPal",
      status: "READY",
      detail: `Live credentials, webhook, and ${plans.length} paid plan mapping(s) present (API not called).`,
    };
  } catch {
    return {
      id: "paypal",
      label: "PayPal",
      status: "ERROR",
      detail: "Could not verify PayPal plan mappings in the database.",
    };
  }
}

async function checkStripe(
  env: Record<string, string | undefined>,
): Promise<ReadinessItem> {
  const secret = (env.STRIPE_SECRET_KEY ?? "").trim();
  const webhook = (env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!secret) {
    return {
      id: "stripe",
      label: "Stripe",
      status: "NOT_CONFIGURED",
      detail: "Optional — not configured (PayPal-only deploys OK).",
    };
  }
  if (secret.startsWith("sk_test_")) {
    return {
      id: "stripe",
      label: "Stripe",
      status: "ERROR",
      detail: "Test secret key is not production-safe.",
    };
  }
  if (!secret.startsWith("sk_live_")) {
    return {
      id: "stripe",
      label: "Stripe",
      status: "ERROR",
      detail: "Secret key is not a live Stripe key.",
    };
  }
  if (!webhook) {
    return {
      id: "stripe",
      label: "Stripe",
      status: "NOT_CONFIGURED",
      detail: "Live secret set; STRIPE_WEBHOOK_SECRET missing.",
    };
  }

  try {
    const plans = await prisma.plan.findMany({
      where: { isFree: false, status: "ACTIVE", stripeEnabled: true },
      select: {
        slug: true,
        monthlyEnabled: true,
        annualEnabled: true,
        stripePriceMonthly: true,
        stripePriceAnnual: true,
        stripePriceEnv: true,
      },
    });
    const missing: string[] = [];
    for (const plan of plans) {
      if (plan.monthlyEnabled && !resolveStripePriceId(plan as Plan, "MONTH")) {
        missing.push(`${plan.slug}/MONTH`);
      }
      if (plan.annualEnabled && !resolveStripePriceId(plan as Plan, "YEAR")) {
        missing.push(`${plan.slug}/YEAR`);
      }
    }
    if (missing.length) {
      return {
        id: "stripe",
        label: "Stripe",
        status: "NOT_CONFIGURED",
        detail: `Live keys OK; missing Stripe Price IDs: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "…" : ""}`,
      };
    }
    return {
      id: "stripe",
      label: "Stripe",
      status: "READY",
      detail: "Live secret, webhook, and Price ID mappings present (API not called).",
    };
  } catch {
    return {
      id: "stripe",
      label: "Stripe",
      status: "ERROR",
      detail: "Could not verify Stripe Price ID mappings.",
    };
  }
}

function checkTurnstile(env: Record<string, string | undefined>): ReadinessItem {
  const cfg = getTurnstileServerConfig(env);
  if (!cfg.siteKey || !cfg.secretKey) {
    return {
      id: "turnstile",
      label: "Turnstile",
      status: "NOT_CONFIGURED",
      detail: "Site key and/or secret missing. Required for production (fail-closed).",
    };
  }
  if (DUMMY_TURNSTILE_SECRETS.has(cfg.secretKey) || DUMMY_TURNSTILE_SITES.has(cfg.siteKey)) {
    return {
      id: "turnstile",
      label: "Turnstile",
      status: "ERROR",
      detail: "Cloudflare dummy keys are not allowed for production.",
    };
  }
  if (!cfg.expectedHostname) {
    return {
      id: "turnstile",
      label: "Turnstile",
      status: "NOT_CONFIGURED",
      detail: "Keys set; NEXT_PUBLIC_APP_URL missing for hostname binding.",
    };
  }
  if (cfg.production && cfg.required) {
    return {
      id: "turnstile",
      label: "Turnstile",
      status: "READY",
      detail: "Production keys present; server-side Siteverify required (fail-closed).",
    };
  }
  return {
    id: "turnstile",
    label: "Turnstile",
    status: "READY",
    detail: "Keys present with hostname binding. Confirm NODE_ENV=production on the live host.",
  };
}

async function checkEmail(): Promise<ReadinessItem> {
  try {
    const snap = await getResendAdminSnapshot();
    if (!snap.hasApiKey) {
      return {
        id: "email",
        label: "Email",
        status: "NOT_CONFIGURED",
        detail: "No Resend API key in vault or env.",
      };
    }
    if (!snap.fromEmail && !process.env.EMAIL_FROM?.trim()) {
      return {
        id: "email",
        label: "Email",
        status: "NOT_CONFIGURED",
        detail: "API key present but from-address not configured.",
      };
    }
    if (snap.connectionStatus === "verified" || snap.lastTestOk === true) {
      return {
        id: "email",
        label: "Email",
        status: "READY",
        detail: `Resend key via ${snap.apiKeySource}; last connection test OK (recipient masked).`,
      };
    }
    if (snap.connectionStatus === "error" || snap.lastTestOk === false) {
      return {
        id: "email",
        label: "Email",
        status: "ERROR",
        detail: snap.lastErrorSafe?.slice(0, 160) || "Last Resend connection test failed.",
      };
    }
    return {
      id: "email",
      label: "Email",
      status: "NOT_CONFIGURED",
      detail: `Key via ${snap.apiKeySource}; run Super Admin → Email connection test (does not invent success).`,
    };
  } catch {
    return {
      id: "email",
      label: "Email",
      status: "ERROR",
      detail: "Could not resolve email configuration.",
    };
  }
}

function checkHttps(env: Record<string, string | undefined>): ReadinessItem {
  const url = (env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (!url) {
    return {
      id: "https",
      label: "HTTPS / app URL",
      status: "NOT_CONFIGURED",
      detail: "NEXT_PUBLIC_APP_URL is not set.",
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      id: "https",
      label: "HTTPS / app URL",
      status: "ERROR",
      detail: "NEXT_PUBLIC_APP_URL is not a valid URL.",
    };
  }
  if (parsed.protocol !== "https:") {
    return {
      id: "https",
      label: "HTTPS / app URL",
      status: "NOT_CONFIGURED",
      detail: "App URL is not https — required for production cookies and Turnstile binding.",
    };
  }
  return {
    id: "https",
    label: "HTTPS / app URL",
    status: "READY",
    detail: "HTTPS public origin configured (hostname not echoed).",
  };
}

function checkSecurityHardening(
  env: Record<string, string | undefined>,
): ReadinessItem {
  const headerKeys = new Set(BASELINE_SECURITY_HEADERS.map((h) => h.key));
  const required = [
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
  ];
  const missingHeaders = required.filter((k) => !headerKeys.has(k));
  if (missingHeaders.length) {
    return {
      id: "security",
      label: "Security hardening",
      status: "ERROR",
      detail: `Missing baseline security headers: ${missingHeaders.join(", ")}`,
    };
  }

  const smokeOff = isInternalPipelineSmokeDisabled(
    env.NODE_ENV as "production" | "development" | "test" | undefined,
  );
  if (env.NODE_ENV === "production" && !smokeOff) {
    return {
      id: "security",
      label: "Security hardening",
      status: "ERROR",
      detail: "Internal smoke/debug routes must be disabled in production.",
    };
  }

  if (env.NODE_ENV !== "production") {
    return {
      id: "security",
      label: "Security hardening",
      status: "NOT_CONFIGURED",
      detail:
        "Header baseline present in code; cookies use secure only when NODE_ENV=production. Smoke routes disabled only in production.",
    };
  }

  return {
    id: "security",
    label: "Security hardening",
    status: "READY",
    detail:
      "Production NODE_ENV: secure cookies expected, baseline headers present, internal smoke routes disabled.",
  };
}

/** Critical items that must be READY for overall READY. */
const PRODUCTION_REQUIRED_IDS = new Set([
  "node_env",
  "database",
  "auth_secret",
  "super_admin",
  "storage",
  "rate_limiting",
  "worker",
  "backups",
  "turnstile",
  "https",
  "paypal",
  "security",
]);

export async function collectProductionReadiness(
  env: Record<string, string | undefined> = process.env,
): Promise<ProductionReadinessSnapshot> {
  const [
    database,
    storage,
    backups,
    rateLimiting,
    worker,
    email,
    superAdmin,
    paypal,
    stripe,
  ] = await Promise.all([
    checkDatabase(),
    checkStorage(env),
    checkBackups(env),
    checkRateLimiting(env),
    checkWorker(env),
    checkEmail(),
    checkSuperAdmin(env),
    checkPaypal(env),
    checkStripe(env),
  ]);

  const items: ReadinessItem[] = [
    checkNodeEnv(env),
    authSecretStatus(env),
    superAdmin,
    checkHttps(env),
    database,
    storage,
    worker,
    rateLimiting,
    backups,
    checkRestoreIsolation(env),
    paypal,
    stripe,
    checkTurnstile(env),
    email,
    checkSecurityHardening(env),
  ];

  let overall: "READY" | "NOT_READY" = "READY";
  for (const item of items) {
    if (!PRODUCTION_REQUIRED_IDS.has(item.id)) continue;
    if (item.status !== "READY") overall = "NOT_READY";
  }

  return {
    checkedAt: new Date().toISOString(),
    nodeEnv: env.NODE_ENV ?? "undefined",
    overall,
    items,
  };
}

/**
 * Public readiness payload for load balancers — no item details that leak config.
 */
export async function getPublicReadyStatus(
  env: Record<string, string | undefined> = process.env,
): Promise<{ ready: boolean; status: "READY" | "NOT_READY"; ts: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return { ready: false, status: "NOT_READY", ts: new Date().toISOString() };
  }

  if (
    isUnsafeProductionMemoryRateLimit(env) ||
    env.RATE_LIMIT_BACKEND?.trim().toLowerCase() === "memory"
  ) {
    return { ready: false, status: "NOT_READY", ts: new Date().toISOString() };
  }

  if (env.NODE_ENV === "production" && env.LOAD_TEST_MODE !== "1") {
    const secret = (env.AUTH_SECRET ?? "").trim();
    if (secret.length < 32) {
      return { ready: false, status: "NOT_READY", ts: new Date().toISOString() };
    }
    const appUrl = (env.NEXT_PUBLIC_APP_URL ?? "").trim();
    try {
      if (!appUrl || new URL(appUrl).protocol !== "https:") {
        return { ready: false, status: "NOT_READY", ts: new Date().toISOString() };
      }
    } catch {
      return { ready: false, status: "NOT_READY", ts: new Date().toISOString() };
    }
    const turnstile = getTurnstileServerConfig(env);
    if (
      !turnstile.siteKey ||
      !turnstile.secretKey ||
      DUMMY_TURNSTILE_SECRETS.has(turnstile.secretKey) ||
      DUMMY_TURNSTILE_SITES.has(turnstile.siteKey)
    ) {
      return { ready: false, status: "NOT_READY", ts: new Date().toISOString() };
    }
    if (!env.STORAGE_ROOT?.trim() || !env.BACKUP_ROOT?.trim()) {
      return { ready: false, status: "NOT_READY", ts: new Date().toISOString() };
    }
  } else if (env.NODE_ENV === "production" && env.LOAD_TEST_MODE === "1") {
    // Isolated load-test / multi-instance staging: require durable rate limit + AUTH_SECRET,
    // but do not require HTTPS/Turnstile/payment (those are intentionally absent).
    const secret = (env.AUTH_SECRET ?? "").trim();
    if (secret.length < 32) {
      return { ready: false, status: "NOT_READY", ts: new Date().toISOString() };
    }
  }

  try {
    const root = resolveStorageRoot(env);
    await mkdir(root, { recursive: true });
    const probe = path.join(root, `.ready-${process.pid}`);
    await writeFile(probe, "ok", "utf8");
    await rm(probe, { force: true });
  } catch {
    return { ready: false, status: "NOT_READY", ts: new Date().toISOString() };
  }

  return { ready: true, status: "READY", ts: new Date().toISOString() };
}
