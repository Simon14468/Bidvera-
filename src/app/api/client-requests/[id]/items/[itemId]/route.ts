import {
  assertClientRequestsAvailable,
  completeClientRequestInformation,
  linkClientRequestItem,
  reopenClientRequestItem,
  unlinkClientRequestItem,
} from "@/modules/client-requests";
import { assertCanMutateCompanyContent } from "@/auth/company-content-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanMutateCompanyContent(auth.user.role);
    await assertClientRequestsAvailable(companyId);
    const { id, itemId } = await ctx.params;
    const body = await request.json();
    const action = body?.action as string | undefined;

    if (action === "complete_information") {
      return NextResponse.json({
        request: await completeClientRequestInformation(
          companyId,
          id,
          itemId,
          body,
          auth.user.id,
        ),
      });
    }
    if (action === "link") {
      return NextResponse.json({
        request: await linkClientRequestItem(
          companyId,
          id,
          itemId,
          body,
          auth.user.id,
        ),
      });
    }
    if (action === "unlink") {
      return NextResponse.json({
        request: await unlinkClientRequestItem(
          companyId,
          id,
          itemId,
          auth.user.id,
        ),
      });
    }
    if (action === "reopen") {
      return NextResponse.json({
        request: await reopenClientRequestItem(
          companyId,
          id,
          itemId,
          auth.user.id,
        ),
      });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
