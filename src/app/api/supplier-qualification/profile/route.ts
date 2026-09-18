import {
  assertSupplierQualificationAvailable,
  getSupplierDashboard,
  getSupplierProfile,
  updateSupplierProfile,
} from "@/modules/supplier-qualification";
import { assertCanMutateCompanyContent } from "@/auth/company-content-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertSupplierQualificationAvailable(companyId);
    const view = new URL(request.url).searchParams.get("view");
    if (view === "dashboard") {
      return NextResponse.json(await getSupplierDashboard(companyId));
    }
    return NextResponse.json({ profile: await getSupplierProfile(companyId) });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanMutateCompanyContent(auth.user.role);
    await assertSupplierQualificationAvailable(companyId);
    const body = await request.json();
    const profile = await updateSupplierProfile(companyId, body);
    return NextResponse.json({ profile });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
