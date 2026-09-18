import {
  assertMatchingEngineAvailable,
  getMatchingProfileForCompany,
  rebuildMatchingProfileForCompany,
} from "@/modules/matching-engine";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertMatchingEngineAvailable(companyId);
    const profile = await getMatchingProfileForCompany(companyId);
    return NextResponse.json({ profile });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function POST() {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertMatchingEngineAvailable(companyId);
    const profile = await rebuildMatchingProfileForCompany(companyId);
    return NextResponse.json({ profile });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
