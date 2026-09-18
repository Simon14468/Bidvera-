import { EMAIL_CHANGE } from "@/config/server";
import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";

export type RateLimitConsumeResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export function isUnsafeProductionMemoryRateLimit(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const forced = env.RATE_LIMIT_BACKEND?.trim().toLowerCase();
  return env.NODE_ENV === "production" && forced === "memory";
}

function prefersMemoryRateLimitBackend(): boolean {
  if (isUnsafeProductionMemoryRateLimit()) {
    throw new AppError(
      ErrorCode.INTERNAL,
      "RATE_LIMIT_BACKEND=memory is not allowed in production. Use durable.",
      503,
    );
  }
  const forced = process.env.RATE_LIMIT_BACKEND?.trim().toLowerCase();
  if (forced === "memory") return true;
  if (forced === "durable" || forced === "db") return false;
  // Unit tests without a live DB — memory is explicit and isolated.
  if (process.env.NODE_ENV === "test") return true;
  // Local single-instance Next.js — avoid blocking auth on DB/quota outages.
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Rate limiter with durable (DB) backend for multi-instance production.
 * Memory backend when RATE_LIMIT_BACKEND=memory, NODE_ENV=test, or development.
 * Production: fail-closed when durable backend is unavailable.
 * Development: fall back to in-process memory so login is not blocked by DB quota/outages.
 */
export class RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  async check(key: string): Promise<void> {
    const status = await this.consume(key);
    if (!status.ok) {
      throw new AppError(ErrorCode.RATE_LIMITED, "Too many requests. Try again later.", 429);
    }
  }

  /** Consume one unit; returns whether allowed and how many remain in the window. */
  async consume(key: string): Promise<RateLimitConsumeResult> {
    if (prefersMemoryRateLimitBackend()) {
      return this.consumeMemory(key);
    }
    try {
      return await this.consumeDurable(key);
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (!isProductionRuntime()) {
        return this.consumeMemory(key);
      }
      throw new AppError(
        ErrorCode.RATE_LIMITED,
        "Rate limit service unavailable. Try again later.",
        503,
      );
    }
  }

  async peek(key: string): Promise<{ remaining: number; resetAt: number }> {
    if (prefersMemoryRateLimitBackend()) {
      const now = Date.now();
      const entry = this.buckets.get(key);
      if (!entry || entry.resetAt <= now) {
        return { remaining: this.limit, resetAt: now + this.windowMs };
      }
      return {
        remaining: Math.max(0, this.limit - entry.count),
        resetAt: entry.resetAt,
      };
    }
    try {
      const row = await prisma.rateLimitBucket.findUnique({ where: { key } });
      const now = Date.now();
      if (!row || row.resetAt.getTime() <= now) {
        return { remaining: this.limit, resetAt: now + this.windowMs };
      }
      return {
        remaining: Math.max(0, this.limit - row.count),
        resetAt: row.resetAt.getTime(),
      };
    } catch {
      if (!isProductionRuntime()) {
        const now = Date.now();
        return { remaining: this.limit, resetAt: now + this.windowMs };
      }
      throw new AppError(
        ErrorCode.RATE_LIMITED,
        "Rate limit service unavailable. Try again later.",
        503,
      );
    }
  }

  /** Test helper — clear memory buckets between cases. */
  resetMemoryForTests(): void {
    this.buckets.clear();
  }

  private consumeMemory(key: string): RateLimitConsumeResult {
    const now = Date.now();
    const entry = this.buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { ok: true, remaining: this.limit - 1, resetAt };
    }
    if (entry.count >= this.limit) {
      return { ok: false, remaining: 0, resetAt: entry.resetAt };
    }
    entry.count += 1;
    return {
      ok: true,
      remaining: this.limit - entry.count,
      resetAt: entry.resetAt,
    };
  }

  private async consumeDurable(key: string): Promise<RateLimitConsumeResult> {
    const now = new Date();
    const nextReset = new Date(now.getTime() + this.windowMs);

    // Conditional increment while under limit and window still open
    const bumped = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      UPDATE "RateLimitBucket"
      SET "count" = "count" + 1, "updatedAt" = ${now}
      WHERE "key" = ${key}
        AND "resetAt" > ${now}
        AND "count" < ${this.limit}
      RETURNING "count", "resetAt"
    `;
    if (bumped.length > 0) {
      const row = bumped[0]!;
      return {
        ok: true,
        remaining: Math.max(0, this.limit - Number(row.count)),
        resetAt: new Date(row.resetAt).getTime(),
      };
    }

    const existing = await prisma.rateLimitBucket.findUnique({ where: { key } });
    if (existing && existing.resetAt > now && existing.count >= this.limit) {
      return {
        ok: false,
        remaining: 0,
        resetAt: existing.resetAt.getTime(),
      };
    }

    // Missing row or expired window — start a new window at count=1
    const row = await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, resetAt: nextReset },
      update: { count: 1, resetAt: nextReset },
    });
    return {
      ok: true,
      remaining: this.limit - 1,
      resetAt: row.resetAt.getTime(),
    };
  }
}

export const authRateLimiter = new RateLimiter(30, 60 * 60 * 1000);
export const uploadRateLimiter = new RateLimiter(20, 60 * 60 * 1000);
export const analysisRateLimiter = new RateLimiter(10, 60 * 60 * 1000);
/** Stricter bucket for email verify / resend / password reset */
export const authSensitiveRateLimiter = new RateLimiter(10, 60 * 60 * 1000);
/** Voice assistant ask + TTS (coarse IP) */
export const assistantRateLimiter = new RateLimiter(40, 60 * 60 * 1000);
/** Assistant image asks: 1 image / 4 hours per authenticated principal. */
export const assistantImageRateLimiter = new RateLimiter(1, 4 * 60 * 60 * 1000);
/** Assistant text/image asks: 10 replies / 4 hours per authenticated principal. */
export const assistantReplyRateLimiter = new RateLimiter(10, 4 * 60 * 60 * 1000);
/** Assistant TTS plays: 10 / 4 hours per authenticated principal. */
export const assistantTtsRateLimiter = new RateLimiter(10, 4 * 60 * 60 * 1000);
/** Checkout / trial session creation — coarse company + user buckets. */
export const checkoutRateLimiter = new RateLimiter(8, 60 * 60 * 1000);
/** Billing webhooks — coarse IP cap so retries still succeed. */
export const webhookRateLimiter = new RateLimiter(120, 60 * 1000);

/** Email-change initiate / resend — per authenticated user. */
export const emailChangeUserRateLimiter = new RateLimiter(
  EMAIL_CHANGE.maxRequestsPerUserPerHour,
  60 * 60 * 1000,
);
/** Email-change initiate / resend — coarse IP. */
export const emailChangeIpRateLimiter = new RateLimiter(
  EMAIL_CHANGE.maxRequestsPerIpPerHour,
  60 * 60 * 1000,
);
/** Email-change confirmation attempts — coarse IP. */
export const emailChangeConfirmRateLimiter = new RateLimiter(
  EMAIL_CHANGE.maxConfirmPerIpPerHour,
  60 * 60 * 1000,
);
