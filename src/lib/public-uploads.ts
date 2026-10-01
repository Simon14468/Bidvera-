/**
 * Shared public upload roots (avatars + landing media).
 *
 * Production multi-instance: set PUBLIC_UPLOADS_ROOT to a persistent shared path
 * (e.g. /var/lib/bidvera/public-uploads). All app units must share it — otherwise
 * an upload on instance A 404s when the browser hits instance B.
 *
 * Default (local / single-node): {cwd}/public/uploads so Next can also serve
 * files statically when present.
 */
import path from "path";

type EnvLike = Record<string, string | undefined>;

export function resolvePublicUploadsRoot(
  env: EnvLike = process.env,
  cwd: string = process.cwd(),
): string {
  const configured = env.PUBLIC_UPLOADS_ROOT?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(cwd, "public", "uploads");
}

export function resolveAvatarsRoot(
  env: EnvLike = process.env,
  cwd: string = process.cwd(),
): string {
  return path.join(resolvePublicUploadsRoot(env, cwd), "avatars");
}

export function resolveLandingUploadsRoot(
  env: EnvLike = process.env,
  cwd: string = process.cwd(),
): string {
  return path.join(resolvePublicUploadsRoot(env, cwd), "landing");
}

const AVATAR_EXT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function contentTypeForAvatarFilename(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  return AVATAR_EXT_TYPES[ext] ?? null;
}

/**
 * Resolve a safe absolute path under avatars/{userId}/{file}.
 * Returns null when the URL/path escapes the root or is malformed.
 */
export function resolveSafeAvatarFilePath(
  userId: string,
  filename: string,
  env: EnvLike = process.env,
  cwd: string = process.cwd(),
): string | null {
  if (!userId || !filename) return null;
  if (
    userId.includes("..") ||
    userId.includes("/") ||
    userId.includes("\\") ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return null;
  }
  if (!contentTypeForAvatarFilename(filename)) return null;

  const root = path.resolve(resolveAvatarsRoot(env, cwd), userId);
  const full = path.resolve(root, filename);
  if (!full.startsWith(root + path.sep)) return null;
  return full;
}

/** Public URL shape stored in User.avatarUrl (unchanged). */
export function publicAvatarUrl(userId: string, filename: string): string {
  return `/uploads/avatars/${userId}/${filename}`;
}
