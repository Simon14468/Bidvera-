import {
  assertMatchingEngineAvailable,
  countMatchedOpportunityNotificationsForCompany,
} from "@/modules/matching-engine";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextResponse } from "next/server";

/**
 * Topbar badge — same unread matched Alert count Email delivers via Resend.
 * Never uses a parallel isNew counter (avoids contradiction with notifications).
 */
export async function GET() {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertMatchingEngineAvailable(companyId);
    const count =
      await countMatchedOpportunityNotificationsForCompany(companyId);
    return NextResponse.json(
      { count },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
