import {
  assertMatchingEngineAvailable,
  generateRecommendationsForCompany,
} from "@/modules/matching-engine";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertMatchingEngineAvailable(companyId);
    const recommendations = await generateRecommendationsForCompany(companyId);
    return NextResponse.json({ recommendations });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
