import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getAuthSecret } from "@/lib/auth-secret";

/** 8-byte magic so we never treat random files as Bidvera backups. */
export const BACKUP_MAGIC = Buffer.from("BIDVBK01", "ascii");

export function backupKeyMaterial(secret = getAuthSecret()): Buffer {
  return createHash("sha256").update(`bidvera-backup-v1:${secret}`).digest();
}

export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** AES-256-GCM: magic || iv(12) || tag(16) || ciphertext. */
export function encryptBackupPayload(plain: Buffer, key = backupKeyMaterial()): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([BACKUP_MAGIC, iv, tag, enc]);
}

export function decryptBackupPayload(payload: Buffer, key = backupKeyMaterial()): Buffer {
  if (payload.length < BACKUP_MAGIC.length + 12 + 16 + 1) {
    throw new Error("Backup file is truncated or not a Bidvera archive.");
  }
  const magic = payload.subarray(0, BACKUP_MAGIC.length);
  if (!magic.equals(BACKUP_MAGIC)) {
    throw new Error("Backup file magic mismatch.");
  }
  const iv = payload.subarray(BACKUP_MAGIC.length, BACKUP_MAGIC.length + 12);
  const tag = payload.subarray(BACKUP_MAGIC.length + 12, BACKUP_MAGIC.length + 28);
  const data = payload.subarray(BACKUP_MAGIC.length + 28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
