import type { ComplianceReminderKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_CATEGORY_SEEDS } from "../constants";
import {
  addDaysDateOnly,
  dateOnlyToUtcDate,
  formatDateOnly,
  todayDateOnly,
} from "./date-only";
import { computeComplianceStatus } from "./status";
import type {
  ComplianceCategoryDto,
  ComplianceDocumentDto,
  ComplianceReminderSettingsDto,
} from "./types";
import type { ExtractionProvenanceEntry } from "./extract-metadata";

type DocRow = Prisma.ComplianceDocumentGetPayload<{
  include: {
    category: true;
    versions: { select: { id: true }; take: 1 };
    _count: { select: { versions: true } };
  };
}>;

function provenanceFromJson(
  value: Prisma.JsonValue | null | undefined,
): ExtractionProvenanceEntry[] | null {
  if (!value || !Array.isArray(value)) return null;
  return value as ExtractionProvenanceEntry[];
}

export function toDocumentDto(row: DocRow): ComplianceDocumentDto {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    categoryKey: row.category.key,
    categoryLabel: row.category.label,
    issuingAuthority: row.issuingAuthority,
    documentNumber: row.documentNumber,
    issueDate: row.issueDate ? formatDateOnly(row.issueDate) : null,
    expiryDate: row.expiryDate ? formatDateOnly(row.expiryDate) : null,
    status: row.status,
    extractionConfidence: row.extractionConfidence,
    extractionProvenance: provenanceFromJson(row.extractionProvenance),
    currentVersionId: row.currentVersionId,
    versionCount: row._count.versions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const docInclude = {
  category: true,
  versions: { select: { id: true }, take: 1 },
  _count: { select: { versions: true } },
} as const;

export async function ensureDefaultCategories(
  companyId: string,
): Promise<ComplianceCategoryDto[]> {
  for (const seed of DEFAULT_CATEGORY_SEEDS) {
    await prisma.complianceDocumentCategory.upsert({
      where: { companyId_key: { companyId, key: seed.key } },
      create: {
        companyId,
        key: seed.key,
        label: seed.label,
        sortOrder: seed.sortOrder,
      },
      update: {
        label: seed.label,
        sortOrder: seed.sortOrder,
      },
    });
  }
  const rows = await prisma.complianceDocumentCategory.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    sortOrder: r.sortOrder,
  }));
}

export async function getOrCreateReminderSettings(
  companyId: string,
): Promise<ComplianceReminderSettingsDto> {
  const row = await prisma.complianceReminderSettings.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
  });
  return {
    remind90d: row.remind90d,
    remind30d: row.remind30d,
    remind7d: row.remind7d,
    remindExpired: row.remindExpired,
    expiringSoonDays: row.expiringSoonDays,
  };
}

export async function updateReminderSettings(
  companyId: string,
  patch: Partial<ComplianceReminderSettingsDto>,
): Promise<ComplianceReminderSettingsDto> {
  const row = await prisma.complianceReminderSettings.upsert({
    where: { companyId },
    create: {
      companyId,
      remind90d: patch.remind90d ?? true,
      remind30d: patch.remind30d ?? true,
      remind7d: patch.remind7d ?? true,
      remindExpired: patch.remindExpired ?? true,
      expiringSoonDays: patch.expiringSoonDays ?? 90,
    },
    update: {
      ...(patch.remind90d !== undefined ? { remind90d: patch.remind90d } : {}),
      ...(patch.remind30d !== undefined ? { remind30d: patch.remind30d } : {}),
      ...(patch.remind7d !== undefined ? { remind7d: patch.remind7d } : {}),
      ...(patch.remindExpired !== undefined
        ? { remindExpired: patch.remindExpired }
        : {}),
      ...(patch.expiringSoonDays !== undefined
        ? { expiringSoonDays: patch.expiringSoonDays }
        : {}),
    },
  });
  return {
    remind90d: row.remind90d,
    remind30d: row.remind30d,
    remind7d: row.remind7d,
    remindExpired: row.remindExpired,
    expiringSoonDays: row.expiringSoonDays,
  };
}

export async function findCategoryByKey(companyId: string, key: string) {
  await ensureDefaultCategories(companyId);
  return prisma.complianceDocumentCategory.findUnique({
    where: { companyId_key: { companyId, key } },
  });
}

export async function listDocuments(input: {
  companyId: string;
  status?: string;
  categoryKey?: string;
  q?: string;
}): Promise<ComplianceDocumentDto[]> {
  const where: Prisma.ComplianceDocumentWhereInput = {
    companyId: input.companyId,
  };
  if (input.status) {
    where.status = input.status as never;
  }
  if (input.categoryKey) {
    where.category = { key: input.categoryKey, companyId: input.companyId };
  }
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { documentNumber: { contains: q, mode: "insensitive" } },
      { issuingAuthority: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.complianceDocument.findMany({
    where,
    include: docInclude,
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
  });
  return rows.map(toDocumentDto);
}

export async function getDocumentForCompany(
  companyId: string,
  documentId: string,
): Promise<ComplianceDocumentDto | null> {
  const row = await prisma.complianceDocument.findFirst({
    where: { id: documentId, companyId },
    include: docInclude,
  });
  return row ? toDocumentDto(row) : null;
}

export async function getVersionForCompany(
  companyId: string,
  versionId: string,
) {
  return prisma.complianceDocumentVersion.findFirst({
    where: { id: versionId, companyId },
  });
}

export async function listVersionsForDocument(
  companyId: string,
  documentId: string,
) {
  return prisma.complianceDocumentVersion.findMany({
    where: { companyId, documentId },
    orderBy: { versionNumber: "desc" },
  });
}

export async function nextVersionNumber(
  companyId: string,
  documentId: string,
): Promise<number> {
  const last = await prisma.complianceDocumentVersion.findFirst({
    where: { companyId, documentId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  return (last?.versionNumber ?? 0) + 1;
}

export async function refreshDocumentStatus(
  companyId: string,
  documentId: string,
): Promise<void> {
  const [doc, settings] = await Promise.all([
    prisma.complianceDocument.findFirst({
      where: { id: documentId, companyId },
    }),
    getOrCreateReminderSettings(companyId),
  ]);
  if (!doc) return;

  const provenance = provenanceFromJson(doc.extractionProvenance);
  const uncertain =
    Boolean(
      provenance?.some((p) => p.label === "non_expiry_date_ignored"),
    ) && !doc.expiryDate;
  const noExpiry = doc.status === "NO_EXPIRY" && !doc.expiryDate;
  // Prefer provenance/no expiry flags from stored facts
  const status = computeComplianceStatus({
    expiryDateYmd: doc.expiryDate ? formatDateOnly(doc.expiryDate) : null,
    uncertain: uncertain && !doc.expiryDate,
    noExpiry: !doc.expiryDate && (noExpiry || doc.status === "NO_EXPIRY"),
    expiringSoonDays: settings.expiringSoonDays,
  });

  // If currently UNKNOWN with no expiry, keep UNKNOWN
  const next =
    !doc.expiryDate && doc.status === "UNKNOWN"
      ? "UNKNOWN"
      : !doc.expiryDate && doc.status === "NO_EXPIRY"
        ? "NO_EXPIRY"
        : status;

  if (next !== doc.status) {
    await prisma.complianceDocument.updateMany({
      where: { id: documentId, companyId },
      data: { status: next },
    });
  }
}

export async function recomputeAllStatusesForCompany(
  companyId: string,
  limit = 100,
): Promise<number> {
  const settings = await getOrCreateReminderSettings(companyId);
  const docs = await prisma.complianceDocument.findMany({
    where: { companyId },
    take: limit,
    select: {
      id: true,
      expiryDate: true,
      status: true,
      extractionProvenance: true,
    },
  });
  let changed = 0;
  for (const doc of docs) {
    const next = computeComplianceStatus({
      expiryDateYmd: doc.expiryDate ? formatDateOnly(doc.expiryDate) : null,
      uncertain: doc.status === "UNKNOWN" && !doc.expiryDate,
      noExpiry: !doc.expiryDate && doc.status !== "UNKNOWN",
      expiringSoonDays: settings.expiringSoonDays,
    });
    if (next !== doc.status) {
      await prisma.complianceDocument.updateMany({
        where: { id: doc.id, companyId },
        data: { status: next },
      });
      changed += 1;
    }
  }
  return changed;
}

const REMINDER_OFFSETS: Array<{
  kind: ComplianceReminderKind;
  daysBefore: number | null;
  setting: keyof ComplianceReminderSettingsDto;
}> = [
  { kind: "DAYS_90", daysBefore: 90, setting: "remind90d" },
  { kind: "DAYS_30", daysBefore: 30, setting: "remind30d" },
  { kind: "DAYS_7", daysBefore: 7, setting: "remind7d" },
  { kind: "EXPIRED", daysBefore: null, setting: "remindExpired" },
];

export async function cancelRemindersForDocument(
  companyId: string,
  documentId: string,
): Promise<void> {
  await prisma.complianceExpiryReminder.updateMany({
    where: { companyId, documentId, status: "SCHEDULED" },
    data: { status: "CANCELLED" },
  });
  // Cancel linked in-app alerts so reconcile cannot re-arm dismissed/scheduled copies.
  await prisma.alert.updateMany({
    where: {
      companyId,
      status: "SCHEDULED",
      dedupeKey: { startsWith: `dcm:${companyId}:${documentId}:` },
    },
    data: { status: "CANCELLED" },
  });
}

export function planReminderDates(
  expiryYmd: string,
  settings: ComplianceReminderSettingsDto,
): Array<{ kind: ComplianceReminderKind; fireOnDate: string }> {
  const out: Array<{ kind: ComplianceReminderKind; fireOnDate: string }> = [];
  for (const offset of REMINDER_OFFSETS) {
    if (!settings[offset.setting]) continue;
    const fireOnDate =
      offset.daysBefore == null
        ? expiryYmd
        : addDaysDateOnly(expiryYmd, -offset.daysBefore);
    out.push({ kind: offset.kind, fireOnDate });
  }
  return out;
}

export function scheduledForFromDateOnly(ymd: string): Date {
  // Date-only fire: schedule at UTC midnight of that calendar day (no TZ shift).
  return dateOnlyToUtcDate(ymd);
}

export { todayDateOnly, formatDateOnly, dateOnlyToUtcDate };
