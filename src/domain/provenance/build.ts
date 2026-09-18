/**
 * Build canonical SourceReference from domain objects.
 */

import {
  computeLocated,
  isRealExcerpt,
  sanitizePageNumber,
  type PageValidationContext,
} from "@/domain/provenance/validate";
import type {
  ProvenanceBasis,
  ProvenanceConfidence,
  ProvenanceKind,
  SourceReference,
  TenderFactKey,
  TenderFactProvenance,
} from "@/domain/provenance/types";
import { NEEDS_VERIFICATION_MESSAGE } from "@/domain/provenance/messages";

type BuildSourceInput = {
  kind: ProvenanceKind;
  documentId?: string | null;
  documentName?: string | null;
  page?: number | null;
  section?: string | null;
  cell?: string | null;
  columnHeader?: string | null;
  rowLabel?: string | null;
  versionLabel?: string | null;
  locator?: string | null;
  completeness?: SourceReference["completeness"];
  excerpt?: string | null;
  normalizedText?: string | null;
  classification?: string | null;
  confidence?: ProvenanceConfidence;
  basis?: ProvenanceBasis;
  verificationStatus?: SourceReference["verificationStatus"];
  pageContext?: PageValidationContext;
};

export function buildSourceReference(input: BuildSourceInput): SourceReference {
  const excerpt = isRealExcerpt(input.excerpt) ? input.excerpt!.trim() : null;
  const page = sanitizePageNumber(input.page, input.pageContext);
  const section = input.section?.trim() || null;
  const cell = input.cell?.trim() || null;
  const locator = input.locator?.trim() || null;
  const located = computeLocated({
    excerpt,
    page,
    section,
    cell,
    locator,
    pageContext: input.pageContext,
  });

  let basis = input.basis ?? "UNKNOWN";
  if (input.kind === "TENDER_SOURCE" && basis === "TEAM_VERIFIED") {
    basis = "UNKNOWN";
  }
  if (input.kind === "COMPANY_EVIDENCE" && basis === "TENDER_DOCUMENT") {
    basis = "UNKNOWN";
  }

  return {
    kind: input.kind,
    documentId: input.documentId ?? null,
    documentName: input.documentName ?? null,
    page,
    section,
    cell,
    columnHeader: input.columnHeader?.trim() || null,
    rowLabel: input.rowLabel?.trim() || null,
    versionLabel: input.versionLabel?.trim() || null,
    locator,
    completeness: input.completeness ?? null,
    excerpt,
    normalizedText: input.normalizedText?.trim() || null,
    classification: input.classification ?? null,
    confidence: input.confidence ?? (located ? "INFERRED" : "UNKNOWN"),
    basis,
    located,
    verificationStatus: input.verificationStatus ?? "UNKNOWN",
  };
}

export function buildRequirementTenderSource(input: {
  documentName: string | null;
  documentId?: string | null;
  page?: number | null;
  section?: string | null;
  cell?: string | null;
  columnHeader?: string | null;
  rowLabel?: string | null;
  versionLabel?: string | null;
  locator?: string | null;
  completeness?: SourceReference["completeness"];
  originalExcerpt?: string | null;
  normalizedRequirement: string;
  requirementType: string;
  pageContext?: PageValidationContext;
}): SourceReference {
  return buildSourceReference({
    kind: "TENDER_SOURCE",
    documentId: input.documentId ?? null,
    documentName: input.documentName,
    page: input.page,
    section: input.section,
    cell: input.cell,
    columnHeader: input.columnHeader,
    rowLabel: input.rowLabel,
    versionLabel: input.versionLabel,
    locator: input.locator,
    completeness: input.completeness,
    excerpt: input.originalExcerpt,
    normalizedText: input.normalizedRequirement,
    classification: input.requirementType,
    basis: isRealExcerpt(input.originalExcerpt) ? "TENDER_DOCUMENT" : "UNKNOWN",
    confidence: isRealExcerpt(input.originalExcerpt) ? "INFERRED" : "UNKNOWN",
    verificationStatus: "NEEDS_VERIFICATION",
    pageContext: input.pageContext,
  });
}

export function buildCompanyEvidenceSource(input: {
  excerpt?: string | null;
  documentName?: string | null;
  documentId?: string | null;
  humanVerified?: boolean;
  verificationStatus?: SourceReference["verificationStatus"];
}): SourceReference | null {
  if (!isRealExcerpt(input.excerpt)) return null;
  return buildSourceReference({
    kind: "COMPANY_EVIDENCE",
    documentId: input.documentId ?? null,
    documentName: input.documentName ?? null,
    excerpt: input.excerpt,
    basis: input.humanVerified ? "TEAM_VERIFIED" : "COMPANY_PROFILE",
    confidence: input.humanVerified ? "VERIFIED" : "INFERRED",
    verificationStatus:
      input.verificationStatus ??
      (input.humanVerified ? "VERIFIED" : "NEEDS_VERIFICATION"),
  });
}

export function buildTenderFactProvenance(input: {
  key: TenderFactKey;
  value: string | null;
  documentName?: string | null;
  page?: number | null;
  excerpt?: string | null;
  note?: string | null;
  pageContext?: PageValidationContext;
}): TenderFactProvenance {
  const source =
    input.value && isRealExcerpt(input.excerpt)
      ? buildSourceReference({
          kind: "TENDER_SOURCE",
          documentName: input.documentName ?? null,
          page: input.page,
          excerpt: input.excerpt,
          normalizedText: input.value,
          classification: input.key,
          basis: "TENDER_DOCUMENT",
          confidence: "INFERRED",
          verificationStatus: "NEEDS_VERIFICATION",
          pageContext: input.pageContext,
        })
      : null;

  return {
    key: input.key,
    value: input.value,
    source,
    note: source ? null : (input.note ?? NEEDS_VERIFICATION_MESSAGE),
  };
}
