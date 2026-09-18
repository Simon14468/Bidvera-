/**
 * Fail-closed outbound URL guard (SSRF).
 * Used for Super Admin–configured AI baseUrl and similar server-side fetches.
 * Pure JS — no node:net (must stay safe if imported near client boundaries).
 */

import { AppError, ErrorCode } from "@/lib/errors";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".corp", ".home"];

function isIpv4Literal(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

function isBlockedIpv4(hostname: string): boolean {
  if (!isIpv4Literal(hostname)) return false;
  const parts = hostname.split(".").map((p) => Number(p));
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && parts[2] === 0) return true;
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isIpv6Literal(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "");
  return h.includes(":");
}

function isBlockedIpv6(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h.startsWith("fe80")) return true;
  if (h.startsWith("ff")) return true;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(h);
  if (mapped?.[1] && isBlockedIpv4(mapped[1])) return true;
  return false;
}

function hostnameLooksBlocked(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (host === "169.254.169.254" || host.endsWith(".169.254.169.254")) return true;

  if (isIpv4Literal(host)) return isBlockedIpv4(host);
  if (isIpv6Literal(host)) return isBlockedIpv6(host);

  if (/^\d+$/.test(host)) return true;
  if (/^0x[0-9a-f]+$/i.test(host)) return true;

  return false;
}

/**
 * Normalize and validate an AI provider base URL.
 * Empty/null → null (caller uses provider default).
 * Non-empty must be https public host; fail closed otherwise.
 */
export function normalizeSafeAiBaseUrl(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError(ErrorCode.VALIDATION, "AI base URL is not a valid URL.", 400);
  }

  if (parsed.protocol !== "https:") {
    throw new AppError(
      ErrorCode.VALIDATION,
      "AI base URL must use https.",
      400,
    );
  }
  if (parsed.username || parsed.password) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "AI base URL must not include credentials.",
      400,
    );
  }
  if (hostnameLooksBlocked(parsed.hostname)) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "AI base URL host is not allowed.",
      400,
    );
  }

  return trimmed.replace(/\/$/, "");
}

export function assertSafeAiBaseUrl(raw: string | null | undefined): string | null {
  return normalizeSafeAiBaseUrl(raw);
}

/** True when a redirect Location would be unsafe to follow (SSRF). */
export function isUnsafeOutboundRedirectLocation(
  location: string | null,
  baseUrl?: string,
): boolean {
  if (!location) return true;
  try {
    const resolved = new URL(location, baseUrl);
    if (resolved.protocol !== "https:") return true;
    if (resolved.username || resolved.password) return true;
    return hostnameLooksBlocked(resolved.hostname);
  } catch {
    return true;
  }
}
