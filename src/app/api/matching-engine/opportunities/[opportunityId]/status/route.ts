import { transitionOpportunity } from "@/modules/matching-engine";
import { resolveSuperAdminContext } from "@/auth/super-admin-session";
import { writeAdminAudit } from "@/services/admin/audit";
import { AppError, ErrorCode, toSafeClientError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import type { MatchingOpportunityStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ opportunityId: string }> };

const ALLOWED: MatchingOpportunityStatus[] = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "EXPIRED",
  "ARCHIVED",
];

/** Super Admin lifecycle transition boundary. */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const admin = await resolveSuperAdminContext();
    if (!admin || (admin.admin.role !== "SUPER_ADMIN" && admin.admin.role !== "OPS")) {
      throw new AppError(ErrorCode.FORBIDDEN, "Super Admin access required.", 403);
    }
    const { opportunityId } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const to = body?.status as MatchingOpportunityStatus;
    if (!ALLOWED.includes(to)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    const before = await prisma.matchingOpportunity.findUnique({
      where: { id: opportunityId },
      select: { status: true, title: true },
    });
    const opportunity = await transitionOpportunity(opportunityId, to);
    await writeAdminAudit({
      adminUserId: admin.admin.id,
      action: "MATCHING_OPPORTUNITY_STATUS_TRANSITIONED",
      targetType: "matching_opportunity",
      targetId: opportunity.id,
      previousValue: before
        ? { status: before.status, title: before.title }
        : undefined,
      newValue: { status: opportunity.status, title: opportunity.title },
      metadata: { to },
    });
    return NextResponse.json({ opportunity });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
