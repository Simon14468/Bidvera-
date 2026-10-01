"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { MatchRecommendationDto } from "@/modules/matching-engine";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import Link from "next/link";

export type MatchedOpportunitiesCopy = {
  emptyTitle: string;
  emptyDescription: string;
  emptyImproveProfile: string;
  updateCompanyProfile: string;
  matchDisclaimer: string;
  whyMatched: string;
  gapsLabel: string;
  highlyRelevant: string;
  matchScore: string;
  dismiss: string;
  refreshMatches: string;
  filterRelevance: string;
  filterDeadline: string;
  filterGeography: string;
  filterCategory: string;
  filterStatus: string;
  statusAll: string;
  statusNew: string;
  statusViewed: string;
  statusHighlyRelevant: string;
  interested: string;
  viewOpportunity: string;
  locationLabel: string;
  deadlineLabel: string;
  matchedCapabilities: string;
  noMatchFilter: string;
  sponsored: string;
  loading: string;
  errorGeneric: string;
};

type SortMode = "relevance" | "deadline";
type StatusFilter = "all" | "new" | "viewed" | "highly";

export function MatchedOpportunitiesClient({
  recommendations,
  copy,
  canRefresh = false,
}: {
  recommendations: MatchRecommendationDto[];
  copy: MatchedOpportunitiesCopy;
  canRefresh?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("relevance");
  const [geography, setGeography] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  useEffect(() => {
    if (recommendations.length === 0) return;
    void Promise.all(
      recommendations.map((item) =>
        fetch("/api/matching-engine/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "IMPRESSION",
            opportunityId: item.opportunity.id,
            recommendationId: item.id,
            metadata: { surface: "matched_opportunities" },
          }),
        }).catch(() => null),
      ),
    );
  }, [recommendations]);

  const geographyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of recommendations) {
      for (const g of r.opportunity.geographies) {
        if (g.trim()) set.add(g.trim());
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [recommendations]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of recommendations) {
      const c = r.opportunity.category || r.opportunity.industry;
      if (c?.trim()) set.add(c.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [recommendations]);

  const filtered = useMemo(() => {
    let list = [...recommendations];
    if (geography !== "all") {
      list = list.filter((r) =>
        r.opportunity.geographies.some((g) => g === geography),
      );
    }
    if (category !== "all") {
      list = list.filter(
        (r) =>
          r.opportunity.category === category ||
          r.opportunity.industry === category,
      );
    }
    if (status === "new") list = list.filter((r) => r.isNew);
    if (status === "viewed") list = list.filter((r) => r.status === "READ");
    if (status === "highly") list = list.filter((r) => r.score >= 70);

    list.sort((a, b) => {
      if (sort === "deadline") {
        const da = a.opportunity.deadline
          ? new Date(a.opportunity.deadline).getTime()
          : Number.POSITIVE_INFINITY;
        const db = b.opportunity.deadline
          ? new Date(b.opportunity.deadline).getTime()
          : Number.POSITIVE_INFINITY;
        return da - db;
      }
      const fa = a.finalRankScore ?? a.score;
      const fb = b.finalRankScore ?? b.score;
      return fb - fa;
    });
    return list;
  }, [recommendations, geography, category, status, sort]);

  function postEvent(
    item: MatchRecommendationDto,
    eventType: string,
    metadata?: Record<string, string>,
  ) {
    void fetch("/api/matching-engine/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        opportunityId: item.opportunity.id,
        recommendationId: item.id,
        idempotencyKey: `${eventType.toLowerCase()}:${item.id}`,
        metadata,
      }),
    }).catch(() => null);
  }

  function markRead(item: MatchRecommendationDto) {
    startTransition(() => {
      void fetch(`/api/matching-engine/recommendations/${item.id}/read`, {
        method: "POST",
      }).catch(() => null);
    });
    postEvent(item, "VIEW", { surface: "matched_opportunities" });
  }

  function dismiss(item: MatchRecommendationDto) {
    startTransition(() => {
      void fetch(`/api/matching-engine/recommendations/${item.id}/dismiss`, {
        method: "POST",
      }).then(() => {
        window.location.reload();
      });
    });
  }

  function interest(item: MatchRecommendationDto) {
    postEvent(item, "INTEREST", { target: "contact_request" });
    markRead(item);
  }

  async function refreshMatches() {
    if (!canRefresh || refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/matching-engine/recommendations/generate", {
        method: "POST",
      });
      if (!res.ok) {
        setError(copy.errorGeneric);
        return;
      }
      window.location.reload();
    } catch {
      setError(copy.errorGeneric);
    } finally {
      setRefreshing(false);
    }
  }

  if (recommendations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
        <p className="text-sm font-medium">{copy.emptyTitle}</p>
        <p className="mt-1 text-sm text-muted">{copy.emptyDescription}</p>
        <p className="mt-2 text-xs text-muted">{copy.emptyImproveProfile}</p>
        <p className="mt-2 text-xs text-muted">{copy.matchDisclaimer}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/company"
            className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-card"
          >
            {copy.updateCompanyProfile}
          </Link>
          {canRefresh ? (
            <button
              type="button"
              onClick={() => void refreshMatches()}
              disabled={refreshing}
              className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-card disabled:opacity-60"
            >
              {refreshing ? copy.loading : copy.refreshMatches}
            </button>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:p-4">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="min-w-0 text-xs text-muted">
            {copy.filterRelevance}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2 text-sm text-foreground"
            >
              <option value="relevance">{copy.filterRelevance}</option>
              <option value="deadline">{copy.filterDeadline}</option>
            </select>
          </label>
          <label className="min-w-0 text-xs text-muted">
            {copy.filterGeography}
            <select
              value={geography}
              onChange={(e) => setGeography(e.target.value)}
              className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2 text-sm text-foreground"
            >
              <option value="all">{copy.statusAll}</option>
              {geographyOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-xs text-muted">
            {copy.filterCategory}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2 text-sm text-foreground"
            >
              <option value="all">{copy.statusAll}</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-xs text-muted">
            {copy.filterStatus}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2 text-sm text-foreground"
            >
              <option value="all">{copy.statusAll}</option>
              <option value="new">{copy.statusNew}</option>
              <option value="viewed">{copy.statusViewed}</option>
              <option value="highly">{copy.statusHighlyRelevant}</option>
            </select>
          </label>
        </div>
        {canRefresh ? (
          <button
            type="button"
            onClick={() => void refreshMatches()}
            disabled={refreshing}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-background disabled:opacity-60"
          >
            {refreshing ? copy.loading : copy.refreshMatches}
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted">
          {copy.noMatchFilter}
        </div>
      ) : (
        <ul className={cn("space-y-4", pending && "opacity-80")}>
          {filtered.map((item) => (
            <li
              key={item.id}
              id={item.id}
              className="scroll-mt-24 rounded-2xl border border-border/80 bg-card p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold tracking-tight">
                      {item.opportunity.title}
                    </h2>
                    {item.isNew ? (
                      <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        {copy.statusNew}
                      </span>
                    ) : null}
                    {item.score >= 70 ? (
                      <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
                        {copy.highlyRelevant}
                      </span>
                    ) : null}
                    {item.type === "SPONSORED" ? (
                      <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                        {copy.sponsored}
                      </span>
                    ) : null}
                    {item.status === "READ" ? (
                      <span className="text-[10px] uppercase tracking-wide text-muted">
                        {copy.statusViewed}
                      </span>
                    ) : null}
                  </div>
                  {item.opportunity.summary ? (
                    <p className="mt-2 text-sm text-muted">
                      {item.opportunity.summary}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-xs tabular-nums text-muted">
                  <p>
                    {copy.matchScore}{" "}
                    <span className="text-base font-semibold text-foreground">
                      {item.score}
                    </span>
                  </p>
                  {item.opportunity.geographies.length > 0 ? (
                    <p className="mt-0.5 max-w-[12rem] truncate">
                      {copy.locationLabel}:{" "}
                      {item.opportunity.geographies.slice(0, 2).join(", ")}
                    </p>
                  ) : null}
                </div>
              </div>

              <p className="mt-3 text-sm">
                <span className="text-muted">{copy.whyMatched}: </span>
                {item.explanation ??
                  item.reasons[0] ??
                  "Relevant to your profile."}
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

              {item.matchedLabels.length > 1 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
                  {item.reasons.slice(0, 4).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}

              {item.gapNotes.length > 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-border bg-background/60 px-3 py-2">
                  <p className="text-xs font-medium text-foreground">
                    {copy.gapsLabel}
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">
                    {item.gapNotes.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
                {item.opportunity.category ? (
                  <span>{item.opportunity.category}</span>
                ) : null}
                {item.opportunity.industry ? (
                  <span
                    className={cn(
                      item.opportunity.category &&
                        "before:mr-3 before:content-['·']",
                    )}
                  >
                    {item.opportunity.industry}
                  </span>
                ) : null}
                {item.opportunity.deadline ? (
                  <span>
                    {copy.deadlineLabel}{" "}
                    {formatDate(new Date(item.opportunity.deadline))}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    postEvent(item, "CLICK", { target: "view_opportunity" });
                    markRead(item);
                  }}
                  className="inline-flex h-9 items-center rounded-xl border border-border bg-background px-3 text-xs font-medium hover:border-primary/30"
                >
                  {copy.viewOpportunity}
                </button>
                <button
                  type="button"
                  onClick={() => interest(item)}
                  className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-xs font-medium hover:bg-background"
                >
                  {copy.interested}
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(item)}
                  className="inline-flex h-9 items-center rounded-xl px-3 text-xs font-medium text-muted hover:text-foreground"
                >
                  {copy.dismiss}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
