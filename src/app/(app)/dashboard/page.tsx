export const dynamic = "force-dynamic";

import { getMatchingDashboardOverview } from "@/application/matching-dashboard-overview";
import { getWorkspaceDashboard } from "@/application/workspace-dashboard";
import { MatchingEngineOverview } from "@/components/dashboard/matching-engine-overview";
import { WorkspaceBarChart } from "@/components/dashboard/workspace-bar-chart";
import { WorkspaceKpiGrid } from "@/components/dashboard/workspace-kpi-grid";
import { WorkspacePlanCard } from "@/components/dashboard/workspace-plan-card";
import { WorkspaceQuickActions } from "@/components/dashboard/workspace-quick-actions";
import { WorkspaceRecentActivity } from "@/components/dashboard/workspace-recent-activity";
import { PwaInstallCard } from "@/components/pwa/pwa-install-card";
import { isCommerciallyAvailableFeature } from "@/domain/billing/entitlement-catalog";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const common = dict.app.common;
  const { requireCompanyId } = await import("@/auth/session");
  const { companyId } = await requireCompanyId();

  // Matching commercially OFF: skip overview DB work entirely (journeys hit /dashboard 3×).
  const matchingCommerciallyOn = isCommerciallyAvailableFeature("matching_engine");

  const [data, matchingOverview] = await Promise.all([
    getWorkspaceDashboard(companyId),
    matchingCommerciallyOn
      ? getMatchingDashboardOverview(companyId).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {common.yourWorkspace}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {common.dashboardTitle}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {common.dashboardSubtitle}
          </p>
        </div>
        <Link
          href="/billing"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-5 text-sm font-medium transition hover:bg-background"
        >
          {common.viewPlan}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <PwaInstallCard copy={dict.app.pwa} />

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            {common.workspaceOverview}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {common.workspaceOverviewHint}
          </p>
        </div>
        <WorkspaceKpiGrid
          kpis={data.kpis}
          lockedLabel={common.lockedPlan}
          kpiLabels={dict.app.kpi}
          emptyDataLabel={common.noDataYet}
        />
      </section>

      {matchingOverview && matchingOverview.state !== "unavailable" ? (
        <MatchingEngineOverview data={matchingOverview} locale={locale} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <WorkspaceBarChart
          title={common.complianceStatus}
          description={
            data.hasComplianceHistory
              ? common.complianceStatusHint
              : common.complianceStatusHintEmpty
          }
          series={data.complianceStatusSeries}
          emptyLabel={common.complianceEmpty}
        />
        <WorkspaceBarChart
          title={common.workspaceActivity}
          description={common.workspaceActivityHint}
          series={data.activitySeries}
          emptyLabel={
            data.hasActivityHistory
              ? common.activityEmptyPeriod
              : common.activityEmpty
          }
        />
        <WorkspaceBarChart
          title={common.deadlineOverview}
          description={common.deadlineOverviewHint}
          series={data.deadlineSeries}
          emptyLabel={common.deadlineEmpty}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <WorkspaceRecentActivity
          items={data.recentActivity}
          locale={locale}
          labels={common}
        />
        <div className="space-y-4">
          <WorkspacePlanCard
            plan={data.plan}
            locale={locale}
            labels={common}
            featureLabels={dict.pricing.features as unknown as Record<string, string>}
          />
          <WorkspaceQuickActions
            actions={data.quickActions}
            labels={common}
          />
        </div>
      </div>
    </div>
  );
}
