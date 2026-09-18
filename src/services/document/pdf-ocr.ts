import { createWorker, type Worker } from "tesseract.js";
import { logInfo } from "@/services/observability";
import { createPdfParser } from "@/services/document/pdf-worker";
import { sanitizeExtractedText } from "@/services/document/extract-sanitize";

export type OcrPageProvenance = {
  page: number;
  method: "OCR";
  text: string;
  confidence: number | null;
  charCount: number;
};

export type OcrDocumentResult = {
  text: string;
  pageCount: number;
  pages: OcrPageProvenance[];
  method: "OCR";
  languages: string[];
};

const OCR_LANGS = ["eng", "fra", "ara"] as const;
/** Soft cap — keep background jobs from running for hours on huge scans. */
const MAX_OCR_PAGES = 40;
const RENDER_SCALE = 1.6;

let sharedWorker: Worker | null = null;
let sharedWorkerPromise: Promise<Worker> | null = null;

async function getOcrWorker(): Promise<Worker> {
  if (sharedWorker) return sharedWorker;
  if (!sharedWorkerPromise) {
    sharedWorkerPromise = (async () => {
      const worker = await createWorker([...OCR_LANGS], 1, {
        logger: () => undefined,
      });
      sharedWorker = worker;
      return worker;
    })();
  }
  return sharedWorkerPromise;
}

/** Release the shared Tesseract worker (tests / graceful shutdown). */
export async function terminateOcrWorker(): Promise<void> {
  const pending = sharedWorkerPromise;
  const worker = sharedWorker;
  sharedWorker = null;
  sharedWorkerPromise = null;
  if (worker) {
    await worker.terminate().catch(() => undefined);
    return;
  }
  if (pending) {
    const created = await pending.catch(() => null);
    await created?.terminate().catch(() => undefined);
  }
}

/**
 * Page-by-page OCR fallback for scanned / image-only PDFs.
 * Renders one page at a time (does not treat PDF binary as UTF-8 text).
 */
export async function ocrPdfPages(input: {
  buffer: Buffer;
  documentId?: string | null;
  onPage?: (info: {
    page: number;
    total: number;
    chars: number;
  }) => void | Promise<void>;
  maxPages?: number;
}): Promise<OcrDocumentResult> {
  const maxPages = Math.min(input.maxPages ?? MAX_OCR_PAGES, MAX_OCR_PAGES);
  const parser = await createPdfParser(new Uint8Array(input.buffer));
  const pages: OcrPageProvenance[] = [];
  const worker = await getOcrWorker();

  try {
    const info = await parser.getInfo().catch(() => null);
    const totalPages = Math.max(1, info?.total ?? 1);
    const toProcess = Math.min(totalPages, maxPages);

    logInfo("pdf.ocr.start", {
      documentId: input.documentId ?? null,
      totalPages,
      toProcess,
      languages: [...OCR_LANGS],
    });

    for (let page = 1; page <= toProcess; page++) {
      const shot = await parser.getScreenshot({
        partial: [page],
        scale: RENDER_SCALE,
        imageBuffer: true,
        imageDataUrl: false,
      });
      const img = shot.pages[0];
      if (!img?.data?.length) {
        pages.push({
          page,
          method: "OCR",
          text: "",
          confidence: null,
          charCount: 0,
        });
        await input.onPage?.({ page, total: toProcess, chars: 0 });
        continue;
      }

      const png = Buffer.from(img.data);
      const result = await worker.recognize(png);
      const text = sanitizeExtractedText(result.data.text ?? "");
      const confidence =
        typeof result.data.confidence === "number" ? result.data.confidence : null;

      pages.push({
        page,
        method: "OCR",
        text,
        confidence,
        charCount: text.length,
      });

      await input.onPage?.({ page, total: toProcess, chars: text.length });
      logInfo("pdf.ocr.page", {
        documentId: input.documentId ?? null,
        page,
        chars: text.length,
        confidence,
      });
    }

    const combined = sanitizeExtractedText(
      pages
        .map((p) => {
          const header = `\n\n--- Page ${p.page} (OCR) ---\n\n`;
          return p.text ? `${header}${p.text}` : "";
        })
        .join(""),
    );

    logInfo("pdf.ocr.ok", {
      documentId: input.documentId ?? null,
      pages: pages.length,
      characterCount: combined.length,
      method: "OCR",
    });

    return {
      text: combined,
      pageCount: info?.total ?? pages.length,
      pages,
      method: "OCR",
      languages: [...OCR_LANGS],
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export function buildOcrProvenanceSources(input: {
  documentId: string | null;
  pages: OcrPageProvenance[];
}): Array<{
  documentId: string | null;
  page: number;
  method: "OCR";
  confidence: number | null;
  charCount: number;
}> {
  return input.pages
    .filter((p) => p.charCount > 0)
    .map((p) => ({
      documentId: input.documentId,
      page: p.page,
      method: "OCR" as const,
      confidence: p.confidence,
      charCount: p.charCount,
    }));
}

/** OCR a standalone scanned tender page image (PNG / JPEG / TIFF). */
export async function ocrImageBuffer(input: {
  buffer: Buffer;
  documentId?: string | null;
}): Promise<OcrDocumentResult> {
  const worker = await getOcrWorker();
  logInfo("image.ocr.start", {
    documentId: input.documentId ?? null,
    bytes: input.buffer.byteLength,
  });
  const result = await worker.recognize(input.buffer);
  const text = sanitizeExtractedText(result.data.text ?? "");
  const confidence =
    typeof result.data.confidence === "number" ? result.data.confidence : null;
  return {
    text,
    pageCount: 1,
    pages: [
      {
        page: 1,
        method: "OCR",
        text,
        confidence,
        charCount: text.length,
      },
    ],
    method: "OCR",
    languages: [...OCR_LANGS],
  };
}
