"use client";

import { cn } from "@/lib/cn";
import type { WorkspaceKpi } from "@/application/workspace-dashboard";
import type { AppModuleBundle } from "@/i18n/app-modules";
import {
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileWarning,
  FolderOpen,
  Scale,
  ShieldCheck,
  Lock,
} from "lucide-react";
import Link from "next/link";

const KPI_ICONS: Record<WorkspaceKpi["id"], typeof FileCheck2> = {
  document_compliance: FileCheck2,
  expiring_documents: FileWarning,
  supplier_qualification: ClipboardCheck,
  client_requests: FolderOpen,
  questionnaires: ClipboardList,
  evidence_intelligence: ShieldCheck,
  decision_activity: Scale,
  upcoming_deadlines: CalendarClock,
};

export type WorkspaceKpiLabels = AppModuleBundle["kpi"];

export function WorkspaceKpiGrid({
  kpis,
  lockedLabel,
  kpiLabels,
  emptyDataLabel,
}: {
  kpis: WorkspaceKpi[];
  lockedLabel: string;
  kpiLabels: WorkspaceKpiLabels;
  emptyDataLabel: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi, i) => {
        const meta = kpiLabels[kpi.id];
        const Icon = KPI_ICONS[kpi.id];
        const href = kpi.enabled ? kpi.href : "/upgrade";
        const display =
          kpi.unit === "percent" ? `${kpi.value}%` : String(kpi.value);

        return (
          <Link
            key={kpi.id}
            href={href}
            className="group block min-w-0 animate-fade-up"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <article
              className={cn(
                "h-full rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition hover:border-primary/25 hover:shadow-[var(--shadow-lift)]",
                !kpi.enabled && "opacity-90",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary-muted text-primary">
                  <Icon className="size-4" aria-hidden />
                </div>
                {!kpi.enabled ? (
                  <Lock className="size-3.5 shrink-0 text-muted" aria-hidden />
                ) : null}
              </div>
              <p className="mt-3 text-xs font-medium text-muted">{meta.title}</p>
              {kpi.enabled ? (
                <>
                  <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                    {kpi.empty && kpi.unit === "percent" && kpi.value === 0
                      ? "—"
                      : display}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {kpi.empty
                      ? emptyDataLabel
                      : meta.secondaryLabel && kpi.secondary != null
                        ? `${meta.hint} · ${kpi.secondary} ${meta.secondaryLabel}`
                        : meta.hint}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-muted">
                    —
                  </p>
                  <p className="mt-1 text-xs text-muted">{lockedLabel}</p>
                </>
              )}
            </article>
          </Link>
        );
      })}
    </div>
  );
}
