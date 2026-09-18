import {
  assertSupplierQualificationAvailable,
  downloadSupplierEvidence,
} from "@/modules/supplier-qualification";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { safeContentDispositionFilename } from "@/lib/safe-filename";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ evidenceId: string }> },
) {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertSupplierQualificationAvailable(companyId);
    const { evidenceId } = await context.params;
    const file = await downloadSupplierEvidence({ companyId, evidenceId });
    const filename = safeContentDispositionFilename(file.fileName);
    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
