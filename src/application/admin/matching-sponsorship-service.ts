/**
 * Super Admin — Matching sponsorship management (Feature 8F).
 */

import type { SuperAdminContext } from "@/auth/super-admin-session";
import { writeAdminAudit } from "@/services/admin/audit";
import {
  createSponsorship,
  getSponsorshipGlobalSettings,
  listSponsorships,
  setSponsorshipGlobalEnabled,
  transitionSponsorship,
  type MatchingSponsorshipDto,
} from "@/modules/matching-engine/internal/sponsorship";
import { z } from "zod";

const globalSchema = z.object({
  enabledGlobal: z.boolean(),
});

const createSchema = z.object({
  opportunityId: z.string().min(1),
  sponsorCompanyId: z.string().min(1),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  campaignMeta: z.unknown().optional(),
});

const transitionSchema = z.object({
  sponsorshipId: z.string().min(1),
  to: z.enum(["ACTIVE", "PAUSED", "ENDED"]),
});

export async function getMatchingSponsorshipAdminSnapshot() {
  const [settings, sponsorships] = await Promise.all([
    getSponsorshipGlobalSettings(),
    listSponsorships({ limit: 50 }),
  ]);
  return { settings, sponsorships };
}

export async function saSetMatchingSponsorshipGlobal(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const { enabledGlobal } = globalSchema.parse(raw);
  const before = await getSponsorshipGlobalSettings();
  const settings = await setSponsorshipGlobalEnabled(enabledGlobal);
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "MATCHING_SPONSORSHIP_GLOBAL_UPDATED",
    targetType: "matching_sponsorship_settings",
    targetId: "global",
    previousValue: before,
    newValue: settings,
    ipHash,
  });
  return settings;
}

export async function saCreateMatchingSponsorship(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
): Promise<MatchingSponsorshipDto> {
  const input = createSchema.parse(raw);
  const row = await createSponsorship({
    ...input,
    actorAdminId: ctx.admin.id,
  });
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "MATCHING_SPONSORSHIP_CREATED",
    targetType: "matching_sponsorship",
    targetId: row.id,
    newValue: {
      id: row.id,
      opportunityId: row.opportunityId,
      sponsorCompanyId: row.sponsorCompanyId,
      status: row.status,
    },
    ipHash,
  });
  return row;
}

export async function saTransitionMatchingSponsorship(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
): Promise<MatchingSponsorshipDto> {
  const input = transitionSchema.parse(raw);
  const before = (await listSponsorships({ limit: 100 })).find(
    (s) => s.id === input.sponsorshipId,
  );
  const row = await transitionSponsorship({
    sponsorshipId: input.sponsorshipId,
    to: input.to,
    actorAdminId: ctx.admin.id,
  });
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "MATCHING_SPONSORSHIP_TRANSITIONED",
    targetType: "matching_sponsorship",
    targetId: row.id,
    previousValue: before
      ? { status: before.status, opportunityId: before.opportunityId }
      : undefined,
    newValue: { status: row.status, opportunityId: row.opportunityId },
    ipHash,
    metadata: { to: input.to },
  });
  return row;
}
