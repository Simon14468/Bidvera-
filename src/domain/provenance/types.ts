/**
 * Canonical provenance — one structure for requirements, evidence, risks,
 * tender facts, and decision traceability across web, PDF, and API.
 *
 * Accuracy over completeness: never invent page numbers or excerpts.
 */

export type ProvenanceConfidence = "VERIFIED" | "INFERRED" | "UNKNOWN";

/** What the citation refers to — never conflate tender text with company proof. */
export type ProvenanceKind = "TENDER_SOURCE" | "COMPANY_EVIDENCE";

export type ProvenanceBasis =
  | "TENDER_DOCUMENT"
  | "COMPANY_PROFILE"
  | "TEAM_VERIFIED"
  | "AI_INTERPRETATION"
  | "HEURISTIC"
  | "UNKNOWN";

export type SourceReference = {
  kind: ProvenanceKind;
  documentId: string | null;
  documentName: string | null;
  page: number | null;
  section: string | null;
  /** Table cell address (Excel A12 / row-col) when the excerpt is a cell. */
  cell?: string | null;
  columnHeader?: string | null;
  rowLabel?: string | null;
  versionLabel?: string | null;
  locator?: string | null;
  completeness?: "COMPLETE" | "TRUNCATED" | "PARTIAL" | "UNREADABLE" | null;
  /** Original excerpt from the source document — null when unknown. */
  excerpt: string | null;
  /** Normalized claim derived from excerpt (e.g. requirement description). */
  normalizedText: string | null;
  classification: string | null;
  confidence: ProvenanceConfidence;
  basis: ProvenanceBasis;
  /** True when excerpt exists and page, section, cell, or locator is known. */
  located: boolean;
  verificationStatus: "VERIFIED" | "NEEDS_VERIFICATION" | "MISSING" | "NOT_APPLICABLE" | "UNKNOWN";
};

export type TenderFactKey =
  | "deadline"
  | "submission_method"
  | "contract_duration"
  | "estimated_value"
  | "bid_security"
  | "guarantee"
  | "payment_terms"
  | "evaluation_criteria"
  | "technical_specifications"
  | "penalties"
  | "warranty_sla";

export type TenderFactProvenance = {
  key: TenderFactKey;
  value: string | null;
  source: SourceReference | null;
  note: string | null;
};

export type DecisionTraceLink = {
  decision: string;
  reason: string;
  requirementId: string | null;
  riskId: string | null;
  evidenceId: string | null;
  tenderSource: SourceReference | null;
  companyEvidence: SourceReference | null;
};
