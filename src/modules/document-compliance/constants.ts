/**
 * Document Compliance Manager — module identity.
 * Global enable/disable is Feature.enabledGlobal for this key (Super Admin → Features).
 */

export const DOCUMENT_COMPLIANCE_MODULE_ID = "document-compliance" as const;

/** Platform Feature.key / entitlement catalog key — do not invent a second flag. */
export const DOCUMENT_COMPLIANCE_FEATURE_KEY = "document_compliance" as const;

export const DOCUMENT_COMPLIANCE_MODULE_NAME = "Document Compliance";

/** Sessions created via Super Admin → Enter company (deviceFingerprint prefix). */
export const SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX = "sa-enter:" as const;

export const DEFAULT_CATEGORY_SEEDS = [
  { key: "RC", label: "RC / Trade register", sortOrder: 10 },
  { key: "CNSS", label: "CNSS", sortOrder: 20 },
  { key: "TVA", label: "TVA / VAT", sortOrder: 30 },
  { key: "TAX_CERTIFICATE", label: "Tax certificate", sortOrder: 40 },
  { key: "ISO", label: "ISO certification", sortOrder: 50 },
  { key: "INSURANCE", label: "Insurance", sortOrder: 60 },
  { key: "LICENSE", label: "License", sortOrder: 70 },
  { key: "CONTRACT", label: "Contract", sortOrder: 80 },
  { key: "CERTIFICATION", label: "Certification", sortOrder: 90 },
  { key: "OTHER", label: "Other / custom", sortOrder: 100 },
] as const;
