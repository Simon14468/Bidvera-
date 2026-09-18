import { z } from "zod";
import { locales } from "@/i18n/config";
import { AppError, ErrorCode } from "@/lib/errors";

export const landingLocaleSchema = z.enum(locales);

/**
 * Landing asset URLs must be our generated upload paths only
 * (no javascript:/data:/external HTML hosts for stored XSS).
 */
export function assertSafeLandingAssetUrl(
  url: string | null | undefined,
): string | null {
  if (url == null) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("/uploads/landing/")) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Landing asset URL must be a Bidvera landing upload path.",
      400,
    );
  }
  const name = trimmed.slice("/uploads/landing/".length);
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    throw new AppError(ErrorCode.VALIDATION, "Invalid landing asset path.", 400);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new AppError(ErrorCode.VALIDATION, "Invalid landing asset filename.", 400);
  }
  // Block dangerous extensions even if somehow referenced.
  if (/\.(svg|html?|js|mjs|css|xml|php|exe|sh|bat)$/i.test(name)) {
    throw new AppError(ErrorCode.VALIDATION, "Landing asset type is not allowed.", 400);
  }
  return `/uploads/landing/${name}`;
}

const landingAssetUrlSchema = z
  .string()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v?.trim() ? v.trim() : null))
  .superRefine((val, ctx) => {
    if (val == null) return;
    try {
      assertSafeLandingAssetUrl(val);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          error instanceof AppError
            ? error.message
            : "Invalid landing asset URL.",
      });
    }
  });

export const landingVideoUpdateSchema = z.object({
  locale: landingLocaleSchema,
  enabled: z.boolean(),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  youtubeUrl: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  videoUrl: landingAssetUrlSchema,
  posterUrl: landingAssetUrlSchema,
  clearVideo: z.boolean().optional(),
  clearPoster: z.boolean().optional(),
});

export const testimonialUpsertSchema = z.object({
  id: z.string().cuid().optional(),
  customerName: z.string().min(1).max(120),
  companyName: z.string().min(1).max(120),
  jobTitle: z.string().max(120).optional().nullable(),
  quote: z.string().min(10).max(800),
  rating: z.number().int().min(1).max(5).default(5),
  avatarUrl: landingAssetUrlSchema,
  verified: z.boolean().default(false),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export const testimonialReorderSchema = z.object({
  orderedIds: z.array(z.string().cuid()).min(1),
});
