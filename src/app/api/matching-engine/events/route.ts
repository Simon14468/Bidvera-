import {
  assertMatchingEngineAvailable,
  engagementIdempotencyKey,
  impressionIdempotencyKey,
  recordBehaviorEventForCompany,
} from "@/modules/matching-engine";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertMatchingEngineAvailable(companyId);
    const body = await request.json().catch(() => ({}));
    const eventType = String(body?.eventType ?? "");
    const opportunityId = String(body?.opportunityId ?? "");
    const recommendationId = body?.recommendationId
      ? String(body.recommendationId)
      : null;

    if (!opportunityId) {
      return NextResponse.json(
        { error: "opportunityId is required." },
        { status: 400 },
      );
    }

    let idempotencyKey =
      typeof body?.idempotencyKey === "string" ? body.idempotencyKey : null;
    if (eventType === "IMPRESSION" && recommendationId && !idempotencyKey) {
      const day = new Date().toISOString().slice(0, 10);
      idempotencyKey = impressionIdempotencyKey(
        companyId,
        recommendationId,
        day,
      );
    } else if (
      !idempotencyKey &&
      recommendationId &&
      (eventType === "VIEW" ||
        eventType === "CLICK" ||
        eventType === "INTEREST" ||
        eventType === "DISMISS")
    ) {
      idempotencyKey = engagementIdempotencyKey(
        eventType,
        companyId,
        recommendationId,
      );
    }

    const event = await recordBehaviorEventForCompany({
      companyId,
      opportunityId,
      recommendationId,
      eventType,
      actorUserId: auth.user.id,
      idempotencyKey,
      metadata:
        body?.metadata && typeof body.metadata === "object"
          ? body.metadata
          : null,
    });
    return NextResponse.json({ event }, { status: event.duplicate ? 200 : 201 });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
