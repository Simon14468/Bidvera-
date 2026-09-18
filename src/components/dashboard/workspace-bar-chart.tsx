"use client";

import { cn } from "@/lib/cn";
import type { WorkspaceChartSeries } from "@/application/workspace-dashboard";

/** Simple accessible SVG bar chart — no extra chart dependency. */
export function WorkspaceBarChart({
  title,
  description,
  series,
  emptyLabel,
  className,
}: {
  title: string;
  description?: string;
  series: WorkspaceChartSeries[];
  emptyLabel: string;
  className?: string;
}) {
  const max = Math.max(0, ...series.map((s) => s.value));
  const hasData = series.some((s) => s.value > 0);

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]",
        className,
      )}
      aria-label={title}
    >
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {description ? (
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      ) : null}

      {!hasData ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center">
          <p className="text-sm text-muted">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3" role="list">
          {series.map((item) => {
            const pct = max > 0 ? (item.value / max) * 100 : 0;
            return (
              <li key={item.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-muted">{item.label}</span>
                  <span className="tabular-nums font-medium text-foreground">
                    {item.value}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-border/70"
                  role="img"
                  aria-label={`${item.label}: ${item.value}`}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${Math.max(pct, item.value > 0 ? 4 : 0)}%` }}
                    title={`${item.label}: ${item.value}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
