import {
  assertDocumentComplianceAvailable,
  getReminderSettings,
  listCategories,
  updateReminderSettings,
} from "@/modules/document-compliance";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertDocumentComplianceAvailable(companyId);
    const [settings, categories] = await Promise.all([
      getReminderSettings(companyId),
      listCategories(companyId),
    ]);
    return NextResponse.json({ settings, categories });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertDocumentComplianceAvailable(companyId);
    const body = (await request.json()) as Record<string, unknown>;
    const settings = await updateReminderSettings(companyId, {
      remind90d: typeof body.remind90d === "boolean" ? body.remind90d : undefined,
      remind30d: typeof body.remind30d === "boolean" ? body.remind30d : undefined,
      remind7d: typeof body.remind7d === "boolean" ? body.remind7d : undefined,
      remindExpired:
        typeof body.remindExpired === "boolean" ? body.remindExpired : undefined,
      expiringSoonDays:
        typeof body.expiringSoonDays === "number"
          ? body.expiringSoonDays
          : undefined,
    });
    return NextResponse.json({ settings });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
