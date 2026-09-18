/**
 * Encrypt short-lived auth delivery secrets (email link tokens, SA enter session).
 * Job payloads store only opaque ids — never raw bearer tokens.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getAuthSecret } from "@/lib/auth-secret";

const MAGIC = Buffer.from("BDE1", "ascii");

function keyMaterial(): Buffer {
  return createHash("sha256").update(`bidvera-delivery-v1:${getAuthSecret()}`).digest();
}

export function encryptDeliverySecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, enc]).toString("base64url");
}

export function decryptDeliverySecret(payload: string): string | null {
  try {
    const buf = Buffer.from(payload, "base64url");
    if (buf.length < MAGIC.length + 12 + 16 + 1) return null;
    if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) return null;
    const iv = buf.subarray(MAGIC.length, MAGIC.length + 12);
    const tag = buf.subarray(MAGIC.length + 12, MAGIC.length + 28);
    const data = buf.subarray(MAGIC.length + 28);
    const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
