"use server";

import { requireCompanyId } from "@/auth/session";
import { AppError } from "@/lib/errors";
import type {
  RiskSeverity,
  TeamWorkflowDepartment,
  TeamWorkflowTaskKind,
} from "@prisma/client";

function fail(error: unknown) {
  if (error instanceof AppError) {
    return {
      ok: false as const,
      error: { code: error.code, message: error.message },
    };
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return {
    ok: false as const,
    error: { code: "INTERNAL", message },
  };
}

export async function listTenderTeamTasksAction(tenderId: string) {
  try {
    const { auth, companyId } = await requireCompanyId();
    const { listTenderWorkflowTasks } = await import("@/services/team-workflow");
    const data = await listTenderWorkflowTasks({
      companyId,
      tenderId,
      role: auth.user.role,
    });
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function listCompanyTeamTasksAction(mineOnly = false) {
  try {
    const { auth, companyId } = await requireCompanyId();
    const { listCompanyWorkflowTasks } = await import("@/services/team-workflow");
    const data = await listCompanyWorkflowTasks({
      companyId,
      role: auth.user.role,
      userId: auth.user.id,
      mineOnly,
    });
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function listTeamMembersAction() {
  try {
    const { companyId } = await requireCompanyId();
    const { listCompanyTeamMembers } = await import("@/services/team-workflow");
    const data = await listCompanyTeamMembers(companyId);
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function createTeamTaskAction(raw: {
  tenderId: string;
  kind: TeamWorkflowTaskKind;
  title: string;
  description?: string;
  requiredResponse?: string;
  department?: TeamWorkflowDepartment | null;
  assigneeUserId?: string | null;
  priority?: RiskSeverity;
  deadlineIso?: string | null;
  requirementId?: string | null;
  riskId?: string | null;
  missingDocId?: string | null;
}) {
  try {
    const { auth, companyId } = await requireCompanyId();
    const { createTeamWorkflowTask } = await import("@/services/team-workflow");
    const data = await createTeamWorkflowTask({
      companyId,
      userId: auth.user.id,
      role: auth.user.role,
      tenderId: raw.tenderId,
      kind: raw.kind,
      title: raw.title,
      description: raw.description,
      requiredResponse: raw.requiredResponse,
      department: raw.department,
      assigneeUserId: raw.assigneeUserId,
      priority: raw.priority,
      deadline: raw.deadlineIso ? new Date(raw.deadlineIso) : null,
      requirementId: raw.requirementId,
      riskId: raw.riskId,
      missingDocId: raw.missingDocId,
    });
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function assignTeamTaskAction(raw: {
  taskId: string;
  assigneeUserId: string | null;
  department?: TeamWorkflowDepartment | null;
  deadlineIso?: string | null;
}) {
  try {
    const { auth, companyId } = await requireCompanyId();
    const { assignTeamWorkflowTask } = await import("@/services/team-workflow");
    const data = await assignTeamWorkflowTask({
      companyId,
      userId: auth.user.id,
      role: auth.user.role,
      taskId: raw.taskId,
      assigneeUserId: raw.assigneeUserId,
      department: raw.department,
      deadline: raw.deadlineIso ? new Date(raw.deadlineIso) : undefined,
    });
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function respondTeamTaskAction(raw: {
  taskId: string;
  responseText: string;
  evidenceNote?: string;
  markCompleted?: boolean;
}) {
  try {
    const { auth, companyId } = await requireCompanyId();
    const { respondToTeamWorkflowTask } = await import(
      "@/services/team-workflow"
    );
    const data = await respondToTeamWorkflowTask({
      companyId,
      userId: auth.user.id,
      role: auth.user.role,
      taskId: raw.taskId,
      responseText: raw.responseText,
      evidenceNote: raw.evidenceNote,
      markCompleted: raw.markCompleted,
    });
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function verifyTeamTaskAction(raw: {
  taskId: string;
  verdict: "VERIFIED" | "REJECTED";
  verificationNote?: string;
  appliedRequirementStatus?:
    | "MATCHED"
    | "FAILED"
    | "UNCERTAIN"
    | "MISSING"
    | null;
}) {
  try {
    const { auth, companyId } = await requireCompanyId();
    const { verifyTeamWorkflowEvidence } = await import(
      "@/services/team-workflow/closed-loop"
    );
    const data = await verifyTeamWorkflowEvidence({
      companyId,
      userId: auth.user.id,
      role: auth.user.role,
      taskId: raw.taskId,
      verdict: raw.verdict,
      verificationNote: raw.verificationNote,
      appliedRequirementStatus: raw.appliedRequirementStatus ?? null,
    });
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function uploadTeamTaskEvidenceAction(formData: FormData) {
  try {
    const { auth, companyId } = await requireCompanyId();
    const taskId = String(formData.get("taskId") ?? "");
    const file = formData.get("file");
    if (!taskId || !(file instanceof File)) {
      return {
        ok: false as const,
        error: { code: "VALIDATION", message: "taskId and file are required." },
      };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const { uploadTeamWorkflowEvidence } = await import(
      "@/services/team-workflow"
    );
    const data = await uploadTeamWorkflowEvidence({
      companyId,
      userId: auth.user.id,
      role: auth.user.role,
      taskId,
      fileName: file.name || "evidence.pdf",
      mimeType: file.type || "application/pdf",
      body: buffer,
    });
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function reopenTeamTaskAction(taskId: string, message?: string) {
  try {
    const { auth, companyId } = await requireCompanyId();
    const { reopenTeamWorkflowTask } = await import("@/services/team-workflow");
    const data = await reopenTeamWorkflowTask({
      companyId,
      userId: auth.user.id,
      role: auth.user.role,
      taskId,
      message,
    });
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}

export async function listTeamTaskEventsAction(taskId: string) {
  try {
    const { auth, companyId } = await requireCompanyId();
    const { listTaskEvents } = await import("@/services/team-workflow");
    const data = await listTaskEvents({
      companyId,
      taskId,
      role: auth.user.role,
    });
    return { ok: true as const, data };
  } catch (error) {
    return fail(error);
  }
}
