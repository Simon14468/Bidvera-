import { getAuthSecret } from "@/lib/auth-secret";
import { createHash, randomBytes, createHmac } from "crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashToken(token: string): string {
  return createHmac("sha256", getAuthSecret()).update(token).digest("hex");
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashIdentifier(value: string | null | undefined): string | null {
  if (!value) return null;
  return sha256(value.trim().toLowerCase());
}
