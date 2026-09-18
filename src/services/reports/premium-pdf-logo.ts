import fs from "node:fs";
import path from "node:path";
import { resolveLogoPath } from "@/services/reports/premium-pdf-fonts";

const WHITE_CACHE = path.join(
  process.cwd(),
  "assets",
  "brand",
  "bidvera-logo-white.png",
);

let whiteLogoPromise: Promise<Buffer | null> | null = null;
let lightLogoPromise: Promise<Buffer | null> | null = null;

/**
 * White lockup for dark cover — matches sidebar `brightness-0 invert`.
 */
export async function resolveWhiteLogoBuffer(): Promise<Buffer | null> {
  if (whiteLogoPromise) return whiteLogoPromise;
  whiteLogoPromise = (async () => {
    if (fs.existsSync(WHITE_CACHE)) {
      return fs.readFileSync(WHITE_CACHE);
    }
    const src = resolveLogoPath();
    if (!src) return null;
    try {
      const sharp = (await import("sharp")).default;
      const buf = await sharp(src)
        .ensureAlpha()
        // Match sidebar CSS: brightness(0) then invert → white lockup on dark
        .recomb([
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ])
        .negate({ alpha: false })
        .png()
        .toBuffer();
      fs.mkdirSync(path.dirname(WHITE_CACHE), { recursive: true });
      fs.writeFileSync(WHITE_CACHE, buf);
      return buf;
    } catch {
      return null;
    }
  })();
  return whiteLogoPromise;
}

/**
 * Original lockup for light/white PDF surfaces — matches sidebar light mode
 * (`light:brightness-100 light:invert-0`): black wordmark, no invert.
 */
export async function resolveLightLogoBuffer(): Promise<Buffer | null> {
  if (lightLogoPromise) return lightLogoPromise;
  lightLogoPromise = (async () => {
    const src = resolveLogoPath();
    if (!src) return null;
    try {
      return fs.readFileSync(src);
    } catch {
      return null;
    }
  })();
  return lightLogoPromise;
}

/** @deprecated Use resolveLightLogoBuffer — kept for callers expecting a path. */
export function resolveColorLogoPath(): string | null {
  return resolveLogoPath();
}
