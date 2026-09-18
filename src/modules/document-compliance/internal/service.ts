/**
 * Document Compliance service — tenant-scoped mutations and reads.
 * AI/OCR extraction never executes actions; this layer persists facts only.
 */

import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { extractDocumentText } from "@/services/document/extract";
import { storageService } from "@/services/storage";
import {
  dateOnlyToUtcDate,
  formatDateOnly,
  isDateOnlyString,
} from "./date-only";
import { extractComplianceMetadataFromText } from "./extract-metadata";
import { scheduleRemindersForDocument } from "./reminders";
import {
  ensureDefaultCategories,
  getDocumentForCompany,
  getOrCreateReminderSettings,
  getVersionForCompany,
  listDocuments,
  listVersionsForDocument,
  nextVersionNumber,
  recomputeAllStatusesForCompany,
  toDocumentDto,
  updateReminderSettings,
} from "./repository";
import { computeComplianceStatus } from "./status";
import type {
  AddComplianceVersionInput,
  ComplianceDashboardDto,
  ComplianceDocumentDto,
  ComplianceReminderSettingsDto,
  UploadComplianceDocumentInput,
} from "./types";
import type { ComplianceStatus } from "@prisma/client";

function assertDateOnlyOrNull(value: string | null | undefined, field: string) {
  if (value == null || value === "") return null;
  if (!isDateOnlyString(value)) {
    throw new AppError(
      ErrorCode.VALIDATION,
      `${field} must be a calendar date (YYYY-MM-DD).`,
      400,
    );
  }
  return value;
}

async function extractTextSafe(input: {
  body: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<{ text: string; preview: string }> {
  try {
    const extracted = await extractDocumentText({
      buffer: input.body,
      mimeType: input.mimeType,
      fileName: input.fileName,
    });
    const text = extracted.text?.trim() ?? "";
    return { text, preview: text.slice(0, 4000) };
  } catch {
    return { text: "", preview: "" };
  }
}

export async function getComplianceDashboard(
  companyId: string,
): Promise<ComplianceDashboardDto> {
  await recomputeAllStatusesForCompany(companyId, 200);
  const docs = await listDocuments({ companyId });
  const byStatus = {
    VALID: 0,
    EXPIRING_SOON: 0,
    EXPIRED: 0,
    NO_EXPIRY: 0,
    UNKNOWN: 0,
  } as Record<ComplianceStatus, number>;
  for (const d of docs) byStatus[d.status] += 1;
  return {
    total: docs.length,
    byStatus,
    expiringSoon: docs.filter((d) => d.status === "EXPIRING_SOON").slice(0, 10),
    expired: docs.filter((d) => d.status === "EXPIRED").slice(0, 10),
  };
}

export async function listComplianceDocuments(input: {
  companyId: string;
  status?: string;
  categoryKey?: string;
  q?: string;
}): Promise<ComplianceDocumentDto[]> {
  return listDocuments(input);
}

export async function getComplianceDocument(
  companyId: string,
  documentId: string,
): Promise<ComplianceDocumentDto | null> {
  return getDocumentForCompany(companyId, documentId);
}

export async function listComplianceCategories(companyId: string) {
  return ensureDefaultCategories(companyId);
}

export async function getComplianceReminderSettings(companyId: string) {
  return getOrCreateReminderSettings(companyId);
}

export async function saveComplianceReminderSettings(
  companyId: string,
  patch: Partial<ComplianceReminderSettingsDto>,
) {
  const settings = await updateReminderSettings(companyId, patch);
  // Reschedule for documents with expiry
  const docs = await prisma.complianceDocument.findMany({
    where: { companyId, expiryDate: { not: null } },
    select: { id: true, name: true, expiryDate: true },
  });
  for (const doc of docs) {
    if (!doc.expiryDate) continue;
    await scheduleRemindersForDocument({
      companyId,
      documentId: doc.id,
      documentName: doc.name,
      expiryDateYmd: formatDateOnly(doc.expiryDate),
    });
  }
  await recomputeAllStatusesForCompany(companyId, 200);
  return settings;
}

export async function uploadComplianceDocument(
  input: UploadComplianceDocumentInput,
): Promise<ComplianceDocumentDto> {
  const { companyId } = input;
  const categories = await ensureDefaultCategories(companyId);
  const categoryKey = input.categoryKey ?? "OTHER";
  const category =
    categories.find((c) => c.key === categoryKey) ??
    categories.find((c) => c.key === "OTHER");
  if (!category) {
    throw new AppError(ErrorCode.VALIDATION, "Document category missing.", 400);
  }

  const { text, preview } = await extractTextSafe({
    body: input.body,
    mimeType: input.mimeType,
    fileName: input.fileName,
  });
  const extracted = extractComplianceMetadataFromText(text, input.fileName);

  const userIssue = assertDateOnlyOrNull(input.issueDate, "issueDate");
  const userExpiry = assertDateOnlyOrNull(input.expiryDate, "expiryDate");
  const noExpiry = Boolean(input.noExpiry) || extracted.noExpiry;

  // Never invent expiry: only use extracted expiry when confidently labeled.
  let expiryDateYmd: string | null = null;
  let uncertain = extracted.uncertain;
  if (userExpiry) {
    expiryDateYmd = userExpiry;
    uncertain = false;
  } else if (noExpiry) {
    expiryDateYmd = null;
    uncertain = false;
  } else if (extracted.expiryDate) {
    expiryDateYmd = extracted.expiryDate;
    uncertain = false;
  } else {
    expiryDateYmd = null;
  }

  const issueDateYmd =
    userIssue ?? extracted.issueDate ?? null;

  const settings = await getOrCreateReminderSettings(companyId);
  const status = computeComplianceStatus({
    expiryDateYmd,
    uncertain: uncertain && !expiryDateYmd,
    noExpiry: noExpiry && !expiryDateYmd,
    expiringSoonDays: settings.expiringSoonDays,
  });

  const name =
    input.name?.trim() ||
    extracted.name ||
    input.fileName.replace(/\.[^.]+$/, "") ||
    "Untitled document";

  const document = await prisma.complianceDocument.create({
    data: {
      companyId,
      categoryId: category.id,
      name,
      issuingAuthority:
        input.issuingAuthority?.trim() || extracted.issuingAuthority,
      documentNumber:
        input.documentNumber?.trim() || extracted.documentNumber,
      issueDate: issueDateYmd ? dateOnlyToUtcDate(issueDateYmd) : null,
      expiryDate: expiryDateYmd ? dateOnlyToUtcDate(expiryDateYmd) : null,
      status,
      extractionConfidence: extracted.confidence,
      extractionProvenance: extracted.provenance,
    },
  });

  const stored = await storageService.putObject({
    companyId,
    tenderId: `dcm/${document.id}`,
    fileName: input.fileName,
    mimeType: input.mimeType,
    body: input.body,
  });

  const version = await prisma.complianceDocumentVersion.create({
    data: {
      companyId,
      documentId: document.id,
      versionNumber: 1,
      storageKey: stored.storageKey,
      fileName: input.fileName,
      mimeType: stored.detectedMimeType || input.mimeType,
      byteLength: stored.byteLength,
      checksumSha256: stored.checksumSha256,
      extractedTextPreview: preview || null,
    },
  });

  await prisma.complianceDocument.updateMany({
    where: { id: document.id, companyId },
    data: { currentVersionId: version.id },
  });

  await scheduleRemindersForDocument({
    companyId,
    documentId: document.id,
    documentName: name,
    expiryDateYmd,
  });

  const dto = await getDocumentForCompany(companyId, document.id);
  if (!dto) {
    throw new AppError(ErrorCode.INTERNAL, "Document create failed.", 500);
  }
  const { scheduleMatchingProfileRebuild } = await import(
    "@/application/matching-rebuild"
  );
  scheduleMatchingProfileRebuild(companyId);
  return dto;
}

export async function addComplianceDocumentVersion(
  input: AddComplianceVersionInput,
): Promise<ComplianceDocumentDto> {
  const { companyId, documentId } = input;
  const existing = await prisma.complianceDocument.findFirst({
    where: { id: documentId, companyId },
  });
  if (!existing) {
    throw new AppError(ErrorCode.NOT_FOUND, "Document not found.", 404);
  }

  const { text, preview } = await extractTextSafe({
    body: input.body,
    mimeType: input.mimeType,
    fileName: input.fileName,
  });
  const extracted = extractComplianceMetadataFromText(text, input.fileName);

  const versionNumber = await nextVersionNumber(companyId, documentId);
  const stored = await storageService.putObject({
    companyId,
    tenderId: `dcm/${documentId}`,
    fileName: input.fileName,
    mimeType: input.mimeType,
    body: input.body,
  });

  const version = await prisma.complianceDocumentVersion.create({
    data: {
      companyId,
      documentId,
      versionNumber,
      storageKey: stored.storageKey,
      fileName: input.fileName,
      mimeType: stored.detectedMimeType || input.mimeType,
      byteLength: stored.byteLength,
      checksumSha256: stored.checksumSha256,
      extractedTextPreview: preview || null,
    },
  });

  // Update metadata only when new extraction is stronger / provides expiry facts.
  const settings = await getOrCreateReminderSettings(companyId);
  let expiryDateYmd = existing.expiryDate
    ? formatDateOnly(existing.expiryDate)
    : null;
  let issueDateYmd = existing.issueDate
    ? formatDateOnly(existing.issueDate)
    : null;
  let noExpiry = existing.status === "NO_EXPIRY" && !existing.expiryDate;
  let uncertain = existing.status === "UNKNOWN";

  if (extracted.noExpiry) {
    expiryDateYmd = null;
    noExpiry = true;
    uncertain = false;
  } else if (extracted.expiryDate) {
    expiryDateYmd = extracted.expiryDate;
    noExpiry = false;
    uncertain = false;
  } else if (extracted.uncertain && !expiryDateYmd) {
    uncertain = true;
  }
  if (extracted.issueDate) issueDateYmd = extracted.issueDate;

  const status = computeComplianceStatus({
    expiryDateYmd,
    uncertain: uncertain && !expiryDateYmd,
    noExpiry: noExpiry && !expiryDateYmd,
    expiringSoonDays: settings.expiringSoonDays,
  });

  await prisma.complianceDocument.updateMany({
    where: { id: documentId, companyId },
    data: {
      currentVersionId: version.id,
      status,
      issueDate: issueDateYmd ? dateOnlyToUtcDate(issueDateYmd) : null,
      expiryDate: expiryDateYmd ? dateOnlyToUtcDate(expiryDateYmd) : null,
      extractionConfidence: extracted.confidence,
      extractionProvenance: extracted.provenance,
      issuingAuthority:
        extracted.issuingAuthority ?? existing.issuingAuthority,
      documentNumber: extracted.documentNumber ?? existing.documentNumber,
    },
  });

  await scheduleRemindersForDocument({
    companyId,
    documentId,
    documentName: existing.name,
    expiryDateYmd,
  });

  const dto = await getDocumentForCompany(companyId, documentId);
  if (!dto) {
    throw new AppError(ErrorCode.NOT_FOUND, "Document not found.", 404);
  }
  const { scheduleMatchingProfileRebuild } = await import(
    "@/application/matching-rebuild"
  );
  scheduleMatchingProfileRebuild(companyId);
  return dto;
}

export async function getComplianceFileForDownload(input: {
  companyId: string;
  versionId: string;
}): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}> {
  const version = await getVersionForCompany(input.companyId, input.versionId);
  if (!version) {
    throw new AppError(ErrorCode.NOT_FOUND, "File not found.", 404);
  }
  if (!version.storageKey.startsWith(`${input.companyId}/`)) {
    throw new AppError(ErrorCode.FORBIDDEN, "File ownership mismatch.", 403);
  }
  try {
    const buffer = await storageService.getObject(version.storageKey);
    return {
      buffer,
      fileName: version.fileName,
      mimeType: version.mimeType,
    };
  } catch {
    throw new AppError(ErrorCode.NOT_FOUND, "File not found.", 404);
  }
}

export async function listDocumentVersions(companyId: string, documentId: string) {
  const doc = await getDocumentForCompany(companyId, documentId);
  if (!doc) {
    throw new AppError(ErrorCode.NOT_FOUND, "Document not found.", 404);
  }
  return listVersionsForDocument(companyId, documentId);
}

export { toDocumentDto };
