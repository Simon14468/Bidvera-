import { prisma } from "@/lib/db";
import {
  assertSafeLandingAssetUrl,
  landingVideoUpdateSchema,
  testimonialReorderSchema,
  testimonialUpsertSchema,
} from "@/domain/schemas/landing";
import { assertLandingUploadAllowed } from "@/domain/security/landing-upload-sniff";
import { AppError, ErrorCode } from "@/lib/errors";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const LANDING_PUBLIC_DIR = path.join(process.cwd(), "public", "uploads", "landing");

async function ensureLandingDir() {
  await mkdir(LANDING_PUBLIC_DIR, { recursive: true });
}

export function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtube-nocookie.com")) {
      const fromQuery = u.searchParams.get("v");
      if (fromQuery) return fromQuery;
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1]!;
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1]!;
      const liveIdx = parts.indexOf("live");
      if (liveIdx >= 0 && parts[liveIdx + 1]) return parts[liveIdx + 1]!;
    }
  } catch {
    return null;
  }
  return null;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

let migratedDefaultKey = false;

/** One-time: rename legacy `default` row to `en`. */
async function ensureDefaultMigratedToEn() {
  if (migratedDefaultKey) return;
  const legacy = await prisma.landingVideo.findUnique({ where: { key: "default" } });
  if (legacy) {
    const en = await prisma.landingVideo.findUnique({ where: { key: "en" } });
    if (!en) {
      await prisma.landingVideo.update({
        where: { id: legacy.id },
        data: { key: "en" },
      });
    } else {
      await prisma.landingVideo.delete({ where: { id: legacy.id } });
    }
  }
  migratedDefaultKey = true;
}

export async function getOrCreateLandingVideo(locale: Locale = defaultLocale) {
  await ensureDefaultMigratedToEn();
  const existing = await prisma.landingVideo.findUnique({ where: { key: locale } });
  if (existing) return existing;

  const fallback =
    locale !== defaultLocale
      ? await prisma.landingVideo.findUnique({ where: { key: defaultLocale } })
      : null;

  return prisma.landingVideo.create({
    data: {
      key: locale,
      enabled: false,
      title: fallback?.title ?? "See Bidvera in Action",
      description:
        fallback?.description ??
        "Watch how Bidvera turns a long tender pack into a clear BID, REVIEW, or NO-BID decision.",
    },
  });
}

export async function listLandingVideosForAdmin() {
  await ensureDefaultMigratedToEn();
  const rows = await Promise.all(locales.map((locale) => getOrCreateLandingVideo(locale)));
  return Object.fromEntries(locales.map((locale, i) => [locale, rows[i]!])) as Record<
    Locale,
    (typeof rows)[number]
  >;
}

function toPublicVideo(video: Awaited<ReturnType<typeof getOrCreateLandingVideo>>) {
  const hasSource = Boolean(video.youtubeUrl?.trim() || video.videoUrl?.trim());
  if (!video.enabled || !hasSource) return null;
  return {
    ...video,
    youtubeId: extractYoutubeId(video.youtubeUrl),
  };
}

/** Prefer current locale video; fall back to English if missing. */
export async function getPublicLandingVideo(locale: Locale = defaultLocale) {
  const primary = toPublicVideo(await getOrCreateLandingVideo(locale));
  if (primary) return primary;
  if (locale !== defaultLocale) {
    return toPublicVideo(await getOrCreateLandingVideo(defaultLocale));
  }
  return null;
}

export async function updateLandingVideoForAdmin(raw: unknown) {
  const data = landingVideoUpdateSchema.parse(raw);
  if (data.youtubeUrl && !extractYoutubeId(data.youtubeUrl)) {
    throw new AppError(ErrorCode.VALIDATION, "Enter a valid YouTube URL.", 400);
  }
  const current = await getOrCreateLandingVideo(data.locale);
  const nextVideoUrl = assertSafeLandingAssetUrl(
    data.clearVideo ? null : (data.videoUrl ?? current.videoUrl),
  );
  const nextPosterUrl = assertSafeLandingAssetUrl(
    data.clearPoster ? null : (data.posterUrl ?? current.posterUrl),
  );
  const nextYoutube = data.youtubeUrl;
  const hasSource = Boolean(nextVideoUrl || nextYoutube);

  return prisma.landingVideo.update({
    where: { id: current.id },
    data: {
      enabled: hasSource ? data.enabled : false,
      title: data.title,
      description: data.description ?? null,
      youtubeUrl: nextYoutube,
      videoUrl: nextVideoUrl,
      posterUrl: nextPosterUrl,
    },
  });
}

export async function saveLandingUpload(input: {
  kind: "video" | "poster" | "avatar";
  fileName: string;
  mimeType: string;
  body: Buffer;
}): Promise<string> {
  await ensureLandingDir();

  // Size limits first (DoS) — content type is sniffed, never trusted from client.
  if (input.kind === "video") {
    if (input.body.byteLength > 80 * 1024 * 1024) {
      throw new AppError(ErrorCode.VALIDATION, "Video must be under 80MB.", 400);
    }
  } else if (input.body.byteLength > 5 * 1024 * 1024) {
    throw new AppError(ErrorCode.VALIDATION, "Image must be under 5MB.", 400);
  }

  const sniffed = assertLandingUploadAllowed(input.kind, input.body);
  if (sniffed.kind === "rejected" || sniffed.kind === "unknown" || !sniffed.ext) {
    throw new AppError(
      ErrorCode.VALIDATION,
      input.kind === "video"
        ? "Upload a real MP4, WebM, or MOV video (content must match)."
        : "Upload a real JPG, PNG, WebP, or GIF image (SVG/HTML rejected).",
      400,
    );
  }

  // Ignore client filename/MIME — generate opaque name + sniffed extension only.
  const safe = `${input.kind}-${Date.now()}-${randomBytes(8).toString("hex")}${sniffed.ext}`;
  const resolvedDir = path.resolve(LANDING_PUBLIC_DIR);
  const full = path.resolve(resolvedDir, safe);
  if (!full.startsWith(resolvedDir + path.sep)) {
    throw new AppError(ErrorCode.VALIDATION, "Invalid upload path.", 400);
  }
  await writeFile(full, input.body);
  return `/uploads/landing/${safe}`;
}

export async function deletePublicLandingFile(publicUrl: string | null | undefined) {
  if (!publicUrl?.startsWith("/uploads/landing/")) return;
  const name = path.basename(publicUrl.replace("/uploads/landing/", ""));
  if (!name || name !== publicUrl.replace("/uploads/landing/", "") || name.includes("..")) {
    return;
  }
  await unlink(path.join(LANDING_PUBLIC_DIR, name)).catch(() => undefined);
}

export async function listTestimonialsForAdmin() {
  return prisma.testimonial.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
}

export async function listPublicTestimonials() {
  return prisma.testimonial.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function upsertTestimonialForAdmin(raw: unknown) {
  const data = testimonialUpsertSchema.parse(raw);
  const avatarUrl = assertSafeLandingAssetUrl(data.avatarUrl ?? null);
  if (data.id) {
    const exists = await prisma.testimonial.findUnique({ where: { id: data.id } });
    if (!exists) throw new AppError(ErrorCode.NOT_FOUND, "Testimonial not found.", 404);
    return prisma.testimonial.update({
      where: { id: data.id },
      data: {
        customerName: data.customerName,
        companyName: data.companyName,
        jobTitle: data.jobTitle ?? null,
        quote: data.quote,
        rating: data.rating,
        avatarUrl,
        verified: data.verified,
        enabled: data.enabled,
        sortOrder: data.sortOrder,
      },
    });
  }
  return prisma.testimonial.create({
    data: {
      customerName: data.customerName,
      companyName: data.companyName,
      jobTitle: data.jobTitle ?? null,
      quote: data.quote,
      rating: data.rating,
      avatarUrl,
      verified: data.verified,
      enabled: data.enabled,
      sortOrder: data.sortOrder,
    },
  });
}

export async function deleteTestimonialForAdmin(id: string) {
  const t = await prisma.testimonial.findUnique({ where: { id } });
  if (!t) throw new AppError(ErrorCode.NOT_FOUND, "Testimonial not found.", 404);
  await deletePublicLandingFile(t.avatarUrl);
  await prisma.testimonial.delete({ where: { id } });
}

export async function setTestimonialEnabled(id: string, enabled: boolean) {
  return prisma.testimonial.update({ where: { id }, data: { enabled } });
}

export async function reorderTestimonialsForAdmin(raw: unknown) {
  const { orderedIds } = testimonialReorderSchema.parse(raw);
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.testimonial.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  return listTestimonialsForAdmin();
}
