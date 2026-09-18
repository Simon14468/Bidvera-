/**
 * Production-safe baseline headers. CSP is report-only so existing pages
 * (inline scripts, Next.js runtime) are not blocked.
 */
export const CSP_REPORT_ONLY =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https:; " +
  "font-src 'self' data:; " +
  "connect-src 'self' https: wss:; " +
  "media-src 'self' blob:; " +
  "worker-src 'self' blob:; " +
  "frame-src 'self' https://challenges.cloudflare.com; " +
  "frame-ancestors 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'";

export const BASELINE_SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];
