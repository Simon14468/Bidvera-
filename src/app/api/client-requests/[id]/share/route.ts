import {
  assertClientRequestsAvailable,
  createClientRequestShare,
  revokeClientRequestShare,
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
    const share = await createClientRequestShare(
      companyId,
      id,
      body,
      auth.user.id,
    );
    return NextResponse.json({ share }, { status: 201 });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanMutateCompanyContent(auth.user.role);
    await assertClientRequestsAvailable(companyId);
    const { id } = await ctx.params;
    const shareId = new URL(request.url).searchParams.get("shareId");
    if (!shareId) {
      return NextResponse.json({ error: "shareId is required." }, { status: 400 });
    }
    await revokeClientRequestShare(companyId, id, shareId, auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
