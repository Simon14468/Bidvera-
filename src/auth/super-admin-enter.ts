/**
 * Super Admin "Enter company" session marker.
 * Must never be acceptably set by client login/signup fingerprints.
 */

import { getSessionToken } from "@/auth/session";
import { hashToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";

export const SA_ENTER_FINGERPRINT_PREFIX = "sa-enter:" as const;

/** True when a client-supplied fingerprint tries to forge SA enter. */
export function isReservedSaEnterFingerprint(
  fingerprint: string | null | undefined,
): boolean {
  if (!fingerprint) return false;
  return fingerprint.trim().toLowerCase().startsWith(SA_ENTER_FINGERPRINT_PREFIX);
}

/**
 * Strip reserved SA-enter markers from public auth fingerprints.
 * Returns null when missing or reserved (never store a forged prefix).
 */
export function sanitizePublicDeviceFingerprint(
  fingerprint: string | null | undefined,
): string | null {
  if (!fingerprint) return null;
  const trimmed = fingerprint.trim().slice(0, 128);
  if (!trimmed || isReservedSaEnterFingerprint(trimmed)) return null;
  return trimmed;
}

/**
 * True when a stored session fingerprint is a verified Super Admin enter-company
 * marker (active SUPER_ADMIN/OPS). Used to allow recovery access into suspended tenants.
 */
export async function isAuthorizedSaEnterFingerprint(
  fingerprint: string | null | undefined,
): Promise<boolean> {
  if (!fingerprint?.startsWith(SA_ENTER_FINGERPRINT_PREFIX)) return false;
  const adminId = fingerprint.slice(SA_ENTER_FINGERPRINT_PREFIX.length).trim();
  if (!adminId) return false;
  try {
    const admin = await prisma.adminUser.findFirst({
      where: {
        id: adminId,
        active: true,
        role: { in: ["SUPER_ADMIN", "OPS"] },
      },
      select: { id: true },
    });
    return Boolean(admin);
  } catch {
    return false;
  }
}

/**
 * True only for company sessions created by Super Admin enter-company,
 * with a fingerprint that references an active SUPER_ADMIN/OPS admin id.
 */
export async function isVerifiedSuperAdminEnterSession(): Promise<boolean> {
  try {
    const token = await getSessionToken();
    if (!token) return false;
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { deviceFingerprint: true },
    });
    return isAuthorizedSaEnterFingerprint(session?.deviceFingerprint);
  } catch {
    // Outside Next.js request scope (scripts/tests) — never treat as SA enter.
    return false;
  }
}
