import type { UploadPhase } from "@/domain/types";

export const POLL_INTERVAL_MS = 800;
export const POLL_SLOW_INTERVAL_MS = 3_000;
export const SOFT_WAIT_MS = 90_000;
export const MAX_WAIT_MS = 10 * 60_000;
export const MAX_POLL_ERRORS = 5;

export type PollStatusPayload = {
  status: string;
  progress: number;
  phase?: string | null;
  message?: string;
};

export type PollStepResult =
  | { kind: "continue"; progress: number; phase: UploadPhase }
  | { kind: "success" }
  | { kind: "failed"; message: string }
  | { kind: "still_processing" }
  | { kind: "poll_error"; message: string; exhausted: boolean };

export function computeWaitBudget(fileSizeBytes: number): number {
  const sizeBonusMs = Math.min(
    5 * 60_000,
    Math.floor(fileSizeBytes / (500 * 1024)) * 15_000,
  );
  return Math.min(MAX_WAIT_MS, SOFT_WAIT_MS + 3 * 60_000 + sizeBonusMs);
}

export function nextPollIntervalMs(phase: UploadPhase): number {
  return phase === "still_processing" ? POLL_SLOW_INTERVAL_MS : POLL_INTERVAL_MS;
}

/**
 * Pure poll step — drives upload UI state without silent failure or infinite spin.
 */
export function evaluatePollStep(input: {
  elapsedMs: number;
  waitBudgetMs: number;
  pollOk: boolean;
  pollErrorMessage?: string;
  consecutivePollErrors: number;
  data?: PollStatusPayload;
}): PollStepResult {
  if (input.pollOk && input.data?.status === "COMPLETED") {
    return { kind: "success" };
  }
  if (input.pollOk && input.data?.status === "FAILED") {
    return {
      kind: "failed",
      message: input.data.message ?? "Analysis failed",
    };
  }

  if (!input.pollOk) {
    const exhausted = input.consecutivePollErrors + 1 >= MAX_POLL_ERRORS;
    return {
      kind: "poll_error",
      message: input.pollErrorMessage ?? "Unable to check analysis status",
      exhausted,
    };
  }

  const progress = Math.max(25, input.data?.progress ?? 0);
  let phase: UploadPhase = "processing";
  if (input.data?.status === "ANALYZING" || progress >= 60) {
    phase = "analyzing";
  } else if (input.data?.status === "EXTRACTING") {
    phase = "extracting";
  } else if (
    input.data?.status === "PROCESSING" ||
    input.data?.status === "UPLOADING"
  ) {
    phase = "preparing";
  }

  if (input.elapsedMs > input.waitBudgetMs) {
    return { kind: "still_processing" };
  }

  if (input.elapsedMs > SOFT_WAIT_MS) {
    return { kind: "continue", progress, phase };
  }

  return { kind: "continue", progress, phase };
}
