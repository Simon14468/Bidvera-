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
            Your Bidvera workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Compliance, qualification, client requests, questionnaires, evidence,
            decisions, and deadlines — in one company workspace.
          </p>
        </div>
        <Link
          href="/billing"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-5 text-sm font-medium transition hover:bg-background"
        >
          View plan
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <PwaInstallCard copy={dict.app.pwa} />

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Workspace overview</h2>
          <p className="mt-0.5 text-sm text-muted">
            Live company metrics. Empty modules show zero — never estimated values.
          </p>
        </div>
        <WorkspaceKpiGrid kpis={data.kpis} lockedLabel="Not on your current plan" />
      </section>

      {matchingOverview && matchingOverview.state !== "unavailable" ? (
        <MatchingEngineOverview data={matchingOverview} locale={locale} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <WorkspaceBarChart
          title="Compliance status"
          description={
            data.hasComplianceHistory
              ? "Current document status mix for your company."
              : "Status mix from your documents. Historical trend appears when updates accumulate."
          }
          series={data.complianceStatusSeries}
          emptyLabel="No compliance documents yet."
        />
        <WorkspaceBarChart
          title="Workspace activity"
          description="Client request and questionnaire activity in the last 30 days."
          series={data.activitySeries}
          emptyLabel={
            data.hasActivityHistory
              ? "No activity in this period."
              : "No recent activity recorded yet."
          }
        />
        <WorkspaceBarChart
          title="Deadline overview"
          description="Upcoming Tender Calendar deadlines by time window."
          series={data.deadlineSeries}
          emptyLabel="No upcoming calendar deadlines."
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <WorkspaceRecentActivity items={data.recentActivity} locale={locale} />
        <div className="space-y-4">
          <WorkspacePlanCard plan={data.plan} locale={locale} />
          <WorkspaceQuickActions actions={data.quickActions} />
        </div>
      </div>
    </div>
  );
}
