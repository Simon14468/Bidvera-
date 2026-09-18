import {
  assertMatchingEngineAvailable,
  markRecommendationReadForCompany,
} from "@/modules/matching-engine";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ recommendationId: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertMatchingEngineAvailable(companyId);
    const { recommendationId } = await ctx.params;
    const recommendation = await markRecommendationReadForCompany(
      companyId,
      recommendationId,
    );
    return NextResponse.json({ recommendation });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
