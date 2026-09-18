import type { MatchingDashboardOverview } from "@/application/matching-dashboard-overview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

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
    <div className="rounded-xl border border-border bg-background px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

function FunnelBars({
  title,
  stages,
  emptyLabel,
}: {
  title: string;
  stages: Array<{ id: string; label: string; value: number }>;
  emptyLabel: string;
}) {
  const max = Math.max(0, ...stages.map((s) => s.value));
  const hasData = stages.some((s) => s.value > 0);
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {!hasData ? (
        <p className="mt-3 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2.5" role="list">
          {stages.map((stage) => {
            const pct = max > 0 ? (stage.value / max) * 100 : 0;
            return (
              <li key={stage.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-muted">{stage.label}</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {stage.value}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-border/70"
                  role="img"
                  aria-label={`${stage.label}: ${stage.value}`}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{
                      width: `${Math.max(pct, stage.value > 0 ? 4 : 0)}%`,
                    }}
                    title={`${stage.label}: ${stage.value}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function MatchingEngineOverview({
  data,
  locale,
}: {
  data: MatchingDashboardOverview;
  locale: Locale;
}) {
  if (data.state === "unavailable") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            <CardTitle>Matching Engine Overview</CardTitle>
          </div>
          <CardDescription>
            Bidvera analyzes available opportunities against your company&apos;s profile,
            capabilities, qualifications and location to surface relevant matches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              Matching is not available on this workspace yet
            </p>
            <p className="mt-1 text-sm text-muted">
              When Matching Engine is enabled for your plan, live match statistics will appear here.
              No sample or estimated figures are shown.
            </p>
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
            <CardTitle>Matching Engine Overview</CardTitle>
          </div>
          <CardDescription>
            Bidvera analyzes available opportunities against your company&apos;s profile,
            capabilities, qualifications and location to surface relevant matches.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              Matching is not currently available for this company
            </p>
            <p className="mt-1 text-sm text-muted">
              Complete company capabilities and geography in your profile so the engine can
              evaluate eligibility. Matches are never fabricated.
            </p>
            <Link
              href="/company"
              className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
            >
              Update company profile
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = data.stats!;

  return (
    <section className="space-y-4" aria-label="Matching Engine Overview">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden />
                <CardTitle>Matching Engine Overview</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Bidvera analyzes available opportunities against your company&apos;s profile,
                capabilities, qualifications and location to surface relevant matches.
                A match means a relevant opportunity was identified — not a won contract.
              </CardDescription>
            </div>
            <Link
              href="/matched-opportunities"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium transition hover:border-primary/25 hover:bg-background"
            >
              View matched opportunities
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {data.state === "empty" ? (
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No matches yet</p>
              <p className="mt-1 text-sm text-muted">
                When opportunities match your eligible profile, statistics and recent matches
                will appear here. Completing company capabilities and geography improves match quality.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/company"
                  className="inline-flex text-sm font-medium text-primary hover:underline"
                >
                  Update company profile
                </Link>
                <Link
                  href="/matched-opportunities"
                  className="inline-flex text-sm font-medium text-primary hover:underline"
                >
                  View matched opportunities →
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StatCell label="Matches found" value={stats.matchesFound} />
                <StatCell
                  label="Highly relevant"
                  value={stats.highlyRelevant}
                  hint="Score ≥ 70"
                />
                <StatCell label="Viewed" value={stats.viewed} />
                <StatCell label="Interested" value={stats.interested} />
                <StatCell label="Dismissed" value={stats.dismissed} />
                <StatCell
                  label="Event views"
                  value={data.eventViews}
                  hint="Behavior events"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <FunnelBars
                  title="Match funnel"
                  stages={data.funnel}
                  emptyLabel="No funnel activity yet."
                />
                <FunnelBars
                  title="Match quality"
                  stages={data.quality}
                  emptyLabel="No quality breakdown yet."
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">Recent matches</p>
                  <Link
                    href="/matched-opportunities"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    View matched opportunities →
                  </Link>
                </div>
                {data.recent.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">No recent matches to show.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {data.recent.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-3 transition",
                            "hover:border-primary/25 hover:bg-background",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.title}</p>
                            <p className="mt-1 text-xs text-muted">
                              {item.geography ? `${item.geography} · ` : ""}
                              {item.highlyRelevant ? "Highly relevant" : "Relevant"}
                              {item.sponsored ? " · Sponsored" : ""}
                              {` · ${item.status}`}
                              {item.deadline
                                ? ` · ${formatDate(item.deadline, locale)}`
                                : ""}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-medium tabular-nums text-primary">
                            {Math.round(item.score)}
                          </span>
                        </Link>
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
