/**
 * User profile avatar uploads — public files under /uploads/avatars/{userId}/.
 * Reuses landing image sniff (JPG/PNG/WebP/GIF); never trusts client MIME.
 */
import { assertLandingUploadAllowed } from "@/domain/security/landing-upload-sniff";
import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATARS_ROOT = path.join(process.cwd(), "public", "uploads", "avatars");

export function assertSafeUserAvatarUrl(
  userId: string,
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const prefix = `/uploads/avatars/${userId}/`;
  if (!trimmed.startsWith(prefix)) {
    throw new AppError(ErrorCode.VALIDATION, "Invalid avatar path.", 400);
  }
  const rest = trimmed.slice(prefix.length);
  if (!rest || rest.includes("..") || rest.includes("/") || rest.includes("\\")) {
    throw new AppError(ErrorCode.VALIDATION, "Invalid avatar path.", 400);
  }
  return trimmed;
}

async function ensureUserAvatarDir(userId: string) {
  const dir = path.join(AVATARS_ROOT, userId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function deleteUserAvatarFile(publicUrl: string | null | undefined) {
  if (!publicUrl?.startsWith("/uploads/avatars/")) return;
  const relative = publicUrl.replace("/uploads/avatars/", "");
  const parts = relative.split("/");
  if (parts.length !== 2) return;
  const [userId, name] = parts;
  if (!userId || !name || name.includes("..")) return;
  const full = path.resolve(AVATARS_ROOT, userId, name);
  const root = path.resolve(AVATARS_ROOT, userId);
  if (!full.startsWith(root + path.sep)) return;
  await unlink(full).catch(() => undefined);
}

export async function saveUserAvatarUpload(input: {
  userId: string;
  body: Buffer;
}): Promise<string> {
  if (input.body.byteLength > AVATAR_MAX_BYTES) {
    throw new AppError(ErrorCode.VALIDATION, "Image must be under 5MB.", 400);
  }

  const sniffed = assertLandingUploadAllowed("avatar", input.body);
  if (sniffed.kind === "rejected" || sniffed.kind === "unknown" || !sniffed.ext) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Upload a real JPG, PNG, WebP, or GIF image (SVG/HTML rejected).",
      400,
    );
  }

  const dir = await ensureUserAvatarDir(input.userId);
  const safe = `avatar-${Date.now()}-${randomBytes(8).toString("hex")}${sniffed.ext}`;
  const full = path.resolve(dir, safe);
  if (!full.startsWith(dir + path.sep)) {
    throw new AppError(ErrorCode.VALIDATION, "Invalid upload path.", 400);
  }
  await writeFile(full, input.body);
  return `/uploads/avatars/${input.userId}/${safe}`;
}

export async function setUserAvatarUrl(userId: string, avatarUrl: string | null) {
  const safe = assertSafeUserAvatarUrl(userId, avatarUrl);
  return prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: safe },
    select: { id: true, avatarUrl: true },
  });
}
