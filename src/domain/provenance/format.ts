/**
 * Format provenance for display — shared by web report and PDF.
 */

import {
  COMPANY_EVIDENCE_LABEL,
  NO_COMPANY_EVIDENCE_MESSAGE,
  SOURCE_NOT_LOCATED_MESSAGE,
  TENDER_SOURCE_LABEL,
} from "@/domain/provenance/messages";
import type { SourceReference, TenderFactProvenance } from "@/domain/provenance/types";

export function formatSourceLocation(ref: SourceReference | null): string {
  if (!ref) return SOURCE_NOT_LOCATED_MESSAGE;
  if (!ref.located) return SOURCE_NOT_LOCATED_MESSAGE;
  const parts = [
    ref.documentName,
    ref.section
      ? ref.section.startsWith("Section")
        ? ref.section
        : `Section ${ref.section}`
      : null,
    ref.page != null ? `Page ${ref.page}` : null,
    ref.cell ? `Cell ${ref.cell}` : null,
    ref.columnHeader ? `Col ${ref.columnHeader}` : null,
    ref.versionLabel ? `Ver ${ref.versionLabel}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : SOURCE_NOT_LOCATED_MESSAGE;
}

export function formatSourceLine(ref: SourceReference | null): string {
  if (!ref) return SOURCE_NOT_LOCATED_MESSAGE;
  const label = ref.kind === "TENDER_SOURCE" ? TENDER_SOURCE_LABEL : COMPANY_EVIDENCE_LABEL;
  const loc = formatSourceLocation(ref);
  if (ref.excerpt) {
    return `${label}: ${loc} — "${truncate(ref.excerpt, 200)}"`;
  }
  return `${label}: ${loc}`;
}

export function formatCompanyEvidenceDisplay(
  company: SourceReference | null,
): string {
  if (!company?.excerpt) return NO_COMPANY_EVIDENCE_MESSAGE;
  return company.excerpt;
}

export function formatTenderFactLine(fact: TenderFactProvenance): string {
  if (!fact.value) return fact.note ?? "Needs verification";
  if (fact.source?.located) {
    return `${fact.value} (${formatSourceLocation(fact.source)})`;
  }
  if (fact.source?.excerpt) {
    return `${fact.value} — "${truncate(fact.source.excerpt, 120)}"`;
  }
  return fact.value;
}

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

export function pageContextFromExtractedPages(
  pages: Array<{ page: number | null }> | null | undefined,
  maxPage?: number | null,
): { maxPage: number | null; knownPages: Set<number> | null } {
  const known = new Set<number>();
  for (const p of pages ?? []) {
    if (p.page != null && p.page >= 1) known.add(p.page);
  }
  return {
    maxPage: maxPage ?? (known.size ? Math.max(...known) : null),
    knownPages: known.size ? known : null,
  };
}
