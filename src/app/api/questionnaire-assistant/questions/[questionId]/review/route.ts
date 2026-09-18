import {
  assertQuestionnaireAssistantAvailable,
  reviewTenderQuestionnaireDraft,
} from "@/modules/questionnaire-assistant";
import { assertCanMutateCompanyContent } from "@/auth/company-content-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ questionId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanMutateCompanyContent(auth.user.role);
    await assertQuestionnaireAssistantAvailable(companyId);
    const { questionId } = await ctx.params;
    const body = await request.json();
    const action = body?.action as string | undefined;
    if (action !== "approve" && action !== "reject" && action !== "edit") {
      return NextResponse.json(
        { error: "action must be approve, reject, or edit." },
        { status: 400 },
      );
    }
    const question = await reviewTenderQuestionnaireDraft({
      companyId,
      questionId,
      action,
      editedText: body?.editedText ?? null,
      actorUserId: auth.user.id,
    });
    return NextResponse.json({ question });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
