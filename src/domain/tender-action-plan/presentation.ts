/**
 * Tender Action Plan — presentation helpers for UI and reports.
 * Read-only projection; never mutates canonical state.
 */

import type { TenderActionItem, TenderActionPlanBundle } from "./types";

export type ActionPlanTeamTaskView = {
  id: string;
  title: string;
  status: string;
  department: string | null;
  assigneeLabel: string | null;
  deadline: Date | string | null;
  requiredResponse: string | null;
  responseText: string | null;
  verificationState: string | null;
};

export type ActionPlanExecutiveItem = {
  id: string;
  title: string;
  priority: TenderActionItem["priority"];
  priorityEmoji: string;
  ownerLabel: string;
  blockingLabel: string | null;
  status: TenderActionItem["status"];
  simulationOnly: boolean;
};

export type ActionPlanExecutiveView = {
  openCount: number;
  criticalCount: number;
  blockingCount: number;
  deadlineLabel: string;
  urgencyNote: string | null;
  topActions: ActionPlanExecutiveItem[];
  hasMore: boolean;
};

const PRIORITY_EMOJI: Record<TenderActionItem["priority"], string> = {
  CRITICAL: "🔴",
  HIGH: "🔴",
  MEDIUM: "🟡",
  LOW: "🟢",
};

export function priorityEmoji(priority: TenderActionItem["priority"]): string {
  return PRIORITY_EMOJI[priority] ?? "🟡";
}

export function formatActionOwner(
  item: TenderActionItem,
  teamTask?: ActionPlanTeamTaskView | null,
): string {
  if (teamTask?.assigneeLabel) return teamTask.assigneeLabel;
  if (teamTask?.department) return formatDepartment(teamTask.department);
  if (item.ownerLabel) return formatDepartment(item.ownerLabel);
  return "UNKNOWN";
}

export function formatDepartment(dept: string): string {
  const map: Record<string, string> = {
    FINANCE: "Finance",
    LEGAL: "Legal",
    TECHNICAL: "Technical Team",
    MANAGEMENT: "Management",
    PROCUREMENT: "Procurement",
    OTHER: "Team",
  };
  return map[dept] ?? dept.replace(/_/g, " ");
}

export function blockingLabel(item: TenderActionItem): string | null {
  if (item.simulationOnly) return null;
  if (item.blocking && item.priority === "CRITICAL") return "Blocks final decision";
  if (item.blocking) return "Mandatory evidence";
  if (item.verificationRequired) return "Verification required";
  return "No current blocker";
}

export function statusDisplayLabel(status: TenderActionItem["status"]): string {
  switch (status) {
    case "OPEN":
      return "Open";
    case "IN_PROGRESS":
      return "In progress";
    case "EVIDENCE_SUBMITTED":
      return "Evidence submitted";
    case "AWAITING_VERIFICATION":
      return "Awaiting verification";
    case "COMPLETED":
      return "Completed";
    case "BLOCKED":
      return "Blocked";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function isOpenAction(item: TenderActionItem): boolean {
  return (
    item.status !== "COMPLETED" &&
    item.status !== "CANCELLED" &&
    !item.simulationOnly
  );
}

export function selectTopActions(
  items: TenderActionItem[],
  limit = 3,
): TenderActionItem[] {
  return items.filter(isOpenAction).slice(0, limit);
}

export function buildActionPlanExecutiveView(
  bundle: TenderActionPlanBundle,
): ActionPlanExecutiveView {
  const realItems = bundle.items.filter((i) => !i.simulationOnly);
  const open = realItems.filter(isOpenAction);
  const top = selectTopActions(realItems, 3);

  let deadlineLabel = "Deadline unavailable";
  if (bundle.deadlineUrgency.tenderDeadline) {
    try {
      deadlineLabel = new Date(bundle.deadlineUrgency.tenderDeadline).toLocaleDateString(
        undefined,
        { dateStyle: "medium" },
      );
    } catch {
      deadlineLabel = bundle.deadlineUrgency.tenderDeadline;
    }
  }

  return {
    openCount: open.length,
    criticalCount: open.filter((i) => i.priority === "CRITICAL").length,
    blockingCount: open.filter((i) => i.blocking).length,
    deadlineLabel,
    urgencyNote: bundle.deadlineUrgency.urgencyNote,
    topActions: top.map((item) => ({
      id: item.id,
      title: item.title.replace(/^\[SIMULATION ONLY\]\s*/i, ""),
      priority: item.priority,
      priorityEmoji: priorityEmoji(item.priority),
      ownerLabel: item.ownerLabel ? formatDepartment(item.ownerLabel) : "UNKNOWN",
      blockingLabel: blockingLabel(item),
      status: item.status,
      simulationOnly: item.simulationOnly,
    })),
    hasMore: open.length > top.length,
  };
}

export function enrichActionWithTeamTask(
  item: TenderActionItem,
  teamTasks: ActionPlanTeamTaskView[],
): ActionPlanTeamTaskView | null {
  if (!item.linkedTeamTaskId) return null;
  return teamTasks.find((t) => t.id === item.linkedTeamTaskId) ?? null;
}

export function formatActionPlanReportLine(
  item: TenderActionItem,
  index: number,
): string {
  const owner = item.ownerLabel ? formatDepartment(item.ownerLabel) : "UNKNOWN";
  const block = item.blocking ? " [blocking]" : "";
  const sim = item.simulationOnly ? " [SIMULATION]" : "";
  const req =
    item.requirementText?.trim() ||
    (item.linkedRequirementId ? item.description?.trim() : "") ||
    "";
  const reqPart = req ? ` — Requirement: ${req}` : "";
  return `${index + 1}. ${item.title} — ${owner} — ${statusDisplayLabel(item.status)}${block}${sim}${reqPart}`;
}
