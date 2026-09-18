import {
  addClientRequestItem,
  assertClientRequestsAvailable,
} from "@/modules/client-requests";
import { assertCanMutateCompanyContent } from "@/auth/company-content-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanMutateCompanyContent(auth.user.role);
    await assertClientRequestsAvailable(companyId);
    const { id } = await ctx.params;
    const body = await request.json();
    return NextResponse.json({
      request: await addClientRequestItem(companyId, id, body, auth.user.id),
    });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
