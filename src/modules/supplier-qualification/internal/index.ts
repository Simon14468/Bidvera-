/** Module-private — do not import from outside @/modules/supplier-qualification. */

export {
  computeProfileCompleteness,
  completenessChecklist,
  REQUIRED_COMPLETENESS_FIELDS,
} from "./completeness";
export {
  profileUpdateSchema,
  evidenceCreateSchema,
  normalizeStringList,
} from "./validation";
export {
  getOrCreateProfile,
  getProfile,
  upsertProfile,
  getDashboard,
  listEvidence,
  addEvidence,
  getEvidenceFile,
  deleteEvidence,
} from "./service";
export type {
  SupplierQualificationProfileDto,
  SupplierQualificationEvidenceDto,
  SupplierQualificationDashboardDto,
} from "./types";
