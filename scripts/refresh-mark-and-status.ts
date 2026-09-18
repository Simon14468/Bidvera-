/**
 * Refresh Bidvera mark + status-indicator mask from official ChatGPT mark exports
 * (green and white on black). Keeps public URL paths unchanged.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = process.cwd();
const greenSrc = path.join(root, "public", "bidvera-mark-green-source.png");
const whiteSrc = path.join(root, "public", "bidvera-mark-white-source.png");
const archiveDir = path.join(root, "public", "brand-archive");

async function backup(rel: string) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return;
  fs.mkdirSync(archiveDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.copyFileSync(abs, path.join(archiveDir, `${path.basename(rel)}.${stamp}`));
}

/** Black/near-black → transparent; keep colored (or white) pixels. */
async function knockOutBlack(input: string | Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (r < 40 && g < 40 && b < 40) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 10 })
    .png()
    .toBuffer();
}

/** White silhouette on transparent — for CSS mask-image. */
async function whiteMaskFromBlackBg(input: string): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 50) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    } else {
      // solid white for reliable CSS mask alpha
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 8 })
    .png()
    .toBuffer();
}

async function toSquare(png: Buffer, size = 512): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  const side = Math.max(w, h);
  const padded = await sharp({
    create: {
      width: side,
      height: side,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: png,
        left: Math.round((side - w) / 2),
        top: Math.round((side - h) / 2),
      },
    ])
    .png()
    .toBuffer();

  return sharp(padded)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function writePwaFromMark(markPath: string) {
  const iconsDir = path.join(root, "public", "icons");
  const appDir = path.join(root, "src", "app");
  fs.mkdirSync(iconsDir, { recursive: true });

  async function tile(size: number, out: string, darkBg = true) {
    const inner = Math.round(size * 0.78);
    const logo = await sharp(markPath)
      .resize(inner, inner, {
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
        background: darkBg
          ? { r: 18, g: 18, b: 18, alpha: 1 }
          : { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: logo,
          left: Math.round((size - inner) / 2),
          top: Math.round((size - inner) / 2),
        },
      ])
      .png()
      .toFile(out);
  }

  await tile(192, path.join(iconsDir, "icon-192.png"));
  await tile(512, path.join(iconsDir, "icon-512.png"));
  await tile(180, path.join(iconsDir, "apple-touch-icon.png"));
  await tile(180, path.join(appDir, "apple-icon.png"));

  // maskable with safe padding
  for (const size of [192, 512] as const) {
    const pad = Math.round(size * 0.12);
    const inner = size - pad * 2;
    const logo = await sharp(markPath)
      .resize(inner, inner, {
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
        background: { r: 26, g: 26, b: 26, alpha: 1 },
      },
    })
      .composite([{ input: logo, left: pad, top: pad }])
      .png()
      .toFile(path.join(iconsDir, `icon-maskable-${size}.png`));
  }

  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  await sharp(markPath)
    .resize(32, 32, { fit: "contain", background: transparent })
    .png()
    .toFile(path.join(root, "public", "favicon.png"));
  await sharp(markPath)
    .resize(64, 64, { fit: "contain", background: transparent })
    .png()
    .toFile(path.join(appDir, "icon.png"));
  await sharp(path.join(iconsDir, "icon-512.png"))
    .jpeg({ quality: 95 })
    .toFile(path.join(root, "public", "pwa-icon-source.jpg"));
}

async function main() {
  if (!fs.existsSync(greenSrc) || !fs.existsSync(whiteSrc)) {
    throw new Error("Missing green/white mark source PNGs in public/");
  }

  await backup("public/bidvera-mark.png");
  await backup("public/icons/status-indicator.png");
  await backup("public/favicon.png");

  const greenKnocked = await knockOutBlack(greenSrc);
  const mark = await toSquare(greenKnocked, 512);
  const markPath = path.join(root, "public", "bidvera-mark.png");
  await sharp(mark).png({ compressionLevel: 9 }).toFile(markPath);
  // keep stable source for apply-brand-logo
  await sharp(mark).png().toFile(path.join(root, "public", "bidvera-mark-source.png"));
  console.log("wrote public/bidvera-mark.png");

  const whiteKnocked = await whiteMaskFromBlackBg(whiteSrc);
  const mask = await toSquare(whiteKnocked, 512);
  await sharp(mask)
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, "public", "icons", "status-indicator.png"));
  console.log("wrote public/icons/status-indicator.png (new Bidvera mark mask)");

  await writePwaFromMark(markPath);

  const iconn = path.join(root, "public", "iconn.png");
  if (fs.existsSync(iconn)) {
    await backup("public/iconn.png");
    await sharp(mark)
      .resize(256, 256, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(iconn);
  }

  const whiteCache = path.join(root, "assets", "brand", "bidvera-logo-white.png");
  if (fs.existsSync(whiteCache)) fs.unlinkSync(whiteCache);

  console.log("done");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
