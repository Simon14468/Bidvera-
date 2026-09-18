import {
  assertClientRequestsAvailable,
  cancelClientRequest,
  deleteClientRequest,
  getClientRequest,
  updateClientRequest,
} from "@/modules/client-requests";
import { assertCanMutateCompanyContent } from "@/auth/company-content-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertClientRequestsAvailable(companyId);
    const { id } = await ctx.params;
    return NextResponse.json({ request: await getClientRequest(companyId, id) });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanMutateCompanyContent(auth.user.role);
    await assertClientRequestsAvailable(companyId);
    const { id } = await ctx.params;
    const body = await request.json();
    if (body?.action === "cancel") {
      return NextResponse.json({
        request: await cancelClientRequest(companyId, id, auth.user.id),
      });
    }
    return NextResponse.json({
      request: await updateClientRequest(companyId, id, body, auth.user.id),
    });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanMutateCompanyContent(auth.user.role);
    await assertClientRequestsAvailable(companyId);
    const { id } = await ctx.params;
    await deleteClientRequest(companyId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
