"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type {
  EvidenceIntelligenceBundle,
  EvidenceIntelligenceState,
  RequirementEvidenceIntelligenceRow,
} from "@/domain/evidence-intelligence";
import {
  evidenceDisplayTitle,
  sourceDisplayLabel,
  verificationDisplayLabel,
} from "@/domain/evidence-intelligence";
import { cn } from "@/lib/cn";
import { ChevronDown, ChevronUp, FileCheck2 } from "lucide-react";
import { useMemo, useState } from "react";
import { SourceViewerButton } from "./source-viewer";

const STATE_BADGE: Record<EvidenceIntelligenceState, string> = {
  VERIFIED: "bg-success/15 text-success border-success/30",
  FOUND_UNVERIFIED: "bg-warning/15 text-warning border-warning/30",
  MISSING: "bg-danger/15 text-danger border-danger/30",
  INVALID: "bg-danger/15 text-danger border-danger/30",
  EXPIRED: "bg-danger/15 text-danger border-danger/30",
  UNKNOWN: "bg-muted/30 text-muted border-border",
};

const STATUS_SHORT: Record<EvidenceIntelligenceState, string> = {
  VERIFIED: "Supported",
  FOUND_UNVERIFIED: "Unverified",
  MISSING: "Missing",
  INVALID: "Invalid",
  EXPIRED: "Expired",
  UNKNOWN: "Unknown",
};

type EvidenceIntelligencePanelProps = {
  tenderId: string;
  bundle: EvidenceIntelligenceBundle;
};

function ExecutiveSummary({
  bundle,
  onViewEvidence,
  expanded,
}: {
  bundle: EvidenceIntelligenceBundle;
  onViewEvidence: () => void;
  expanded: boolean;
}) {
  const { readinessSummary: rs } = bundle;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Evidence Readiness
        </p>
        <ul className="mt-3 space-y-1.5 text-sm">
          <li className="flex justify-between gap-4">
            <span className="text-muted">Requirements</span>
            <span className="font-semibold tabular-nums text-foreground">
              {rs.totalRequirements}
            </span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-muted">Supported</span>
            <span className="font-semibold tabular-nums text-success">{rs.supported}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-muted">Need Verification</span>
            <span className="font-semibold tabular-nums text-warning">
              {rs.needVerification}
            </span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-muted">Missing Evidence</span>
            <span className="font-semibold tabular-nums text-danger">
              {rs.missingEvidence}
            </span>
          </li>
        </ul>
      </div>

      <Button
        type="button"
        variant={expanded ? "outline" : "primary"}
        size="sm"
        className="w-full sm:w-auto"
        onClick={onViewEvidence}
      >
        {expanded ? "Hide Evidence" : "View Evidence"}
        {expanded ? (
          <ChevronUp className="ms-1.5 size-4" aria-hidden />
        ) : (
          <ChevronDown className="ms-1.5 size-4" aria-hidden />
        )}
      </Button>
    </div>
  );
}

function CompactEvidenceRow({
  row,
  tenderId,
  detailOpen,
  onToggleDetail,
}: {
  row: RequirementEvidenceIntelligenceRow;
  tenderId: string;
  detailOpen: boolean;
  onToggleDetail: () => void;
}) {
  const ev = row.evidence;

  return (
    <li className="rounded-xl border border-border bg-card text-sm">
      <div className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_auto] sm:items-center sm:gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Requirement
          </p>
          <p className="mt-0.5 font-medium text-foreground line-clamp-2">{row.requirement}</p>
        </div>

        <div className="min-w-0 hidden sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Evidence</p>
          <p className="mt-0.5 text-xs text-muted truncate">{evidenceDisplayTitle(row)}</p>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted sm:sr-only">
            Status
          </p>
          <Badge
            variant="outline"
            className={cn("mt-0.5 text-[10px] font-semibold", STATE_BADGE[row.evidenceState])}
          >
            {STATUS_SHORT[row.evidenceState]}
          </Badge>
        </div>

        <div className="min-w-0 hidden md:block max-w-[140px]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Source</p>
          <p className="mt-0.5 text-xs text-muted truncate" title={sourceDisplayLabel(row)}>
            {sourceDisplayLabel(row)}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:justify-end">
          <div className="min-w-0 flex-1 sm:hidden">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Verification
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {verificationDisplayLabel(row)}
            </p>
          </div>
          <span className="hidden sm:inline text-xs text-muted max-w-[120px] truncate">
            {verificationDisplayLabel(row)}
          </span>
          {ev?.evidenceId ? (
            <SourceViewerButton
              tenderId={tenderId}
              requirementId={row.requirementId}
              evidenceId={ev.evidenceId}
              view="company"
              label="Source"
            />
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={onToggleDetail}>
            {detailOpen ? (
              <ChevronUp className="size-4" aria-hidden />
            ) : (
              <ChevronDown className="size-4" aria-hidden />
            )}
            <span className="sr-only">Toggle details</span>
          </Button>
        </div>
      </div>

      {detailOpen ? (
        <div className="border-t border-border bg-background/60 px-3 py-3 text-xs text-muted space-y-2">
          <p className="sm:hidden">
            <span className="font-medium text-foreground/80">Evidence: </span>
            {evidenceDisplayTitle(row)}
          </p>
          {ev?.excerpt ? (
            <p>
              <span className="font-medium text-foreground/80">Excerpt: </span>
              &ldquo;{ev.excerpt.slice(0, 280)}
              {ev.excerpt.length > 280 ? "…" : ""}&rdquo;
            </p>
          ) : null}
          {row.relevanceReason ? (
            <p>
              <span className="font-medium text-foreground/80">Why linked: </span>
              {row.relevanceReason}
            </p>
          ) : null}
          <p>
            <span className="font-medium text-foreground/80">Readiness: </span>
            {row.readinessImpactLabel}
          </p>
          {ev ? (
            <>
              <p>
                <span className="font-medium text-foreground/80">Confidence (not verification): </span>
                {ev.confidence}
              </p>
              {ev.expiryDate ? (
                <p>
                  <span className="font-medium text-foreground/80">Expiry: </span>
                  {ev.expiryDate} ({ev.validityState.replace("_", " ").toLowerCase()})
                </p>
              ) : (
                <p>
                  <span className="font-medium text-foreground/80">Validity: </span>
                  Unknown — no reliable expiry date in evidence text
                </p>
              )}
            </>
          ) : null}
          {row.evidenceState === "FOUND_UNVERIFIED" || row.teamTaskId ? (
            <p className="text-warning">
              Requires human verification — Evidence Intelligence never auto-verifies requirements.
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function EvidenceIntelligencePanel({
  tenderId,
  bundle,
}: EvidenceIntelligencePanelProps) {
  const [listOpen, setListOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      bundle.rows.filter((r) => r.requirementVerificationStatus !== "NOT_APPLICABLE"),
    [bundle.rows],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-muted">
            <FileCheck2 className="size-4 text-primary" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Evidence Intelligence</h2>
            <p className="text-xs text-muted">{bundle.disclaimer}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ExecutiveSummary
          bundle={bundle}
          expanded={listOpen}
          onViewEvidence={() => setListOpen((v) => !v)}
        />

        {listOpen ? (
          <div className="space-y-3 border-t border-border pt-4">
            {rows.length === 0 ? (
              <p className="text-sm text-muted">No evidence rows for this tender.</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((row) => (
                  <CompactEvidenceRow
                    key={row.requirementId}
                    row={row}
                    tenderId={tenderId}
                    detailOpen={expandedId === row.requirementId}
                    onToggleDetail={() =>
                      setExpandedId((id) =>
                        id === row.requirementId ? null : row.requirementId,
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
