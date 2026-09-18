/**
 * Enrich explanation with Team Workflow links — reference only, never auto-verify.
 */

import { effectiveTaskStatus } from "@/domain/team-workflow";
import type { ExplainableDecision, ExplainableDecisionItem } from "./types";
import type { ExplainableTopReason } from "./presentation";
import { buildTopReasons } from "./presentation";

export type TeamWorkflowTaskInput = {
  id: string;
  title: string;
  requirementId: string | null;
  status: string;
  department: string | null;
  assigneeUser?: { name: string } | null;
  deadline?: Date | null;
};

export type ExplainableTeamWorkflowLink = {
  taskId: string;
  title: string;
  assigneeLabel: string | null;
  department: string | null;
  statusLabel: string;
  requirementId: string | null;
};

export type ExplainableDecisionView = ExplainableDecision & {
  topReasons: ExplainableTopReason[];
  teamWorkflowLinks: ExplainableTeamWorkflowLink[];
  itemsWithWorkflow: Array<
    ExplainableDecisionItem & { workflowLink: ExplainableTeamWorkflowLink | null }
  >;
};

function taskStatusLabel(status: ReturnType<typeof effectiveTaskStatus>): string {
  switch (status) {
    case "COMPLETED":
      return "Completed";
    case "OVERDUE":
      return "Overdue";
    case "IN_PROGRESS":
      return "In progress";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "Awaiting response";
  }
}

export function enrichExplainableDecision(
  explanation: ExplainableDecision,
  tasks: TeamWorkflowTaskInput[] = [],
): ExplainableDecisionView {
  const openTasks = tasks.filter(
    (t) => effectiveTaskStatus({ status: t.status as never, deadline: t.deadline ?? null }) !== "COMPLETED",
  );

  const teamWorkflowLinks: ExplainableTeamWorkflowLink[] = openTasks.map((t) => ({
    taskId: t.id,
    title: t.title,
    assigneeLabel: t.assigneeUser?.name ?? null,
    department: t.department,
    statusLabel: taskStatusLabel(
      effectiveTaskStatus({ status: t.status as never, deadline: t.deadline ?? null }),
    ),
    requirementId: t.requirementId,
  }));

  const itemsWithWorkflow = explanation.items.map((item) => {
    const link =
      teamWorkflowLinks.find(
        (t) =>
          (item.requirementId && t.requirementId === item.requirementId) ||
          (item.category === "BLOCKER" &&
            t.title.toLowerCase().includes(item.what.slice(0, 24).toLowerCase())),
      ) ?? null;
    return { ...item, workflowLink: link };
  });

  return {
    ...explanation,
    topReasons: buildTopReasons(explanation),
    teamWorkflowLinks,
    itemsWithWorkflow,
  };
}
