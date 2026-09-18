/**
 * Supplier Qualification Profile — module identity.
 * Global enable/disable is Feature.enabledGlobal for this key (Super Admin → Features).
 */

export const SUPPLIER_QUALIFICATION_MODULE_ID = "supplier-qualification" as const;

/** Platform Feature.key / entitlement catalog key. */
export const SUPPLIER_QUALIFICATION_FEATURE_KEY = "supplier_qualification" as const;

export const SUPPLIER_QUALIFICATION_MODULE_NAME = "Supplier Qualification";

/** Sessions created via Super Admin → Enter company (deviceFingerprint prefix). */
export const SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX = "sa-enter:" as const;

/** Evidence kinds — free-form allowed; these are suggested defaults only. */
export const EVIDENCE_KIND_SUGGESTIONS = [
  "CERTIFICATION",
  "LICENSE",
  "REGISTRATION",
  "FINANCIAL",
  "INSURANCE",
  "OTHER",
] as const;
