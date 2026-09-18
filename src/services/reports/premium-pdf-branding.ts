import { hostFromAppOrigin } from "@/lib/app-origin";

export type PdfBranding = {
  /** Configured host (e.g. localhost:3000 or app.example.com). */
  displayHost: string;
  /** Full configured origin URL. */
  displayUrl: string;
  /** e.g. Report by localhost:3000 — shown once on cover top only. */
  reportBy: string;
};

const DEV_HOST =
  /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|\[::ffff:127\.0\.0\.1\])(:\d+)?$/i;

function isDevHost(host: string): boolean {
  const h = host.toLowerCase();
  return DEV_HOST.test(h) || h.includes("localhost") || h.endsWith(".local");
}

function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/\/$/, "");
}

/**
 * Pick the attribution origin from application configuration.
 *
 * Priority:
 * 1. NEXT_PUBLIC_APP_URL when it is a non-dev (production) domain
 * 2. Request appOrigin when it is a non-dev domain
 * 3. NEXT_PUBLIC_APP_URL even if localhost (local development, no prod domain configured)
 * 4. Request appOrigin even if localhost
 * 5. http://localhost:3000 — last-resort local default only (never invent a public domain)
 *
 * Never hardcodes bidvera.com or any invented brand domain.
 */
export function resolvePdfBranding(appOrigin?: string | null): PdfBranding {
  const envRaw = process.env.NEXT_PUBLIC_APP_URL
    ? normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL)
    : null;
  const requestRaw = appOrigin?.trim()
    ? normalizeOrigin(appOrigin)
    : null;

  let chosen: string;
  if (envRaw && !isDevHost(hostFromAppOrigin(envRaw))) {
    chosen = envRaw;
  } else if (requestRaw && !isDevHost(hostFromAppOrigin(requestRaw))) {
    chosen = requestRaw;
  } else if (envRaw) {
    chosen = envRaw;
  } else if (requestRaw) {
    chosen = requestRaw;
  } else {
    chosen = "http://localhost:3000";
  }

  const displayHost = hostFromAppOrigin(chosen);
  return {
    displayHost,
    displayUrl: chosen,
    // Show the real origin (e.g. http://localhost:3000), never an invented domain.
    reportBy: `Report by ${chosen}`,
  };
}
