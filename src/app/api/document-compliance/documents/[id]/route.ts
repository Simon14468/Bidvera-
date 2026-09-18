import {
  assertDocumentComplianceAvailable,
  getDocument,
  listVersions,
  addDocumentVersion,
} from "@/modules/document-compliance";
import { assertCanMutateCompanyContent } from "@/auth/company-content-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertDocumentComplianceAvailable(companyId);
    const { id } = await context.params;
    const document = await getDocument(companyId, id);
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    const versions = await listVersions(companyId, id);
    return NextResponse.json({
      document,
      versions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        fileName: v.fileName,
        mimeType: v.mimeType,
        byteLength: v.byteLength,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanMutateCompanyContent(auth.user.role);
    await assertDocumentComplianceAvailable(companyId);
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const document = await addDocumentVersion({
      companyId,
      documentId: id,
      fileName: file.name || "document.pdf",
      mimeType: file.type || "application/octet-stream",
      body: buffer,
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
