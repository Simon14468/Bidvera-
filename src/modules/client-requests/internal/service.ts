import type {
  ClientRequest,
  ClientRequestActivityType,
  ClientRequestItem,
  ClientRequestStatus,
  Prisma,
} from "@prisma/client";
import { generateToken, hashToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { storageService } from "@/services/storage";
import { CLIENT_REQUEST_SHARE_TTL_MS } from "../constants";
import {
  cancelRemindersForRequest,
  scheduleRemindersForRequest,
} from "./reminders";
import { calcProgressPercent, deriveRequestStatus } from "./status";
import type {
  ClientRequestActivityDto,
  ClientRequestDashboardDto,
  ClientRequestDto,
  ClientRequestItemDto,
  ClientRequestShareDto,
  SharedClientRequestView,
} from "./types";
import {
  addItemSchema,
  completeInformationSchema,
  createRequestSchema,
  createShareSchema,
  formatDateOnly,
  linkItemSchema,
  parseDateOnlyDeadline,
  updateRequestSchema,
} from "./validation";

type ItemWithLinks = ClientRequestItem & {
  complianceDocument: { id: string; name: string } | null;
  supplierEvidence: { id: string; title: string; storageKey: string | null } | null;
};

const itemInclude = {
  complianceDocument: { select: { id: true, name: true } },
  supplierEvidence: {
    select: { id: true, title: true, storageKey: true },
  },
} satisfies Prisma.ClientRequestItemInclude;

function toItemDto(item: ItemWithLinks): ClientRequestItemDto {
  return {
    id: item.id,
    type: item.type,
    label: item.label,
    description: item.description,
    sortOrder: item.sortOrder,
    status: item.status,
    informationValue: item.informationValue,
    linkSource: item.linkSource,
    complianceDocumentId: item.complianceDocumentId,
    complianceDocumentName: item.complianceDocument?.name ?? null,
    supplierEvidenceId: item.supplierEvidenceId,
    supplierEvidenceTitle: item.supplierEvidence?.title ?? null,
    completedAt: item.completedAt?.toISOString() ?? null,
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toListDto(
  row: ClientRequest & { items: Array<{ status: string }> },
): ClientRequestDto {
  const completedItemCount = row.items.filter((i) => i.status === "COMPLETED").length;
  return {
    id: row.id,
    clientName: row.clientName,
    title: row.title,
    description: row.description,
    deadline: row.deadline.toISOString(),
    deadlineDateOnly: row.deadlineDateOnly,
    status: row.status,
    progressPercent: row.progressPercent,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    itemCount: row.items.length,
    completedItemCount,
  };
}

async function recordActivity(input: {
  companyId: string;
  requestId: string;
  actorUserId?: string | null;
  eventType: ClientRequestActivityType;
  message?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.clientRequestActivity.create({
    data: {
      companyId: input.companyId,
      requestId: input.requestId,
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      message: input.message ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}

async function refreshRequestDerived(
  companyId: string,
  requestId: string,
  opts?: { actorUserId?: string | null; cancelReminders?: boolean },
): Promise<ClientRequest> {
  const row = await prisma.clientRequest.findFirst({
    where: { id: requestId, companyId },
    include: { items: { select: { status: true } } },
  });
  if (!row) {
    throw new AppError(ErrorCode.NOT_FOUND, "Client request not found.", 404);
  }

  const completedItems = row.items.filter((i) => i.status === "COMPLETED").length;
  const progressPercent = calcProgressPercent(completedItems, row.items.length);
  const nextStatus = deriveRequestStatus({
    cancelled: Boolean(row.cancelledAt),
    totalItems: row.items.length,
    completedItems,
    deadline: row.deadline,
    deadlineDateOnly: row.deadlineDateOnly,
  });

  const data: Prisma.ClientRequestUpdateInput = {
    progressPercent,
    status: nextStatus,
  };
  if (nextStatus === "COMPLETED" && !row.completedAt) {
    data.completedAt = new Date();
  }
  if (nextStatus !== "COMPLETED" && row.completedAt) {
    data.completedAt = null;
  }

  const updated = await prisma.clientRequest.update({
    where: { id: requestId },
    data,
  });

  if (row.status !== nextStatus) {
    await recordActivity({
      companyId,
      requestId,
      actorUserId: opts?.actorUserId,
      eventType: nextStatus === "COMPLETED" ? "COMPLETED" : "STATUS_CHANGED",
      message: `Status changed to ${nextStatus}`,
      metadata: { from: row.status, to: nextStatus },
    });
  }

  if (
    nextStatus === "COMPLETED" ||
    nextStatus === "CANCELLED" ||
    opts?.cancelReminders
  ) {
    await cancelRemindersForRequest(companyId, requestId);
  } else if (
    nextStatus === "PENDING" ||
    nextStatus === "IN_PROGRESS" ||
    nextStatus === "OVERDUE"
  ) {
    await scheduleRemindersForRequest({
      companyId,
      requestId,
      clientName: updated.clientName,
      title: updated.title,
      deadline: updated.deadline,
    });
  }

  return updated;
}

export async function listRequests(input: {
  companyId: string;
  status?: string;
  client?: string;
  sort?: string;
}): Promise<ClientRequestDto[]> {
  const where: Prisma.ClientRequestWhereInput = { companyId: input.companyId };
  if (input.status && input.status !== "ALL") {
    where.status = input.status as ClientRequestStatus;
  }
  if (input.client?.trim()) {
    where.clientName = { contains: input.client.trim(), mode: "insensitive" };
  }

  let orderBy: Prisma.ClientRequestOrderByWithRelationInput = { updatedAt: "desc" };
  if (input.sort === "deadline") orderBy = { deadline: "asc" };
  else if (input.sort === "client") orderBy = { clientName: "asc" };
  else if (input.sort === "status") orderBy = { status: "asc" };
  else if (input.sort === "updated") orderBy = { updatedAt: "desc" };

  const rows = await prisma.clientRequest.findMany({
    where,
    include: { items: { select: { status: true } } },
    orderBy,
    take: 500,
  });
  return rows.map(toListDto);
}

export async function getDashboard(
  companyId: string,
): Promise<ClientRequestDashboardDto> {
  await reconcileOverdueForCompany(companyId);
  const requests = await listRequests({ companyId, sort: "updated" });
  const byStatus: Record<ClientRequestStatus, number> = {
    PENDING: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    OVERDUE: 0,
    CANCELLED: 0,
  };
  for (const r of requests) byStatus[r.status] += 1;
  return { total: requests.length, byStatus, requests };
}

export async function getRequest(
  companyId: string,
  requestId: string,
): Promise<ClientRequestDto> {
  const row = await prisma.clientRequest.findFirst({
    where: { id: requestId, companyId },
    include: {
      items: { include: itemInclude, orderBy: { sortOrder: "asc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 100 },
      shares: {
        include: { items: { select: { itemId: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!row) {
    throw new AppError(ErrorCode.NOT_FOUND, "Client request not found.", 404);
  }

  const base = toListDto(row);
  const activities: ClientRequestActivityDto[] = row.activities.map((a) => ({
    id: a.id,
    eventType: a.eventType,
    message: a.message,
    actorUserId: a.actorUserId,
    createdAt: a.createdAt.toISOString(),
    metadata: a.metadata,
  }));
  const shares: ClientRequestShareDto[] = row.shares.map((s) => ({
    id: s.id,
    tokenPrefix: s.tokenPrefix,
    expiresAt: s.expiresAt?.toISOString() ?? null,
    revokedAt: s.revokedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    itemIds: s.items.map((i) => i.itemId),
  }));

  return {
    ...base,
    items: row.items.map(toItemDto),
    activities,
    shares,
  };
}

export async function createRequest(
  companyId: string,
  raw: unknown,
  actorUserId?: string | null,
): Promise<ClientRequestDto> {
  const parsed = createRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      ErrorCode.VALIDATION,
      parsed.error.issues[0]?.message ?? "Invalid request.",
      400,
    );
  }
  const data = parsed.data;
  const deadline = parseDateOnlyDeadline(data.deadline);

  const created = await prisma.clientRequest.create({
    data: {
      companyId,
      clientName: data.clientName,
      title: data.title,
      description: data.description ?? null,
      deadline,
      deadlineDateOnly: true,
      status: "PENDING",
      progressPercent: 0,
      createdByUserId: actorUserId ?? null,
      items: {
        create: data.items.map((item, idx) => ({
          companyId,
          type: item.type,
          label: item.label,
          description: item.description ?? null,
          sortOrder: idx,
        })),
      },
    },
    include: { items: { select: { status: true } } },
  });

  await recordActivity({
    companyId,
    requestId: created.id,
    actorUserId,
    eventType: "CREATED",
    message: `Request created for ${data.clientName}`,
  });
  for (const item of data.items) {
    await recordActivity({
      companyId,
      requestId: created.id,
      actorUserId,
      eventType: "ITEM_ADDED",
      message: `Item added: ${item.label}`,
      metadata: { type: item.type },
    });
  }

  await scheduleRemindersForRequest({
    companyId,
    requestId: created.id,
    clientName: created.clientName,
    title: created.title,
    deadline: created.deadline,
  });

  return toListDto(created);
}

export async function updateRequest(
  companyId: string,
  requestId: string,
  raw: unknown,
  actorUserId?: string | null,
): Promise<ClientRequestDto> {
  const parsed = updateRequestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      ErrorCode.VALIDATION,
      parsed.error.issues[0]?.message ?? "Invalid update.",
      400,
    );
  }
  const existing = await prisma.clientRequest.findFirst({
    where: { id: requestId, companyId },
  });
  if (!existing) {
    throw new AppError(ErrorCode.NOT_FOUND, "Client request not found.", 404);
  }
  if (existing.cancelledAt) {
    throw new AppError(ErrorCode.VALIDATION, "Cancelled requests cannot be edited.", 400);
  }

  const data = parsed.data;
  const deadlineChanged =
    data.deadline != null && data.deadline !== formatDateOnly(existing.deadline);

  await prisma.clientRequest.update({
    where: { id: requestId },
    data: {
      clientName: data.clientName ?? undefined,
      title: data.title ?? undefined,
      description:
        data.description === undefined ? undefined : data.description,
      deadline: data.deadline ? parseDateOnlyDeadline(data.deadline) : undefined,
      deadlineDateOnly: data.deadline ? true : undefined,
    },
  });

  await recordActivity({
    companyId,
    requestId,
    actorUserId,
    eventType: deadlineChanged ? "DEADLINE_CHANGED" : "UPDATED",
    message: deadlineChanged
      ? `Deadline changed to ${data.deadline}`
      : "Request details updated",
    metadata: deadlineChanged
      ? { from: formatDateOnly(existing.deadline), to: data.deadline }
      : undefined,
  });

  await refreshRequestDerived(companyId, requestId, { actorUserId });
  return getRequest(companyId, requestId);
}

export async function cancelRequest(
  companyId: string,
  requestId: string,
  actorUserId?: string | null,
): Promise<ClientRequestDto> {
  const existing = await prisma.clientRequest.findFirst({
    where: { id: requestId, companyId },
  });
  if (!existing) {
    throw new AppError(ErrorCode.NOT_FOUND, "Client request not found.", 404);
  }
  if (existing.cancelledAt) {
    return getRequest(companyId, requestId);
  }

  await prisma.clientRequest.update({
    where: { id: requestId },
    data: {
      cancelledAt: new Date(),
      status: "CANCELLED",
    },
  });
  await recordActivity({
    companyId,
    requestId,
    actorUserId,
    eventType: "CANCELLED",
    message: "Request cancelled",
  });
  await cancelRemindersForRequest(companyId, requestId);
  return getRequest(companyId, requestId);
}

export async function deleteRequest(
  companyId: string,
  requestId: string,
): Promise<void> {
  const existing = await prisma.clientRequest.findFirst({
    where: { id: requestId, companyId },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(ErrorCode.NOT_FOUND, "Client request not found.", 404);
  }
  await cancelRemindersForRequest(companyId, requestId);
  await prisma.clientRequest.delete({ where: { id: requestId } });
}

export async function addItem(
  companyId: string,
  requestId: string,
  raw: unknown,
  actorUserId?: string | null,
): Promise<ClientRequestDto> {
  const parsed = addItemSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      ErrorCode.VALIDATION,
      parsed.error.issues[0]?.message ?? "Invalid item.",
      400,
    );
  }
  const existing = await prisma.clientRequest.findFirst({
    where: { id: requestId, companyId },
    include: { items: { select: { sortOrder: true } } },
  });
  if (!existing) {
    throw new AppError(ErrorCode.NOT_FOUND, "Client request not found.", 404);
  }
  if (existing.cancelledAt) {
    throw new AppError(ErrorCode.VALIDATION, "Cannot add items to a cancelled request.", 400);
  }

  const maxOrder = existing.items.reduce((m, i) => Math.max(m, i.sortOrder), -1);
  await prisma.clientRequestItem.create({
    data: {
      companyId,
      requestId,
      type: parsed.data.type,
      label: parsed.data.label,
      description: parsed.data.description ?? null,
      sortOrder: maxOrder + 1,
    },
  });
  await recordActivity({
    companyId,
    requestId,
    actorUserId,
    eventType: "ITEM_ADDED",
    message: `Item added: ${parsed.data.label}`,
  });
  await refreshRequestDerived(companyId, requestId, { actorUserId });
  return getRequest(companyId, requestId);
}

export async function completeInformationItem(
  companyId: string,
  requestId: string,
  itemId: string,
  raw: unknown,
  actorUserId?: string | null,
): Promise<ClientRequestDto> {
  const parsed = completeInformationSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new AppError(ErrorCode.VALIDATION, "Invalid confirmation.", 400);
  }
  const item = await prisma.clientRequestItem.findFirst({
    where: { id: itemId, requestId, companyId },
  });
  if (!item) {
    throw new AppError(ErrorCode.NOT_FOUND, "Request item not found.", 404);
  }
  if (item.type !== "INFORMATION") {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Only information items can be manually confirmed this way.",
      400,
    );
  }

  await prisma.clientRequestItem.update({
    where: { id: itemId },
    data: {
      status: "COMPLETED",
      informationValue: parsed.data.informationValue ?? item.informationValue,
      completedAt: new Date(),
      completedByUserId: actorUserId ?? null,
    },
  });
  await recordActivity({
    companyId,
    requestId,
    actorUserId,
    eventType: "ITEM_COMPLETED",
    message: `Information completed: ${item.label}`,
  });
  await refreshRequestDerived(companyId, requestId, { actorUserId });
  return getRequest(companyId, requestId);
}

export async function reopenItem(
  companyId: string,
  requestId: string,
  itemId: string,
  actorUserId?: string | null,
): Promise<ClientRequestDto> {
  const item = await prisma.clientRequestItem.findFirst({
    where: { id: itemId, requestId, companyId },
  });
  if (!item) {
    throw new AppError(ErrorCode.NOT_FOUND, "Request item not found.", 404);
  }
  await prisma.clientRequestItem.update({
    where: { id: itemId },
    data: {
      status: "PENDING",
      completedAt: null,
      completedByUserId: null,
    },
  });
  await recordActivity({
    companyId,
    requestId,
    actorUserId,
    eventType: "ITEM_REOPENED",
    message: `Item reopened: ${item.label}`,
  });
  await refreshRequestDerived(companyId, requestId, { actorUserId });
  return getRequest(companyId, requestId);
}

export async function linkItemToBidveraData(
  companyId: string,
  requestId: string,
  itemId: string,
  raw: unknown,
  actorUserId?: string | null,
): Promise<ClientRequestDto> {
  const parsed = linkItemSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      ErrorCode.VALIDATION,
      parsed.error.issues[0]?.message ?? "Invalid link.",
      400,
    );
  }
  const item = await prisma.clientRequestItem.findFirst({
    where: { id: itemId, requestId, companyId },
  });
  if (!item) {
    throw new AppError(ErrorCode.NOT_FOUND, "Request item not found.", 404);
  }

  const link = parsed.data;
  let complianceDocumentId: string | null = null;
  let supplierEvidenceId: string | null = null;
  let labelHint = "";

  if (link.linkSource === "COMPLIANCE_DOCUMENT") {
    const doc = await prisma.complianceDocument.findFirst({
      where: { id: link.complianceDocumentId!, companyId },
      select: { id: true, name: true },
    });
    if (!doc) {
      throw new AppError(ErrorCode.NOT_FOUND, "Compliance document not found.", 404);
    }
    complianceDocumentId = doc.id;
    labelHint = doc.name;
  } else if (link.linkSource === "SUPPLIER_EVIDENCE") {
    const ev = await prisma.supplierQualificationEvidence.findFirst({
      where: { id: link.supplierEvidenceId!, companyId },
      select: { id: true, title: true },
    });
    if (!ev) {
      throw new AppError(ErrorCode.NOT_FOUND, "Qualification evidence not found.", 404);
    }
    supplierEvidenceId = ev.id;
    labelHint = ev.title;
  } else {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });
    if (!company) {
      throw new AppError(ErrorCode.NOT_FOUND, "Company not found.", 404);
    }
    labelHint = "Company Profile";
  }

  await prisma.clientRequestItem.update({
    where: { id: itemId },
    data: {
      linkSource: link.linkSource,
      complianceDocumentId,
      supplierEvidenceId,
      status: "COMPLETED",
      completedAt: new Date(),
      completedByUserId: actorUserId ?? null,
    },
  });

  await recordActivity({
    companyId,
    requestId,
    actorUserId,
    eventType: "DOCUMENT_ATTACHED",
    message: `Linked ${labelHint} to ${item.label}`,
    metadata: { linkSource: link.linkSource },
  });
  await recordActivity({
    companyId,
    requestId,
    actorUserId,
    eventType: "ITEM_COMPLETED",
    message: `Item completed: ${item.label}`,
  });

  await refreshRequestDerived(companyId, requestId, { actorUserId });
  return getRequest(companyId, requestId);
}

export async function unlinkItem(
  companyId: string,
  requestId: string,
  itemId: string,
  actorUserId?: string | null,
): Promise<ClientRequestDto> {
  const item = await prisma.clientRequestItem.findFirst({
    where: { id: itemId, requestId, companyId },
  });
  if (!item) {
    throw new AppError(ErrorCode.NOT_FOUND, "Request item not found.", 404);
  }
  await prisma.clientRequestItem.update({
    where: { id: itemId },
    data: {
      linkSource: null,
      complianceDocumentId: null,
      supplierEvidenceId: null,
      status: "PENDING",
      completedAt: null,
      completedByUserId: null,
      informationValue: null,
    },
  });
  await recordActivity({
    companyId,
    requestId,
    actorUserId,
    eventType: "DOCUMENT_DETACHED",
    message: `Detached link from ${item.label}`,
  });
  await refreshRequestDerived(companyId, requestId, { actorUserId });
  return getRequest(companyId, requestId);
}

export async function createShare(
  companyId: string,
  requestId: string,
  raw: unknown,
  actorUserId?: string | null,
): Promise<ClientRequestShareDto> {
  const parsed = createShareSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      ErrorCode.VALIDATION,
      parsed.error.issues[0]?.message ?? "Invalid share.",
      400,
    );
  }
  const request = await prisma.clientRequest.findFirst({
    where: { id: requestId, companyId },
    include: { items: { select: { id: true } } },
  });
  if (!request) {
    throw new AppError(ErrorCode.NOT_FOUND, "Client request not found.", 404);
  }
  if (request.status === "CANCELLED") {
    throw new AppError(ErrorCode.VALIDATION, "Cannot share a cancelled request.", 400);
  }

  const itemIdSet = new Set(request.items.map((i) => i.id));
  for (const id of parsed.data.itemIds) {
    if (!itemIdSet.has(id)) {
      throw new AppError(ErrorCode.VALIDATION, "Share includes an unknown item.", 400);
    }
  }

  const token = generateToken(32);
  const tokenHash = hashToken(token);
  const tokenPrefix = token.slice(0, 8);
  const ttlMs =
    (parsed.data.ttlDays ?? 14) * 24 * 60 * 60 * 1000 || CLIENT_REQUEST_SHARE_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs);

  const share = await prisma.clientRequestShare.create({
    data: {
      companyId,
      requestId,
      tokenHash,
      tokenPrefix,
      expiresAt,
      createdByUserId: actorUserId ?? null,
      items: {
        create: parsed.data.itemIds.map((itemId) => ({ itemId })),
      },
    },
    include: { items: { select: { itemId: true } } },
  });

  await recordActivity({
    companyId,
    requestId,
    actorUserId,
    eventType: "SHARED",
    message: "Shareable dossier link created",
    metadata: { shareId: share.id, itemCount: parsed.data.itemIds.length },
  });

  return {
    id: share.id,
    tokenPrefix: share.tokenPrefix,
    expiresAt: share.expiresAt?.toISOString() ?? null,
    revokedAt: null,
    createdAt: share.createdAt.toISOString(),
    itemIds: share.items.map((i) => i.itemId),
    url: `/share/client-request/${token}`,
  };
}

export async function revokeShare(
  companyId: string,
  requestId: string,
  shareId: string,
  actorUserId?: string | null,
): Promise<void> {
  const share = await prisma.clientRequestShare.findFirst({
    where: { id: shareId, requestId, companyId },
  });
  if (!share) {
    throw new AppError(ErrorCode.NOT_FOUND, "Share not found.", 404);
  }
  if (share.revokedAt) return;
  await prisma.clientRequestShare.update({
    where: { id: shareId },
    data: { revokedAt: new Date() },
  });
  await recordActivity({
    companyId,
    requestId,
    actorUserId,
    eventType: "SHARE_REVOKED",
    message: "Share link revoked",
    metadata: { shareId },
  });
}

export async function resolveSharedView(
  token: string,
): Promise<SharedClientRequestView> {
  const tokenHash = hashToken(token);
  const share = await prisma.clientRequestShare.findUnique({
    where: { tokenHash },
    include: {
      items: { select: { itemId: true } },
      request: {
        include: {
          company: {
            include: { profile: true },
          },
          items: { include: itemInclude },
        },
      },
    },
  });
  if (!share || share.revokedAt) {
    throw new AppError(ErrorCode.FORBIDDEN, "This share link is invalid or revoked.", 403);
  }
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    throw new AppError(ErrorCode.FORBIDDEN, "This share link has expired.", 403);
  }

  const allowed = new Set(share.items.map((i) => i.itemId));
  const request = share.request;
  const sharedItems = request.items
    .filter((i) => allowed.has(i.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const includeProfile = sharedItems.some(
    (i) => i.linkSource === "COMPANY_PROFILE" && i.status === "COMPLETED",
  );
  const profile = request.company.profile;

  return {
    companyName: request.company.name,
    clientName: request.clientName,
    title: request.title,
    description: request.description,
    deadline: request.deadline.toISOString(),
    deadlineDateOnly: request.deadlineDateOnly,
    status: request.status,
    progressPercent: calcProgressPercent(
      sharedItems.filter((i) => i.status === "COMPLETED").length,
      sharedItems.length,
    ),
    updatedAt: request.updatedAt.toISOString(),
    items: sharedItems.map((item) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      description: item.description,
      status: item.status,
      informationValue:
        item.type === "INFORMATION" && item.status === "COMPLETED"
          ? item.informationValue
          : null,
      linkSource: item.linkSource,
      documentLabel:
        item.complianceDocument?.name ??
        item.supplierEvidence?.title ??
        (item.linkSource === "COMPANY_PROFILE" ? "Company Profile" : null),
      hasDownload:
        item.status === "COMPLETED" &&
        ((item.linkSource === "COMPLIANCE_DOCUMENT" &&
          Boolean(item.complianceDocumentId)) ||
          (item.linkSource === "SUPPLIER_EVIDENCE" &&
            Boolean(item.supplierEvidence?.storageKey))),
    })),
    companyProfile:
      includeProfile && profile
        ? {
            industry: profile.industry,
            country: profile.country,
            companySize: profile.companySize,
            services: profile.services,
            certifications: profile.certifications,
            employeeRange: profile.employeeRange,
            geographicCoverage: profile.geographicCoverage,
          }
        : null,
  };
}

export async function downloadSharedItemFile(input: {
  token: string;
  itemId: string;
}): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  const tokenHash = hashToken(input.token);
  const share = await prisma.clientRequestShare.findUnique({
    where: { tokenHash },
    include: {
      items: { select: { itemId: true } },
    },
  });
  if (!share || share.revokedAt) {
    throw new AppError(ErrorCode.FORBIDDEN, "This share link is invalid or revoked.", 403);
  }
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    throw new AppError(ErrorCode.FORBIDDEN, "This share link has expired.", 403);
  }
  if (!share.items.some((i) => i.itemId === input.itemId)) {
    throw new AppError(ErrorCode.FORBIDDEN, "Item is not included in this share.", 403);
  }

  const item = await prisma.clientRequestItem.findFirst({
    where: {
      id: input.itemId,
      requestId: share.requestId,
      companyId: share.companyId,
      status: "COMPLETED",
    },
    include: {
      complianceDocument: {
        select: { id: true, currentVersionId: true, name: true },
      },
      supplierEvidence: true,
    },
  });
  if (!item) {
    throw new AppError(ErrorCode.NOT_FOUND, "Item not found.", 404);
  }

  if (item.linkSource === "COMPLIANCE_DOCUMENT" && item.complianceDocument) {
    const versionId = item.complianceDocument.currentVersionId;
    if (!versionId) {
      throw new AppError(ErrorCode.NOT_FOUND, "Document file not available.", 404);
    }
    const version = await prisma.complianceDocumentVersion.findFirst({
      where: {
        id: versionId,
        companyId: share.companyId,
        documentId: item.complianceDocument.id,
      },
    });
    if (!version || !version.storageKey.startsWith(`${share.companyId}/`)) {
      throw new AppError(ErrorCode.NOT_FOUND, "Document file not available.", 404);
    }
    const buffer = await storageService.getObject(version.storageKey);
    return {
      buffer,
      fileName: version.fileName,
      mimeType: version.mimeType,
    };
  }

  if (item.linkSource === "SUPPLIER_EVIDENCE" && item.supplierEvidence?.storageKey) {
    const key = item.supplierEvidence.storageKey;
    if (!key.startsWith(`${share.companyId}/`)) {
      throw new AppError(ErrorCode.FORBIDDEN, "File ownership mismatch.", 403);
    }
    const buffer = await storageService.getObject(key);
    return {
      buffer,
      fileName: item.supplierEvidence.fileName ?? "evidence",
      mimeType: item.supplierEvidence.mimeType ?? "application/octet-stream",
    };
  }

  throw new AppError(ErrorCode.NOT_FOUND, "No downloadable file for this item.", 404);
}

export async function reconcileOverdueForCompany(companyId: string): Promise<number> {
  const open = await prisma.clientRequest.findMany({
    where: {
      companyId,
      cancelledAt: null,
      status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] },
    },
    include: { items: { select: { status: true } } },
    take: 200,
  });
  let n = 0;
  for (const row of open) {
    const completedItems = row.items.filter((i) => i.status === "COMPLETED").length;
    const next = deriveRequestStatus({
      cancelled: false,
      totalItems: row.items.length,
      completedItems,
      deadline: row.deadline,
      deadlineDateOnly: row.deadlineDateOnly,
    });
    const progressPercent = calcProgressPercent(completedItems, row.items.length);
    if (next !== row.status || progressPercent !== row.progressPercent) {
      await prisma.clientRequest.update({
        where: { id: row.id },
        data: {
          status: next,
          progressPercent,
          completedAt: next === "COMPLETED" ? row.completedAt ?? new Date() : null,
        },
      });
      if (next === "COMPLETED" || next === "CANCELLED") {
        await cancelRemindersForRequest(companyId, row.id);
      }
      n += 1;
    }
  }
  return n;
}

export async function reconcileClientRequests(limit = 40): Promise<{
  overdueUpdated: number;
}> {
  const companies = await prisma.clientRequest.findMany({
    where: {
      cancelledAt: null,
      status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] },
    },
    select: { companyId: true },
    distinct: ["companyId"],
    take: limit,
  });
  let overdueUpdated = 0;
  for (const c of companies) {
    overdueUpdated += await reconcileOverdueForCompany(c.companyId);
  }
  return { overdueUpdated };
}

export {
  calcProgressPercent,
  deriveRequestStatus,
  isDeadlinePassed,
} from "./status";
export { planClientRequestReminderFireTimes } from "./reminders";
export { formatDateOnly, parseDateOnlyDeadline } from "./validation";
