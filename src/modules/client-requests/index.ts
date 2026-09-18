/**
 * Client Requests Portal — public module API.
 *
 * Import ONLY from `@/modules/client-requests`.
 * Do not import `@/modules/client-requests/internal` from other modules.
 * Links existing Bidvera documents/evidence by reference — never duplicates files.
 */

export {
  CLIENT_REQUESTS_FEATURE_KEY,
  CLIENT_REQUESTS_MODULE_ID,
  CLIENT_REQUESTS_MODULE_NAME,
  CLIENT_REQUEST_ITEM_TYPES,
  CLIENT_REQUEST_LINK_SOURCES,
  CLIENT_REQUEST_SHARE_TTL_MS,
  CLIENT_REQUEST_STATUSES,
  SUPER_ADMIN_ENTER_FINGERPRINT_PREFIX,
} from "./constants";

export {
  assertClientRequestsAvailable,
  clientRequestsUnavailableReason,
  isClientRequestsAvailable,
  isClientRequestsGloballyEnabled,
  isSuperAdminEnterSession,
} from "./access";

export {
  CLIENT_REQUESTS_DISABLED_REDIRECT,
  requireClientRequestsModule,
} from "./guard";

export {
  addClientRequestItem,
  cancelClientRequest,
  completeClientRequestInformation,
  createClientRequest,
  createClientRequestShare,
  deleteClientRequest,
  downloadSharedClientRequestFile,
  getClientRequest,
  getClientRequestsDashboard,
  getSharedClientRequest,
  linkClientRequestItem,
  listClientRequests,
  reconcileClientRequestsModule,
  reopenClientRequestItem,
  revokeClientRequestShare,
  unlinkClientRequestItem,
  updateClientRequest,
} from "./entry";

export {
  calcProgressPercent,
  deriveRequestStatus,
  formatDateOnly,
  isDeadlinePassed,
  parseDateOnlyDeadline,
  planClientRequestReminderFireTimes,
} from "./internal";

export type {
  ClientRequestActivityDto,
  ClientRequestDashboardDto,
  ClientRequestDto,
  ClientRequestItemDto,
  ClientRequestShareDto,
  SharedClientRequestView,
} from "./internal/types";
