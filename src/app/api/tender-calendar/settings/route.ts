import {
  assertTenderCalendarAvailable,
  getCalendarReminderSettings,
  updateCalendarReminderSettings,
} from "@/modules/tender-calendar";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertTenderCalendarAvailable(companyId);
    return NextResponse.json({
      settings: await getCalendarReminderSettings(companyId),
    });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertTenderCalendarAvailable(companyId);
    const body = await request.json();
    const settings = await updateCalendarReminderSettings(companyId, body);
    return NextResponse.json({ settings });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
