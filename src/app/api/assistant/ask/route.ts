import { resolveAuthContext } from "@/auth/session";
import { AppError, ErrorCode, toSafeClientError } from "@/lib/errors";
import {
  assistantImageRateLimiter,
  assistantRateLimiter,
  assistantReplyRateLimiter,
} from "@/lib/rate-limit";
import { askBidveraAssistant } from "@/services/ai/assistant";
import { parseImageDataUrl } from "@/services/ai/providers";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z
  .object({
    question: z.string().max(2000).optional().default(""),
    locale: z.string().max(12).optional(),
    /** Exactly one image as a data URL — optional. */
    imageDataUrl: z.string().max(5_500_000).optional().nullable(),
    /** Stable browser id from localStorage (not a secret). */
    clientId: z.string().min(8).max(80).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    const q = val.question.trim();
    const image = parseImageDataUrl(val.imageDataUrl ?? null);
    if (!image && q.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a question or attach one image.",
        path: ["question"],
      });
    }
    if (val.imageDataUrl && !image) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid image. Use one JPEG, PNG, WebP, or GIF under ~4MB.",
        path: ["imageDataUrl"],
      });
    }
  });

function sanitizeClientId(raw: string | null | undefined): string {
  if (!raw) return "anon";
  return raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anon";
}

export async function POST(request: Request) {
  try {
    const auth = await resolveAuthContext();
    if (!auth?.user?.id) {
      throw new AppError(
        ErrorCode.UNAUTHENTICATED,
        "Sign in to use Bidvera Assistant.",
        401,
      );
    }

    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
    await assistantRateLimiter.check(`assistant-ask:${auth.user.id}:${ip}`);

    const json = await request.json().catch(() => null);
    const data = bodySchema.parse(json);
    const image = parseImageDataUrl(data.imageDataUrl ?? null);
    const clientId = sanitizeClientId(data.clientId);

    // Durable quotas keyed by authenticated user (not spoofable guest id alone).
    const replyKey = `assistant-reply:user:${auth.user.id}`;
    const replyStatus = await assistantReplyRateLimiter.consume(replyKey);
    if (!replyStatus.ok) {
      throw new AppError(
        ErrorCode.RATE_LIMITED,
        "Reply limit reached (10 replies / 4 hours). Try again later.",
        429,
      );
    }

    let imageQuota: { remaining: number; resetAt: number } | null = null;
    if (image) {
      const key = `assistant-image:user:${auth.user.id}`;
      const status = await assistantImageRateLimiter.consume(key);
      if (!status.ok) {
        throw new AppError(
          ErrorCode.RATE_LIMITED,
          "Image limit reached (1 image / 4 hours). Try again later.",
          429,
        );
      }
      imageQuota = { remaining: status.remaining, resetAt: status.resetAt };
    }

    const { answer, answerLocale } = await askBidveraAssistant({
      question: data.question,
      companyId: auth.user.companyId ?? null,
      locale: data.locale,
      imageDataUrl: data.imageDataUrl,
    });

    return NextResponse.json({
      ok: true,
      answer,
      answerLocale,
      imageQuota,
      replyQuota: {
        remaining: replyStatus.remaining,
        resetAt: replyStatus.resetAt,
      },
      clientId,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { ok: false, error: toSafeClientError(error) },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION,
            message: error.issues[0]?.message ?? "Invalid question.",
            status: 400,
          },
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: ErrorCode.INTERNAL,
          message: "Something went wrong.",
          status: 500,
        },
      },
      { status: 500 },
    );
  }
}
