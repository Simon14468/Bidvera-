/**
 * Supplier Qualification Profile — public module API.
 *
 * Import ONLY from `@/modules/supplier-qualification`.
 * Do not import `@/modules/supplier-qualification/internal` from other modules.
 */

export {
  SUPPLIER_QUALIFICATION_FEATURE_KEY,
  SUPPLIER_QUALIFICATION_MODULE_ID,
  SUPPLIER_QUALIFICATION_MODULE_NAME,
  SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX,
  EVIDENCE_KIND_SUGGESTIONS,
} from "./constants";

export {
  assertSupplierQualificationAvailable,
  isSuperAdminEnterSession,
  isSupplierQualificationAvailable,
  isSupplierQualificationGloballyEnabled,
  supplierQualificationUnavailableReason,
} from "./access";

export {
  requireSupplierQualificationModule,
  SUPPLIER_QUALIFICATION_DISABLED_REDIRECT,
} from "./guard";

export {
  getSupplierProfile,
  readSupplierProfile,
  updateSupplierProfile,
  getSupplierDashboard,
  listSupplierEvidence,
  addSupplierEvidence,
  downloadSupplierEvidence,
  removeSupplierEvidence,
} from "./entry";

export {
  computeProfileCompleteness,
  completenessChecklist,
  REQUIRED_COMPLETENESS_FIELDS,
} from "./internal/completeness";
export {
  profileUpdateSchema,
  evidenceCreateSchema,
  normalizeStringList,
} from "./internal/validation";
export type {
  SupplierQualificationProfileDto,
  SupplierQualificationEvidenceDto,
  SupplierQualificationDashboardDto,
} from "./internal/types";
