import { assertClientRequestsAvailable } from "./access";
import {
  addItem,
  cancelRequest,
  completeInformationItem,
  createRequest,
  createShare,
  deleteRequest,
  downloadSharedItemFile,
  getDashboard,
  getRequest,
  linkItemToBidveraData,
  listRequests,
  reconcileClientRequests,
  reopenItem,
  resolveSharedView,
  revokeShare,
  unlinkItem,
  updateRequest,
} from "./internal";

export async function listClientRequests(input: {
  companyId: string;
  status?: string;
  client?: string;
  sort?: string;
}) {
  await assertClientRequestsAvailable(input.companyId);
  return listRequests(input);
}

export async function getClientRequestsDashboard(companyId: string) {
  await assertClientRequestsAvailable(companyId);
  return getDashboard(companyId);
}

export async function getClientRequest(companyId: string, requestId: string) {
  await assertClientRequestsAvailable(companyId);
  return getRequest(companyId, requestId);
}

export async function createClientRequest(
  companyId: string,
  raw: unknown,
  actorUserId?: string | null,
) {
  await assertClientRequestsAvailable(companyId);
  return createRequest(companyId, raw, actorUserId);
}

export async function updateClientRequest(
  companyId: string,
  requestId: string,
  raw: unknown,
  actorUserId?: string | null,
) {
  await assertClientRequestsAvailable(companyId);
  return updateRequest(companyId, requestId, raw, actorUserId);
}

export async function cancelClientRequest(
  companyId: string,
  requestId: string,
  actorUserId?: string | null,
) {
  await assertClientRequestsAvailable(companyId);
  return cancelRequest(companyId, requestId, actorUserId);
}

export async function deleteClientRequest(companyId: string, requestId: string) {
  await assertClientRequestsAvailable(companyId);
  return deleteRequest(companyId, requestId);
}

export async function addClientRequestItem(
  companyId: string,
  requestId: string,
  raw: unknown,
  actorUserId?: string | null,
) {
  await assertClientRequestsAvailable(companyId);
  return addItem(companyId, requestId, raw, actorUserId);
}

export async function completeClientRequestInformation(
  companyId: string,
  requestId: string,
  itemId: string,
  raw: unknown,
  actorUserId?: string | null,
) {
  await assertClientRequestsAvailable(companyId);
  return completeInformationItem(companyId, requestId, itemId, raw, actorUserId);
}

export async function reopenClientRequestItem(
  companyId: string,
  requestId: string,
  itemId: string,
  actorUserId?: string | null,
) {
  await assertClientRequestsAvailable(companyId);
  return reopenItem(companyId, requestId, itemId, actorUserId);
}

export async function linkClientRequestItem(
  companyId: string,
  requestId: string,
  itemId: string,
  raw: unknown,
  actorUserId?: string | null,
) {
  await assertClientRequestsAvailable(companyId);
  return linkItemToBidveraData(companyId, requestId, itemId, raw, actorUserId);
}

export async function unlinkClientRequestItem(
  companyId: string,
  requestId: string,
  itemId: string,
  actorUserId?: string | null,
) {
  await assertClientRequestsAvailable(companyId);
  return unlinkItem(companyId, requestId, itemId, actorUserId);
}

export async function createClientRequestShare(
  companyId: string,
  requestId: string,
  raw: unknown,
  actorUserId?: string | null,
) {
  await assertClientRequestsAvailable(companyId);
  return createShare(companyId, requestId, raw, actorUserId);
}

export async function revokeClientRequestShare(
  companyId: string,
  requestId: string,
  shareId: string,
  actorUserId?: string | null,
) {
  await assertClientRequestsAvailable(companyId);
  return revokeShare(companyId, requestId, shareId, actorUserId);
}

/** Public share — no entitlement gate; token proves access. */
export async function getSharedClientRequest(token: string) {
  return resolveSharedView(token);
}

/** Public share file download — no entitlement gate; token + share item prove access. */
export async function downloadSharedClientRequestFile(input: {
  token: string;
  itemId: string;
}) {
  return downloadSharedItemFile(input);
}

export async function reconcileClientRequestsModule(limit = 40) {
  return reconcileClientRequests(limit);
}
