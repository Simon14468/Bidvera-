import {
  assertMatchingEngineAvailable,
  isMatchingSponsorshipGloballyEnabled,
  listSponsoredMatchingPlanRequestsForCompany,
  requestSponsoredMatchingPlanForCompany,
} from "@/modules/matching-engine";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { requireCompanyIdApi } from "@/auth/session";
import { AppError, ErrorCode, toSafeClientError } from "@/lib/errors";
import { NextResponse } from "next/server";

async function assertSponsoredMatchingAvailable() {
  if (!(await isMatchingSponsorshipGloballyEnabled())) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Sponsored Matching is not available.",
      403,
    );
  }
}

/** Company-scoped sponsorship pricing requests (own tenant only). */
export async function GET() {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertMatchingEngineAvailable(companyId);
    await assertSponsoredMatchingAvailable();
    const requests = await listSponsoredMatchingPlanRequestsForCompany(companyId);
    return NextResponse.json({ requests });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function POST(req: Request) {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertMatchingEngineAvailable(companyId);
    await assertSponsoredMatchingAvailable();
    const body = (await req.json()) as { planId?: string; notes?: string };
    if (!body.planId?.trim()) {
      throw new AppError(ErrorCode.VALIDATION, "planId is required.", 400);
    }
    const request = await requestSponsoredMatchingPlanForCompany({
      companyId,
      planId: body.planId.trim(),
      notes: body.notes ?? null,
    });
    return NextResponse.json({ request });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
