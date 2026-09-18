/**
 * Apply Bidvera official lockup (public/Bidvera AI logo orgenall.png) to all brand assets
 * without changing public URL paths used by the app.
 *
 * - Backs up previous bidvera-logo.png / bidvera-mark.png
 * - Writes transparent bidvera-logo.png (full lockup)
 * - Writes transparent bidvera-mark.png (green mark only)
 * - Refreshes favicon + PWA icons
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public", "Bidvera AI logo orgenall.png");
const archiveDir = path.join(root, "public", "brand-archive");

async function backupIfExists(rel: string) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return;
  fs.mkdirSync(archiveDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = path.join(archiveDir, `${path.basename(rel)}.${stamp}`);
  fs.copyFileSync(abs, dest);
  console.log(`backed up ${rel} → ${path.relative(root, dest)}`);
}

/** Near-black → transparent; keep greens and wordmark. */
async function toTransparentLockup(input: string): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    // Black / near-black background
    if (r < 28 && g < 28 && b < 28) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
}

/**
 * Mark comes from the standalone official icon (public/bidvera-mark-source.png)
 * when present; otherwise geometric crop of the left square of the lockup.
 * Never pixel-color detection — gradients break it.
 */
async function extractMark(lockupPng: Buffer): Promise<Buffer> {
  const standalone = path.join(root, "public", "bidvera-mark-source.png");
  let cropped: Buffer;

  if (fs.existsSync(standalone)) {
    cropped = await sharp(standalone).trim({ threshold: 8 }).png().toBuffer();
  } else {
    const meta = await sharp(lockupPng).metadata();
    const h = meta.height ?? 0;
    const w = Math.min(meta.width ?? 0, Math.round(h * 1.05));
    cropped = await sharp(lockupPng)
      .extract({ left: 0, top: 0, width: w, height: h })
      .trim({ threshold: 8 })
      .png()
      .toBuffer();
  }

  const cMeta = await sharp(cropped).metadata();
  const width = cMeta.width ?? 1;
  const height = cMeta.height ?? 1;

  // Square canvas, mark centered, transparent
  const size = Math.max(width, height);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: cropped,
        left: Math.round((size - width) / 2),
        top: Math.round((size - height) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function writeSquareFromMark(markPath: string, size: number, outPath: string, maskable = false) {
  if (maskable) {
    const pad = Math.round(size * 0.12);
    const inner = size - pad * 2;
    const tile = await sharp(markPath)
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 26, g: 26, b: 26, alpha: 1 },
      },
    })
      .composite([{ input: tile, left: pad, top: pad }])
      .png()
      .toFile(outPath);
    return;
  }

  // Dark square so bright green mark reads on home-screen tiles
  const tile = await sharp(markPath)
    .resize(Math.round(size * 0.78), Math.round(size * 0.78), {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 18, g: 18, b: 18, alpha: 1 },
    },
  })
    .composite([
      {
        input: tile,
        left: Math.round(size * 0.11),
        top: Math.round(size * 0.11),
      },
    ])
    .png()
    .toFile(outPath);
}

async function main() {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing source: ${source}`);
  }

  await backupIfExists("public/bidvera-logo.png");
  await backupIfExists("public/bidvera-mark.png");
  await backupIfExists("public/favicon.png");
  await backupIfExists("public/pwa-icon-source.jpg");

  const lockup = await toTransparentLockup(source);
  const lockupMeta = await sharp(lockup).metadata();
  console.log(`lockup ${lockupMeta.width}×${lockupMeta.height}`);

  const logoPath = path.join(root, "public", "bidvera-logo.png");
  await sharp(lockup).png({ compressionLevel: 9 }).toFile(logoPath);
  console.log("wrote public/bidvera-logo.png");

  const markBuf = await extractMark(lockup);
  const markMeta = await sharp(markBuf).metadata();
  console.log(`mark ${markMeta.width}×${markMeta.height}`);
  const markPath = path.join(root, "public", "bidvera-mark.png");
  await sharp(markBuf).png({ compressionLevel: 9 }).toFile(markPath);
  console.log("wrote public/bidvera-mark.png");

  // Keep a stable canonical copy of the official source name too (already present)
  // Favicon / Next icon from mark (transparent)
  const appDir = path.join(root, "src", "app");
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  await sharp(markPath)
    .resize(32, 32, { fit: "contain", background: transparent })
    .png()
    .toFile(path.join(root, "public", "favicon.png"));
  await sharp(markPath)
    .resize(64, 64, { fit: "contain", background: transparent })
    .png()
    .toFile(path.join(appDir, "icon.png"));

  // PWA install tiles from mark
  const iconsDir = path.join(root, "public", "icons");
  fs.mkdirSync(iconsDir, { recursive: true });
  await writeSquareFromMark(markPath, 192, path.join(iconsDir, "icon-192.png"));
  await writeSquareFromMark(markPath, 512, path.join(iconsDir, "icon-512.png"));
  await writeSquareFromMark(markPath, 180, path.join(iconsDir, "apple-touch-icon.png"));
  await writeSquareFromMark(markPath, 192, path.join(iconsDir, "icon-maskable-192.png"), true);
  await writeSquareFromMark(markPath, 512, path.join(iconsDir, "icon-maskable-512.png"), true);
  await writeSquareFromMark(markPath, 180, path.join(appDir, "apple-icon.png"));

  // pwa-icon-source for future npm run icons:pwa
  await sharp(path.join(iconsDir, "icon-512.png"))
    .jpeg({ quality: 95 })
    .toFile(path.join(root, "public", "pwa-icon-source.jpg"));

  // Also refresh iconn.png if used as alternate mark
  const iconn = path.join(root, "public", "iconn.png");
  if (fs.existsSync(iconn)) {
    await backupIfExists("public/iconn.png");
    await sharp(markPath)
      .resize(256, 256, { fit: "contain", background: transparent })
      .png()
      .toFile(iconn);
  }

  // Invalidate cached white PDF logo so it regenerates from new lockup
  const whiteCache = path.join(root, "assets", "brand", "bidvera-logo-white.png");
  if (fs.existsSync(whiteCache)) {
    await backupIfExists("assets/brand/bidvera-logo-white.png");
    fs.unlinkSync(whiteCache);
    console.log("cleared assets/brand/bidvera-logo-white.png (will regenerate on next PDF)");
  }

  console.log("aspect", ((lockupMeta.width ?? 1) / (lockupMeta.height ?? 1)).toFixed(4));
  console.log("done");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
