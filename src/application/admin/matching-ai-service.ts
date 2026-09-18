/**
 * Super Admin — Matching Engine AI provider management.
 */

import type { SuperAdminContext } from "@/auth/super-admin-session";
import { AppError, ErrorCode } from "@/lib/errors";
import { writeAdminAudit } from "@/services/admin/audit";
import {
  getMatchingAiAdminSnapshot,
  matchingAiAuditSafeSnapshot,
  matchingAiAdminSaveSchema,
  recordMatchingAiTestResult,
  resolveMatchingAiApiKey,
  sanitizeMatchingAiErrorMessage,
  saveMatchingAiAdminSettings,
  isMatchingAiProviderKey,
  type MatchingAiAdminSnapshot,
  MATCHING_AI_DEFAULT_MODEL,
} from "@/modules/matching-engine/internal/ai-config";
import { testMatchingAiConnection } from "@/modules/matching-engine/internal/ai-provider";
import { sanitizeModelName } from "@/services/ai/assistant-settings";

export async function getMatchingAiSettingsForAdmin(): Promise<MatchingAiAdminSnapshot> {
  return getMatchingAiAdminSnapshot();
}

export async function saveMatchingAiSettingsForAdmin(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const before = matchingAiAuditSafeSnapshot(await getMatchingAiAdminSnapshot());
  const parsed = matchingAiAdminSaveSchema.parse(raw);
  const snap = await saveMatchingAiAdminSettings(parsed);
  const after = matchingAiAuditSafeSnapshot(snap);

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "MATCHING_AI_SETTINGS_UPDATED",
    targetType: "matching_ai_provider",
    targetId: snap.provider,
    previousValue: before,
    newValue: after,
    ipHash,
    metadata: {
      apiKeyRotated: Boolean(parsed.apiKey?.trim?.()),
      apiKeyCleared: Boolean(parsed.clearApiKey),
      enabled: snap.enabled,
      model: snap.model,
    },
  });

  return snap;
}

export async function testMatchingAiConnectionForAdmin(
  ctx: SuperAdminContext,
  raw?: unknown,
  ipHash?: string | null,
) {
  const snap = await getMatchingAiAdminSnapshot();
  if (!snap.hasApiKey) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Configure an API key before testing the connection.",
      400,
    );
  }

  const override =
    raw && typeof raw === "object"
      ? (raw as { model?: string; provider?: string })
      : {};
  const provider = isMatchingAiProviderKey(override.provider)
    ? override.provider
    : snap.provider;
  const model =
    sanitizeModelName(override.model) ||
    sanitizeModelName(snap.model) ||
    MATCHING_AI_DEFAULT_MODEL;

  const apiKey = await resolveMatchingAiApiKey();
  const result = await testMatchingAiConnection({
    provider,
    model,
    apiKey,
  });

  const updated = await recordMatchingAiTestResult({
    ok: result.ok,
    errorSafe: result.ok
      ? null
      : sanitizeMatchingAiErrorMessage(result.message),
  });

  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "MATCHING_AI_CONNECTION_TESTED",
    targetType: "matching_ai_provider",
    targetId: provider,
    previousValue: matchingAiAuditSafeSnapshot(snap),
    newValue: matchingAiAuditSafeSnapshot(updated),
    ipHash,
    metadata: {
      ok: result.ok,
      latencyMs: result.latencyMs,
      model,
      // Never store key or raw provider payloads
    },
  });

  return {
    ok: result.ok,
    latencyMs: result.latencyMs,
    message: result.ok
      ? result.message
      : sanitizeMatchingAiErrorMessage(result.message),
    snapshot: updated,
  };
}
