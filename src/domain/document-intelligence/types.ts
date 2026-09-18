/**
 * Universal Document Intelligence — Phase 1 contracts.
 * Normalizes ingestion/extraction BEFORE UTI / requirements / Decision.
 * Does not redesign UI, Decision, Risk, or create a parallel pipeline.
 */

export type DocumentFormatId =
  | "pdf"
  | "doc"
  | "docx"
  | "xls"
  | "xlsx"
  | "csv"
  | "ppt"
  | "pptx"
  | "txt"
  | "png"
  | "jpeg"
  | "tiff"
  | "zip"
  | "rar"
  | "unknown";

/** Explicit extraction quality before business analysis. */
export type DocumentExtractionQualityState =
  | "VALID"
  | "PARTIALLY_READABLE"
  | "UNREADABLE"
  | "UNSUPPORTED"
  | "AMBIGUOUS";

export type DocumentBlockKind =
  | "heading"
  | "paragraph"
  | "list_item"
  | "footnote"
  | "header"
  | "footer"
  | "table"
  | "annex"
  | "unknown";

export type DocumentTableCell = {
  row: number;
  col: number;
  text: string;
  address: string | null;
  isHeader: boolean;
  /** Merge span when known. Origin cell carries the full span; covered cells repeat text. */
  rowspan: number | null;
  colspan: number | null;
};

export type DocumentTable = {
  id: string;
  sheetOrPage: string | null;
  headers: string[];
  rows: DocumentTableCell[][];
  notes: string[];
  provenance: {
    documentId: string | null;
    fileName: string | null;
    pageOrSheet: number | null;
  };
};

export type DocumentStructuralBlock = {
  kind: DocumentBlockKind;
  text: string;
  page: number | null;
  section: string | null;
  /** True when block must never become a requirement by itself (headers, labels). */
  nonRequirement: boolean;
};

export type NormalizedDocumentStructure = {
  version: "document-structure/v1";
  pages: Array<{
    page: number;
    charCount: number;
    method: string | null;
  }>;
  sections: Array<{ title: string; page: number | null }>;
  tables: DocumentTable[];
  blocks: DocumentStructuralBlock[];
};

export type FormatAdapterResult = {
  format: DocumentFormatId;
  adapterId: string;
  text: string;
  pageOrSheetCount: number | null;
  method: string;
  pages: Array<{
    page: number;
    method: string;
    confidence: number | null;
    charCount: number;
  }>;
  structure: NormalizedDocumentStructure | null;
  usedOcrFallback: boolean;
  nativeCharCount: number | null;
  /** Explicit failure — never silent. */
  failure: {
    code: "EXTRACTION_FAILED" | "UNSUPPORTED" | "UNREADABLE" | "ENCRYPTED" | "ARCHIVE_NOT_EXTRACTABLE";
    message: string;
  } | null;
};

export type FormatAdapterInput = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  documentId?: string | null;
  format: DocumentFormatId;
};

export type FormatAdapter = {
  id: string;
  formats: readonly DocumentFormatId[];
  extract(input: FormatAdapterInput): Promise<FormatAdapterResult>;
};

export type UniversalDocumentInventoryRecord = {
  fileId: string;
  originalName: string;
  mimeType: string | null;
  format: DocumentFormatId;
  source: "loose" | "zip" | "rar" | "unknown";
  archivePath: string | null;
  documentRole: string | null;
  language: string | null;
  sizeBytes: number | null;
  pageOrSheetCount: number | null;
  extractionMethod: string | null;
  extractionStatus:
    | "DISCOVERED"
    | "STORED"
    | "EXTRACTING"
    | "EXTRACTED"
    | "FILE_EXTRACTION_FAILED"
    | "UNSUPPORTED_SKIPPED"
    | "UNREADABLE";
  readability: DocumentExtractionQualityState;
  ocrStatus: "NOT_NEEDED" | "USED" | "FAILED" | "UNKNOWN";
  versionRevision: string | null;
  provenance: {
    archiveFileName: string | null;
    discoveryId: string | null;
  };
  failureMessage: string | null;
};

export type UniversalDocumentPackageModel = {
  version: "universal-document-intelligence/v1";
  packageLabel: string;
  inventory: UniversalDocumentInventoryRecord[];
  inventoryCount: number;
  extractedOkCount: number;
  failedCount: number;
  unsupportedCount: number;
  qualityState: DocumentExtractionQualityState;
};
