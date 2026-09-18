import {
  assertQuestionnaireAssistantAvailable,
  extractTenderQuestionnaires,
  getLatestTenderQuestionnaire,
  listTenderQuestionnaires,
} from "@/modules/questionnaire-assistant";
import { assertCanMutateCompanyContent } from "@/auth/company-content-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ tenderId: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertQuestionnaireAssistantAvailable(companyId);
    const { tenderId } = await ctx.params;
    const latestOnly = new URL(request.url).searchParams.get("latest") === "1";
    if (latestOnly) {
      const pack = await getLatestTenderQuestionnaire(companyId, tenderId);
      return NextResponse.json({ pack });
    }
    const packs = await listTenderQuestionnaires(companyId, tenderId);
    return NextResponse.json({ packs });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanMutateCompanyContent(auth.user.role);
    await assertQuestionnaireAssistantAvailable(companyId);
    const { tenderId } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const pack = await extractTenderQuestionnaires({
      companyId,
      tenderId,
      force: Boolean(body?.force),
    });
    return NextResponse.json({ pack }, { status: 201 });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
