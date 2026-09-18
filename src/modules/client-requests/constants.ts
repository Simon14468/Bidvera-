export const CLIENT_REQUESTS_MODULE_ID = "client-requests" as const;
export const CLIENT_REQUESTS_FEATURE_KEY = "client_requests" as const;
export const CLIENT_REQUESTS_MODULE_NAME = "Client Requests";
export const SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX = "sa-enter:" as const;

export const CLIENT_REQUEST_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "OVERDUE",
  "CANCELLED",
] as const;

export const CLIENT_REQUEST_ITEM_TYPES = ["INFORMATION", "DOCUMENT"] as const;

export const CLIENT_REQUEST_LINK_SOURCES = [
  "COMPLIANCE_DOCUMENT",
  "SUPPLIER_EVIDENCE",
  "COMPANY_PROFILE",
] as const;

/** Default share TTL: 14 days. */
export const CLIENT_REQUEST_SHARE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
