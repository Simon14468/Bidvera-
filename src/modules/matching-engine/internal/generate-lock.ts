/**
 * Per-company generate lock — reduces same-process / sequential regenerate races.
 * Best-effort via SystemSetting TTL; expired locks are stealable.
 *
 * Remaining limitation (documented, not rewritten):
 * Multi-instance deploys behind Neon/PgBouncer cannot safely share session
 * advisory locks. Two app instances can still race the check-then-set window
 * under high concurrency. Acceptable for current Matching Engine scale; if
 * dual-generate corruption appears in production, move to a Postgres
 * row-level lock / `SKIP LOCKED` job queue — not a SystemSetting TTL rewrite.
 */

import { AppError, ErrorCode } from "@/lib/errors";
import { getSetting, setSetting } from "@/services/settings";
import { prisma } from "@/lib/db";

const LOCK_TTL_MS = 120_000;

type GenerateLockValue = {
  token: string;
  until: number;
};

function lockKey(companyId: string) {
  return `matching.generate.lock:${companyId}`;
}

export async function withMatchingGenerateLock<T>(
  companyId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = lockKey(companyId);
  const token = crypto.randomUUID();
  const now = Date.now();
  const existing = await getSetting<GenerateLockValue | null>(key, null);
  if (
    existing &&
    typeof existing.until === "number" &&
    existing.until > now &&
    existing.token !== token
  ) {
    throw new AppError(
      ErrorCode.CONFLICT,
      "Matching generation already in progress for this company.",
      409,
    );
  }

  await setSetting(key, { token, until: now + LOCK_TTL_MS } satisfies GenerateLockValue);

  try {
    return await fn();
  } finally {
    const cur = await getSetting<GenerateLockValue | null>(key, null);
    if (cur?.token === token) {
      await prisma.systemSetting.deleteMany({ where: { key } }).catch(() => {
        /* best-effort unlock */
      });
    }
  }
}
