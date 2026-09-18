import { headers } from "next/headers";
import { AppError, ErrorCode } from "@/lib/errors";
import { RATE_LIMITS } from "@/config/server";
import { logInfo } from "@/services/observability";

export const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare dummy secrets — local/test only; hostname/action binding is skipped. */
export const TURNSTILE_DUMMY_PASS_SECRET = "1x0000000000000000000000000000000AA";
export const TURNSTILE_DUMMY_FAIL_SECRET = "2x0000000000000000000000000000000AA";
export const TURNSTILE_DUMMY_SPENT_SECRET = "3x0000000000000000000000000000000AA";

export type TurnstileAction =
  | "signup"
  | "login"
  | "forgot-password"
  | "reset-password"
  | "trial"
  | "checkout";

export type TurnstileServerConfig = {
  enabled: boolean;
  required: boolean;
  siteKey: string;
  secretKey: string;
  expectedHostname: string | null;
  production: boolean;
};

export type TurnstileSiteverifyResult = {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
};

const DUMMY_SECRETS = new Set([
  TURNSTILE_DUMMY_PASS_SECRET,
  TURNSTILE_DUMMY_FAIL_SECRET,
  TURNSTILE_DUMMY_SPENT_SECRET,
]);

/** Tokens older than this are treated as expired even if Siteverify returned success. */
export const TURNSTILE_MAX_AGE_MS = 5 * 60 * 1000;

/** Login requires a token after this many prior attempts in the rate-limit window. */
export const LOGIN_TURNSTILE_AFTER_ATTEMPTS = 2;

let siteverifyFetch: typeof fetch = fetch;

/** Test helper — restore with `null` / omit to use global fetch. */
export function setTurnstileFetchForTests(fn: typeof fetch | null) {
  siteverifyFetch = fn ?? fetch;
}

export function hostnameFromAppUrl(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function getTurnstileServerConfig(
  env: Record<string, string | undefined> = process.env,
): TurnstileServerConfig {
  const siteKey = String(env.TURNSTILE_SITE_KEY ?? env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();
  const secretKey = String(env.TURNSTILE_SECRET_KEY ?? "").trim();
  const explicit = String(env.TURNSTILE_ENABLED ?? "").trim().toLowerCase();
  const production = env.NODE_ENV === "production";
  const expectedHostname = hostnameFromAppUrl(env);

  if (production) {
    return {
      enabled: true,
      required: true,
      siteKey,
      secretKey,
      expectedHostname,
      production: true,
    };
  }

  if (explicit === "false") {
    return {
      enabled: false,
      required: false,
      siteKey,
      secretKey,
      expectedHostname,
      production: false,
    };
  }

  const required = explicit === "true" || Boolean(siteKey && secretKey);
  return {
    enabled: required,
    required,
    siteKey,
    secretKey,
    expectedHostname,
    production: false,
  };
}

/** Browser-safe config — never includes the secret. */
export function getTurnstilePublicConfig(
  env: Record<string, string | undefined> = process.env,
): { enabled: boolean; siteKey: string } {
  const cfg = getTurnstileServerConfig(env);
  const siteKey = cfg.enabled ? cfg.siteKey : "";
  return { enabled: Boolean(cfg.enabled && siteKey), siteKey };
}

export function loginTurnstileRequiredFromRemaining(
  remaining: number,
  limit: number = RATE_LIMITS.authPerIpPerHour,
  afterAttempts: number = LOGIN_TURNSTILE_AFTER_ATTEMPTS,
): boolean {
  const used = Math.max(0, limit - remaining);
  return used >= afterAttempts;
}

export function extractTurnstileToken(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const token = (raw as { turnstileToken?: unknown }).turnstileToken;
  return typeof token === "string" ? token.trim() : undefined;
}

export type EvaluatedTurnstile =
  | { ok: true }
  | { ok: false; reason: "missing" | "invalid" | "expired" | "action" | "hostname" | "misconfigured" };

export function evaluateTurnstileSiteverify(input: {
  result: TurnstileSiteverifyResult;
  expectedAction: TurnstileAction;
  expectedHostname: string | null;
  skipBinding: boolean;
  now?: number;
}): EvaluatedTurnstile {
  if (!input.result.success) {
    const codes = input.result["error-codes"] ?? [];
    if (codes.some((c) => c === "timeout-or-duplicate" || c.includes("expired"))) {
      return { ok: false, reason: "expired" };
    }
    return { ok: false, reason: "invalid" };
  }

  const now = input.now ?? Date.now();
  if (input.result.challenge_ts) {
    const ts = Date.parse(input.result.challenge_ts);
    if (Number.isFinite(ts) && now - ts > TURNSTILE_MAX_AGE_MS) {
      return { ok: false, reason: "expired" };
    }
  }

  if (!input.skipBinding && input.result.action && input.result.action !== input.expectedAction) {
    return { ok: false, reason: "action" };
  }

  if (!input.skipBinding && input.expectedHostname && input.result.hostname) {
    const actual = input.result.hostname.toLowerCase();
    if (actual !== input.expectedHostname) {
      return { ok: false, reason: "hostname" };
    }
  }

  return { ok: true };
}

async function siteverify(input: {
  secret: string;
  token: string;
  ip?: string | null;
}): Promise<TurnstileSiteverifyResult> {
  const body = new URLSearchParams();
  body.set("secret", input.secret);
  body.set("response", input.token);
  if (input.ip) body.set("remoteip", input.ip);

  const response = await siteverifyFetch(TURNSTILE_SITEVERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    return { success: false, "error-codes": ["upstream-http"] };
  }

  const json = (await response.json()) as TurnstileSiteverifyResult;
  return json;
}

function failClosed(
  reason: "missing" | "invalid" | "expired" | "action" | "hostname" | "misconfigured",
): never {
  const message =
    reason === "missing"
      ? "Please complete the security check and try again."
      : reason === "misconfigured"
        ? "Bot protection is not configured."
        : "Security check failed. Please try again.";
  throw new AppError(
    reason === "misconfigured" ? ErrorCode.UPSTREAM : ErrorCode.FORBIDDEN,
    message,
    reason === "misconfigured" ? 503 : 403,
  );
}

/**
 * Server-side Cloudflare Turnstile verification.
 * Never accepts a client `verified` flag. IP is forwarded to Siteverify only —
 * it is not used as a local blocking rule.
 */
export async function assertTurnstileToken(input: {
  token: unknown;
  action: TurnstileAction;
  ip?: string | null;
  env?: Record<string, string | undefined>;
}): Promise<void> {
  const cfg = getTurnstileServerConfig(input.env ?? process.env);
  if (!cfg.required) return;

  if (!cfg.secretKey || !cfg.siteKey) {
    logInfo("turnstile.misconfigured", { action: input.action });
    failClosed("misconfigured");
  }

  const token = typeof input.token === "string" ? input.token.trim() : "";
  if (!token) {
    failClosed("missing");
  }

  let result: TurnstileSiteverifyResult;
  try {
    result = await siteverify({ secret: cfg.secretKey, token, ip: input.ip });
  } catch {
    logInfo("turnstile.upstream_error", { action: input.action });
    failClosed("invalid");
  }

  const evaluated = evaluateTurnstileSiteverify({
    result,
    expectedAction: input.action,
    expectedHostname: cfg.expectedHostname,
    skipBinding: DUMMY_SECRETS.has(cfg.secretKey),
  });

  if (!evaluated.ok) {
    logInfo("turnstile.rejected", {
      action: input.action,
      reason: evaluated.reason,
      codes: result["error-codes"] ?? [],
    });
    failClosed(evaluated.reason);
  }
}

/**
 * Login is challenged only after prior attempts in the existing rate-limit window.
 * A present token is always verified (never trusted from the client).
 */
export async function assertLoginTurnstileIfRequired(input: {
  token: unknown;
  ip?: string | null;
  remainingIp: number;
  remainingEmail: number;
  env?: Record<string, string | undefined>;
}): Promise<void> {
  const cfg = getTurnstileServerConfig(input.env ?? process.env);
  if (!cfg.required) return;
  const required =
    loginTurnstileRequiredFromRemaining(input.remainingIp) ||
    loginTurnstileRequiredFromRemaining(input.remainingEmail);
  const token = typeof input.token === "string" ? input.token.trim() : "";
  if (!required && !token) return;
  await assertTurnstileToken({
    token: input.token,
    action: "login",
    ip: input.ip,
    env: input.env,
  });
}

export async function requestClientIp(): Promise<string | undefined> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined;
  } catch {
    return undefined;
  }
}
