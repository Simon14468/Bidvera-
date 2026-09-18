/**
 * Tender Calendar service — tenant-scoped CRUD for calendar tenders/deadlines/events.
 * No tender analysis, no AI, no invented timezones.
 */

import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import {
  computeMilestoneStatus,
  orderByOccursAtAsc,
  parseOccurrenceInput,
} from "./datetime";
import {
  getOrCreateReminderSettings,
  scheduleRemindersForDeadline,
  cancelRemindersForDeadline,
  updateReminderSettings,
} from "./reminders";
import type {
  CalendarDashboardDto,
  CalendarDeadlineDto,
  CalendarEventDto,
  CalendarTenderDto,
  ReminderSettingsDto,
} from "./types";
import {
  milestoneInputSchema,
  reminderSettingsSchema,
  tenderCreateSchema,
  tenderUpdateSchema,
} from "./validation";

function toTenderDto(
  row: {
    id: string;
    companyId: string;
    title: string;
    referenceNumber: string | null;
    buyerAuthority: string | null;
    country: string | null;
    category: string | null;
    description: string | null;
    status: CalendarTenderDto["status"];
    sourceUrl: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  extra?: { deadlineCount?: number; nextDeadlineAt?: Date | null },
): CalendarTenderDto {
  return {
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    referenceNumber: row.referenceNumber,
    buyerAuthority: row.buyerAuthority,
    country: row.country,
    category: row.category,
    description: row.description,
    status: row.status,
    sourceUrl: row.sourceUrl,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deadlineCount: extra?.deadlineCount,
    nextDeadlineAt: extra?.nextDeadlineAt?.toISOString() ?? null,
  };
}

function toDeadlineDto(row: {
  id: string;
  companyId: string;
  tenderId: string;
  type: CalendarDeadlineDto["type"];
  title: string;
  occursAt: Date;
  dateOnly: boolean;
  timezone: string | null;
  source: string | null;
  notes: string | null;
  status: CalendarDeadlineDto["status"];
  createdAt: Date;
  updatedAt: Date;
}): CalendarDeadlineDto {
  return {
    id: row.id,
    companyId: row.companyId,
    tenderId: row.tenderId,
    type: row.type,
    title: row.title,
    occursAt: row.occursAt.toISOString(),
    dateOnly: row.dateOnly,
    timezone: row.timezone,
    source: row.source,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toEventDto(row: {
  id: string;
  companyId: string;
  tenderId: string;
  type: CalendarEventDto["type"];
  title: string;
  occursAt: Date;
  dateOnly: boolean;
  timezone: string | null;
  source: string | null;
  notes: string | null;
  status: CalendarEventDto["status"];
  createdAt: Date;
  updatedAt: Date;
}): CalendarEventDto {
  return {
    id: row.id,
    companyId: row.companyId,
    tenderId: row.tenderId,
    type: row.type,
    title: row.title,
    occursAt: row.occursAt.toISOString(),
    dateOnly: row.dateOnly,
    timezone: row.timezone,
    source: row.source,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertTenderOwned(companyId: string, tenderId: string) {
  const row = await prisma.calendarTender.findFirst({
    where: { id: tenderId, companyId },
  });
  if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  return row;
}

export async function listTenders(input: {
  companyId: string;
  status?: string;
  category?: string;
  country?: string;
  q?: string;
}): Promise<CalendarTenderDto[]> {
  const where: Prisma.CalendarTenderWhereInput = { companyId: input.companyId };
  if (input.status) where.status = input.status as never;
  if (input.category) where.category = input.category;
  if (input.country) where.country = input.country;
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { referenceNumber: { contains: q, mode: "insensitive" } },
      { buyerAuthority: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.calendarTender.findMany({
    where,
    include: {
      deadlines: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { occursAt: "asc" },
        take: 1,
      },
      _count: { select: { deadlines: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  return rows.map((r) =>
    toTenderDto(r, {
      deadlineCount: r._count.deadlines,
      nextDeadlineAt: r.deadlines[0]?.occursAt ?? null,
    }),
  );
}

export async function getTender(
  companyId: string,
  tenderId: string,
): Promise<CalendarTenderDto | null> {
  const row = await prisma.calendarTender.findFirst({
    where: { id: tenderId, companyId },
    include: {
      _count: { select: { deadlines: true } },
      deadlines: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { occursAt: "asc" },
        take: 1,
      },
    },
  });
  if (!row) return null;
  return toTenderDto(row, {
    deadlineCount: row._count.deadlines,
    nextDeadlineAt: row.deadlines[0]?.occursAt ?? null,
  });
}

export async function createTender(
  companyId: string,
  raw: unknown,
): Promise<CalendarTenderDto> {
  const parsed = tenderCreateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      ErrorCode.VALIDATION,
      parsed.error.issues[0]?.message ?? "Invalid tender.",
      400,
    );
  }
  const d = parsed.data;
  const row = await prisma.calendarTender.create({
    data: {
      companyId,
      title: d.title,
      referenceNumber: d.referenceNumber ?? null,
      buyerAuthority: d.buyerAuthority ?? null,
      country: d.country ?? null,
      category: d.category ?? null,
      description: d.description ?? null,
      status: d.status ?? "OPEN",
      sourceUrl: d.sourceUrl ?? null,
      notes: d.notes ?? null,
    },
  });
  return toTenderDto(row, { deadlineCount: 0, nextDeadlineAt: null });
}

export async function updateTender(
  companyId: string,
  tenderId: string,
  raw: unknown,
): Promise<CalendarTenderDto> {
  await assertTenderOwned(companyId, tenderId);
  const parsed = tenderUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      ErrorCode.VALIDATION,
      parsed.error.issues[0]?.message ?? "Invalid tender.",
      400,
    );
  }
  const clean = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );
  await prisma.calendarTender.updateMany({
    where: { id: tenderId, companyId },
    data: clean,
  });
  const dto = await getTender(companyId, tenderId);
  if (!dto) throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  return dto;
}

export async function deleteTender(
  companyId: string,
  tenderId: string,
): Promise<void> {
  const deadlines = await prisma.calendarTenderDeadline.findMany({
    where: { companyId, tenderId },
    select: { id: true },
  });
  for (const d of deadlines) {
    await cancelRemindersForDeadline(companyId, d.id);
  }
  const result = await prisma.calendarTender.deleteMany({
    where: { id: tenderId, companyId },
  });
  if (result.count === 0) {
    throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  }
}

export async function listDeadlines(
  companyId: string,
  tenderId: string,
): Promise<CalendarDeadlineDto[]> {
  await assertTenderOwned(companyId, tenderId);
  const rows = await prisma.calendarTenderDeadline.findMany({
    where: { companyId, tenderId },
    orderBy: { occursAt: "asc" },
  });
  return orderByOccursAtAsc(rows).map(toDeadlineDto);
}

export async function createDeadline(
  companyId: string,
  tenderId: string,
  raw: unknown,
): Promise<CalendarDeadlineDto> {
  const tender = await assertTenderOwned(companyId, tenderId);
  const parsed = milestoneInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      ErrorCode.VALIDATION,
      parsed.error.issues[0]?.message ?? "Invalid deadline.",
      400,
    );
  }
  let occurrence;
  try {
    occurrence = parseOccurrenceInput(parsed.data);
  } catch (e) {
    throw new AppError(
      ErrorCode.VALIDATION,
      e instanceof Error ? e.message : "Invalid date.",
      400,
    );
  }

  // Duplicate deadline guard (same tender/type/title/occursAt)
  const dup = await prisma.calendarTenderDeadline.findFirst({
    where: {
      companyId,
      tenderId,
      type: parsed.data.type,
      title: parsed.data.title,
      occursAt: occurrence.occursAt,
    },
  });
  if (dup) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "A deadline with the same type, title, and time already exists.",
      409,
    );
  }

  const status = computeMilestoneStatus(
    occurrence.occursAt,
    occurrence.dateOnly,
  );
  const row = await prisma.calendarTenderDeadline.create({
    data: {
      companyId,
      tenderId,
      type: parsed.data.type,
      title: parsed.data.title,
      occursAt: occurrence.occursAt,
      dateOnly: occurrence.dateOnly,
      timezone: occurrence.timezone,
      source: parsed.data.source ?? null,
      notes: parsed.data.notes ?? null,
      status,
    },
  });

  await scheduleRemindersForDeadline({
    companyId,
    tenderId,
    tenderTitle: tender.title,
    deadlineId: row.id,
    deadlineTitle: row.title,
    occursAt: row.occursAt,
  });

  return toDeadlineDto(row);
}

export async function updateDeadline(
  companyId: string,
  deadlineId: string,
  raw: unknown,
): Promise<CalendarDeadlineDto> {
  const existing = await prisma.calendarTenderDeadline.findFirst({
    where: { id: deadlineId, companyId },
    include: { tender: { select: { title: true } } },
  });
  if (!existing) {
    throw new AppError(ErrorCode.NOT_FOUND, "Deadline not found.", 404);
  }
  const parsed = milestoneInputSchema.partial().safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      ErrorCode.VALIDATION,
      parsed.error.issues[0]?.message ?? "Invalid deadline.",
      400,
    );
  }

  let occursAt = existing.occursAt;
  let dateOnly = existing.dateOnly;
  let timezone = existing.timezone;
  if (
    parsed.data.date !== undefined ||
    parsed.data.dateTime !== undefined ||
    parsed.data.dateOnly !== undefined ||
    parsed.data.timezone !== undefined
  ) {
    try {
      const occurrence = parseOccurrenceInput({
        date: parsed.data.date ?? (existing.dateOnly ? existing.occursAt.toISOString().slice(0, 10) : null),
        dateTime: parsed.data.dateTime,
        dateOnly: parsed.data.dateOnly ?? existing.dateOnly,
        timezone:
          parsed.data.timezone !== undefined
            ? parsed.data.timezone
            : existing.timezone,
      });
      occursAt = occurrence.occursAt;
      dateOnly = occurrence.dateOnly;
      timezone = occurrence.timezone;
    } catch (e) {
      throw new AppError(
        ErrorCode.VALIDATION,
        e instanceof Error ? e.message : "Invalid date.",
        400,
      );
    }
  }

  const status = computeMilestoneStatus(occursAt, dateOnly);
  await prisma.calendarTenderDeadline.updateMany({
    where: { id: deadlineId, companyId },
    data: {
      type: parsed.data.type ?? existing.type,
      title: parsed.data.title ?? existing.title,
      occursAt,
      dateOnly,
      timezone,
      source:
        parsed.data.source !== undefined ? parsed.data.source : existing.source,
      notes:
        parsed.data.notes !== undefined ? parsed.data.notes : existing.notes,
      status,
    },
  });

  const row = await prisma.calendarTenderDeadline.findFirstOrThrow({
    where: { id: deadlineId, companyId },
  });

  await scheduleRemindersForDeadline({
    companyId,
    tenderId: row.tenderId,
    tenderTitle: existing.tender.title,
    deadlineId: row.id,
    deadlineTitle: row.title,
    occursAt: row.occursAt,
  });

  return toDeadlineDto(row);
}

export async function deleteDeadline(
  companyId: string,
  deadlineId: string,
): Promise<void> {
  await cancelRemindersForDeadline(companyId, deadlineId);
  const result = await prisma.calendarTenderDeadline.deleteMany({
    where: { id: deadlineId, companyId },
  });
  if (result.count === 0) {
    throw new AppError(ErrorCode.NOT_FOUND, "Deadline not found.", 404);
  }
}

export async function listEvents(
  companyId: string,
  tenderId: string,
): Promise<CalendarEventDto[]> {
  await assertTenderOwned(companyId, tenderId);
  const rows = await prisma.calendarTenderEvent.findMany({
    where: { companyId, tenderId },
    orderBy: { occursAt: "asc" },
  });
  return orderByOccursAtAsc(rows).map(toEventDto);
}

export async function createEvent(
  companyId: string,
  tenderId: string,
  raw: unknown,
): Promise<CalendarEventDto> {
  await assertTenderOwned(companyId, tenderId);
  const parsed = milestoneInputSchema.safeParse({
    ...(typeof raw === "object" && raw ? raw : {}),
    type:
      typeof raw === "object" && raw && "type" in raw
        ? (raw as { type?: string }).type
        : "OTHER",
  });
  if (!parsed.success) {
    throw new AppError(
      ErrorCode.VALIDATION,
      parsed.error.issues[0]?.message ?? "Invalid event.",
      400,
    );
  }
  let occurrence;
  try {
    occurrence = parseOccurrenceInput(parsed.data);
  } catch (e) {
    throw new AppError(
      ErrorCode.VALIDATION,
      e instanceof Error ? e.message : "Invalid date.",
      400,
    );
  }

  const existing = await prisma.calendarTenderEvent.findFirst({
    where: {
      companyId,
      tenderId,
      type: parsed.data.type,
      title: parsed.data.title,
      occursAt: occurrence.occursAt,
    },
  });
  if (existing) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "A duplicate event already exists for this tender.",
      409,
    );
  }

  const status = computeMilestoneStatus(
    occurrence.occursAt,
    occurrence.dateOnly,
  );

  try {
    const row = await prisma.calendarTenderEvent.create({
      data: {
        companyId,
        tenderId,
        type: parsed.data.type,
        title: parsed.data.title,
        occursAt: occurrence.occursAt,
        dateOnly: occurrence.dateOnly,
        timezone: occurrence.timezone,
        source: parsed.data.source ?? null,
        notes: parsed.data.notes ?? null,
        status,
      },
    });
    return toEventDto(row);
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "A duplicate event already exists for this tender.",
        409,
      );
    }
    throw e;
  }
}

export async function deleteEvent(
  companyId: string,
  eventId: string,
): Promise<void> {
  const result = await prisma.calendarTenderEvent.deleteMany({
    where: { id: eventId, companyId },
  });
  if (result.count === 0) {
    throw new AppError(ErrorCode.NOT_FOUND, "Event not found.", 404);
  }
}

export async function getDashboard(
  companyId: string,
): Promise<CalendarDashboardDto> {
  await refreshMilestoneStatuses(companyId);
  const now = new Date();
  const startOfTodayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const [upcomingRows, pastRows, tenderCount] = await Promise.all([
    prisma.calendarTenderDeadline.findMany({
      where: {
        companyId,
        status: { not: "CANCELLED" },
        occursAt: { gte: startOfTodayUtc },
      },
      include: { tender: { select: { title: true } } },
      orderBy: { occursAt: "asc" },
      take: 30,
    }),
    prisma.calendarTenderDeadline.findMany({
      where: {
        companyId,
        status: { not: "CANCELLED" },
        occursAt: { lt: startOfTodayUtc },
      },
      include: { tender: { select: { title: true } } },
      orderBy: { occursAt: "desc" },
      take: 20,
    }),
    prisma.calendarTender.count({ where: { companyId } }),
  ]);

  return {
    upcoming: upcomingRows.map((d) => ({
      ...toDeadlineDto(d),
      tenderTitle: d.tender.title,
    })),
    past: pastRows.map((d) => ({
      ...toDeadlineDto(d),
      tenderTitle: d.tender.title,
    })),
    tenderCount,
  };
}

export async function listCalendarMonth(input: {
  companyId: string;
  year: number;
  month: number; // 1-12
}): Promise<Array<(CalendarDeadlineDto | CalendarEventDto) & { kind: "deadline" | "event"; tenderTitle: string }>> {
  if (
    !Number.isInteger(input.year) ||
    !Number.isInteger(input.month) ||
    input.month < 1 ||
    input.month > 12 ||
    input.year < 1970 ||
    input.year > 2100
  ) {
    throw new AppError(ErrorCode.VALIDATION, "Invalid year or month.", 400);
  }
  const start = new Date(Date.UTC(input.year, input.month - 1, 1));
  const end = new Date(Date.UTC(input.year, input.month, 1));
  const [deadlines, events] = await Promise.all([
    prisma.calendarTenderDeadline.findMany({
      where: {
        companyId: input.companyId,
        occursAt: { gte: start, lt: end },
        status: { not: "CANCELLED" },
      },
      include: { tender: { select: { title: true } } },
      take: 500,
    }),
    prisma.calendarTenderEvent.findMany({
      where: {
        companyId: input.companyId,
        occursAt: { gte: start, lt: end },
        status: { not: "CANCELLED" },
      },
      include: { tender: { select: { title: true } } },
      take: 500,
    }),
  ]);

  const items = [
    ...deadlines.map((d) => ({
      ...toDeadlineDto(d),
      kind: "deadline" as const,
      tenderTitle: d.tender.title,
    })),
    ...events.map((e) => ({
      ...toEventDto(e),
      kind: "event" as const,
      tenderTitle: e.tender.title,
    })),
  ];
  return orderByOccursAtAsc(items);
}

export async function getReminderSettings(
  companyId: string,
): Promise<ReminderSettingsDto> {
  return getOrCreateReminderSettings(companyId);
}

export async function saveReminderSettings(
  companyId: string,
  raw: unknown,
): Promise<ReminderSettingsDto> {
  const parsed = reminderSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(ErrorCode.VALIDATION, "Invalid reminder settings.", 400);
  }
  const settings = await updateReminderSettings(companyId, parsed.data);
  // Reschedule open deadlines
  const deadlines = await prisma.calendarTenderDeadline.findMany({
    where: { companyId, status: { not: "CANCELLED" } },
    include: { tender: { select: { title: true } } },
    take: 200,
  });
  for (const d of deadlines) {
    await scheduleRemindersForDeadline({
      companyId,
      tenderId: d.tenderId,
      tenderTitle: d.tender.title,
      deadlineId: d.id,
      deadlineTitle: d.title,
      occursAt: d.occursAt,
    });
  }
  return settings;
}

export async function refreshMilestoneStatuses(
  companyId: string,
  limit = 200,
): Promise<number> {
  const [deadlines, events] = await Promise.all([
    prisma.calendarTenderDeadline.findMany({
      where: { companyId, status: { not: "CANCELLED" } },
      take: limit,
    }),
    prisma.calendarTenderEvent.findMany({
      where: { companyId, status: { not: "CANCELLED" } },
      take: limit,
    }),
  ]);
  let changed = 0;
  for (const d of deadlines) {
    const next = computeMilestoneStatus(d.occursAt, d.dateOnly);
    if (next !== d.status) {
      await prisma.calendarTenderDeadline.updateMany({
        where: { id: d.id, companyId },
        data: { status: next },
      });
      changed += 1;
    }
  }
  for (const e of events) {
    const next = computeMilestoneStatus(e.occursAt, e.dateOnly);
    if (next !== e.status) {
      await prisma.calendarTenderEvent.updateMany({
        where: { id: e.id, companyId },
        data: { status: next },
      });
      changed += 1;
    }
  }
  return changed;
}

export async function reconcileTenderCalendar(limit = 40): Promise<{
  statusUpdates: number;
}> {
  const { hasFeature } = await import("@/services/entitlements");
  const { TENDER_CALENDAR_FEATURE_KEY } = await import("../constants");
  const companies = await prisma.calendarTender.findMany({
    distinct: ["companyId"],
    take: limit * 2,
    orderBy: { updatedAt: "desc" },
    select: { companyId: true },
  });
  let statusUpdates = 0;
  let eligible = 0;
  for (const c of companies) {
    if (eligible >= limit) break;
    if (!(await hasFeature(c.companyId, TENDER_CALENDAR_FEATURE_KEY))) continue;
    eligible += 1;
    statusUpdates += await refreshMilestoneStatuses(c.companyId, 100);
  }
  return { statusUpdates };
}
