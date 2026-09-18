import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { getLocale } from "@/i18n/get-locale";
import { prisma } from "@/lib/db";
import { resolveRequestAppOrigin } from "@/lib/app-origin";
import { logInfo } from "@/services/observability";
import {
  buildTenderReportPdf,
  buildTenderReportPdfFileName,
  getTenderReportForCompany,
} from "@/services/reports/tender-report";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const started = Date.now();
  try {
    const { id: tenderId } = await context.params;
    const { companyId } = await requireCompanyIdApi();
    const { assertTenderAnalysisAvailable } = await import(
      "@/modules/tender-analysis"
    );
    await assertTenderAnalysisAvailable(companyId);
    const { assertFeature } = await import("@/services/entitlements");
    await assertFeature(
      companyId,
      "pdf_export",
      "PDF export is not included in your plan. Upgrade to download reports.",
    );
    const [report, locale, company, appOrigin] = await Promise.all([
      getTenderReportForCompany(tenderId, companyId),
      getLocale(),
      prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      }),
      resolveRequestAppOrigin(),
    ]);
    const pdf = await buildTenderReportPdf(report, {
      locale,
      companyName: company?.name ?? null,
      appOrigin,
    });
    const fileName = buildTenderReportPdfFileName(report.title, tenderId);
    logInfo("report.pdf.ready", {
      tenderId,
      companyId,
      bytes: pdf.length,
      ms: Date.now() - started,
    });
    return new NextResponse(Uint8Array.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json(
      { error: safe.message, code: safe.code },
      { status: safe.status },
    );
  }
}
