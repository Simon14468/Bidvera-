import { assertSupplierQualificationAvailable } from "./access";
import {
  addEvidence,
  deleteEvidence,
  getDashboard,
  getEvidenceFile,
  getOrCreateProfile,
  getProfile,
  listEvidence,
  upsertProfile,
} from "./internal";

export async function getSupplierProfile(companyId: string) {
  await assertSupplierQualificationAvailable(companyId);
  return getOrCreateProfile(companyId);
}

export async function readSupplierProfile(companyId: string) {
  await assertSupplierQualificationAvailable(companyId);
  return getProfile(companyId);
}

export async function updateSupplierProfile(companyId: string, raw: unknown) {
  await assertSupplierQualificationAvailable(companyId);
  return upsertProfile(companyId, raw);
}

export async function getSupplierDashboard(companyId: string) {
  await assertSupplierQualificationAvailable(companyId);
  return getDashboard(companyId);
}

export async function listSupplierEvidence(companyId: string) {
  await assertSupplierQualificationAvailable(companyId);
  return listEvidence(companyId);
}

export async function addSupplierEvidence(input: {
  companyId: string;
  meta: unknown;
  file?: { fileName: string; mimeType: string; body: Buffer } | null;
}) {
  await assertSupplierQualificationAvailable(input.companyId);
  return addEvidence(input);
}

export async function downloadSupplierEvidence(input: {
  companyId: string;
  evidenceId: string;
}) {
  await assertSupplierQualificationAvailable(input.companyId);
  return getEvidenceFile(input);
}

export async function removeSupplierEvidence(
  companyId: string,
  evidenceId: string,
) {
  await assertSupplierQualificationAvailable(companyId);
  return deleteEvidence(companyId, evidenceId);
}
