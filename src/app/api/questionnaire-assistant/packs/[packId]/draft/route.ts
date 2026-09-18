import {
  assertQuestionnaireAssistantAvailable,
  draftTenderQuestionnaireAnswers,
} from "@/modules/questionnaire-assistant";
import { assertCanMutateCompanyContent } from "@/auth/company-content-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ packId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanMutateCompanyContent(auth.user.role);
    await assertQuestionnaireAssistantAvailable(companyId);
    const { packId } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const pack = await draftTenderQuestionnaireAnswers({
      companyId,
      packId,
      questionIds: Array.isArray(body?.questionIds)
        ? body.questionIds.filter((x: unknown) => typeof x === "string")
        : undefined,
    });
    return NextResponse.json({ pack });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
