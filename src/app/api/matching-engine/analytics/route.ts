import {
  assertMatchingEngineAvailable,
  getCompanyMatchingAnalytics,
} from "@/modules/matching-engine";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextResponse } from "next/server";

/** Minimal company-scoped analytics foundation — not a full dashboard. */
export async function GET() {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertMatchingEngineAvailable(companyId);
    const analytics = await getCompanyMatchingAnalytics(companyId);
    return NextResponse.json({ analytics });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
