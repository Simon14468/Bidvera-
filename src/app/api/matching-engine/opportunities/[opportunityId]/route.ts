import {
  assertMatchingEngineAvailable,
  getPublicOpportunity,
} from "@/modules/matching-engine";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ opportunityId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertMatchingEngineAvailable(companyId);
    const { opportunityId } = await ctx.params;
    const opportunity = await getPublicOpportunity(opportunityId);
    if (!opportunity) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ opportunity });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
