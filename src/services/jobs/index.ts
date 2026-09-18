import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { DecisionGuardianError } from "@/domain/decision-validation";
import { logError, logInfo } from "@/services/observability";
import { AI_REQUEST_TIMEOUT_MS } from "@/config/ai-timeout";
import type { JobType, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * Deterministic analysis failures must not reopen ANALYZING via job retries.
 * Guardian / validation outcomes are terminal — retry cannot invent a timezone.
 */
export function isNonRetryableAnalysisError(error: unknown): boolean {
  if (error instanceof DecisionGuardianError) return true;
  if (error instanceof AppError) {
    return (
      error.code === ErrorCode.VALIDATION ||
      error.code === ErrorCode.FORBIDDEN ||
      error.code === ErrorCode.NOT_FOUND ||
      error.code === ErrorCode.CONFLICT
    );
  }
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return (
    msg.startsWith("Decision Guardian blocked release:") ||
    msg.includes("Canonical snapshot invariant") ||
    msg.includes("Conditional obligation lost trigger context:")
  );
}

export async function enqueueJob(input: {
  companyId?: string | null;
  tenderId?: string | null;
  type: JobType;
  payload: Prisma.InputJsonValue;
  idempotencyKey?: string;
  availableAt?: Date;
  maxAttempts?: number;
}) {
  if (input.idempotencyKey) {
    const existing = await prisma.job.findUnique({
      where: {
        type_idempotencyKey: {
          type: input.type,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return existing;
  }

  return prisma.job.create({
    data: {
      companyId: input.companyId ?? null,
      tenderId: input.tenderId ?? null,
      type: input.type,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      availableAt: input.availableAt ?? new Date(),
      maxAttempts: input.maxAttempts ?? 5,
    },
  });
}

/**
 * DB-backed queue — swappable for Redis/SQS later without rewriting callers.
 * Uses SKIP LOCKED semantics via conditional claim.
 */
export async function claimNextJob(workerId = randomUUID()) {
  const candidates = await prisma.job.findMany({
    where: {
      status: "PENDING",
      availableAt: { lte: new Date() },
    },
    orderBy: { createdAt: "asc" },
    take: 5,
  });

  for (const job of candidates) {
    const claimed = await prisma.job.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: {
        status: "RUNNING",
        lockedAt: new Date(),
        lockedBy: workerId,
        attempts: { increment: 1 },
      },
    });
    if (claimed.count === 1) {
      return prisma.job.findUnique({ where: { id: job.id } });
    }
  }
  return null;
}

export async function completeJob(jobId: string) {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
}

export async function failJob(jobId: string, error: unknown) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  const message = error instanceof Error ? error.message : "Unknown job error";
  const attempts = job.attempts;
  const nonRetryable = isNonRetryableAnalysisError(error);
  const dead = nonRetryable || attempts >= job.maxAttempts;

  const delayMs = Math.min(60_000, 2 ** Math.min(attempts, 6) * 1000);
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: dead ? "DEAD" : "PENDING",
      lastError: message.slice(0, 1000),
      lockedAt: null,
      lockedBy: null,
      availableAt: dead ? job.availableAt : new Date(Date.now() + delayMs),
    },
  });

  logError("job.failed", {
    jobId,
    type: job.type,
    attempts,
    dead,
    nonRetryable,
    message,
  });
}

export async function processJobsOnce(handlers: {
  [K in JobType]?: (job: {
    id: string;
    companyId: string | null;
    tenderId: string | null;
    payload: Prisma.JsonValue;
  }) => Promise<void>;
}) {
  const job = await claimNextJob();
  if (!job) return false;

  logInfo("job.started", { jobId: job.id, type: job.type });
  try {
    const handler = handlers[job.type];
    if (!handler) throw new Error(`No handler for job type ${job.type}`);
    await handler({
      id: job.id,
      companyId: job.companyId,
      tenderId: job.tenderId,
      payload: job.payload,
    });
    await completeJob(job.id);
    logInfo("job.completed", { jobId: job.id, type: job.type });
  } catch (error) {
    await failJob(job.id, error);
  }
  return true;
}

/** Abandoned RUNNING locks (crashed after() / serverless abort).
 * Must exceed worst-case analysis (OCR + AI). 12s caused concurrent re-entrancy. */
const STALE_LOCK_MS = Math.max(AI_REQUEST_TIMEOUT_MS + 60_000, 600_000);

/** Release jobs stuck in RUNNING (e.g. crashed after() / aborted request). */
export async function releaseStaleJobLocks(olderThanMs = STALE_LOCK_MS) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await prisma.job.updateMany({
    where: {
      status: "RUNNING",
      lockedAt: { lt: cutoff },
    },
    data: {
      status: "PENDING",
      lockedAt: null,
      lockedBy: null,
      availableAt: new Date(),
      lastError: "Stale lock released — retrying.",
    },
  });
  if (result.count > 0) {
    logInfo("job.stale_locks_released", { count: result.count });
  }
  return result.count;
}

/**
 * Ensure a tender's analysis job is claimed and executed.
 * Safe to call from poll — dedupe concurrent kicks with in-process set.
 */
const tenderKickInFlight = new Set<string>();

export async function kickTenderAnalysisJob(
  tenderId: string,
  run: (tenderId: string) => Promise<void>,
): Promise<"started" | "already_running" | "none" | "done"> {
  if (tenderKickInFlight.has(tenderId)) return "already_running";
  tenderKickInFlight.add(tenderId);

  try {
    await releaseStaleJobLocks();

    const job = await prisma.job.findFirst({
      where: {
        tenderId,
        type: { in: ["RUN_TENDER_ANALYSIS", "PROCESS_TENDER_DOCUMENT"] },
        status: { in: ["PENDING", "RUNNING"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!job) {
      const tender = await prisma.tender.findUnique({
        where: { id: tenderId },
        select: { analysisStatus: true },
      });
      if (
        tender?.analysisStatus === "COMPLETED" ||
        tender?.analysisStatus === "FAILED"
      ) {
        return "done";
      }
      return "none";
    }

    // Terminal tender must not be reopened by orphan PENDING retry jobs
    // (e.g. Guardian block previously left the job PENDING).
    {
      const tender = await prisma.tender.findUnique({
        where: { id: tenderId },
        select: { analysisStatus: true, analysisError: true },
      });
      if (
        tender?.analysisStatus === "FAILED" ||
        tender?.analysisStatus === "COMPLETED"
      ) {
        const terminalFailed = tender.analysisStatus === "FAILED";
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: terminalFailed ? "DEAD" : "COMPLETED",
            completedAt: terminalFailed ? null : new Date(),
            lockedAt: null,
            lockedBy: null,
            lastError: terminalFailed
              ? (job.lastError ??
                tender.analysisError ??
                "Terminal FAILED — job retired without retry")
              : null,
          },
        });
        logInfo("job.terminal_retired", {
          jobId: job.id,
          tenderId,
          analysisStatus: tender.analysisStatus,
        });
        return "done";
      }
    }

    const staleCutoff = new Date(Date.now() - STALE_LOCK_MS);
    const claimed = await prisma.job.updateMany({
      where: {
        id: job.id,
        OR: [
          { status: "PENDING" },
          { status: "RUNNING", lockedAt: { lt: staleCutoff } },
          { status: "RUNNING", lockedAt: null },
        ],
      },
      data: {
        status: "RUNNING",
        lockedAt: new Date(),
        lockedBy: `kick:${tenderId}`,
        attempts: { increment: 1 },
      },
    });
    if (claimed.count !== 1) return "already_running";

    logInfo("job.started", { jobId: job.id, type: job.type, kick: true });
    await run(tenderId);
    await completeJob(job.id);
    logInfo("job.completed", { jobId: job.id, type: job.type, kick: true });
    return "started";
  } catch (error) {
    const job = await prisma.job.findFirst({
      where: {
        tenderId,
        type: { in: ["RUN_TENDER_ANALYSIS", "PROCESS_TENDER_DOCUMENT"] },
        status: "RUNNING",
        lockedBy: `kick:${tenderId}`,
      },
      orderBy: { createdAt: "desc" },
    });
    if (job) await failJob(job.id, error);
    throw error;
  } finally {
    tenderKickInFlight.delete(tenderId);
  }
}
