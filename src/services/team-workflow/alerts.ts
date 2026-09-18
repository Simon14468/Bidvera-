/**
 * Targeted Smart Alerts for team workflow closed loop.
 * Respects prefs, dedupe, tenant isolation; emails target user when set.
 */

import { notificationService } from "@/services/notifications";

export type WorkflowAlertKind =
  | "TASK_ASSIGNED"
  | "VERIFICATION_REQUIRED"
  | "EVIDENCE_VERIFIED"
  | "EVIDENCE_REJECTED"
  | "DECISION_CHANGED";

export async function notifyWorkflowStakeholders(input: {
  companyId: string;
  tenderId: string;
  tenderTitle: string;
  kind: WorkflowAlertKind;
  taskId: string;
  taskTitle: string;
  message: string;
  targetUserId?: string | null;
  dedupeKey?: string;
}) {
  const titles: Record<WorkflowAlertKind, string> = {
    TASK_ASSIGNED: "Team task assigned",
    VERIFICATION_REQUIRED: "Verification required",
    EVIDENCE_VERIFIED: "Evidence verified",
    EVIDENCE_REJECTED: "Evidence rejected",
    DECISION_CHANGED: "Decision updated",
  };

  const dedupeKey =
    input.dedupeKey ??
    `${input.companyId}:${input.taskId}:${input.kind}:${input.targetUserId ?? "stakeholders"}`;

  await notificationService.createInAppAlert({
    companyId: input.companyId,
    tenderId: input.tenderId,
    type: "WORKFLOW_EVENT",
    title: titles[input.kind],
    message: input.message,
    href: `/tenders/${input.tenderId}#team-workflow`,
    dedupeKey,
    targetUserId: input.targetUserId ?? null,
  });
}
