/**
 * Generate PWA *install* icons only (taskbar / home screen).
 * Browser tab favicon stays `bidvera-mark.png` — this script does not change it.
 *
 * Change install icon later:
 * 1. Replace `public/pwa-icon-source.jpg`
 * 2. Run: npm run icons:pwa
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const root = process.cwd();
const defaultSourceCandidates = [
  "public/pwa-icon-source.jpg",
  "public/pwa-icon-source.png",
  "public/PAWW icon pc.jpg",
];

function resolveSource(): string {
  const arg = process.argv[2];
  if (arg) {
    const abs = path.isAbsolute(arg) ? arg : path.join(root, arg);
    if (!fs.existsSync(abs)) {
      throw new Error(`Source image not found: ${abs}`);
    }
    return abs;
  }
  for (const rel of defaultSourceCandidates) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) return abs;
  }
  throw new Error(
    "No PWA source icon found. Place one at public/pwa-icon-source.jpg then re-run.",
  );
}

async function writeSquare(
  src: string,
  size: number,
  outPath: string,
  opts?: { maskable?: boolean },
) {
  if (opts?.maskable) {
    const pad = Math.round(size * 0.1);
    const inner = size - pad * 2;
    const tile = await sharp(src)
      .resize(inner, inner, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 3,
        background: { r: 76, g: 175, b: 109 },
      },
    })
      .composite([{ input: tile, left: pad, top: pad }])
      .png()
      .toFile(outPath);
    return;
  }

  await sharp(src)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png()
    .toFile(outPath);
}

/** Browser favicon from brand mark — transparent, no added background. */
async function writeBrowserFaviconFromMark() {
  const mark = path.join(root, "public", "bidvera-mark.png");
  if (!fs.existsSync(mark)) {
    console.warn("public/bidvera-mark.png missing — skipped browser favicon restore");
    return;
  }
  const appDir = path.join(root, "src", "app");
  fs.mkdirSync(appDir, { recursive: true });

  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

  await sharp(mark)
    .resize(32, 32, { fit: "contain", background: transparent })
    .png()
    .toFile(path.join(root, "public", "favicon.png"));

  // Next.js file convention → browser tab favicon (keeps alpha)
  await sharp(mark)
    .resize(64, 64, { fit: "contain", background: transparent })
    .png()
    .toFile(path.join(appDir, "icon.png"));
}

async function main() {
  const src = resolveSource();
  const iconsDir = path.join(root, "public", "icons");
  const appDir = path.join(root, "src", "app");
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.mkdirSync(appDir, { recursive: true });

  const stableSource = path.join(root, "public", "pwa-icon-source.jpg");
  if (path.resolve(src) !== path.resolve(stableSource)) {
    await sharp(src).jpeg({ quality: 95 }).toFile(stableSource);
  }

  // Install-only assets (web app manifest / home screen / taskbar)
  await writeSquare(src, 192, path.join(iconsDir, "icon-192.png"));
  await writeSquare(src, 512, path.join(iconsDir, "icon-512.png"));
  await writeSquare(src, 180, path.join(iconsDir, "apple-touch-icon.png"));
  await writeSquare(src, 192, path.join(iconsDir, "icon-maskable-192.png"), {
    maskable: true,
  });
  await writeSquare(src, 512, path.join(iconsDir, "icon-maskable-512.png"), {
    maskable: true,
  });
  // iOS “Add to Home Screen” uses apple-touch-icon → install tile
  await writeSquare(src, 180, path.join(appDir, "apple-icon.png"));

  // Browser tab stays brand mark
  await writeBrowserFaviconFromMark();

  console.log(`PWA install icons ← ${path.relative(root, src)}`);
  console.log("Browser tab favicon ← public/bidvera-mark.png");
  console.log("To change install icon: replace public/pwa-icon-source.jpg → npm run icons:pwa");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
