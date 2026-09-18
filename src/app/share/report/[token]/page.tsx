export const dynamic = "force-dynamic";

import { TenderReportView } from "@/components/tenders/tender-report-view";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AppError, ErrorCode } from "@/lib/errors";
import { verifyReportShareToken } from "@/services/reports/share-token";
import { getTenderReportForCompany, getReportFeatureAccess } from "@/services/reports/tender-report";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedReportPage({ params }: PageProps) {
  const { token } = await params;
  let report;
  try {
    const payload = await verifyReportShareToken(token);
    report = await getTenderReportForCompany(payload.tenderId, payload.companyId);
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === ErrorCode.NOT_FOUND) notFound();
      return (
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
          <BrandLogo href="/" height={36} />
          <h1 className="mt-8 text-xl font-semibold">Link unavailable</h1>
          <p className="mt-2 text-sm text-muted">{error.message}</p>
        </div>
      );
    }
    throw error;
  }

  const featureAccess = await getReportFeatureAccess(report.companyId);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4 print:hidden">
          <BrandLogo href="/" height={32} />
          <p className="text-xs text-muted">Read-only shared report · expires automatically</p>
        </div>
        <TenderReportView report={report} featureAccess={featureAccess} />
      </div>
    </div>
  );
}
