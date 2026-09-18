/**
 * Authoritative document extraction capability contract.
 * Backend validation and UI advertising MUST derive from this module —
 * never claim a format is analyzable unless a real extraction path exists.
 */

export type ExtractionSupportLevel =
  /** Real extractor exists; safe for tender analysis when text quality passes. */
  | "FULL"
  /** Real extractor exists but quality may be limited (e.g. OCR, lightweight OOXML). */
  | "PARTIAL"
  /** Accepted at upload for conversion/compatibility; extraction is not reliable. */
  | "UPLOAD_ONLY"
  /** Expansion container — not text-extracted as a single document. */
  | "ARCHIVE"
  /** Not accepted. */
  | "UNSUPPORTED";

export type ExtractionCapability = {
  id: string;
  extensions: readonly string[];
  mimeTypes: readonly string[];
  support: ExtractionSupportLevel;
  /** Short machine-stable extractor id when support is FULL/PARTIAL. */
  extractor: string | null;
  textExtraction: boolean;
  structuredExtraction: boolean;
  safeForTenderAnalysis: boolean;
  notes: string;
};

/**
 * Single source of truth for upload + extraction advertising.
 * Order is display order for accept hints.
 */
export const EXTRACTION_CAPABILITIES: readonly ExtractionCapability[] = [
  {
    id: "pdf",
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
    support: "FULL",
    extractor: "pdf-parse+ocr",
    textExtraction: true,
    structuredExtraction: false,
    safeForTenderAnalysis: true,
    notes: "Native PDF text with OCR fallback for scans.",
  },
  {
    id: "docx",
    extensions: [".docx"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    support: "FULL",
    extractor: "mammoth",
    textExtraction: true,
    structuredExtraction: false,
    safeForTenderAnalysis: true,
    notes: "Word OOXML via mammoth.",
  },
  {
    id: "doc",
    extensions: [".doc"],
    mimeTypes: ["application/msword"],
    support: "PARTIAL",
    extractor: "mammoth",
    textExtraction: true,
    structuredExtraction: false,
    safeForTenderAnalysis: false,
    notes: "Legacy Word OLE — often fails; prefer DOCX or PDF.",
  },
  {
    id: "xlsx",
    extensions: [".xlsx"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    support: "FULL",
    extractor: "sheetjs",
    textExtraction: true,
    structuredExtraction: true,
    safeForTenderAnalysis: true,
    notes: "Sheets, cells, numbers/dates via SheetJS.",
  },
  {
    id: "xls",
    extensions: [".xls"],
    mimeTypes: ["application/vnd.ms-excel"],
    support: "FULL",
    extractor: "sheetjs",
    textExtraction: true,
    structuredExtraction: true,
    safeForTenderAnalysis: true,
    notes: "Legacy Excel OLE via SheetJS.",
  },
  {
    id: "csv",
    extensions: [".csv"],
    mimeTypes: ["text/csv"],
    support: "FULL",
    extractor: "csv-text",
    textExtraction: true,
    structuredExtraction: true,
    safeForTenderAnalysis: true,
    notes: "UTF-8 CSV rows preserved as structured text.",
  },
  {
    id: "pptx",
    extensions: [".pptx"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    support: "PARTIAL",
    extractor: "ooxml-pptx",
    textExtraction: true,
    structuredExtraction: false,
    safeForTenderAnalysis: true,
    notes: "Slide XML text extraction (no speaker notes media).",
  },
  {
    id: "ppt",
    extensions: [".ppt"],
    mimeTypes: ["application/vnd.ms-powerpoint"],
    support: "UPLOAD_ONLY",
    extractor: null,
    textExtraction: false,
    structuredExtraction: false,
    safeForTenderAnalysis: false,
    notes: "Legacy PowerPoint OLE — not text-extractable; convert to PPTX/PDF.",
  },
  {
    id: "txt",
    extensions: [".txt", ".text"],
    mimeTypes: ["text/plain"],
    support: "FULL",
    extractor: "utf8",
    textExtraction: true,
    structuredExtraction: false,
    safeForTenderAnalysis: true,
    notes: "UTF-8 plain text.",
  },
  {
    id: "png",
    extensions: [".png"],
    mimeTypes: ["image/png"],
    support: "PARTIAL",
    extractor: "tesseract-ocr",
    textExtraction: true,
    structuredExtraction: false,
    safeForTenderAnalysis: true,
    notes: "Image OCR (Tesseract).",
  },
  {
    id: "jpeg",
    extensions: [".jpg", ".jpeg"],
    mimeTypes: ["image/jpeg"],
    support: "PARTIAL",
    extractor: "tesseract-ocr",
    textExtraction: true,
    structuredExtraction: false,
    safeForTenderAnalysis: true,
    notes: "Image OCR (Tesseract).",
  },
  {
    id: "tiff",
    extensions: [".tif", ".tiff"],
    mimeTypes: ["image/tiff"],
    support: "PARTIAL",
    extractor: "tesseract-ocr",
    textExtraction: true,
    structuredExtraction: false,
    safeForTenderAnalysis: true,
    notes: "Image OCR (Tesseract).",
  },
  {
    id: "zip",
    extensions: [".zip"],
    mimeTypes: ["application/zip"],
    support: "ARCHIVE",
    extractor: "yauzl-expand",
    textExtraction: false,
    structuredExtraction: false,
    safeForTenderAnalysis: false,
    notes: "Expanded safely; members extracted individually.",
  },
  {
    id: "rar",
    extensions: [".rar"],
    mimeTypes: ["application/vnd.rar", "application/x-rar-compressed"],
    support: "ARCHIVE",
    extractor: "node-unrar-js",
    textExtraction: false,
    structuredExtraction: false,
    safeForTenderAnalysis: false,
    notes: "Expanded safely; members extracted individually.",
  },
] as const;

export function capabilityByExtension(ext: string): ExtractionCapability | null {
  const needle = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return EXTRACTION_CAPABILITIES.find((c) => c.extensions.includes(needle)) ?? null;
}

export function capabilityByMime(mime: string): ExtractionCapability | null {
  const m = mime.toLowerCase().trim();
  return EXTRACTION_CAPABILITIES.find((c) => c.mimeTypes.includes(m)) ?? null;
}

/** Formats with a real text extraction path (FULL or PARTIAL). */
export function isTextExtractableCapability(cap: ExtractionCapability): boolean {
  return cap.textExtraction && (cap.support === "FULL" || cap.support === "PARTIAL");
}

/** HTML accept= attribute — includes archives + uploadable documents. */
export function buildUploadAcceptAttribute(): string {
  const exts = EXTRACTION_CAPABILITIES.flatMap((c) => [...c.extensions]);
  const mimes = EXTRACTION_CAPABILITIES.flatMap((c) =>
    c.support === "UNSUPPORTED" ? [] : [...c.mimeTypes],
  );
  return [...exts, ...mimes].join(",");
}

/**
 * Honest UI file-types line (English template).
 * Does not advertise legacy PPT as text-analyzable.
 */
export function buildUploadFileTypesHint(input: {
  maxFiles: number;
  maxFileMb: number;
  maxPackageMb: number;
}): string {
  return (
    `PDF, DOCX, XLS/XLSX, CSV, TXT, PPTX, images, ZIP/RAR` +
    ` · up to ${input.maxFiles} files per package` +
    ` · max ${input.maxFileMb}MB per file` +
    ` · max ${input.maxPackageMb}MB per package` +
    ` · legacy DOC/PPT may fail extraction`
  );
}

export function analyzableDocumentMimeTypes(): readonly string[] {
  return EXTRACTION_CAPABILITIES.filter(
    (c) => c.support === "FULL" || c.support === "PARTIAL" || c.support === "UPLOAD_ONLY",
  ).flatMap((c) => [...c.mimeTypes]);
}
