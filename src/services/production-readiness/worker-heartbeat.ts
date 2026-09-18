/**
 * Worker liveness signal for production readiness checks.
 * Updated by the worker process; never stores secrets.
 */
import { prisma } from "@/lib/db";

export const WORKER_HEARTBEAT_KEY = "ops.worker.heartbeat";

/** Consider worker READY if heartbeat is newer than this. */
export const WORKER_HEARTBEAT_STALE_MS = 2 * 60 * 1000;

export type WorkerHeartbeatValue = {
  at: string;
  pid: number | null;
};

let lastTouchMs = 0;
const TOUCH_MIN_INTERVAL_MS = 20_000;

export async function touchWorkerHeartbeat(now = Date.now()): Promise<void> {
  if (now - lastTouchMs < TOUCH_MIN_INTERVAL_MS) return;
  lastTouchMs = now;
  const value: WorkerHeartbeatValue = {
    at: new Date(now).toISOString(),
    pid: typeof process.pid === "number" ? process.pid : null,
  };
  await prisma.systemSetting.upsert({
    where: { key: WORKER_HEARTBEAT_KEY },
    create: {
      key: WORKER_HEARTBEAT_KEY,
      value: value as object,
      description: "Worker process heartbeat (ops)",
    },
    update: { value: value as object },
  });
}

export async function readWorkerHeartbeat(): Promise<{
  at: Date | null;
  ageMs: number | null;
  stale: boolean;
}> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: WORKER_HEARTBEAT_KEY },
  });
  const raw = row?.value as WorkerHeartbeatValue | null | undefined;
  const atIso = raw && typeof raw.at === "string" ? raw.at : null;
  if (!atIso) {
    return { at: null, ageMs: null, stale: true };
  }
  const at = new Date(atIso);
  if (Number.isNaN(at.getTime())) {
    return { at: null, ageMs: null, stale: true };
  }
  const ageMs = Date.now() - at.getTime();
  return { at, ageMs, stale: ageMs > WORKER_HEARTBEAT_STALE_MS };
}

/** Test helper */
export function resetWorkerHeartbeatThrottleForTests() {
  lastTouchMs = 0;
}
