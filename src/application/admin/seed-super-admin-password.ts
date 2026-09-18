import { PASSWORD_MIN_LENGTH } from "@/domain/schemas";

/** Never ship or silently seed this known local demo password. */
export const KNOWN_SUPER_ADMIN_DEMO_PASSWORD = "BidveraSuperAdmin1!";

/** Never silently seed this known placeholder email. */
export const KNOWN_SUPER_ADMIN_DEMO_EMAILS = [
  "superadmin@bidvera.com",
  "superadmin@example.com",
] as const;

function envFlag(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

/**
 * Local workstation seed only — not production, CI, or hosted platforms.
 */
export function isLocalDevelopmentSeed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") return false;
  if (envFlag(env.VERCEL) || envFlag(env.CI)) return false;
  if (env.RENDER || env.RAILWAY_ENVIRONMENT || env.FLY_APP_NAME) return false;
  return env.NODE_ENV === "development" || env.NODE_ENV === "test" || !env.NODE_ENV;
}

function looksLikeEmail(value: string): boolean {
  // Practical seed/bootstrap check — not a full RFC validator.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Production Super Admin email must come from SUPER_ADMIN_EMAIL (no hardcoded fallback).
 */
export function resolveSeedSuperAdminEmail(
  env: Record<string, string | undefined> = process.env,
): string {
  const email = (env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) {
    throw new Error(
      "SUPER_ADMIN_EMAIL must be set to seed or sync Super Admin. There is no default Super Admin email.",
    );
  }
  if (!looksLikeEmail(email)) {
    throw new Error("SUPER_ADMIN_EMAIL must be a valid email address.");
  }
  const isDemoEmail = (KNOWN_SUPER_ADMIN_DEMO_EMAILS as readonly string[]).includes(email);
  if (isDemoEmail && !isLocalDevelopmentSeed(env)) {
    throw new Error(
      "SUPER_ADMIN_EMAIL must not use a known placeholder/demo address outside local development.",
    );
  }
  return email;
}

/**
 * Production Super Admin password must come from SUPER_ADMIN_PASSWORD (no silent fallback).
 */
export function resolveSeedSuperAdminPassword(
  env: Record<string, string | undefined> = process.env,
): string {
  const password = env.SUPER_ADMIN_PASSWORD?.trim() ?? "";
  if (!password) {
    throw new Error(
      "SUPER_ADMIN_PASSWORD must be set to seed Super Admin. The known fallback password is no longer used.",
    );
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(
      `SUPER_ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
  }
  if (password === KNOWN_SUPER_ADMIN_DEMO_PASSWORD && !isLocalDevelopmentSeed(env)) {
    throw new Error(
      "SUPER_ADMIN_PASSWORD must not use the known local demo password outside local development.",
    );
  }
  return password;
}

/** Fail-closed production env presence check (values never returned). */
export function assertProductionSuperAdminEnvConfigured(
  env: Record<string, string | undefined> = process.env,
): { ok: true } | { ok: false; reason: string } {
  if (env.NODE_ENV !== "production") return { ok: true };
  try {
    resolveSeedSuperAdminEmail(env);
    resolveSeedSuperAdminPassword(env);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required in production.",
    };
  }
}
