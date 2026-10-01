/**
 * Super Admin — Matching Engine activation (enable/disable + Run Matching Now).
 */

import type { SuperAdminContext } from "@/auth/super-admin-session";
import { writeAdminAudit } from "@/services/admin/audit";
import {
  getMatchingActivationStatus,
  refreshMatchingOpportunitiesForAdmin,
  runMatchingNowForAdmin,
  setMatchingEngineGlobalEnabled,
} from "@/modules/matching-engine/internal/platform-workflow";
import { z } from "zod";

const enableSchema = z.object({
  enabled: z.boolean(),
  runWorkflowOnEnable: z.boolean().optional(),
});

export async function getMatchingActivationAdminSnapshot() {
  return getMatchingActivationStatus();
}

export async function saSetMatchingEngineGlobalForAdmin(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const data = enableSchema.parse(raw);
  const before = await getMatchingActivationStatus();
  const result = await setMatchingEngineGlobalEnabled({
    enabled: data.enabled,
    runWorkflowOnEnable: data.runWorkflowOnEnable,
  });
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: data.enabled ? "MATCHING_ENGINE_ENABLED" : "MATCHING_ENGINE_DISABLED",
    targetType: "matching_engine",
    targetId: "matching_engine",
    previousValue: { enabledGlobal: before.matchingEnabledGlobal } as never,
    newValue: {
      enabledGlobal: result.enabled,
      summary: result.summary,
    } as never,
    ipHash,
  });
  return result;
}

export async function saRunMatchingNowForAdmin(
  ctx: SuperAdminContext,
  ipHash?: string | null,
) {
  const result = await runMatchingNowForAdmin();
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "MATCHING_ENGINE_RUN_NOW",
    targetType: "matching_engine",
    targetId: "matching_engine",
    newValue: { summary: result.summary } as never,
    ipHash,
  });
  return result;
}

export async function saRefreshMatchingOpportunitiesForAdmin(
  ctx: SuperAdminContext,
  ipHash?: string | null,
) {
  const result = await refreshMatchingOpportunitiesForAdmin();
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "MATCHING_OPPORTUNITIES_REFRESH",
    targetType: "matching_engine",
    targetId: "matching_engine",
    newValue: { summary: result.summary } as never,
    ipHash,
  });
  return result;
}
