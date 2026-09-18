/**
 * Lightweight timing for tender result delivery (no sensitive payloads).
 */

import { logInfo } from "@/services/observability";

export type ResultDeliveryPhase =
  | "request_start"
  | "shell_read"
  | "canonical_read"
  | "projection"
  | "report_built"
  | "explainable_built"
  | "response_ready";

export function createResultDeliveryTimer(tenderId: string, companyId: string) {
  const startedAt = performance.now();
  const marks = new Map<ResultDeliveryPhase, number>();

  return {
    mark(phase: ResultDeliveryPhase) {
      marks.set(phase, performance.now() - startedAt);
    },
    finish(extra?: Record<string, unknown>) {
      const totalMs = Math.round(performance.now() - startedAt);
      const phases = Object.fromEntries(marks);
      logInfo("tender.result_delivery", {
        tenderId,
        companyId,
        totalMs,
        phases,
        ...extra,
      });
      return totalMs;
    },
  };
}
