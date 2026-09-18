import { logInfo } from "@/services/observability";
import type { AnalysisStatus } from "@prisma/client";

export interface PhaseTransitionContext {
  tenderId: string;
  jobId?: string | null;
}

/**
 * Structured phase timing for tender analysis observability.
 * Logs phaseStart implicitly on enter; phaseEnd + durationMs on transition.
 */
export class AnalysisPhaseTimer {
  private currentPhase: string | null = null;
  private currentStartedAt = 0;

  constructor(private readonly ctx: PhaseTransitionContext) {}

  /** Call after setAnalysisStatus when entering a new phase. */
  markEntered(phase: string, analysisStatus: AnalysisStatus): void {
    const now = Date.now();
    if (this.currentPhase) {
      logInfo("analysis.phase.end", {
        tenderId: this.ctx.tenderId,
        jobId: this.ctx.jobId ?? undefined,
        phase: this.currentPhase,
        durationMs: now - this.currentStartedAt,
        nextPhase: phase,
        analysisStatus,
      });
    }
    this.currentPhase = phase;
    this.currentStartedAt = now;
    logInfo("analysis.phase.start", {
      tenderId: this.ctx.tenderId,
      jobId: this.ctx.jobId ?? undefined,
      phase,
      analysisStatus,
    });
  }

  finish(): void {
    if (!this.currentPhase) return;
    logInfo("analysis.phase.end", {
      tenderId: this.ctx.tenderId,
      jobId: this.ctx.jobId ?? undefined,
      phase: this.currentPhase,
      durationMs: Date.now() - this.currentStartedAt,
      terminal: true,
    });
    this.currentPhase = null;
  }
}
