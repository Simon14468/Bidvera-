/** Public app origin for billing CTAs and checkout redirects. Never logs secrets. */

export function billingAppOrigin(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = (env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").trim();
  return raw.replace(/\/$/, "") || "http://localhost:3000";
}

export function billingAbsoluteUrl(
  path: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const origin = billingAppOrigin(env);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${suffix}`;
}

/** Canonical production success landing after Stripe/PayPal hosted checkout. */
export const CHECKOUT_SUCCESS_PATH = "/dashboard";

/** Default cancel landing when cancelPath is omitted or invalid. */
export const CHECKOUT_CANCEL_PATH = "/upgrade";

/**
 * Allowlisted relative paths for checkout cancel returns only.
 * Success always lands on CHECKOUT_SUCCESS_PATH — never client-controlled.
 */
export const CHECKOUT_CANCEL_PATH_ALLOWLIST = [
  "/upgrade",
  "/billing",
  "/onboarding/plan",
] as const;

export type CheckoutCancelPath = (typeof CHECKOUT_CANCEL_PATH_ALLOWLIST)[number];

/**
 * Reject open redirects and protocol-relative / absolute URLs from the browser.
 * Returns an allowlisted relative path or the default cancel path.
 */
export function sanitizeCheckoutCancelPath(
  candidate: string | null | undefined,
): CheckoutCancelPath {
  if (!candidate || typeof candidate !== "string") return CHECKOUT_CANCEL_PATH;
  const trimmed = candidate.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return CHECKOUT_CANCEL_PATH;
  }
  if (/[\s\\]/.test(trimmed) || trimmed.includes("://")) {
    return CHECKOUT_CANCEL_PATH;
  }
  const pathOnly = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
  const match = CHECKOUT_CANCEL_PATH_ALLOWLIST.find((p) => p === pathOnly);
  return match ?? CHECKOUT_CANCEL_PATH;
}

/**
 * Fixed success URL for hosted checkout. Correlation params (session_id, etc.)
 * may be appended by the provider layer — they are never treated as payment proof.
 */
export function buildCheckoutSuccessUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  return billingAbsoluteUrl(CHECKOUT_SUCCESS_PATH, env);
}

/** Safe cancel URL — path must be allowlisted; query is fixed. */
export function buildCheckoutCancelUrl(
  cancelPath?: string | null,
  env: Record<string, string | undefined> = process.env,
): string {
  const path = sanitizeCheckoutCancelPath(cancelPath);
  return `${billingAbsoluteUrl(path, env)}?canceled=1`;
}
