import { downloadSharedClientRequestFile } from "@/modules/client-requests";
import { toSafeClientError } from "@/lib/errors";
import { safeContentDispositionFilename } from "@/lib/safe-filename";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ token: string; itemId: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { token, itemId } = await ctx.params;
    const file = await downloadSharedClientRequestFile({ token, itemId });
    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${safeContentDispositionFilename(file.fileName)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
