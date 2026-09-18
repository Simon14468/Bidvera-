/**
 * Team Decision Workflow service.
 * Tenant-isolated; never invents responses; never mutates Decision Engine scores.
 */

import {
  assertCanMutateTenderAnalysis,
  assertCanViewTenderAnalysis,
} from "@/auth/tender-access";
import {
  buildSeedTaskCandidates,
  canAssignTeamTasks,
  canRespondToTeamTask,
  effectiveTaskStatus,
  summarizeUnresolvedCriticalTasks,
  type DisplayTaskStatus,
} from "@/domain/team-workflow";
import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { hasFeature } from "@/services/entitlements";
import { trackEvent, logInfo } from "@/services/observability";
import { notificationService } from "@/services/notifications";
import type {
  RiskSeverity,
  TeamWorkflowDepartment,
  TeamWorkflowTaskKind,
  TeamWorkflowTaskStatus,
  UserRole,
} from "@prisma/client";
import { Prisma } from "@prisma/client";

async function assertTeamFeature(companyId: string) {
  await prisma.feature.upsert({
    where: { key: "team_collaboration" },
    create: {
      key: "team_collaboration",
      name: "Team Collaboration",
      enabledGlobal: true,
    },
    update: {},
  });
  const ok = await hasFeature(companyId, "team_collaboration");
  if (!ok) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Team collaboration is not enabled for this workspace.",
      403,
    );
  }
}

async function loadTenderOrThrow(companyId: string, tenderId: string) {
  const tender = await prisma.tender.findFirst({
    where: { id: tenderId, companyId },
    select: { id: true, title: true, companyId: true, deadline: true },
  });
  if (!tender) {
    throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  }
  return tender;
}

async function recordTaskEvent(input: {
  companyId: string;
  taskId: string;
  actorUserId: string | null;
  eventType:
    | "CREATED"
    | "ASSIGNED"
    | "STATUS_CHANGED"
    | "RESPONSE_ADDED"
    | "EVIDENCE_LINKED"
    | "COMPLETED"
    | "REOPENED"
    | "COMMENT"
    | "VERIFICATION_REQUESTED"
    | "VERIFIED"
    | "REJECTED"
    | "REQUIREMENT_UPDATED"
    | "DECISION_RERUN";
  fromStatus?: TeamWorkflowTaskStatus | null;
  toStatus?: TeamWorkflowTaskStatus | null;
  message?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.teamWorkflowEvent.create({
    data: {
      companyId: input.companyId,
      taskId: input.taskId,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      message: input.message ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}

function mapTask(row: {
  id: string;
  companyId: string;
  tenderId: string;
  kind: TeamWorkflowTaskKind;
  title: string;
  description: string | null;
  requiredResponse: string | null;
  department: TeamWorkflowDepartment | null;
  assigneeUserId: string | null;
  status: TeamWorkflowTaskStatus;
  priority: RiskSeverity;
  deadline: Date | null;
  responseText: string | null;
  evidenceNote: string | null;
  responseSubmittedAt?: Date | null;
  responseSubmittedById?: string | null;
  verificationStatus?: string;
  verifiedAt?: Date | null;
  verifiedById?: string | null;
  verificationNote?: string | null;
  appliedRequirementStatus?: string | null;
  verifiedEvidenceId?: string | null;
  requirementId: string | null;
  riskId: string | null;
  missingDocId: string | null;
  clarificationId: string | null;
  createdById: string | null;
  completedAt: Date | null;
  completedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  assigneeUser?: { id: string; name: string; email: string } | null;
  createdBy?: { id: string; name: string } | null;
  tender?: { id: string; title: string } | null;
  attachments?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    createdAt: Date;
  }>;
}) {
  const displayStatus = effectiveTaskStatus(row);
  return {
    ...row,
    verificationStatus: row.verificationStatus ?? "NONE",
    displayStatus: displayStatus as DisplayTaskStatus,
    assigneeName: row.assigneeUser?.name ?? null,
    assigneeEmail: row.assigneeUser?.email ?? null,
    createdByName: row.createdBy?.name ?? null,
    tenderTitle: row.tender?.title ?? null,
    attachments: row.attachments ?? [],
  };
}

export async function listCompanyTeamMembers(companyId: string) {
  return prisma.user.findMany({
    where: {
      companyId,
      role: { in: ["OWNER", "ADMIN", "MEMBER"] },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function listTenderWorkflowTasks(input: {
  companyId: string;
  tenderId: string;
  role: UserRole;
}) {
  assertCanViewTenderAnalysis(input.role);
  await loadTenderOrThrow(input.companyId, input.tenderId);
  const rows = await prisma.teamWorkflowTask.findMany({
    where: { companyId: input.companyId, tenderId: input.tenderId },
    include: {
      assigneeUser: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      attachments: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ priority: "desc" }, { deadline: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(mapTask);
}

export async function listCompanyWorkflowTasks(input: {
  companyId: string;
  role: UserRole;
  userId: string;
  mineOnly?: boolean;
}) {
  assertCanViewTenderAnalysis(input.role);
  const rows = await prisma.teamWorkflowTask.findMany({
    where: {
      companyId: input.companyId,
      ...(input.mineOnly ? { assigneeUserId: input.userId } : {}),
      status: { not: "CANCELLED" },
    },
    include: {
      assigneeUser: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      tender: { select: { id: true, title: true } },
    },
    orderBy: [{ status: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return rows.map(mapTask);
}

export async function getTenderWorkflowSummary(input: {
  companyId: string;
  tenderId: string;
}) {
  const rows = await prisma.teamWorkflowTask.findMany({
    where: {
      companyId: input.companyId,
      tenderId: input.tenderId,
      status: { not: "CANCELLED" },
    },
    select: {
      status: true,
      deadline: true,
      priority: true,
      title: true,
    },
  });
  return summarizeUnresolvedCriticalTasks(rows);
}

export async function createTeamWorkflowTask(input: {
  companyId: string;
  userId: string;
  role: UserRole;
  tenderId: string;
  kind: TeamWorkflowTaskKind;
  title: string;
  description?: string | null;
  requiredResponse?: string | null;
  department?: TeamWorkflowDepartment | null;
  assigneeUserId?: string | null;
  priority?: RiskSeverity;
  deadline?: Date | null;
  requirementId?: string | null;
  riskId?: string | null;
  missingDocId?: string | null;
  clarificationId?: string | null;
  dedupeKey?: string | null;
}) {
  await assertTeamFeature(input.companyId);
  assertCanMutateTenderAnalysis(input.role);
  if (!canAssignTeamTasks(input.role)) {
    throw new AppError(ErrorCode.FORBIDDEN, "Cannot assign team tasks.", 403);
  }

  const tender = await loadTenderOrThrow(input.companyId, input.tenderId);
  const title = input.title.trim();
  if (!title) {
    throw new AppError(ErrorCode.VALIDATION, "Task title is required.", 400);
  }

  if (input.assigneeUserId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: input.assigneeUserId,
        companyId: input.companyId,
        role: { in: ["OWNER", "ADMIN", "MEMBER"] },
      },
      select: { id: true, email: true, name: true },
    });
    if (!assignee) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Assignee must be a company member.",
        400,
      );
    }
  }

  const sourceId =
    input.requirementId ??
    input.riskId ??
    input.missingDocId ??
    input.clarificationId ??
    `custom:${title.slice(0, 40)}:${Date.now()}`;
  const dedupeKey =
    input.dedupeKey ??
    `${input.companyId}:${input.tenderId}:${input.kind}:${sourceId}`;

  try {
    const task = await prisma.teamWorkflowTask.create({
      data: {
        companyId: input.companyId,
        tenderId: input.tenderId,
        kind: input.kind,
        title,
        description: input.description?.trim() || null,
        requiredResponse: input.requiredResponse?.trim() || null,
        department: input.department ?? null,
        assigneeUserId: input.assigneeUserId ?? null,
        priority: input.priority ?? "MEDIUM",
        deadline: input.deadline ?? tender.deadline,
        requirementId: input.requirementId ?? null,
        riskId: input.riskId ?? null,
        missingDocId: input.missingDocId ?? null,
        clarificationId: input.clarificationId ?? null,
        dedupeKey,
        createdById: input.userId,
        status: "PENDING",
      },
      include: {
        assigneeUser: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await recordTaskEvent({
      companyId: input.companyId,
      taskId: task.id,
      actorUserId: input.userId,
      eventType: "CREATED",
      toStatus: "PENDING",
      message: `Task created: ${title}`,
    });

    if (task.assigneeUserId) {
      await recordTaskEvent({
        companyId: input.companyId,
        taskId: task.id,
        actorUserId: input.userId,
        eventType: "ASSIGNED",
        toStatus: "PENDING",
        message: `Assigned to ${task.assigneeUser?.name ?? task.assigneeUserId}`,
        metadata: { assigneeUserId: task.assigneeUserId },
      });
      await notifyAssignee({
        companyId: input.companyId,
        tenderId: input.tenderId,
        tenderTitle: tender.title,
        taskId: task.id,
        taskTitle: task.title,
        assigneeUserId: task.assigneeUserId,
      });
    }

    await trackEvent({
      action: "TEAM_TASK_CREATED",
      companyId: input.companyId,
      userId: input.userId,
      metadata: {
        taskId: task.id,
        tenderId: input.tenderId,
        kind: input.kind,
        dedupeKey,
      },
    });

    return mapTask(task);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.teamWorkflowTask.findUnique({
        where: { dedupeKey },
        include: {
          assigneeUser: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });
      if (existing) return mapTask(existing);
      throw new AppError(
        ErrorCode.CONFLICT,
        "A task for this tender item already exists.",
        409,
      );
    }
    throw error;
  }
}

export async function assignTeamWorkflowTask(input: {
  companyId: string;
  userId: string;
  role: UserRole;
  taskId: string;
  assigneeUserId: string | null;
  department?: TeamWorkflowDepartment | null;
  deadline?: Date | null;
}) {
  await assertTeamFeature(input.companyId);
  assertCanMutateTenderAnalysis(input.role);
  if (!canAssignTeamTasks(input.role)) {
    throw new AppError(ErrorCode.FORBIDDEN, "Cannot assign team tasks.", 403);
  }

  const task = await prisma.teamWorkflowTask.findFirst({
    where: { id: input.taskId, companyId: input.companyId },
  });
  if (!task) throw new AppError(ErrorCode.NOT_FOUND, "Task not found.", 404);
  if (task.status === "COMPLETED" || task.status === "CANCELLED") {
    throw new AppError(
      ErrorCode.CONFLICT,
      "Cannot reassign a completed or cancelled task.",
      409,
    );
  }

  if (input.assigneeUserId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: input.assigneeUserId,
        companyId: input.companyId,
        role: { in: ["OWNER", "ADMIN", "MEMBER"] },
      },
    });
    if (!assignee) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Assignee must be a company member.",
        400,
      );
    }
  }

  const updated = await prisma.teamWorkflowTask.update({
    where: { id: task.id },
    data: {
      assigneeUserId: input.assigneeUserId,
      department: input.department ?? task.department,
      deadline: input.deadline === undefined ? task.deadline : input.deadline,
      status: task.status === "OVERDUE" ? "PENDING" : task.status,
    },
    include: {
      assigneeUser: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      tender: { select: { id: true, title: true } },
    },
  });

  await recordTaskEvent({
    companyId: input.companyId,
    taskId: task.id,
    actorUserId: input.userId,
    eventType: "ASSIGNED",
    fromStatus: task.status,
    toStatus: updated.status,
    message: input.assigneeUserId
      ? `Assigned to ${updated.assigneeUser?.name ?? input.assigneeUserId}`
      : "Assignee cleared",
    metadata: { assigneeUserId: input.assigneeUserId },
  });

  await trackEvent({
    action: "TEAM_TASK_ASSIGNED",
    companyId: input.companyId,
    userId: input.userId,
    metadata: {
      taskId: task.id,
      assigneeUserId: input.assigneeUserId,
    },
  });

  if (input.assigneeUserId) {
    await notifyAssignee({
      companyId: input.companyId,
      tenderId: updated.tenderId,
      tenderTitle: updated.tender?.title ?? "Tender",
      taskId: updated.id,
      taskTitle: updated.title,
      assigneeUserId: input.assigneeUserId,
    });
  }

  return mapTask(updated);
}

export async function respondToTeamWorkflowTask(input: {
  companyId: string;
  userId: string;
  role: UserRole;
  taskId: string;
  responseText: string;
  evidenceNote?: string | null;
  markCompleted?: boolean;
}) {
  await assertTeamFeature(input.companyId);
  assertCanMutateTenderAnalysis(input.role);

  const task = await prisma.teamWorkflowTask.findFirst({
    where: { id: input.taskId, companyId: input.companyId },
  });
  if (!task) throw new AppError(ErrorCode.NOT_FOUND, "Task not found.", 404);

  if (
    !canRespondToTeamTask({
      role: input.role,
      userId: input.userId,
      assigneeUserId: task.assigneeUserId,
    })
  ) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "You are not assigned to this task.",
      403,
    );
  }

  const responseText = input.responseText.trim();
  if (!responseText) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Response text is required — never invent a response.",
      400,
    );
  }
  if (task.status === "CANCELLED") {
    throw new AppError(ErrorCode.CONFLICT, "Task is cancelled.", 409);
  }

  const { requiresVerificationBeforeComplete } = await import(
    "@/domain/team-workflow/closed-loop"
  );
  const needsVerify = requiresVerificationBeforeComplete({
    kind: task.kind,
    requirementId: task.requirementId,
    riskId: task.riskId,
    missingDocId: task.missingDocId,
  });

  // Unverified responses never complete decision-critical tasks
  const markCompleted =
    input.markCompleted === true && !needsVerify && task.status !== "COMPLETED";

  const nextStatus: TeamWorkflowTaskStatus = markCompleted
    ? "COMPLETED"
    : "IN_PROGRESS";

  const updated = await prisma.teamWorkflowTask.update({
    where: { id: task.id },
    data: {
      responseText,
      evidenceNote: input.evidenceNote?.trim() || task.evidenceNote,
      status: nextStatus,
      responseSubmittedAt: new Date(),
      responseSubmittedById: input.userId,
      // Never auto-verify — always PENDING until human verifier acts
      verificationStatus: needsVerify ? "PENDING" : task.verificationStatus,
      verifiedAt: null,
      verifiedById: null,
      verificationNote: null,
      closedLoopHash: null,
      completedAt: markCompleted ? new Date() : null,
      completedById: markCompleted ? input.userId : null,
    },
    include: {
      assigneeUser: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      tender: { select: { id: true, title: true } },
      attachments: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          createdAt: true,
        },
      },
    },
  });

  await recordTaskEvent({
    companyId: input.companyId,
    taskId: task.id,
    actorUserId: input.userId,
    eventType: "RESPONSE_ADDED",
    fromStatus: task.status,
    toStatus: nextStatus,
    message: responseText.slice(0, 500),
    metadata: {
      verificationStatus: needsVerify ? "PENDING" : "NONE",
      unverified: true,
    },
  });

  if (needsVerify) {
    await recordTaskEvent({
      companyId: input.companyId,
      taskId: task.id,
      actorUserId: input.userId,
      eventType: "VERIFICATION_REQUESTED",
      toStatus: nextStatus,
      message: "Response submitted — awaiting verification before decision impact",
    });

    const { notifyWorkflowStakeholders } = await import(
      "@/services/team-workflow/alerts"
    );
    // Notify OWNER/ADMIN verifiers (no single target — company-wide alert)
    await notifyWorkflowStakeholders({
      companyId: input.companyId,
      tenderId: task.tenderId,
      tenderTitle: updated.tender?.title ?? "Tender",
      kind: "VERIFICATION_REQUIRED",
      taskId: task.id,
      taskTitle: task.title,
      message: `"${task.title}" has a response awaiting verification on "${updated.tender?.title ?? "Tender"}". Unverified evidence does not change the decision.`,
      dedupeKey: `${input.companyId}:${task.id}:verification-required:${updated.responseSubmittedAt?.getTime() ?? Date.now()}`,
    });
  }

  await trackEvent({
    action: "TEAM_TASK_RESPONDED",
    companyId: input.companyId,
    userId: input.userId,
    metadata: {
      taskId: task.id,
      completed: markCompleted,
      verificationPending: needsVerify,
    },
  });

  if (markCompleted) {
    await recordTaskEvent({
      companyId: input.companyId,
      taskId: task.id,
      actorUserId: input.userId,
      eventType: "COMPLETED",
      fromStatus: task.status,
      toStatus: "COMPLETED",
      message: "Task marked completed (no decision-critical link)",
    });
    await trackEvent({
      action: "TEAM_TASK_COMPLETED",
      companyId: input.companyId,
      userId: input.userId,
      metadata: { taskId: task.id, tenderId: task.tenderId },
    });
  }

  return mapTask(updated);
}

export async function uploadTeamWorkflowEvidence(input: {
  companyId: string;
  userId: string;
  role: UserRole;
  taskId: string;
  fileName: string;
  mimeType: string;
  body: Buffer;
}) {
  await assertTeamFeature(input.companyId);
  assertCanMutateTenderAnalysis(input.role);

  const task = await prisma.teamWorkflowTask.findFirst({
    where: { id: input.taskId, companyId: input.companyId },
  });
  if (!task) throw new AppError(ErrorCode.NOT_FOUND, "Task not found.", 404);

  if (
    !canRespondToTeamTask({
      role: input.role,
      userId: input.userId,
      assigneeUserId: task.assigneeUserId,
    })
  ) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "You are not assigned to this task.",
      403,
    );
  }
  if (task.status === "CANCELLED" || task.verificationStatus === "VERIFIED") {
    throw new AppError(
      ErrorCode.CONFLICT,
      "Cannot upload evidence on a cancelled or already-verified task.",
      409,
    );
  }

  const { storageService } = await import("@/services/storage");
  const stored = await storageService.putObject({
    companyId: input.companyId,
    tenderId: task.tenderId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    body: input.body,
  });

  const attachment = await prisma.teamWorkflowAttachment.create({
    data: {
      companyId: input.companyId,
      taskId: task.id,
      fileName: input.fileName,
      storageKey: stored.storageKey,
      mimeType: input.mimeType,
      fileSize: stored.byteLength,
      checksumSha256: stored.checksumSha256,
      uploadedById: input.userId,
    },
  });

  await recordTaskEvent({
    companyId: input.companyId,
    taskId: task.id,
    actorUserId: input.userId,
    eventType: "EVIDENCE_LINKED",
    message: `Evidence file uploaded: ${input.fileName}`,
    metadata: {
      attachmentId: attachment.id,
      checksumSha256: stored.checksumSha256,
      unverified: true,
    },
  });

  await trackEvent({
    action: "TEAM_EVIDENCE_UPLOADED",
    companyId: input.companyId,
    userId: input.userId,
    metadata: { taskId: task.id, attachmentId: attachment.id },
  });

  return attachment;
}

export async function reopenTeamWorkflowTask(input: {
  companyId: string;
  userId: string;
  role: UserRole;
  taskId: string;
  message?: string | null;
}) {
  await assertTeamFeature(input.companyId);
  assertCanMutateTenderAnalysis(input.role);
  if (input.role !== "OWNER" && input.role !== "ADMIN") {
    throw new AppError(ErrorCode.FORBIDDEN, "Only owners/admins can reopen.", 403);
  }

  const task = await prisma.teamWorkflowTask.findFirst({
    where: { id: input.taskId, companyId: input.companyId },
  });
  if (!task) throw new AppError(ErrorCode.NOT_FOUND, "Task not found.", 404);
  if (task.status !== "COMPLETED" && task.status !== "CANCELLED") {
    throw new AppError(ErrorCode.CONFLICT, "Task is not completed.", 409);
  }

  const updated = await prisma.teamWorkflowTask.update({
    where: { id: task.id },
    data: {
      status: "IN_PROGRESS",
      completedAt: null,
      completedById: null,
      // Allow a new response cycle — does NOT silently reverse requirement status
      verificationStatus: "NONE",
      verifiedAt: null,
      verifiedById: null,
      verificationNote: null,
      closedLoopHash: null,
      appliedRequirementStatus: null,
      verifiedEvidenceId: null,
    },
    include: {
      assigneeUser: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  await recordTaskEvent({
    companyId: input.companyId,
    taskId: task.id,
    actorUserId: input.userId,
    eventType: "REOPENED",
    fromStatus: task.status,
    toStatus: "IN_PROGRESS",
    message: input.message?.trim() || "Task reopened",
  });

  await trackEvent({
    action: "TEAM_TASK_REOPENED",
    companyId: input.companyId,
    userId: input.userId,
    metadata: { taskId: task.id },
  });

  return mapTask(updated);
}

export async function listTaskEvents(input: {
  companyId: string;
  taskId: string;
  role: UserRole;
}) {
  assertCanViewTenderAnalysis(input.role);
  const task = await prisma.teamWorkflowTask.findFirst({
    where: { id: input.taskId, companyId: input.companyId },
    select: { id: true },
  });
  if (!task) throw new AppError(ErrorCode.NOT_FOUND, "Task not found.", 404);

  return prisma.teamWorkflowEvent.findMany({
    where: { taskId: input.taskId, companyId: input.companyId },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Seed tasks from analysis gaps (idempotent via dedupeKey).
 * Does not invent gaps — only uses persisted requirements/risks/missing docs.
 */
export async function seedTeamTasksFromAnalysis(input: {
  companyId: string;
  tenderId: string;
  actorUserId?: string | null;
  verificationChains?: import("@/domain/evidence-verification").RequirementVerificationChain[];
}): Promise<number> {
  await prisma.feature.upsert({
    where: { key: "team_collaboration" },
    create: {
      key: "team_collaboration",
      name: "Team Collaboration",
      enabledGlobal: true,
    },
    update: {},
  });
  const enabled = await hasFeature(input.companyId, "team_collaboration");
  if (!enabled) return 0;

  const tender = await prisma.tender.findFirst({
    where: { id: input.tenderId, companyId: input.companyId },
    select: {
      id: true,
      title: true,
      deadline: true,
      requirements: {
        select: {
          id: true,
          description: true,
          category: true,
          mandatory: true,
          status: true,
        },
      },
      risks: {
        select: {
          id: true,
          description: true,
          category: true,
          severity: true,
          status: true,
        },
      },
      missingDocs: {
        select: {
          id: true,
          documentName: true,
          reason: true,
          severity: true,
          status: true,
        },
      },
    },
  });
  if (!tender) return 0;

  const candidates = buildSeedTaskCandidates({
    companyId: input.companyId,
    tenderId: input.tenderId,
    tenderDeadline: tender.deadline,
    requirements: tender.requirements,
    risks: tender.risks,
    missingDocs: tender.missingDocs,
  });

  if (input.verificationChains?.length) {
    const { buildVerificationSeedCandidates } = await import(
      "@/domain/evidence-verification"
    );
    candidates.push(
      ...buildVerificationSeedCandidates({
        companyId: input.companyId,
        tenderId: input.tenderId,
        tenderDeadline: tender.deadline,
        chains: input.verificationChains,
      }),
    );
  }

  const seedStartedAt = Date.now();
  const {
    chunkArray,
    ANALYSIS_WRITE_CHUNK_SIZE,
    buildSeedSideEffectRows,
  } = await import("@/services/analysis-batch-writes");

  // Idempotent filter: skip candidates whose dedupeKey already exists.
  const existingKeys = new Set(
    (
      await prisma.teamWorkflowTask.findMany({
        where: {
          companyId: input.companyId,
          tenderId: input.tenderId,
          dedupeKey: { in: candidates.map((c) => c.dedupeKey) },
        },
        select: { dedupeKey: true },
      })
    ).map((r) => r.dedupeKey),
  );
  const toCreate = candidates.filter((c) => !existingKeys.has(c.dedupeKey));

  let taskWriteBatches = 0;
  let dbWrites = 1; // existingKeys lookup
  const taskRowsStartedAt = Date.now();
  for (const chunk of chunkArray(toCreate, ANALYSIS_WRITE_CHUNK_SIZE)) {
    await prisma.teamWorkflowTask.createMany({
      data: chunk.map((c) => ({
        companyId: input.companyId,
        tenderId: input.tenderId,
        kind: c.kind,
        title: c.title,
        description: c.description,
        requiredResponse: c.requiredResponse,
        department: c.department,
        priority: c.priority,
        deadline: c.deadline,
        dedupeKey: c.dedupeKey,
        requirementId: c.requirementId ?? null,
        riskId: c.riskId ?? null,
        missingDocId: c.missingDocId ?? null,
        clarificationId: c.clarificationId ?? null,
        createdById: input.actorUserId ?? null,
        status: "PENDING" as const,
      })),
      skipDuplicates: true,
    });
    taskWriteBatches += 1;
    dbWrites += 1;
  }
  const taskSeedDurationMs = Date.now() - taskRowsStartedAt;

  const createdTasks =
    toCreate.length === 0
      ? []
      : await prisma.teamWorkflowTask.findMany({
          where: {
            companyId: input.companyId,
            tenderId: input.tenderId,
            dedupeKey: { in: toCreate.map((c) => c.dedupeKey) },
          },
          select: {
            id: true,
            dedupeKey: true,
            kind: true,
            title: true,
            requirementId: true,
          },
        });
  dbWrites += 1;

  const tasksByDedupeKey = new Map(
    createdTasks.map((t) => [
      t.dedupeKey,
      {
        id: t.id,
        kind: t.kind,
        title: t.title,
        requirementId: t.requirementId,
      },
    ]),
  );
  const { events, verificationAudits, auditLogs } = buildSeedSideEffectRows({
    companyId: input.companyId,
    tenderId: input.tenderId,
    actorUserId: input.actorUserId ?? null,
    candidatesInOrder: toCreate,
    tasksByDedupeKey,
  });

  let eventWriteBatches = 0;
  const eventBatchStartedAt = Date.now();
  for (const chunk of chunkArray(events, ANALYSIS_WRITE_CHUNK_SIZE)) {
    await prisma.teamWorkflowEvent.createMany({
      data: chunk.map((e) => ({
        companyId: e.companyId,
        taskId: e.taskId,
        actorUserId: e.actorUserId,
        eventType: e.eventType,
        toStatus: e.toStatus,
        message: e.message,
      })),
    });
    eventWriteBatches += 1;
    dbWrites += 1;
  }
  const eventBatchDurationMs = Date.now() - eventBatchStartedAt;

  let verificationAuditBatches = 0;
  const verificationAuditStartedAt = Date.now();
  for (const chunk of chunkArray(
    verificationAudits,
    ANALYSIS_WRITE_CHUNK_SIZE,
  )) {
    await prisma.requirementVerificationAudit.createMany({
      data: chunk.map((a) => ({
        companyId: a.companyId,
        tenderId: a.tenderId,
        requirementId: a.requirementId,
        evidenceId: a.evidenceId,
        userId: a.userId,
        action: a.action,
        snapshot: a.snapshot as Prisma.InputJsonValue,
      })),
    });
    verificationAuditBatches += 1;
    dbWrites += 1;
  }
  for (const chunk of chunkArray(auditLogs, ANALYSIS_WRITE_CHUNK_SIZE)) {
    await prisma.auditLog.createMany({
      data: chunk.map((a) => ({
        action: a.action,
        companyId: a.companyId,
        userId: a.userId,
        metadata: a.metadata as Prisma.InputJsonValue,
      })),
    });
    verificationAuditBatches += 1;
    dbWrites += 1;
  }
  const verificationAuditBatchDurationMs =
    Date.now() - verificationAuditStartedAt;

  const created = createdTasks.length;

  if (created > 0) {
    await notificationService.createInAppAlert({
      companyId: input.companyId,
      tenderId: input.tenderId,
      type: "WORKFLOW_EVENT",
      title: "Team workflow tasks ready",
      message: `"${tender.title}" — ${created} team task(s) created from analysis gaps. Assign owners before final decision.`,
      href: `/tenders/${input.tenderId}`,
      dedupeKey: `${input.companyId}:${input.tenderId}:team-seed:${created}`,
    });
    logInfo("team_workflow.seeded", {
      companyId: input.companyId,
      tenderId: input.tenderId,
      created,
      candidateCount: candidates.length,
      skippedExisting: existingKeys.size,
      taskSeedDurationMs,
      eventBatchDurationMs,
      verificationAuditBatchDurationMs,
      taskWriteBatches,
      eventWriteBatches,
      verificationAuditBatches,
      dbWrites,
      durationMs: Date.now() - seedStartedAt,
    });
  }

  return created;
}

/** Mark overdue OPEN tasks (status field) for dispatch/UI consistency. */
export async function markOverdueTeamTasks(limit = 50): Promise<number> {
  const now = new Date();
  const due = await prisma.teamWorkflowTask.findMany({
    where: {
      status: { in: ["PENDING", "IN_PROGRESS"] },
      deadline: { lt: now },
    },
    take: limit,
    select: { id: true, companyId: true, status: true },
  });
  let n = 0;
  for (const t of due) {
    await prisma.teamWorkflowTask.update({
      where: { id: t.id },
      data: { status: "OVERDUE" },
    });
    await recordTaskEvent({
      companyId: t.companyId,
      taskId: t.id,
      actorUserId: null,
      eventType: "STATUS_CHANGED",
      fromStatus: t.status,
      toStatus: "OVERDUE",
      message: "Deadline passed — marked overdue",
    });
    n += 1;
  }
  return n;
}

async function notifyAssignee(input: {
  companyId: string;
  tenderId: string;
  tenderTitle: string;
  taskId: string;
  taskTitle: string;
  assigneeUserId: string;
}) {
  const { notifyWorkflowStakeholders } = await import(
    "@/services/team-workflow/alerts"
  );
  await notifyWorkflowStakeholders({
    companyId: input.companyId,
    tenderId: input.tenderId,
    tenderTitle: input.tenderTitle,
    kind: "TASK_ASSIGNED",
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    targetUserId: input.assigneeUserId,
    message: `"${input.taskTitle}" on tender "${input.tenderTitle}" was assigned to you.`,
    dedupeKey: `${input.companyId}:${input.taskId}:assigned:${input.assigneeUserId}`,
  });
}
