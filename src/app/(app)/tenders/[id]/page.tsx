export const dynamic = "force-dynamic";

import { loadTenderResultPageData } from "@/application/tender-result-page";
import { BidScoreCard } from "@/components/tenders/bid-score-card";
import { ClarificationQuestions } from "@/components/tenders/clarification-questions";
import { ComplianceMatrix } from "@/components/tenders/compliance-matrix";
import { DecisionCard } from "@/components/tenders/decision-card";
import { DecisionSimulatorPanel } from "@/components/tenders/decision-simulator-panel";
import { ExplainableDecisionPanel } from "@/components/tenders/explainable-decision-panel";
import { EvidenceIntelligencePanel } from "@/components/tenders/evidence-intelligence-panel";
import { FeatureUpgradeNotice } from "@/components/billing/feature-upgrade-notice";
import { TenderAnalysisWorkspace } from "@/components/tenders/tender-analysis-workspace";
import type { ActionPlanTeamTaskView } from "@/domain/tender-action-plan/presentation";
import { entitlementDef } from "@/domain/billing/entitlement-catalog";
import { LearningSignalCard } from "@/components/tenders/learning-signal-card";
import { OutcomeLearningCard } from "@/components/tenders/outcome-learning-card";
import { RiskAnalysisSection } from "@/components/tenders/risk-analysis-section";
import { TeamWorkflowPanel } from "@/components/tenders/team-workflow-panel";
import { TenderAnalysisLiveStatus } from "@/components/tenders/tender-analysis-live-status";
import { TenderOutcomeForm } from "@/components/tenders/tender-outcome-form";
import { TenderReadinessCard } from "@/components/tenders/tender-readiness-card";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { requireCompanyId } from "@/auth/session";
import { canMutateTenderAnalysis } from "@/auth/tender-access";
import { COMPANY_ONLY_MESSAGE } from "@/domain/company-knowledge";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { AppError, ErrorCode } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenderDetailPage({ params }: PageProps) {
  const { requireTenderAnalysisModule } = await import("@/modules/tender-analysis");
  await requireTenderAnalysisModule();
  const locale = await getLocale();
  const t = getDictionary(locale).app.tenderDetail;
  const { id } = await params;

  let pageData;
  try {
    pageData = await loadTenderResultPageData(id, locale);
  } catch (error) {
    if (error instanceof AppError && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  if (pageData.kind === "failed") {
    return (
      <div className="mx-auto max-w-4xl space-y-8 animate-fade-in">
        <div>
          <Link
            href="/tenders"
            className="text-sm text-muted transition hover:text-foreground"
          >
            {t.backToTenders}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {pageData.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {pageData.clientName ?? t.unknownClient}
          </p>
        </div>
        <Alert variant="danger" title={t.analysisFailedTitle}>
          <p className="whitespace-pre-wrap">
            {pageData.analysisError ?? t.analysisFailedBody}
          </p>
          {pageData.analysisPhase ? (
            <p className="mt-2 text-xs text-muted">
              {t.analysisFailedPhase.replaceAll("{phase}", pageData.analysisPhase)}
            </p>
          ) : null}
        </Alert>
      </div>
    );
  }

  if (pageData.kind === "in_progress") {
    return (
      <TenderAnalysisLiveStatus
        tenderId={pageData.id}
        initialStatus={pageData.status}
        title={pageData.title}
        clientName={pageData.clientName}
        labels={{
          backToTenders: t.backToTenders,
          unknownClient: t.unknownClient,
          analysisInProgressTitle: t.analysisInProgressTitle,
          analysisInProgressBody: t.analysisInProgressBody,
        }}
      />
    );
  }

  const {
    tender,
    executiveSummary,
    explainableView,
    explainableConsistencyError,
    decisionOutcomeView,
    attachmentOptions,
    teamEnabled,
    teamTasks,
    teamMembers,
    teamSummary,
    reportFeatureAccess,
  } = pageData;

  const { auth } = await requireCompanyId();
  const intelligence = tender.intelligence;
  const companyOnly = tender.companyKnowledgeOnly === true;
  const scoringBlocked = tender.analysis?.fitBreakdown?.scoringAvailable === false;
  const analysisReady = Boolean(tender.decision) || scoringBlocked;

  const actionPlan =
    reportFeatureAccess.tenderActionPlan && intelligence?.actionPlan?.computed
      ? intelligence.actionPlan
      : null;

  const actionPlanTeamTasks: ActionPlanTeamTaskView[] = teamTasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.displayStatus,
    department: task.department,
    assigneeLabel: task.assigneeName ?? null,
    deadline: task.deadline,
    requiredResponse: task.requiredResponse,
    responseText: task.responseText,
    verificationState:
      task.verificationStatus && task.verificationStatus !== "NONE"
        ? task.verificationStatus
        : null,
  }));

  const detailSections = analysisReady && !companyOnly && tender.decision ? (
    <>
      <p className="text-xs text-muted">{t.canonicalNote}</p>

      <DecisionCard
        decision={tender.decision}
        fitScore={tender.analysis!.fitScore}
        confidence={tender.analysis!.confidence}
        why={tender.analysis!.summaryWhy}
        fitBreakdown={tender.analysis!.fitBreakdown}
        readiness={
          tender.analysis!.readiness
            ? {
                score: tender.analysis!.readiness.score,
                attention: tender.analysis!.readiness.attention,
                recommendation: tender.analysis!.readiness.recommendation,
                counts: tender.analysis!.readiness.counts,
              }
            : null
        }
        keyBlockers={intelligence?.keyBlockers}
        reviewItems={intelligence?.reviewItems}
        copy={t}
      />

      {explainableView || explainableConsistencyError ? (
        <ExplainableDecisionPanel
          tenderId={tender.id}
          view={explainableView}
          consistencyError={explainableConsistencyError}
        />
      ) : !reportFeatureAccess.explainableDecision ? (
        <FeatureUpgradeNotice
          featureName={entitlementDef("explainable_decision")?.name ?? "Explainable Decision"}
        />
      ) : null}

      {reportFeatureAccess.decisionSimulator ? (
        <DecisionSimulatorPanel tenderId={tender.id} lazyLoad />
      ) : (
        <FeatureUpgradeNotice
          featureName={entitlementDef("decision_simulator")?.name ?? "Decision Simulator"}
        />
      )}

      {tender.bidScore ? <BidScoreCard bidScore={tender.bidScore} /> : null}

      {tender.analysis?.readiness ? (
        <TenderReadinessCard readiness={tender.analysis.readiness} />
      ) : null}

      {intelligence ? (
        <>
          <LearningSignalCard signal={intelligence.learningSignal} />
          <OutcomeLearningCard insights={intelligence.outcomeLearningInsights} />
          {reportFeatureAccess.evidenceIntelligence && intelligence.evidenceIntelligence ? (
            <EvidenceIntelligencePanel
              tenderId={tender.id}
              bundle={intelligence.evidenceIntelligence}
            />
          ) : !reportFeatureAccess.evidenceIntelligence ? (
            <FeatureUpgradeNotice
              featureName={
                entitlementDef("evidence_intelligence")?.name ?? "Evidence Intelligence"
              }
            />
          ) : null}
          <ComplianceMatrix
            rows={intelligence.complianceMatrix}
            summary={intelligence.complianceSummary}
            tenderId={tender.id}
            complianceStatus={intelligence.complianceStatus}
          />
          <RiskAnalysisSection
            risks={intelligence.risks}
            contradictions={intelligence.contradictions}
            tenderId={tender.id}
          />
          <ClarificationQuestions questions={intelligence.clarificationQuestions} />
        </>
      ) : null}

      <TenderOutcomeForm
        tenderId={tender.id}
        current={decisionOutcomeView}
        canEdit={tender.canMutate}
        attachmentOptions={attachmentOptions}
      />

      {tender.missingDocuments.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{t.missingDocuments}</h2>
          <div className="grid gap-3">
            {tender.missingDocuments.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="pt-5">
                  <p className="text-sm font-semibold">
                    {doc.title}
                    {doc.required ? (
                      <span className="ms-2 text-xs font-medium text-danger">
                        {t.required}
                      </span>
                    ) : null}
                  </p>
                  {doc.description ? (
                    <p className="mt-1 text-sm text-muted">{doc.description}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {teamEnabled ? (
        <div id="team-workflow">
          <TeamWorkflowPanel
            tenderId={tender.id}
            tasks={teamTasks}
            members={teamMembers}
            summary={teamSummary}
            canMutate={canMutateTenderAnalysis(auth.user.role)}
            canVerify={
              auth.user.role === "OWNER" || auth.user.role === "ADMIN"
            }
            copy={t.teamWorkflow}
          />
        </div>
      ) : null}
    </>
  ) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/tenders"
            className="text-sm text-muted transition hover:text-foreground"
          >
            {t.backToTenders}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {tender.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {tender.clientName ?? t.unknownClient}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted shadow-[var(--shadow-soft)]">
            <CalendarClock className="size-3.5 text-primary" aria-hidden />
            {t.deadline} {formatDate(tender.deadline, locale)}
          </span>
          <span className="text-xs text-muted">
            {t.analyzed} {formatDateTime(tender.analyzedAt, locale)}
          </span>
          {analysisReady && !companyOnly ? (
            <Link
              href={`/tenders/${tender.id}/report`}
              className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-sm font-medium text-white hover:bg-primary-hover"
            >
              {t.fullReport}
            </Link>
          ) : null}
          <Link
            href={`/questionnaire-assistant/${tender.id}`}
            className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-foreground/[0.04]"
          >
            Questionnaire Assistant
          </Link>
        </div>
      </div>

      {companyOnly ? (
        <Alert variant="warning" title="Company knowledge">
          {COMPANY_ONLY_MESSAGE}
        </Alert>
      ) : (tender.decision || scoringBlocked) &&
        tender.analysis &&
        executiveSummary ? (
        <TenderAnalysisWorkspace
          summary={executiveSummary}
          copy={t}
          tenderId={tender.id}
          actionPlan={actionPlan}
          actionPlanTeamTasks={actionPlanTeamTasks}
          actionPlanUpgradeNotice={
            !reportFeatureAccess.tenderActionPlan ? (
              <FeatureUpgradeNotice
                featureName={
                  entitlementDef("tender_action_plan")?.name ?? "Tender Action Plan"
                }
              />
            ) : null
          }
        >
          {detailSections}
        </TenderAnalysisWorkspace>
      ) : (
        <Alert variant="warning" title={t.analysisInProgressTitle}>
          {t.analysisInProgressBody.replaceAll("{status}", tender.status)}
        </Alert>
      )}
    </div>
  );
}
