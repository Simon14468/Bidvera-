/** Public app origin for billing email CTAs. Never logs secrets. */

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
