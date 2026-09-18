import {
  assertMatchingEngineAvailable,
  listRecommendationsForCompany,
} from "@/modules/matching-engine";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertMatchingEngineAvailable(companyId);
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "20");
    const offset = Number(searchParams.get("offset") ?? "0");
    const recommendations = await listRecommendationsForCompany(companyId, {
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return NextResponse.json({ recommendations });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
