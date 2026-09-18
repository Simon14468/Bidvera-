/**
 * Public entry — thin wrappers over internals for app routes / actions / worker.
 */

import { assertDocumentComplianceAvailable } from "./access";
import { DOCUMENT_COMPLIANCE_FEATURE_KEY } from "./constants";
import {
  addComplianceDocumentVersion,
  getComplianceDashboard,
  getComplianceDocument,
  getComplianceFileForDownload,
  getComplianceReminderSettings,
  listComplianceCategories,
  listComplianceDocuments,
  listDocumentVersions,
  reconcileDocumentComplianceReminders,
  saveComplianceReminderSettings,
  uploadComplianceDocument,
  type AddComplianceVersionInput,
  type UploadComplianceDocumentInput,
} from "./internal";
import { recomputeAllStatusesForCompany } from "./internal/repository";

export async function uploadDocument(input: UploadComplianceDocumentInput) {
  await assertDocumentComplianceAvailable(input.companyId);
  return uploadComplianceDocument(input);
}

export async function addDocumentVersion(input: AddComplianceVersionInput) {
  await assertDocumentComplianceAvailable(input.companyId);
  return addComplianceDocumentVersion(input);
}

export async function listDocuments(input: {
  companyId: string;
  status?: string;
  categoryKey?: string;
  q?: string;
}) {
  await assertDocumentComplianceAvailable(input.companyId);
  return listComplianceDocuments(input);
}

export async function getDocument(companyId: string, documentId: string) {
  await assertDocumentComplianceAvailable(companyId);
  return getComplianceDocument(companyId, documentId);
}

export async function getDashboard(companyId: string) {
  await assertDocumentComplianceAvailable(companyId);
  return getComplianceDashboard(companyId);
}

export async function listCategories(companyId: string) {
  await assertDocumentComplianceAvailable(companyId);
  return listComplianceCategories(companyId);
}

export async function getReminderSettings(companyId: string) {
  await assertDocumentComplianceAvailable(companyId);
  return getComplianceReminderSettings(companyId);
}

export async function updateReminderSettings(
  companyId: string,
  patch: Parameters<typeof saveComplianceReminderSettings>[1],
) {
  await assertDocumentComplianceAvailable(companyId);
  return saveComplianceReminderSettings(companyId, patch);
}

export async function downloadVersionFile(input: {
  companyId: string;
  versionId: string;
}) {
  await assertDocumentComplianceAvailable(input.companyId);
  return getComplianceFileForDownload(input);
}

export async function listVersions(companyId: string, documentId: string) {
  await assertDocumentComplianceAvailable(companyId);
  return listDocumentVersions(companyId, documentId);
}

/** Worker tick — refresh statuses + remind schedules (idempotent). */
export async function reconcileDocumentCompliance(limit = 40): Promise<{
  reminders: number;
  statusUpdates: number;
}> {
  const { prisma } = await import("@/lib/db");
  const { hasFeature } = await import("@/services/entitlements");
  const companyIds = await prisma.complianceDocument.findMany({
    distinct: ["companyId"],
    take: limit * 2,
    orderBy: { updatedAt: "desc" },
    select: { companyId: true },
  });
  let statusUpdates = 0;
  let eligible = 0;
  for (const row of companyIds) {
    if (eligible >= limit) break;
    if (!(await hasFeature(row.companyId, DOCUMENT_COMPLIANCE_FEATURE_KEY))) {
      continue;
    }
    eligible += 1;
    statusUpdates += await recomputeAllStatusesForCompany(row.companyId, 100);
  }
  const reminders = await reconcileDocumentComplianceReminders(limit);
  return { reminders, statusUpdates };
}
