export const dynamic = "force-dynamic";

import { loadTenderResultPageData } from "@/application/tender-result-page";
import { ReportActions } from "@/components/tenders/report-actions";
import { TenderAnalysisStatusRefresher } from "@/components/tenders/tender-analysis-live-status";
import { TenderReportView } from "@/components/tenders/tender-report-view";
import {
  assertReportPublicationAllowed,
  DecisionGuardianError,
  hashCanonicalReleasePayload,
} from "@/domain/decision-validation";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { AppError, ErrorCode } from "@/lib/errors";
import { logError } from "@/services/observability";
import type { TenderReport } from "@/services/reports/types";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

function ReportNotReady({
  id,
  title,
  body,
  backLabel,
  livePoll = false,
}: {
  id: string;
  title: string;
  body: string;
  backLabel: string;
  /** When true, poll analysis status and refresh on terminal completion/failure. */
  livePoll?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      {livePoll ? <TenderAnalysisStatusRefresher tenderId={id} /> : null}
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <Link
        href={`/tenders/${id}`}
        className="mt-6 inline-block text-sm text-primary hover:underline"
      >
        {backLabel}
      </Link>
    </div>
  );
}

function assertWebReportPublication(report: TenderReport) {
  const projectedHash = hashCanonicalReleasePayload(
    (report.intelligence?.complianceMatrix ?? []).map((row) => ({
      id: row.requirementId,
      text: row.requirement,
    })),
  );
  const requirementCount =
    report.intelligence?.complianceSummary?.totalRequirements ??
    report.intelligence?.complianceMatrix?.length ??
    0;
  assertReportPublicationAllowed({
    companyKnowledgeOnly: report.companyKnowledgeOnly === true,
    analysisMode: report.intelligence?.analysisMode ?? null,
    // Never invent COMPLETE — missing status must not flip an incomplete package into a gated full release.
    complianceStatus: report.intelligence?.complianceStatus ?? null,
    decisionGuardian: report.intelligence?.decisionGuardian ?? null,
    projectedContentHash: projectedHash,
    web: {
      decision: report.decision,
      fitScore: report.fitScore,
      deadlineIso: report.deadline,
      requirementCount,
    },
    pdf: {
      decision: report.decision,
      fitScore: report.fitScore,
      deadlineIso: report.deadline,
      requirementCount,
    },
  });
}

/**
 * Full report uses the SAME tender identity + tenant auth path as the detail page
 * (`loadTenderResultPageData`), then applies the Web/PDF publication gate.
 */
export default async function TenderReportPage({ params }: PageProps) {
  const { requireTenderAnalysisModule } = await import("@/modules/tender-analysis");
  await requireTenderAnalysisModule();
  const { id } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale).app.report;

  let pageData;
  try {
    pageData = await loadTenderResultPageData(id, locale);
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === ErrorCode.NOT_FOUND || error.code === ErrorCode.FORBIDDEN)
    ) {
      notFound();
    }
    if (error instanceof AppError && error.code === ErrorCode.VALIDATION) {
      return (
        <ReportNotReady
          id={id}
          title={t.reportNotReady}
          body={error.message}
          backLabel={t.backToTender}
        />
      );
    }
    throw error;
  }

  if (pageData.kind === "failed") {
    return (
      <ReportNotReady
        id={id}
        title={t.reportNotReady}
        body={pageData.analysisError ?? t.subtitle}
        backLabel={t.backToTender}
      />
    );
  }

  if (pageData.kind === "in_progress") {
    return (
      <ReportNotReady
        id={id}
        title={t.reportNotReady}
        body={t.subtitle}
        backLabel={t.backToTender}
        livePoll
      />
    );
  }

  // Same tender id + company-scoped canonical report as the detail workspace.
  if (pageData.tender.id !== id) {
    notFound();
  }

  const { report, reportFeatureAccess } = pageData;

  try {
    assertWebReportPublication(report);
  } catch (error) {
    if (error instanceof DecisionGuardianError) {
      logError("decision_guardian.web_report_blocked", {
        codes: error.result.blockingFailures.map((f) => f.validationCode),
      });
      return (
        <ReportNotReady
          id={id}
          title={t.reportNotReady}
          body={t.reportNotReadyBody}
          backLabel={t.backToTender}
        />
      );
    }
    throw error;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in print:max-w-none">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div>
          <Link href={`/tenders/${id}`} className="text-sm text-muted hover:text-foreground">
            {t.backToTender}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
        </div>
        <ReportActions
          tenderId={id}
          copy={{
            print: t.print,
            downloadPdf: t.downloadPdf,
            shareLink: t.shareLink,
            copied: t.copied,
            shareExpires: t.shareExpires,
            revokeShare: t.revokeShare,
            shareRevoked: t.shareRevoked,
          }}
        />
      </div>
      <TenderReportView report={report} featureAccess={reportFeatureAccess} />
    </div>
  );
}
