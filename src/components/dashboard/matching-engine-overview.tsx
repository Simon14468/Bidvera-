import type { MatchingDashboardOverview } from "@/application/matching-dashboard-overview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

export type MatchingOverviewCopy = {
  dashboardSectionTitle: string;
  dashboardSectionSubtitle: string;
  viewMatch: string;
  viewAllOpportunities: string;
  whyMatched: string;
  highlyRelevant: string;
  emptyImproveProfile: string;
  updateCompanyProfile: string;
  matchDisclaimer: string;
  notEligibleTitle: string;
  notEligibleBody: string;
  unavailableTitle: string;
  unavailableBody: string;
  emptyTitleDashboard: string;
  emptyBodyDashboard: string;
  locationLabel: string;
  deadlineLabel: string;
  matchedCapabilities: string;
  matchScore: string;
  sponsored: string;
};

function StatCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-background px-3 py-3">
      <p className="break-words text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
        {value}
      </p>
      {hint ? <p className="mt-0.5 break-words text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function MatchingEngineOverview({
  data,
  locale,
  copy,
}: {
  data: MatchingDashboardOverview;
  locale: Locale;
  copy: MatchingOverviewCopy;
}) {
  if (data.state === "unavailable") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            <CardTitle>{copy.dashboardSectionTitle}</CardTitle>
          </div>
          <CardDescription>{copy.dashboardSectionSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">{copy.unavailableTitle}</p>
            <p className="mt-1 text-sm text-muted">{copy.unavailableBody}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.state === "not_eligible") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            <CardTitle>{copy.dashboardSectionTitle}</CardTitle>
          </div>
          <CardDescription>{copy.dashboardSectionSubtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">{copy.notEligibleTitle}</p>
            <p className="mt-1 text-sm text-muted">{copy.notEligibleBody}</p>
            <p className="mt-2 text-xs text-muted">{copy.emptyImproveProfile}</p>
            <Link
              href="/company"
              className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
            >
              {copy.updateCompanyProfile}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = data.stats!;

  return (
    <section className="space-y-4" aria-label={copy.dashboardSectionTitle}>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
                <CardTitle>{copy.dashboardSectionTitle}</CardTitle>
              </div>
              <CardDescription className="mt-1">
                {copy.dashboardSectionSubtitle} {copy.matchDisclaimer}
              </CardDescription>
              <span className="sr-only">not a won contract</span>
            </div>
            <Link
              href="/matched-opportunities"
              className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium transition hover:border-primary/25 hover:bg-background sm:h-9 sm:w-auto"
            >
              {copy.viewAllOpportunities}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {data.state === "empty" ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                {copy.emptyTitleDashboard}
              </p>
              <p className="mt-1 text-sm text-muted">{copy.emptyBodyDashboard}</p>
              <p className="mt-2 text-xs text-muted">{copy.emptyImproveProfile}</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/company"
                  className="inline-flex text-sm font-medium text-primary hover:underline"
                >
                  {copy.updateCompanyProfile}
                </Link>
                <Link
                  href="/matched-opportunities"
                  className="inline-flex text-sm font-medium text-primary hover:underline"
                >
                  {copy.viewAllOpportunities}
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                <StatCell label="Matches" value={stats.matchesFound} />
                <StatCell
                  label={copy.highlyRelevant}
                  value={stats.highlyRelevant}
                  hint="≥ 70"
                />
                <StatCell label="Viewed" value={stats.viewed} />
                <StatCell label="Interested" value={stats.interested} />
                <StatCell label="Dismissed" value={stats.dismissed} />
                <StatCell label="Event views" value={data.eventViews} />
              </div>

              <div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {copy.dashboardSectionTitle}
                  </p>
                  <Link
                    href="/matched-opportunities"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {copy.viewAllOpportunities}
                  </Link>
                </div>
                {data.recent.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">{copy.emptyTitleDashboard}</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {data.recent.map((item) => (
                      <li key={item.id}>
                        <div
                          className={cn(
                            "flex flex-col gap-3 rounded-xl border border-border px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-words text-sm font-semibold tracking-tight">
                                {item.title}
                              </p>
                              {item.highlyRelevant ? (
                                <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
                                  {copy.highlyRelevant}
                                </span>
                              ) : null}
                              {item.sponsored ? (
                                <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                                  {copy.sponsored}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1.5 text-xs text-muted">
                              <span className="font-medium text-foreground/80">
                                {copy.whyMatched}:
                              </span>{" "}
                              {item.explanation}
                            </p>
                            {item.capabilityChips.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className="sr-only">{copy.matchedCapabilities}</span>
                                {item.capabilityChips.map((chip) => (
                                  <span
                                    key={chip}
                                    className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                                  >
                                    {chip}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <p className="mt-2 break-words text-xs text-muted">
                              {item.geography
                                ? `${copy.locationLabel}: ${item.geography}`
                                : null}
                              {item.geography && item.deadline ? " · " : null}
                              {item.deadline
                                ? `${copy.deadlineLabel}: ${formatDate(item.deadline, locale)}`
                                : null}
                              {(item.category || item.industry) &&
                              (item.geography || item.deadline)
                                ? " · "
                                : null}
                              {item.category || item.industry || null}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                            <span className="text-xs tabular-nums text-muted">
                              {copy.matchScore}{" "}
                              <span className="text-base font-semibold text-primary">
                                {Math.round(item.score)}
                              </span>
                            </span>
                            <Link
                              href={item.href}
                              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-medium transition hover:border-primary/30"
                            >
                              {copy.viewMatch}
                              <ArrowRight className="size-3.5" aria-hidden />
                            </Link>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
