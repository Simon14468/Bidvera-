import {
  upsertOpportunity,
  upsertOpportunityBatch,
} from "@/modules/matching-engine";
import { resolveSuperAdminContext } from "@/auth/super-admin-session";
import { writeAdminAudit } from "@/services/admin/audit";
import { AppError, ErrorCode, toSafeClientError } from "@/lib/errors";
import type { UpsertOpportunityInput } from "@/modules/matching-engine";
import { NextRequest, NextResponse } from "next/server";

/**
 * Internal opportunity corpus write boundary (Super Admin session).
 * Supports single upsert or `{ opportunities: [...] }` batch bootstrap.
 * Does not scrape and does not touch Tender Analysis ingestion.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveSuperAdminContext();
    if (!ctx || (ctx.admin.role !== "SUPER_ADMIN" && ctx.admin.role !== "OPS")) {
      throw new AppError(ErrorCode.FORBIDDEN, "Super Admin access required.", 403);
    }
    const body = await request.json().catch(() => ({}));

    if (Array.isArray((body as { opportunities?: unknown })?.opportunities)) {
      const batch = await upsertOpportunityBatch(
        (body as { opportunities: UpsertOpportunityInput[] }).opportunities,
      );
      await writeAdminAudit({
        adminUserId: ctx.admin.id,
        action: "MATCHING_OPPORTUNITY_BATCH_UPSERTED",
        targetType: "matching_opportunity",
        targetId: "batch",
        newValue: {
          upserted: batch.upserted.length,
          errors: batch.errors.length,
          ids: batch.upserted.map((o) => o.id),
        },
      });
      return NextResponse.json(batch, {
        status: batch.errors.length && !batch.upserted.length ? 400 : 201,
      });
    }

    const opportunity = await upsertOpportunity(body ?? {});
    await writeAdminAudit({
      adminUserId: ctx.admin.id,
      action: "MATCHING_OPPORTUNITY_UPSERTED",
      targetType: "matching_opportunity",
      targetId: opportunity.id,
      newValue: {
        id: opportunity.id,
        title: opportunity.title,
        status: opportunity.status,
        source: opportunity.source,
        externalRef: opportunity.externalRef,
        sponsored: opportunity.sponsored,
      },
    });
    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
