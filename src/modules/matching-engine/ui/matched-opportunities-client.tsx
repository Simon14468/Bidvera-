"use client";

import { useEffect, useTransition } from "react";
import type { MatchRecommendationDto } from "@/modules/matching-engine";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import Link from "next/link";

export function MatchedOpportunitiesClient({
  recommendations,
}: {
  recommendations: MatchRecommendationDto[];
}) {
  const [pending, startTransition] = useTransition();

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

  if (recommendations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
        <p className="text-sm font-medium">No matches yet</p>
        <p className="mt-1 text-sm text-muted">
          Complete your company profile and qualifications to improve matching.
          A match means Bidvera identified a relevant opportunity — not a won
          contract.
        </p>
        <Link
          href="/company"
          className="mt-4 inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm font-medium hover:bg-card"
        >
          Update company profile
        </Link>
      </div>
    );
  }

  return (
    <ul className={cn("space-y-4", pending && "opacity-80")}>
      {recommendations.map((item) => (
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
                    New
                  </span>
                ) : null}
                {item.score >= 70 ? (
                  <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
                    Highly relevant
                  </span>
                ) : null}
                {item.type === "SPONSORED" ? (
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                    Sponsored
                  </span>
                ) : (
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                    Organic
                  </span>
                )}
                {item.status === "READ" ? (
                  <span className="text-[10px] uppercase tracking-wide text-muted">
                    Viewed
                  </span>
                ) : null}
              </div>
              {item.opportunity.summary ? (
                <p className="mt-2 text-sm text-muted">{item.opportunity.summary}</p>
              ) : null}
            </div>
            <div className="text-right text-xs tabular-nums text-muted">
              <p>
                Score{" "}
                <span className="font-semibold text-foreground">{item.score}</span>
              </p>
              <p className="mt-0.5">
                Confidence{" "}
                <span className="font-medium text-foreground/80">
                  {item.confidence}
                </span>
              </p>
              {item.opportunity.geographies.length > 0 ? (
                <p className="mt-0.5 max-w-[12rem] truncate">
                  {item.opportunity.geographies.slice(0, 2).join(", ")}
                </p>
              ) : null}
            </div>
          </div>

          <p className="mt-3 text-sm">
            <span className="text-muted">Why it matches: </span>
            {item.explanation ?? item.reasons[0] ?? "Relevant to your profile."}
          </p>

          {item.reasons.length > 1 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
              {item.reasons.slice(0, 4).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
            {item.opportunity.category ? (
              <span>{item.opportunity.category}</span>
            ) : null}
            {item.opportunity.industry ? (
              <span
                className={cn(
                  item.opportunity.category && "before:mr-3 before:content-['·']",
                )}
              >
                {item.opportunity.industry}
              </span>
            ) : null}
            {item.opportunity.deadline ? (
              <span>
                Deadline {formatDate(new Date(item.opportunity.deadline))}
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
              View opportunity
            </button>
            <button
              type="button"
              onClick={() => interest(item)}
              className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-xs font-medium hover:bg-background"
            >
              I&apos;m interested
            </button>
            <button
              type="button"
              onClick={() => dismiss(item)}
              className="inline-flex h-9 items-center rounded-xl px-3 text-xs font-medium text-muted hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
