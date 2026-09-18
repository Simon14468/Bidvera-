/**
 * Source traceability helpers — never invent page numbers or excerpts.
 */

import type { ComplianceRow } from "@/domain/tender-intelligence";
import type { ExplanationSourceRef } from "./types";
import { INSUFFICIENT_DATA } from "./types";

export function sourceFromComplianceRow(
  row: ComplianceRow | null | undefined,
  prefer: "tender" | "company" = "company",
): ExplanationSourceRef {
  if (!row) {
    return {
      kind: "UNKNOWN",
      label: "Source unknown",
      documentName: null,
      page: null,
      section: null,
      excerpt: null,
      located: false,
    };
  }

  const ref = prefer === "company" ? row.companyEvidence : row.tenderSource;
  if (ref?.located || ref?.excerpt) {
    return {
      kind: prefer === "company" ? "COMPANY_EVIDENCE" : "TENDER_DOCUMENT",
      label: ref.documentName ?? row.sourceDocument ?? "Document",
      documentName: ref.documentName ?? row.sourceDocument,
      page: ref.page ?? row.pageNumber,
      section: ref.section ?? row.section,
      excerpt: ref.excerpt ?? null,
      located: ref.located,
    };
  }

  if (row.sourceDocument || row.pageNumber != null || row.section) {
    return {
      kind: "TENDER_DOCUMENT",
      label: row.sourceDocument ?? "Tender document",
      documentName: row.sourceDocument,
      page: row.pageNumber,
      section: row.section,
      excerpt: row.evidence,
      located: row.sourceLocated,
    };
  }

  return {
    kind: "UNKNOWN",
    label: "Source unknown",
    documentName: null,
    page: null,
    section: null,
    excerpt: null,
    located: false,
  };
}

export function sourceFromEngine(
  label: string,
  detail: string | null,
): ExplanationSourceRef {
  return {
    kind: "DECISION_ENGINE",
    label,
    documentName: null,
    page: null,
    section: null,
    excerpt: detail,
    located: Boolean(detail?.trim()),
  };
}

export function sourceFromMemory(title: string): ExplanationSourceRef {
  return {
    kind: "DECISION_MEMORY",
    label: "Decision Memory",
    documentName: null,
    page: null,
    section: null,
    excerpt: title,
    located: true,
  };
}

export function whyFromReason(text: string | null | undefined): string {
  const t = text?.trim();
  return t && t.length > 0 ? t : INSUFFICIENT_DATA;
}

export function stableItemId(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(":").slice(0, 120) || INSUFFICIENT_DATA;
}
