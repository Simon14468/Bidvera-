import { getTenderSourceForSession } from "@/application/tender-service";
import { assertTenderAnalysisAvailable } from "@/modules/tender-analysis";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertTenderAnalysisAvailable(companyId);
    const { id } = await context.params;
    const requirementId = request.nextUrl.searchParams.get("requirementId") ?? undefined;
    const evidenceId = request.nextUrl.searchParams.get("evidenceId") ?? undefined;
    const viewParam = request.nextUrl.searchParams.get("view");
    const view =
      viewParam === "company" || viewParam === "tender" ? viewParam : undefined;
    const data = await getTenderSourceForSession(id, { requirementId, evidenceId, view });
    return NextResponse.json(data);
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
