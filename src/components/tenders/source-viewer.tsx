"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { SourceBasis } from "@/domain/tender-intelligence";
import { sourceBasisBadgeClass, sourceBasisLabels } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { ExternalLink, FileSearch } from "lucide-react";
import { useState } from "react";

type SourcePayload = {
  kind: "TENDER_SOURCE" | "COMPANY_EVIDENCE";
  documentName: string | null;
  documentId?: string | null;
  pageNumber: number | null;
  section: string | null;
  excerpt: string | null;
  basis: SourceBasis;
  located: boolean;
  message: string | null;
};

interface SourceViewerButtonProps {
  tenderId: string;
  requirementId?: string;
  evidenceId?: string | null;
  view?: "tender" | "company";
  label?: string;
  className?: string;
}

export function SourceViewerButton({
  tenderId,
  requirementId,
  evidenceId,
  view = "tender",
  label = "View source",
  className,
}: SourceViewerButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<SourcePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSource() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (requirementId) params.set("requirementId", requirementId);
      if (evidenceId) params.set("evidenceId", evidenceId);
      params.set("view", view);
      const res = await fetch(`/api/tenders/${tenderId}/source?${params}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Could not load source");
      }
      setSource((await res.json()) as SourcePayload);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load source");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-8 gap-1.5 px-2 text-xs", className)}
        onClick={() => void loadSource()}
        disabled={loading}
      >
        <FileSearch className="size-3.5" aria-hidden />
        {loading ? "Loading…" : label}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={source?.kind === "COMPANY_EVIDENCE" ? "Company evidence" : "Tender source"}
        description="Tender source is from the uploaded tender. Company evidence proves your ability to meet the requirement — they are never interchangeable."
        className="max-w-xl"
      >
        {source ? (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge statusIcon className={sourceBasisBadgeClass(source.basis)}>
                {sourceBasisLabels[source.basis]}
              </Badge>
              {source.located ? (
                <span className="text-xs text-muted">
                  {source.kind === "COMPANY_EVIDENCE"
                    ? "Company evidence on file"
                    : "Located in tender document"}
                </span>
              ) : (
                <span className="text-xs text-warning">
                  {source.message ?? "Source could not be precisely located."}
                </span>
              )}
            </div>
            <dl className="space-y-2 rounded-xl border border-border bg-background px-4 py-3">
              {source.documentName ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                    Document
                  </dt>
                  <dd className="mt-0.5 font-medium">{source.documentName}</dd>
                </div>
              ) : null}
              {source.section ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                    Section / clause
                  </dt>
                  <dd className="mt-0.5">{source.section}</dd>
                </div>
              ) : null}
              {source.pageNumber != null ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                    Page
                  </dt>
                  <dd className="mt-0.5 tabular-nums">{source.pageNumber}</dd>
                </div>
              ) : null}
            </dl>
            {source.excerpt ? (
              <blockquote className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm leading-relaxed text-foreground">
                &ldquo;{source.excerpt}&rdquo;
              </blockquote>
            ) : (
              <p className="text-sm text-muted">
                No excerpt available. Refer to the original tender document.
              </p>
            )}
            <p className="flex items-start gap-1.5 text-xs text-muted">
              <ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Open the uploaded tender file from your workspace storage to compare the
              original wording.
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

interface InlineSourceProps {
  document: string | null;
  page: number | null;
  section: string | null;
  excerpt: string | null;
  basis: SourceBasis;
  located: boolean;
  tenderId: string;
  requirementId?: string;
  evidenceId?: string | null;
}

export function InlineSourceTrace({
  document,
  page,
  section,
  excerpt,
  basis,
  located,
  tenderId,
  requirementId,
  evidenceId,
}: InlineSourceProps) {
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge statusIcon className={cn("text-[10px]", sourceBasisBadgeClass(basis))}>
          {sourceBasisLabels[basis]}
        </Badge>
        {!located ? (
          <span className="text-xs text-muted">Source could not be precisely located.</span>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        {document ? `${document}` : "Tender document"}
        {section ? ` — ${section.startsWith("Section") ? section : `Section ${section}`}` : ""}
        {page != null ? ` — Page ${page}` : ""}
      </p>
      {excerpt ? (
        <p className="text-xs leading-relaxed text-muted">
          &ldquo;{excerpt.length > 200 ? `${excerpt.slice(0, 200)}…` : excerpt}&rdquo;
        </p>
      ) : null}
      {(requirementId || evidenceId) && (
        <SourceViewerButton
          tenderId={tenderId}
          requirementId={requirementId}
          evidenceId={evidenceId}
        />
      )}
    </div>
  );
}
