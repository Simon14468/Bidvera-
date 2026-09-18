import {
  assertSupplierQualificationAvailable,
  addSupplierEvidence,
  listSupplierEvidence,
  removeSupplierEvidence,
} from "@/modules/supplier-qualification";
import { assertCanMutateCompanyContent } from "@/auth/company-content-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertSupplierQualificationAvailable(companyId);
    const evidence = await listSupplierEvidence(companyId);
    return NextResponse.json({ evidence });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanMutateCompanyContent(auth.user.role);
    await assertSupplierQualificationAvailable(companyId);
    const form = await request.formData();
    const file = form.get("file");
    const meta = {
      title: String(form.get("title") || ""),
      kind: String(form.get("kind") || "OTHER"),
      description: String(form.get("description") || "") || null,
      externalUrl: String(form.get("externalUrl") || "") || null,
    };
    let filePayload: {
      fileName: string;
      mimeType: string;
      body: Buffer;
    } | null = null;
    // Empty file inputs still yield a File with size 0 — treat as "no file".
    if (file instanceof File && file.size > 0) {
      const { UPLOAD_LIMITS } = await import("@/config/server");
      if (file.size > UPLOAD_LIMITS.maxFileBytes) {
        return NextResponse.json(
          { error: "File exceeds the upload size limit." },
          { status: 400 },
        );
      }
      filePayload = {
        fileName: file.name || "evidence.pdf",
        mimeType: file.type || "application/octet-stream",
        body: Buffer.from(await file.arrayBuffer()),
      };
    }
    const evidence = await addSupplierEvidence({
      companyId,
      meta,
      file: filePayload,
    });
    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { companyId, auth } = await requireCompanyIdApi();
    assertCanMutateCompanyContent(auth.user.role);
    await assertSupplierQualificationAvailable(companyId);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await removeSupplierEvidence(companyId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
