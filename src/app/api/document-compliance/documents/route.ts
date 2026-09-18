import {
  assertDocumentComplianceAvailable,
  getDashboard,
  listDocuments,
  uploadDocument,
} from "@/modules/document-compliance";
import { assertCanMutateCompanyContent } from "@/auth/company-content-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertDocumentComplianceAvailable(companyId);
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");
    if (view === "dashboard") {
      const data = await getDashboard(companyId);
      return NextResponse.json(data);
    }
    const data = await listDocuments({
      companyId,
      status: searchParams.get("status") ?? undefined,
      categoryKey: searchParams.get("category") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    });
    return NextResponse.json({ documents: data });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanMutateCompanyContent(auth.user.role);
    await assertDocumentComplianceAvailable(companyId);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    const { UPLOAD_LIMITS } = await import("@/config/server");
    if (file.size > UPLOAD_LIMITS.maxFileBytes) {
      return NextResponse.json(
        { error: "File exceeds the upload size limit." },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const doc = await uploadDocument({
      companyId,
      fileName: file.name || "document.pdf",
      mimeType: file.type || "application/octet-stream",
      body: buffer,
      name: String(form.get("name") || "") || undefined,
      categoryKey: String(form.get("categoryKey") || "") || undefined,
      issuingAuthority: String(form.get("issuingAuthority") || "") || undefined,
      documentNumber: String(form.get("documentNumber") || "") || undefined,
      issueDate: String(form.get("issueDate") || "") || undefined,
      expiryDate: String(form.get("expiryDate") || "") || undefined,
      noExpiry: form.get("noExpiry") === "true",
    });
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
