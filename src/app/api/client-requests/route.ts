import {
  assertClientRequestsAvailable,
  createClientRequest,
  getClientRequestsDashboard,
  listClientRequests,
} from "@/modules/client-requests";
import { assertCanMutateCompanyContent } from "@/auth/company-content-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertClientRequestsAvailable(companyId);
    const sp = new URL(request.url).searchParams;
    if (sp.get("view") === "dashboard") {
      return NextResponse.json(await getClientRequestsDashboard(companyId));
    }
    return NextResponse.json({
      requests: await listClientRequests({
        companyId,
        status: sp.get("status") ?? undefined,
        client: sp.get("client") ?? undefined,
        sort: sp.get("sort") ?? undefined,
      }),
    });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanMutateCompanyContent(auth.user.role);
    await assertClientRequestsAvailable(companyId);
    const body = await request.json();
    const created = await createClientRequest(companyId, body, auth.user.id);
    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
