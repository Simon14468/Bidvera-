/**
 * Tender Analysis module identity — canonical feature namespace.
 * Global enable/disable is Feature.enabledGlobal for this key (Super Admin → Features).
 */

export const TENDER_ANALYSIS_MODULE_ID = "tender-analysis" as const;

/** Platform Feature.key / entitlement catalog key — do not invent a second flag. */
export const TENDER_ANALYSIS_FEATURE_KEY = "tender_analysis" as const;

export const TENDER_ANALYSIS_MODULE_NAME = "Tender Analysis";

/** Sessions created via Super Admin → Enter company (deviceFingerprint prefix). */
export const SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX = "sa-enter:" as const;
