export const MATCHING_ENGINE_FEATURE_KEY = "matching_engine" as const;
export const MATCHING_ENGINE_MODULE_ID = "matching-engine" as const;
export const MATCHING_ENGINE_MODULE_NAME = "Matching Engine";
export const SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX = "sa-enter:" as const;

/** SystemSetting key — value shape `{ n: number }`. Never hard-code the threshold in gate logic. */
export const MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY =
  "matching_engine.min_eligible_companies" as const;

export const MATCHING_ENGINE_DISABLED_REDIRECT = "/dashboard" as const;
