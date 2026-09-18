"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type {
  ComplianceRow,
  ComplianceSummary,
} from "@/domain/tender-intelligence";
import { readinessBadgeClass, readinessLabels } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { useMemo, useState } from "react";
import { SourceViewerButton } from "./source-viewer";

type FilterId =
  | "all"
  | "mandatory"
  | "missing"
  | "verify"
  | "ready"
  | "high"
  | "risks";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mandatory", label: "Mandatory" },
  { id: "missing", label: "Missing" },
  { id: "verify", label: "Verify" },
  { id: "ready", label: "Ready" },
  { id: "high", label: "High priority" },
  { id: "risks", label: "Risks" },
];

function applyFilter(rows: ComplianceRow[], filter: FilterId): ComplianceRow[] {
  switch (filter) {
    case "mandatory":
      return rows.filter((r) => r.mandatory);
    case "missing":
      return rows.filter((r) => r.status === "MISSING");
    case "verify":
      return rows.filter((r) => r.status === "VERIFY");
    case "ready":
      return rows.filter((r) => r.status === "READY");
    case "high":
      return rows.filter((r) => r.priority === "HIGH");
    case "risks":
      return rows.filter((r) => r.evidenceState === "CONFIRMED_NON_COMPLIANT");
    default:
      return rows;
  }
}

function SummaryStrip({ summary }: { summary: ComplianceSummary }) {
  const items: { label: string; value: number; tone?: string }[] = [
    { label: "Total Requirements", value: summary.totalRequirements },
    { label: "Ready", value: summary.ready, tone: "text-success" },
    { label: "Missing", value: summary.missing, tone: "text-danger" },
    { label: "Verify", value: summary.verify, tone: "text-warning" },
    { label: "Not Applicable", value: summary.notApplicable },
    { label: "Sources", value: summary.sources },
    { label: "Risks", value: summary.risks, tone: "text-warning" },
    { label: "Required Actions", value: summary.requiredActions },
    { label: "Clarifications", value: summary.clarifications },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-border bg-background px-3 py-2.5"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            {item.label}
          </p>
          <p
            className={cn(
              "mt-1 text-xl font-semibold tabular-nums tracking-tight",
              item.tone ?? "text-foreground",
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function SourceCell({ row }: { row: ComplianceRow }) {
  if (!row.sourceLocated) {
    return (
      <p className="text-xs text-muted">Source could not be precisely located.</p>
    );
  }
  return (
    <div className="space-y-0.5 text-xs text-muted">
      {row.sourceDocument ? <p className="font-medium text-foreground">{row.sourceDocument}</p> : null}
      <p>
        {[
          row.section
            ? row.section.startsWith("Section")
              ? row.section
              : `Section ${row.section}`
            : null,
          row.pageNumber != null ? `Page ${row.pageNumber}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "—"}
      </p>
    </div>
  );
}

export function ComplianceMatrix({
  rows,
  summary,
  tenderId,
  complianceStatus,
  className,
}: {
  rows: ComplianceRow[];
  summary: ComplianceSummary;
  tenderId: string;
  complianceStatus?: "COMPLETE" | "INCOMPLETE";
  className?: string;
}) {
  const [filter, setFilter] = useState<FilterId>("all");
  const filtered = useMemo(() => applyFilter(rows, filter), [rows, filter]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="border-b border-border px-5 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          Compliance Matrix
        </p>
        <p className="mt-1 text-sm text-muted">
          {complianceStatus === "INCOMPLETE"
            ? "INCOMPLETE — requirement extraction did not finish; this matrix is not a scored compliance view."
            : "Generated from this tender's analysis — counts and rows reflect real requirements only."}
        </p>
        <div className="mt-4">
          <SummaryStrip summary={summary} />
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.id
                  ? "bg-primary text-white"
                  : "bg-background text-muted ring-1 ring-border hover:text-foreground",
              )}
            >
              {f.label}
              {f.id !== "all" ? (
                <span className="ms-1 tabular-nums opacity-80">
                  ({applyFilter(rows, f.id).length})
                </span>
              ) : (
                <span className="ms-1 tabular-nums opacity-80">({rows.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <CardContent className="space-y-3 pt-5">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted">
            {rows.length === 0
              ? "No requirements were extracted from this tender."
              : "No requirements match this filter."}
          </p>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-border bg-background px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted">{row.id}</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">
                    {row.requirement}
                  </p>
                  <p className="mt-1 text-xs text-muted">{row.requirementType}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {row.mandatory ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-danger">
                      Mandatory
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Optional
                    </span>
                  )}
                  <Badge statusIcon className={readinessBadgeClass(row.status)}>
                    {readinessLabels[row.status]}
                  </Badge>
                </div>
              </div>

              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Tender source
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted">
                    {row.evidence ? (
                      <>&ldquo;{row.evidence}&rdquo;</>
                    ) : (
                      "No tender excerpt available."
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Company evidence
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted">
                    {row.companyEvidence?.excerpt ??
                      row.companyEvidenceMessage ??
                      "No supporting company evidence was found."}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Source document · Page / section
                  </dt>
                  <dd className="mt-1">
                    <SourceCell row={row} />
                    {(row.requirementId || row.evidenceId) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <SourceViewerButton
                          tenderId={tenderId}
                          requirementId={row.requirementId}
                          evidenceId={row.evidenceId}
                          view="tender"
                          label="View tender source"
                        />
                        <SourceViewerButton
                          tenderId={tenderId}
                          requirementId={row.requirementId}
                          evidenceId={row.evidenceId}
                          view="company"
                          label="View company evidence"
                        />
                      </div>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Risk
                  </dt>
                  <dd className="mt-1 text-sm text-muted">
                    {row.risk ?? "No significant risk flagged for this requirement."}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Required action
                  </dt>
                  <dd className="mt-1 text-sm text-muted">
                    {row.requiredAction ?? "No action required based on current status."}
                  </dd>
                </div>
              </dl>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
