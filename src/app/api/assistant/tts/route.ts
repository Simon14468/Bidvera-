import { resolveAuthContext } from "@/auth/session";
import { AppError, ErrorCode, toSafeClientError } from "@/lib/errors";
import {
  assistantRateLimiter,
  assistantTtsRateLimiter,
} from "@/lib/rate-limit";
import { synthesizeSpeech } from "@/services/tts/elevenlabs";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  text: z.string().min(1).max(2500),
  language: z.enum(["en", "es", "zh", "ar", "fr"]).optional(),
  /** Stable browser id from localStorage (not a secret). */
  clientId: z.string().min(8).max(80).optional().nullable(),
});

/**
 * Authenticated TTS only — durable per-user quotas (no anonymous AI-cost exposure).
 */
export async function POST(request: Request) {
  try {
    const auth = await resolveAuthContext();
    if (!auth?.user?.id) {
      throw new AppError(
        ErrorCode.UNAUTHENTICATED,
        "Sign in to use Bidvera voice replies.",
        401,
      );
    }

    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
    await assistantRateLimiter.check(`assistant-tts:${auth.user.id}:${ip}`);

    const json = await request.json().catch(() => null);
    const data = bodySchema.parse(json);

    const ttsKey = `assistant-tts-quota:user:${auth.user.id}`;
    const ttsStatus = await assistantTtsRateLimiter.consume(ttsKey);
    if (!ttsStatus.ok) {
      throw new AppError(
        ErrorCode.RATE_LIMITED,
        "Voice limit reached (10 plays / 4 hours). Try again later.",
        429,
      );
    }

    const { audio, contentType } = await synthesizeSpeech({
      text: data.text,
      language: data.language,
    });

    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-TTS-Remaining": String(ttsStatus.remaining),
      },
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
            message: "Invalid text.",
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
