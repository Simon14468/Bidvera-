/** Default timeout for external AI provider HTTP requests (ms). */
export const AI_REQUEST_TIMEOUT_MS = Math.max(
  5_000,
  Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 120_000),
);

export class AiRequestTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`AI_REQUEST_TIMEOUT_${timeoutMs}`);
    this.name = "AiRequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}
