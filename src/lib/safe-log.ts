import { sha256 } from "@/lib/crypto";

/** Truncated + hashed email for production logs. Never a full address. */
export function redactEmailForLog(email: string | null | undefined): string {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return "unknown";
  const at = normalized.lastIndexOf("@");
  const domain = at >= 0 ? normalized.slice(at + 1) : "invalid";
  const hash = sha256(normalized).slice(0, 12);
  return `***@${domain}#${hash}`;
}
