/**
 * Action status derivation — completion follows underlying canonical state, not uploads alone.
 */

import type { EvidenceIntelligenceState } from "@/domain/evidence-intelligence";
import type { ReadinessStatus } from "@/domain/decision/tender-readiness";
import type { TeamWorkflowTaskStatus } from "@prisma/client";
import type {
  TenderActionSourceType,
  TenderActionStatus,
  TenderActionTeamTaskRef,
} from "./types";

export function priorityFromSignals(input: {
  mandatory?: boolean;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null;
  readinessStatus?: ReadinessStatus | null;
  evidenceState?: EvidenceIntelligenceState | null;
  blocking?: boolean;
  daysRemaining?: number | null;
}): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (input.severity === "CRITICAL") return "CRITICAL";
  if (input.mandatory && (input.readinessStatus === "MISSING" || input.evidenceState === "MISSING")) {
    return "CRITICAL";
  }
  if (input.blocking && input.daysRemaining != null && input.daysRemaining <= 7) {
    return "CRITICAL";
  }
  if (input.severity === "HIGH" || input.mandatory) return "HIGH";
  if (input.readinessStatus === "VERIFY" || input.evidenceState === "FOUND_UNVERIFIED") return "HIGH";
  if (input.daysRemaining != null && input.daysRemaining <= 14) return "HIGH";
  if (input.severity === "MEDIUM") return "MEDIUM";
  return "LOW";
}

export function isTerminalActionStatus(status: TenderActionStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

export function deriveActionStatus(input: {
  sourceType: TenderActionSourceType;
  readinessStatus?: ReadinessStatus | null;
  evidenceState?: EvidenceIntelligenceState | null;
  teamTask?: TenderActionTeamTaskRef | null;
  requirementResolved?: boolean;
  riskResolved?: boolean;
}): TenderActionStatus {
  if (input.requirementResolved || input.riskResolved) return "COMPLETED";

  if (input.evidenceState === "VERIFIED") return "COMPLETED";
  if (input.readinessStatus === "READY" || input.readinessStatus === "NOT_APPLICABLE") {
    if (
      input.sourceType === "MISSING_MANDATORY_REQUIREMENT" ||
      input.sourceType === "MISSING_EVIDENCE" ||
      input.sourceType === "UNVERIFIED_EVIDENCE" ||
      input.sourceType === "EXPIRED_EVIDENCE" ||
      input.sourceType === "FAILED_VERIFICATION"
    ) {
      return "COMPLETED";
    }
  }

  const teamStatus = input.teamTask?.status;
  if (teamStatus) {
    if (teamStatus === "COMPLETED") {
      if (
        input.evidenceState === "FOUND_UNVERIFIED" ||
        input.readinessStatus === "VERIFY" ||
        input.sourceType === "UNVERIFIED_EVIDENCE" ||
        input.sourceType === "TEAM_VERIFICATION_TASK"
      ) {
        return "AWAITING_VERIFICATION";
      }
      if (input.evidenceState === "MISSING" || input.readinessStatus === "MISSING") {
        return "EVIDENCE_SUBMITTED";
      }
      return "COMPLETED";
    }
    if (teamStatus === "CANCELLED") return "CANCELLED";
    if (teamStatus === "IN_PROGRESS" || teamStatus === "OVERDUE") return "IN_PROGRESS";
    if (teamStatus === "PENDING") return "OPEN";
  }

  if (input.evidenceState === "FOUND_UNVERIFIED" || input.readinessStatus === "VERIFY") {
    return "OPEN";
  }
  if (input.evidenceState === "MISSING" || input.readinessStatus === "MISSING") {
    return "OPEN";
  }

  return "OPEN";
}

export function mapTeamTaskToOwner(task: TenderActionTeamTaskRef | null | undefined): string | null {
  if (!task) return null;
  if (task.department) return task.department;
  return "Team";
}

export function daysUntilDeadline(deadline: Date | null, asOf: Date): number | null {
  if (!deadline || Number.isNaN(deadline.getTime())) return null;
  const ms = deadline.getTime() - asOf.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function teamTaskByRequirement(
  tasks: TenderActionTeamTaskRef[],
): Map<string, TenderActionTeamTaskRef> {
  const map = new Map<string, TenderActionTeamTaskRef>();
  for (const t of tasks) {
    if (t.requirementId && !map.has(t.requirementId)) map.set(t.requirementId, t);
  }
  return map;
}

export function teamTaskByRisk(tasks: TenderActionTeamTaskRef[]): Map<string, TenderActionTeamTaskRef> {
  const map = new Map<string, TenderActionTeamTaskRef>();
  for (const t of tasks) {
    if (t.riskId && !map.has(t.riskId)) map.set(t.riskId, t);
  }
  return map;
}

export function isOpenTeamStatus(status: TeamWorkflowTaskStatus): boolean {
  return status === "PENDING" || status === "IN_PROGRESS" || status === "OVERDUE";
}
