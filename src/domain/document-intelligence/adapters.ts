/**
 * Format adapter registry — one interface for all extractors.
 * Adapters wrap existing extract helpers; extractDocumentText remains the pipeline entry.
 */

import { sniffUploadContent } from "@/domain/tender-package/upload-content-sniff";
import {
  capabilityByExtension,
  capabilityByMime,
  type ExtractionCapability,
} from "@/domain/tender-package/extraction-capabilities";
import type { DocumentFormatId, FormatAdapter, FormatAdapterResult } from "./types";

export function detectDocumentFormat(input: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string | null;
}): { format: DocumentFormatId; capability: ExtractionCapability | null } {
  const sniffed = sniffUploadContent(input.buffer, input.fileName);
  const ext = input.fileName.includes(".")
    ? `.${input.fileName.split(".").pop()!.toLowerCase()}`
    : "";
  const byExt = ext ? capabilityByExtension(ext) : null;
  const byMime = input.mimeType ? capabilityByMime(input.mimeType) : null;
  const capability = byExt ?? byMime;

  const kind = sniffed.kind as string;
  const format: DocumentFormatId =
    kind === "pdf" ||
    kind === "doc" ||
    kind === "docx" ||
    kind === "xls" ||
    kind === "xlsx" ||
    kind === "csv" ||
    kind === "ppt" ||
    kind === "pptx" ||
    kind === "txt" ||
    kind === "png" ||
    kind === "jpeg" ||
    kind === "tiff" ||
    kind === "zip" ||
    kind === "rar"
      ? (kind as DocumentFormatId)
      : capability?.id === "jpeg"
        ? "jpeg"
        : ((capability?.id as DocumentFormatId | undefined) ?? "unknown");

  return { format, capability };
}

export function adapterIdForFormat(format: DocumentFormatId): string {
  switch (format) {
    case "pdf":
      return "adapter:pdf-parse+ocr";
    case "doc":
    case "docx":
      return "adapter:mammoth";
    case "xls":
    case "xlsx":
      return "adapter:sheetjs";
    case "csv":
      return "adapter:csv-text";
    case "pptx":
      return "adapter:ooxml-pptx";
    case "ppt":
      return "adapter:ppt-upload-only";
    case "txt":
      return "adapter:utf8";
    case "png":
    case "jpeg":
    case "tiff":
      return "adapter:tesseract-ocr";
    case "zip":
      return "adapter:yauzl-expand";
    case "rar":
      return "adapter:node-unrar-js";
    default:
      return "adapter:unknown";
  }
}

/**
 * Resolve which adapter owns this buffer.
 * OOXML (docx/xlsx/pptx) must never be treated as ZIP archives for text extract.
 */
export function resolveFormatAdapter(input: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string | null;
}): {
  format: DocumentFormatId;
  adapterId: string;
  capability: ExtractionCapability | null;
  isArchive: boolean;
  isOoxmlDocument: boolean;
  textExtractable: boolean;
} {
  const { format, capability } = detectDocumentFormat(input);
  const isArchive = format === "zip" || format === "rar";
  const isOoxmlDocument = format === "docx" || format === "xlsx" || format === "pptx";
  // Critical: OOXML is a zip container but NOT a tender archive
  if (isOoxmlDocument && isArchive) {
    // unreachable by sniff design — assert invariant
  }
  const textExtractable = Boolean(
    capability &&
      capability.textExtraction &&
      (capability.support === "FULL" || capability.support === "PARTIAL"),
  );

  return {
    format,
    adapterId: adapterIdForFormat(format),
    capability,
    isArchive,
    isOoxmlDocument,
    textExtractable,
  };
}

/** Explicit archive-as-document failure — never fabricate text from ZIP/RAR bytes. */
export function archiveNotExtractableResult(
  format: "zip" | "rar",
): FormatAdapterResult {
  return {
    format,
    adapterId: adapterIdForFormat(format),
    text: "",
    pageOrSheetCount: null,
    method: "none",
    pages: [],
    structure: null,
    usedOcrFallback: false,
    nativeCharCount: 0,
    failure: {
      code: "ARCHIVE_NOT_EXTRACTABLE",
      message:
        "ZIP/RAR packages must be expanded into member documents — never text-extracted as a single file.",
    },
  };
}

export function unsupportedFormatResult(format: DocumentFormatId): FormatAdapterResult {
  return {
    format,
    adapterId: adapterIdForFormat(format),
    text: "",
    pageOrSheetCount: null,
    method: "none",
    pages: [],
    structure: null,
    usedOcrFallback: false,
    nativeCharCount: 0,
    failure: {
      code: "UNSUPPORTED",
      message: `Format "${format}" has no reliable text extraction adapter.`,
    },
  };
}

/** Registry metadata for tests / diagnostics — adapters are invoked via extractDocumentText. */
export const FORMAT_ADAPTER_REGISTRY: ReadonlyArray<{
  id: string;
  formats: readonly DocumentFormatId[];
}> = [
  { id: "adapter:pdf-parse+ocr", formats: ["pdf"] },
  { id: "adapter:mammoth", formats: ["doc", "docx"] },
  { id: "adapter:sheetjs", formats: ["xls", "xlsx"] },
  { id: "adapter:csv-text", formats: ["csv"] },
  { id: "adapter:ooxml-pptx", formats: ["pptx"] },
  { id: "adapter:ppt-upload-only", formats: ["ppt"] },
  { id: "adapter:utf8", formats: ["txt"] },
  { id: "adapter:tesseract-ocr", formats: ["png", "jpeg", "tiff"] },
  { id: "adapter:yauzl-expand", formats: ["zip"] },
  { id: "adapter:node-unrar-js", formats: ["rar"] },
] as const;

export type { FormatAdapter };
