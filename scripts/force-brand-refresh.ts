/**
 * Extract official mark from lockup + force new public filenames (cache bust).
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = process.cwd();
const orgenall = path.join(root, "public", "Bidvera AI logo orgenall.png");
const greenSrc = path.join(root, "public", "bidvera-mark-green-source.png");

async function knockOutBlack(input: string | Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i]! < 36 && data[i + 1]! < 36 && data[i + 2]! < 36) {
      data[i + 3] = 0;
    }
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 12 })
    .png()
    .toBuffer();
}

async function toSquare(png: Buffer, size: number): Promise<Buffer> {
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
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function main() {
  // Prefer standalone green mark export; fallback to left of lockup
  let markBuf: Buffer;
  if (fs.existsSync(greenSrc)) {
    markBuf = await toSquare(await knockOutBlack(greenSrc), 512);
    console.log("mark from bidvera-mark-green-source.png");
  } else {
    const lockup = await knockOutBlack(orgenall);
    const meta = await sharp(lockup).metadata();
    const h = meta.height ?? 1;
    const w = Math.min(meta.width ?? 1, Math.round(h * 1.15));
    const crop = await sharp(lockup)
      .extract({ left: 0, top: 0, width: w, height: h })
      .trim({ threshold: 12 })
      .png()
      .toBuffer();
    markBuf = await toSquare(crop, 512);
    console.log("mark from orgenall left crop");
  }

  const lockupTransparent = await knockOutBlack(orgenall);
  const logoMeta = await sharp(lockupTransparent).metadata();

  // New filenames so /_next/image cannot serve stale cache
  const markOut = path.join(root, "public", "bidvera-mark.png");
  const logoOut = path.join(root, "public", "bidvera-logo.png");
  await sharp(markBuf).png({ compressionLevel: 9 }).toFile(markOut);
  await sharp(lockupTransparent).png({ compressionLevel: 9 }).toFile(logoOut);
  await sharp(markBuf).png().toFile(path.join(root, "public", "bidvera-mark-source.png"));

  // Also write versioned copies for explicit cache-bust URLs
  await sharp(markBuf).png().toFile(path.join(root, "public", "brand-mark.png"));
  await sharp(lockupTransparent).png().toFile(path.join(root, "public", "brand-logo.png"));

  console.log("logo", logoMeta.width, "x", logoMeta.height);
  console.log("wrote bidvera-mark.png, bidvera-logo.png, brand-mark.png, brand-logo.png");

  // Clear Next image optimizer cache
  const imgCache = path.join(root, ".next", "cache", "images");
  if (fs.existsSync(imgCache)) {
    fs.rmSync(imgCache, { recursive: true, force: true });
    console.log("cleared .next/cache/images");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
