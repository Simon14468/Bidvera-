/**
 * Pure helpers for tender detail/report live status polling.
 * Used only while the SSR result page is in an in-progress state.
 */

export const DETAIL_POLL_INTERVAL_MS = 1_500;
export const DETAIL_POLL_SLOW_INTERVAL_MS = 4_000;
export const DETAIL_SOFT_WAIT_MS = 90_000;
export const DETAIL_MAX_POLL_ERRORS = 5;

/** Authoritative terminal analysis statuses — stop polling and refresh. */
export const TERMINAL_ANALYSIS_STATUSES = [
  "COMPLETED",
  "FAILED",
  "ANALYSIS_INCOMPLETE",
] as const;

export type TerminalAnalysisStatus = (typeof TERMINAL_ANALYSIS_STATUSES)[number];

export type LiveStatusPayload = {
  status: string;
  progress?: number;
  phase?: string | null;
  message?: string;
};

export type LivePollStepResult =
  | { kind: "continue"; status: string; phase: string | null; intervalMs: number }
  | { kind: "terminal"; status: string; phase: string | null }
  | {
      kind: "poll_error";
      message: string;
      exhausted: boolean;
      intervalMs: number;
    };

export function isTerminalAnalysisStatus(status: string): boolean {
  return (TERMINAL_ANALYSIS_STATUSES as readonly string[]).includes(status);
}

/** Poll only when the SSR page kind is in-progress — never on ready/failed. */
export function shouldStartLiveStatusPolling(
  pageKind: "in_progress" | "ready" | "failed",
): boolean {
  return pageKind === "in_progress";
}

export function nextLivePollIntervalMs(elapsedMs: number): number {
  return elapsedMs > DETAIL_SOFT_WAIT_MS
    ? DETAIL_POLL_SLOW_INTERVAL_MS
    : DETAIL_POLL_INTERVAL_MS;
}

/**
 * Pure poll step for the tender result page.
 * Slow processing never becomes failure — only terminal statuses stop polling.
 */
export function evaluateLiveStatusPollStep(input: {
  elapsedMs: number;
  pollOk: boolean;
  pollErrorMessage?: string;
  consecutivePollErrors: number;
  data?: LiveStatusPayload;
  /** Last known status from SSR or a prior successful poll. */
  previousStatus: string;
}): LivePollStepResult {
  const intervalMs = nextLivePollIntervalMs(input.elapsedMs);

  if (input.pollOk && input.data?.status) {
    const status = input.data.status;
    const phase = input.data.phase ?? null;
    if (isTerminalAnalysisStatus(status)) {
      return { kind: "terminal", status, phase };
    }
    return { kind: "continue", status, phase, intervalMs };
  }

  if (!input.pollOk) {
    const exhausted =
      input.consecutivePollErrors + 1 >= DETAIL_MAX_POLL_ERRORS;
    return {
      kind: "poll_error",
      message: input.pollErrorMessage ?? "Unable to check analysis status",
      exhausted,
      // Keep polling slowly after errors — do not treat as analysis failure.
      intervalMs: exhausted ? DETAIL_POLL_SLOW_INTERVAL_MS : intervalMs,
    };
  }

  // Successful response without status — keep waiting with prior status.
  return {
    kind: "continue",
    status: input.previousStatus,
    phase: null,
    intervalMs,
  };
}

/**
 * Whether a new network poll may start (prevents overlapping in-flight requests).
 */
export function canStartPollRequest(input: {
  cancelled: boolean;
  inFlight: boolean;
  terminalReached: boolean;
}): boolean {
  return !input.cancelled && !input.inFlight && !input.terminalReached;
}
