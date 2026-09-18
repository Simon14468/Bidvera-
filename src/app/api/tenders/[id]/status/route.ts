import {
  assertTenderAnalysisAvailable,
  getTenderAnalysisStatus,
} from "@/modules/tender-analysis";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertTenderAnalysisAvailable(companyId);
    const { id } = await context.params;
    const data = await getTenderAnalysisStatus(id);
    return NextResponse.json(data);
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
