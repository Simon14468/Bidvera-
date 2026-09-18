"use client";

import type { MatchRecommendationDto } from "@/modules/matching-engine";
import { cn } from "@/lib/cn";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export function MatchedOpportunitiesStrip({
  items,
}: {
  items: MatchRecommendationDto[];
}) {
  useEffect(() => {
    if (items.length === 0) return;
    void Promise.all(
      items.map((item) =>
        fetch("/api/matching-engine/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "IMPRESSION",
            opportunityId: item.opportunity.id,
            recommendationId: item.id,
            metadata: { surface: "dashboard_strip" },
          }),
        }).catch(() => null),
      ),
    );
  }, [items]);

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Matched opportunities"
      className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/[0.04] p-4 shadow-[var(--shadow-soft)] sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          MATCHED
        </p>
        <Link
          href="/matched-opportunities"
          className="text-xs font-medium text-muted transition hover:text-foreground"
        >
          View all
        </Link>
      </div>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex flex-col gap-2 border-t border-border/60 pt-3 first:border-0 first:pt-0 sm:flex-row sm:items-end sm:justify-between",
            )}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {item.opportunity.title}
                </p>
                {item.isNew ? (
                  <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    New
                  </span>
                ) : null}
                {item.score >= 70 ? (
                  <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
                    Highly relevant
                  </span>
                ) : null}
                {item.type === "SPONSORED" ? (
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                    Sponsored
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted">
                Why it matches:{" "}
                <span className="text-foreground/80">
                  {item.explanation ?? item.reasons[0] ?? "Relevant to your profile."}
                </span>
              </p>
            </div>
            <Link
              href={`/matched-opportunities#${item.id}`}
              onClick={() => {
                void fetch("/api/matching-engine/events", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    eventType: "CLICK",
                    opportunityId: item.opportunity.id,
                    recommendationId: item.id,
                    metadata: { target: "view_opportunity", surface: "dashboard_strip" },
                  }),
                }).catch(() => null);
              }}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-medium transition hover:border-primary/30 hover:bg-card"
            >
              View opportunity
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
