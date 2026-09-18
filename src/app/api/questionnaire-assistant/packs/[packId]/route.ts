import {
  assertQuestionnaireAssistantAvailable,
  getTenderQuestionnaire,
} from "@/modules/questionnaire-assistant";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ packId: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertQuestionnaireAssistantAvailable(companyId);
    const { packId } = await ctx.params;
    const pack = await getTenderQuestionnaire(companyId, packId);
    return NextResponse.json({ pack });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
