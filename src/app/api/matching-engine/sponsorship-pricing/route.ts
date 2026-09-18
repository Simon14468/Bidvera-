import {
  assertMatchingEngineAvailable,
  isMatchingSponsorshipGloballyEnabled,
  listActiveSponsoredMatchingPlansForCompany,
} from "@/modules/matching-engine";
import { requireCompanyIdApi } from "@/auth/session";
import { AppError, ErrorCode, toSafeClientError } from "@/lib/errors";
import { NextResponse } from "next/server";

/**
 * Company-facing active Sponsored Matching plans.
 * Intended for the explicit request flow only — not organic match cards.
 */
export async function GET() {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertMatchingEngineAvailable(companyId);
    if (!(await isMatchingSponsorshipGloballyEnabled())) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        "Sponsored Matching is not available.",
        403,
      );
    }
    const plans = await listActiveSponsoredMatchingPlansForCompany(companyId);
    return NextResponse.json({ plans });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
