/**
 * Strict same-origin relative path allowlist for post-auth redirects.
 * Rejects external hosts, protocol-relative URLs, javascript/data, and encoding tricks.
 */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (raw == null) return fallback;
  let candidate = String(raw).trim();
  if (!candidate) return fallback;

  // Decode repeatedly to catch double-encoding bypasses (cap iterations).
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) break;
      candidate = decoded;
    } catch {
      return fallback;
    }
  }

  candidate = candidate.trim();
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  if (candidate.includes("://")) return fallback;
  if (candidate.includes("\\")) return fallback;
  if (candidate.includes("//")) return fallback;
  if (/(^|\/)\.\.(\/|$)/.test(candidate.split(/[?#]/, 1)[0] ?? candidate)) {
    return fallback;
  }

  const lower = candidate.toLowerCase();
  if (lower.includes("javascript:") || lower.includes("data:")) return fallback;

  // Block /\\evil.com and /@userinfo tricks.
  if (candidate.startsWith("/\\") || candidate.startsWith("/@")) return fallback;

  const pathOnly = candidate.split(/[?#]/, 1)[0] ?? candidate;
  if (pathOnly.includes("@")) return fallback;

  if (candidate.length > 1024) return fallback;

  return candidate;
}
