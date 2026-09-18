import { UPLOAD_LIMITS } from "@/config/server";
import { AppError, ErrorCode } from "@/lib/errors";
import { logInfo } from "@/services/observability";
import {
  DOCUMENT_ENCRYPTED_CODE,
  DOCUMENT_ENCRYPTED_MESSAGE,
  isPdfEncrypted,
} from "@/services/document/pdf-encrypted";
import {
  buildOcrProvenanceSources,
  ocrImageBuffer,
  ocrPdfPages,
  type OcrPageProvenance,
} from "@/services/document/pdf-ocr";
import {
  extractDocxStructured,
  extractPptxStructured,
  extractPptxText,
} from "@/services/document/extract-ooxml-text";
import { extractSpreadsheetText } from "@/services/document/extract-spreadsheet";
import { sniffUploadContent } from "@/domain/tender-package/upload-content-sniff";
import {
  looksLikeBinaryGarbage,
  sanitizeExtractedText,
} from "@/services/document/extract-sanitize";
import {
  wrapUntrustedTenderContent as wrapTenderForAi,
} from "@/domain/ai-trust";
import {
  assessDocumentExtractionState,
  resolveFormatAdapter,
  structureFromPlainText,
  archiveNotExtractableResult,
  unsupportedFormatResult,
} from "@/domain/document-intelligence";

export { sanitizeExtractedText, looksLikeBinaryGarbage } from "@/services/document/extract-sanitize";
export {
  DOCUMENT_ENCRYPTED_CODE,
  DOCUMENT_ENCRYPTED_MESSAGE,
  isPdfEncrypted,
} from "@/services/document/pdf-encrypted";
export { wrapAuthoritativeTenderDataForAi } from "@/domain/ai-trust";

/**
 * Wrap authoritative tender PDF data for LLM consumption.
 * PDF facts are trusted DATA; instruction-like phrases are never control-plane commands.
 */
export function wrapUntrustedTenderContent(text: string): string {
  return wrapTenderForAi(text);
}

/** @deprecated kept for callers that referenced OCR page type */
export type { OcrPageProvenance };

/** Minimum usable characters after extraction — below this, analysis must not proceed. */
export const MIN_USABLE_EXTRACT_CHARS = 80;

export type ExtractMethod =
  | "pdf-parse"
  | "OCR"
  | "mammoth"
  | "utf8-fallback"
  | "ooxml-text"
  | "sheetjs"
  | "image-ocr";


export type PageExtractProvenance = {
  documentId: string | null;
  page: number;
  method: "pdf-parse" | "OCR" | "sheetjs";
  confidence: number | null;
  charCount: number;
};

export interface ExtractedDocumentText {
  text: string;
  pageCount: number | null;
  method: ExtractMethod;
  /** Per-page provenance when available (native page texts or OCR). */
  pages: PageExtractProvenance[];
  /** Native attempted but insufficient → OCR used. */
  usedOcrFallback: boolean;
  nativeCharCount: number | null;
  /** Phase 1 — normalized structure (tables/sections/blocks). Additive. */
  structure?: import("@/domain/document-intelligence").NormalizedDocumentStructure | null;
  /** Phase 1 — explicit extraction quality state. */
  documentQuality?: import("@/domain/document-intelligence").DocumentExtractionQualityState | null;
  /** Adapter id that produced this result. */
  adapterId?: string | null;
  /** Detected document format. */
  formatId?: import("@/domain/document-intelligence").DocumentFormatId | null;
}

export type ExtractQuality = "ok" | "empty" | "low" | "degraded";

export type ExtractProgressPhase =
  | "READING_PDF"
  | "NATIVE_EXTRACT"
  | "OCR"
  | "NORMALIZE";

export function assessExtractQuality(input: {
  text: string;
  method: ExtractMethod;
  pageCount: number | null;
}): { quality: ExtractQuality; userMessage: string | null } {
  const trimmed = input.text.trim();
  const len = trimmed.length;

  if (len === 0 || looksLikeBinaryGarbage(trimmed)) {
    return {
      quality: "empty",
      userMessage:
        "Could not extract readable text from this PDF. The document may be encrypted, corrupted, or contain unreadable scans.",
    };
  }
  if (len < MIN_USABLE_EXTRACT_CHARS) {
    return {
      quality: "low",
      userMessage:
        "Could not extract readable text from this PDF. The document may be encrypted, corrupted, or contain unreadable scans.",
    };
  }
  if (input.method === "utf8-fallback") {
    return {
      quality: "degraded",
      userMessage:
        "Document parsing used a fallback method — results may be incomplete. Verify requirements manually.",
    };
  }
  if (input.method === "OCR") {
    return {
      quality: "degraded",
      userMessage:
        "Text was recovered with OCR (scanned/image PDF). Verify critical requirements manually.",
    };
  }
  if (input.pageCount != null && input.pageCount > 0 && len / input.pageCount < 40) {
    return {
      quality: "degraded",
      userMessage:
        "This PDF may be scanned or image-heavy — extracted text is limited. Verify requirements manually.",
    };
  }
  return { quality: "ok", userMessage: null };
}

function finalizeExtractedDocument(
  base: Omit<ExtractedDocumentText, "documentQuality" | "structure" | "adapterId" | "formatId"> &
    Partial<Pick<ExtractedDocumentText, "structure" | "adapterId" | "formatId">>,
  opts?: { support?: import("@/domain/tender-package/extraction-capabilities").ExtractionSupportLevel | null },
): ExtractedDocumentText {
  const legacy = assessExtractQuality({
    text: base.text,
    method: base.method,
    pageCount: base.pageCount,
  });
  const gated = assessDocumentExtractionState({
    text: base.text,
    method: base.method,
    pageCount: base.pageCount,
    legacyQuality: legacy.quality,
    support: opts?.support ?? null,
    usedOcr: base.usedOcrFallback || base.method === "OCR" || base.method === "image-ocr",
  });
  const structure =
    base.structure ??
    structureFromPlainText({
      text: base.text,
      pages: base.pages.map((p) => ({
        page: p.page,
        method: p.method,
        charCount: p.charCount,
      })),
    });
  return {
    ...base,
    structure,
    documentQuality: gated.state,
    adapterId: base.adapterId ?? null,
    formatId: base.formatId ?? null,
  };
}

function isPdfBuffer(buffer: Buffer, fileName: string, mime: string): boolean {
  if (mime === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) return true;
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

function isOfficeDoc(fileName: string, mime: string): boolean {
  return (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword" ||
    /\.docx?$/i.test(fileName)
  );
}

function isImageMime(mime: string): boolean {
  return mime === "image/png" || mime === "image/jpeg" || mime === "image/tiff";
}

function isExtendedDocumentKind(kind: string): boolean {
  return (
    kind === "xls" ||
    kind === "xlsx" ||
    kind === "csv" ||
    kind === "ppt" ||
    kind === "pptx" ||
    kind === "txt" ||
    kind === "png" ||
    kind === "jpeg" ||
    kind === "tiff"
  );
}

function nativeTextInsufficient(text: string, pageCount: number | null): boolean {
  const trimmed = text.trim();
  if (!trimmed || looksLikeBinaryGarbage(trimmed)) return true;
  if (trimmed.length < MIN_USABLE_EXTRACT_CHARS) return true;
  if (pageCount != null && pageCount > 0 && trimmed.length / pageCount < 25) return true;
  return false;
}

async function extractNativePdf(input: {
  buffer: Buffer;
  documentId?: string | null;
}): Promise<{
  text: string;
  pageCount: number | null;
  pages: PageExtractProvenance[];
  ok: boolean;
  errorMessage: string | null;
}> {
  const { createPdfParser } = await import("@/services/document/pdf-worker");
  const parser = await createPdfParser(new Uint8Array(input.buffer));
  try {
    const result = await parser.getText();
    const pageCount = result.pages?.length ?? result.total ?? null;
    const pages: PageExtractProvenance[] = (result.pages ?? [])
      .filter((p) => typeof p.num === "number")
      .map((p) => {
        const pageText = sanitizeExtractedText(p.text ?? "");
        return {
          documentId: input.documentId ?? null,
          page: p.num,
          method: "pdf-parse" as const,
          confidence: null,
          charCount: pageText.length,
        };
      })
      .filter((p) => p.charCount > 0);

    const text = sanitizeExtractedText(
      pages.length > 0
        ? pages
            .map((p) => {
              const body = (result.pages ?? []).find((x) => x.num === p.page)?.text ?? "";
              return `\n\n--- Page ${p.page} (pdf-parse) ---\n\n${sanitizeExtractedText(body)}`;
            })
            .join("")
        : (result.text ?? ""),
    );

    return {
      text,
      pageCount,
      pages,
      ok: !nativeTextInsufficient(text, pageCount),
      errorMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "pdf_extract_failed";
    return {
      text: "",
      pageCount: null,
      pages: [],
      ok: false,
      errorMessage: message,
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

/**
 * Extract plain text from uploaded tender documents.
 * PDF → native pdf-parse → OCR fallback if needed; DOCX → mammoth.
 * Never persists raw PDF/DOCX binary as "extracted text".
 */
export async function extractDocumentText(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  documentId?: string | null;
  /** Force OCR path (regression / diagnostics). Native still attempted unless skipNative. */
  forceOcr?: boolean;
  skipNative?: boolean;
  onProgress?: (phase: ExtractProgressPhase, detail?: string) => void | Promise<void>;
}): Promise<ExtractedDocumentText> {
  const mime = input.mimeType || "application/octet-stream";
  const sniffed = sniffUploadContent(input.buffer, input.fileName);
  const resolved = resolveFormatAdapter({
    buffer: input.buffer,
    fileName: input.fileName,
    mimeType: mime,
  });

  // ZIP/RAR are packages — never fabricate text from archive bytes
  if (resolved.isArchive) {
    const fail = archiveNotExtractableResult(resolved.format as "zip" | "rar");
    throw new AppError(ErrorCode.VALIDATION, fail.failure!.message, 400, {
      code: fail.failure!.code,
      adapterId: fail.adapterId,
      format: resolved.format,
    });
  }
  if (resolved.format === "ppt" || resolved.capability?.support === "UPLOAD_ONLY") {
    const fail = unsupportedFormatResult(resolved.format);
    throw new AppError(ErrorCode.VALIDATION, fail.failure!.message, 400, {
      code: fail.failure!.code,
      adapterId: fail.adapterId,
      format: resolved.format,
    });
  }

  const asPdf = isPdfBuffer(input.buffer, input.fileName, mime) || sniffed.kind === "pdf";
  const asDoc =
    (!asPdf && isOfficeDoc(input.fileName, mime)) ||
    sniffed.kind === "doc" ||
    sniffed.kind === "docx";

  if (
    !(UPLOAD_LIMITS.allowedMimeTypes as readonly string[]).includes(mime) &&
    !asPdf &&
    !asDoc &&
    !isExtendedDocumentKind(sniffed.kind)
  ) {
    throw new AppError(ErrorCode.VALIDATION, "Unsupported document type.", 400);
  }

  if (asPdf) {
    await input.onProgress?.("READING_PDF");
    logInfo("pdf.extract.start", {
      documentId: input.documentId ?? null,
      fileName: input.fileName,
      bytes: input.buffer.byteLength,
    });

    if (isPdfEncrypted(input.buffer)) {
      logInfo("pdf.extract.failed", {
        documentId: input.documentId ?? null,
        reason: DOCUMENT_ENCRYPTED_CODE,
      });
      throw new AppError(ErrorCode.VALIDATION, DOCUMENT_ENCRYPTED_MESSAGE, 400, {
        code: DOCUMENT_ENCRYPTED_CODE,
      });
    }

    let nativeText = "";
    let nativePages: PageExtractProvenance[] = [];
    let pageCount: number | null = null;
    let nativeOk = false;
    let nativeError: string | null = null;

    if (!input.skipNative) {
      await input.onProgress?.("NATIVE_EXTRACT");
      const native = await extractNativePdf({
        buffer: input.buffer,
        documentId: input.documentId,
      });
      nativeText = native.text;
      nativePages = native.pages;
      pageCount = native.pageCount;
      nativeOk = native.ok;
      nativeError = native.errorMessage;

      if (nativeOk && !input.forceOcr) {
        logInfo("pdf.extract.ok", {
          documentId: input.documentId ?? null,
          pageCount,
          characterCount: nativeText.length,
          method: "pdf-parse",
        });
        await input.onProgress?.("NORMALIZE");
        return finalizeExtractedDocument(
          {
            text: nativeText,
            pageCount,
            method: "pdf-parse",
            pages: nativePages,
            usedOcrFallback: false,
            nativeCharCount: nativeText.length,
            adapterId: resolved.adapterId,
            formatId: "pdf",
          },
          { support: resolved.capability?.support },
        );
      }

      logInfo("pdf.extract.failed", {
        documentId: input.documentId ?? null,
        characterCount: nativeText.length,
        pageCount,
        cause: nativeError,
        forceOcr: Boolean(input.forceOcr),
        willTryOcr: true,
      });
    }

    await input.onProgress?.("OCR");
    try {
      const ocr = await ocrPdfPages({
        buffer: input.buffer,
        documentId: input.documentId,
      });
      await input.onProgress?.("NORMALIZE");

      const quality = assessExtractQuality({
        text: ocr.text,
        method: "OCR",
        pageCount: ocr.pageCount,
      });
      if (quality.quality === "empty" || quality.quality === "low") {
        logInfo("pdf.ocr.failed", {
          documentId: input.documentId ?? null,
          characterCount: ocr.text.length,
          pageCount: ocr.pageCount,
          reason: "insufficient_text",
        });
        throw new AppError(
          ErrorCode.VALIDATION,
          quality.userMessage ??
            "Could not extract readable text from this PDF. The document may be encrypted, corrupted, or contain unreadable scans.",
          400,
          {
            method: "OCR",
            nativeCause: nativeError,
            nativeChars: nativeText.length,
          },
        );
      }

      const pages = buildOcrProvenanceSources({
        documentId: input.documentId ?? null,
        pages: ocr.pages,
      }).map((p) => ({
        documentId: p.documentId,
        page: p.page,
        method: "OCR" as const,
        confidence: p.confidence,
        charCount: p.charCount,
      }));

      logInfo("pdf.ocr.ok", {
        documentId: input.documentId ?? null,
        pageCount: ocr.pageCount,
        characterCount: ocr.text.length,
        method: "OCR",
        ocrPages: pages.length,
      });
      logInfo("pdf.extract.ok", {
        documentId: input.documentId ?? null,
        pageCount: ocr.pageCount,
        characterCount: ocr.text.length,
        method: "OCR",
      });

      return finalizeExtractedDocument(
        {
          text: ocr.text,
          pageCount: ocr.pageCount,
          method: "OCR",
          pages,
          usedOcrFallback: true,
          nativeCharCount: nativeText.length || 0,
          adapterId: resolved.adapterId,
          formatId: "pdf",
        },
        { support: resolved.capability?.support },
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      const lastError = error instanceof Error ? error.message : "ocr_failed";
      logInfo("pdf.ocr.failed", {
        documentId: input.documentId ?? null,
        message: lastError,
        nativeCause: nativeError,
      });
      throw new AppError(
        ErrorCode.VALIDATION,
        "Could not extract readable text from this PDF. The document may be encrypted, corrupted, or contain unreadable scans.",
        400,
        { method: "OCR", cause: lastError, nativeCause: nativeError },
      );
    }
  }

  if (asDoc) {
    try {
      const structured = sniffed.kind === "docx"
        ? await extractDocxStructured(input.buffer, {
            fileName: input.fileName ?? null,
            documentId: input.documentId ?? null,
          })
        : null;
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: input.buffer });
      const mammothText = sanitizeExtractedText(result.value ?? "");
      const text = structured?.text && structured.text.length >= mammothText.length * 0.6
        ? structured.text
        : mammothText;
      if (!text || looksLikeBinaryGarbage(text)) {
        throw new Error("DOC_NO_TEXT");
      }
      logInfo("docx.extract.ok", { chars: text.length, tables: structured?.structure.tables.length ?? 0 });
      return finalizeExtractedDocument(
        {
          text,
          pageCount: structured?.pageCount ?? null,
          method: "mammoth",
          pages: [],
          usedOcrFallback: false,
          nativeCharCount: text.length,
          structure: structured?.structure ?? null,
          adapterId: resolved.adapterId,
          formatId: sniffed.kind === "doc" ? "doc" : "docx",
        },
        { support: resolved.capability?.support },
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      const lastError = error instanceof Error ? error.message : "docx_extract_failed";
      logInfo("document.extract.docx_failed", { message: lastError });
      throw new AppError(
        ErrorCode.VALIDATION,
        "Could not read text from this Word document. Try exporting as PDF or a newer .docx file.",
        400,
        { method: "mammoth", cause: lastError },
      );
    }
  }

  // XLS / XLSX — SheetJS (cells, sheets, numbers/dates)
  if (
    sniffed.kind === "xlsx" ||
    sniffed.kind === "xls" ||
    mime.includes("spreadsheetml") ||
    mime === "application/vnd.ms-excel"
  ) {
    try {
      const result = extractSpreadsheetText(input.buffer, {
        fileName: input.fileName ?? null,
        documentId: input.documentId ?? null,
      });
      if (!result.text || looksLikeBinaryGarbage(result.text)) {
        throw new Error("SPREADSHEET_NO_TEXT");
      }
      logInfo("spreadsheet.extract.ok", {
        sheets: result.sheetCount,
        chars: result.text.length,
        kind: sniffed.kind,
        tables: result.structure.tables.length,
      });
      return finalizeExtractedDocument(
        {
          text: result.text,
          pageCount: result.sheetCount,
          method: "sheetjs",
          pages: result.sheets.map((s, i) => ({
            documentId: input.documentId ?? null,
            page: i + 1,
            method: "sheetjs" as const,
            confidence: null,
            charCount: s.text.length,
          })),
          usedOcrFallback: false,
          nativeCharCount: result.text.length,
          structure: result.structure,
          adapterId: resolved.adapterId,
          formatId: sniffed.kind === "xls" ? "xls" : "xlsx",
        },
        { support: resolved.capability?.support },
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      const lastError = error instanceof Error ? error.message : "spreadsheet_extract_failed";
      logInfo("document.extract.spreadsheet_failed", { message: lastError });
      throw new AppError(
        ErrorCode.VALIDATION,
        "Could not read text from this Excel spreadsheet.",
        400,
        { method: "sheetjs", cause: lastError },
      );
    }
  }

  if (sniffed.kind === "pptx" || mime.includes("presentationml")) {
    try {
      const structured = await extractPptxStructured(input.buffer);
      const text = structured.text || (await extractPptxText(input.buffer));
      if (!text || looksLikeBinaryGarbage(text)) throw new Error("PPTX_NO_TEXT");
      return finalizeExtractedDocument(
        {
          text,
          pageCount: structured.pageCount || null,
          method: "ooxml-text",
          pages: [],
          usedOcrFallback: false,
          nativeCharCount: text.length,
          structure: structured.structure,
          adapterId: resolved.adapterId,
          formatId: "pptx",
        },
        { support: resolved.capability?.support },
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        ErrorCode.VALIDATION,
        "Could not read text from this PowerPoint file.",
        400,
        { method: "ooxml-text" },
      );
    }
  }

  // Scanned page images — reuse existing Tesseract worker
  if (isImageMime(mime) || sniffed.kind === "png" || sniffed.kind === "jpeg" || sniffed.kind === "tiff") {
    try {
      await input.onProgress?.("OCR");
      const ocr = await ocrImageBuffer({
        buffer: input.buffer,
        documentId: input.documentId,
      });
      await input.onProgress?.("NORMALIZE");
      const quality = assessExtractQuality({
        text: ocr.text,
        method: "OCR",
        pageCount: 1,
      });
      if (quality.quality === "empty" || quality.quality === "low") {
        throw new AppError(
          ErrorCode.VALIDATION,
          quality.userMessage ??
            "Could not extract readable text from this scanned image.",
          400,
          { method: "image-ocr" },
        );
      }
      return finalizeExtractedDocument(
        {
          text: ocr.text,
          pageCount: 1,
          method: "image-ocr",
          pages: [
            {
              documentId: input.documentId ?? null,
              page: 1,
              method: "OCR",
              confidence: ocr.pages[0]?.confidence ?? null,
              charCount: ocr.text.length,
            },
          ],
          usedOcrFallback: true,
          nativeCharCount: 0,
          adapterId: resolved.adapterId,
          formatId:
            sniffed.kind === "png" || sniffed.kind === "jpeg" || sniffed.kind === "tiff"
              ? sniffed.kind
              : "png",
        },
        { support: resolved.capability?.support },
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        ErrorCode.VALIDATION,
        "Could not OCR this image. Try a clearer scan or PDF.",
        400,
        { method: "image-ocr" },
      );
    }
  }

  // TXT / CSV — UTF-8 text; CSV keeps row structure
  if (
    sniffed.kind === "txt" ||
    sniffed.kind === "csv" ||
    mime === "text/plain" ||
    mime === "text/csv"
  ) {
    const raw = input.buffer.toString("utf8");
    let text = sanitizeExtractedText(raw);
    let structure: import("@/domain/document-intelligence").NormalizedDocumentStructure | null =
      null;
    if (sniffed.kind === "csv" || mime === "text/csv" || /\.csv$/i.test(input.fileName ?? "")) {
      try {
        const sheet = extractSpreadsheetText(input.buffer, {
          fileName: input.fileName ?? "data.csv",
          documentId: input.documentId ?? null,
        });
        text = sheet.text;
        structure = sheet.structure;
      } catch {
        // Fall back to raw UTF-8 CSV when SheetJS cannot parse.
      }
    }
    if (!text || looksLikeBinaryGarbage(text)) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "This text file has no readable content.",
        400,
      );
    }
    const isCsv =
      sniffed.kind === "csv" || mime === "text/csv" || /\.csv$/i.test(input.fileName ?? "");
    return finalizeExtractedDocument(
      {
        text,
        pageCount: structure?.pages.length ?? null,
        method: isCsv ? "sheetjs" : "utf8-fallback",
        pages: [],
        usedOcrFallback: false,
        nativeCharCount: text.length,
        structure,
        adapterId: resolved.adapterId,
        formatId: isCsv ? "csv" : "txt",
      },
      { support: resolved.capability?.support },
    );
  }

  if (sniffed.kind === "ppt") {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Legacy .ppt PowerPoint files cannot be read directly. Save as .pptx or PDF and upload again.",
      400,
    );
  }

  if (sniffed.kind === "zip" || sniffed.kind === "rar") {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Archives must be expanded into documents before text extraction.",
      400,
    );
  }

  const fallback = sanitizeExtractedText(input.buffer.toString("utf8"));
  if (looksLikeBinaryGarbage(fallback)) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "This file looks like a binary document without readable text.",
      400,
    );
  }
  return finalizeExtractedDocument(
    {
      text: fallback,
      pageCount: null,
      method: "utf8-fallback",
      pages: [],
      usedOcrFallback: false,
      nativeCharCount: null,
      adapterId: resolved.adapterId,
      formatId: resolved.format,
    },
    { support: resolved.capability?.support },
  );
}
