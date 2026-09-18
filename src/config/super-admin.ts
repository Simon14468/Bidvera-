/**
 * Super Admin path & session config — server-only.
 * Fail closed when SUPER_ADMIN_PATH is missing, weak, or banned.
 * Never invent or fall back to a default privileged path.
 */

const BANNED_PATHS = new Set([
  "admin",
  "administrator",
  "dashboard",
  "login",
  "api",
  "ops",
  "superadmin",
  "super-admin",
]);

export type SuperAdminPathResolution =
  | { ok: true; path: string }
  | { ok: false; reason: string };

/** Minimum entropy for the URL segment (non-guessable). */
const MIN_PATH_LENGTH = 12;

export function resolveSuperAdminPath(): SuperAdminPathResolution {
  const raw = process.env.SUPER_ADMIN_PATH?.trim() ?? "";
  if (!raw) {
    return { ok: false, reason: "SUPER_ADMIN_PATH is not configured" };
  }
  if (raw.includes("/") || raw.includes("\\") || /\s/.test(raw)) {
    return { ok: false, reason: "SUPER_ADMIN_PATH contains illegal characters" };
  }
  if (raw.length < MIN_PATH_LENGTH) {
    return { ok: false, reason: "SUPER_ADMIN_PATH is too short" };
  }
  if (BANNED_PATHS.has(raw.toLowerCase())) {
    return { ok: false, reason: "SUPER_ADMIN_PATH is a banned/trivial value" };
  }
  return { ok: true, path: raw };
}

/**
 * Returns the configured path or throws — never returns a default credential path.
 */
export function getSuperAdminPath(): string {
  const resolved = resolveSuperAdminPath();
  if (!resolved.ok) {
    throw new Error(`SUPER_ADMIN_DISABLED: ${resolved.reason}`);
  }
  return resolved.path;
}

export function isSuperAdminConfigured(): boolean {
  return resolveSuperAdminPath().ok;
}

export function isSuperAdminPathSegment(segment: string | undefined): boolean {
  if (!segment) return false;
  const resolved = resolveSuperAdminPath();
  if (!resolved.ok) return false;
  return segment === resolved.path;
}

export const SUPER_ADMIN_SESSION = {
  cookieName: "bidvera_sa_session",
  /** Short-lived relative to company sessions */
  ttlHours: Number(process.env.SUPER_ADMIN_SESSION_HOURS ?? 8),
} as const;

/** Sensitive setting keys never returned to any client UI */
export const SECRET_SETTING_KEYS = new Set([
  "AI_API_KEY",
  "PAYPAL_CLIENT_SECRET",
  "STRIPE_SECRET_KEY",
  "AUTH_SECRET",
  "SUPER_ADMIN_PATH",
  "ai.assistant.vault",
  "ai.providers.vault",
  "auth.google.vault",
  "auth.microsoft.vault",
  "email.resend.vault",
  "matching.ai.vault",
  "matching.ted.vault",
]);
