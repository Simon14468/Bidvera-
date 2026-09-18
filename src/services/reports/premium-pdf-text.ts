/**
 * Unicode-safe PDF text — script-aware fonts, Arabic shaping, bidi visual order.
 * Presentation only; does not alter report data.
 */

import type { Locale } from "@/i18n/config";
import type PDFDocument from "pdfkit";
import reshaperPkg from "arabic-persian-reshaper";
import bidiFactory from "bidi-js";
import {
  splitIntoScriptRuns,
  textContainsArabic,
  type PdfFontRegistry,
} from "@/services/reports/premium-pdf-fonts";
import { sanitizePdfText } from "@/services/reports/premium-pdf-locale";
import {
  addContentPage,
  startContentPageY,
  type PdfPaginationCtx,
} from "@/services/reports/premium-pdf-pagination";

type PdfDoc = InstanceType<typeof PDFDocument>;

const { ArabicShaper } = reshaperPkg as {
  ArabicShaper: { convertArabic: (text: string) => string };
};

const bidi = bidiFactory();

export type PdfTextOptions = {
  width?: number;
  fontSize?: number;
  fillColor?: string;
  bold?: boolean;
  align?: "left" | "right" | "center" | "justify";
  lineGap?: number;
  locale?: Locale;
  underline?: boolean;
  link?: string;
  lineBreak?: boolean;
  continued?: boolean;
};

type TextDirection = "ltr" | "rtl";

/** Reshape Arabic letters in logical order; leave Latin/French/English untouched. */
export function shapeLogicalText(text: string): string {
  if (!text || !textContainsArabic(text)) return text;
  const runs = splitIntoScriptRuns(text);
  return runs
    .map((run) =>
      run.script === "arabic" ? reshapeArabic(run.text) : run.text,
    )
    .join("");
}

function reshapeArabic(text: string): string {
  try {
    return ArabicShaper.convertArabic(text);
  } catch {
    return text;
  }
}

/** Paragraph base direction — drives bidi for each wrapped line. */
export function paragraphDirection(text: string, locale?: Locale): TextDirection {
  if (!textContainsArabic(text)) return "ltr";
  if (locale === "ar") return "rtl";
  const arabicChars =
    text.match(
      /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0660-\u0669]/g,
    )?.length ?? 0;
  const latinChars = text.match(/[A-Za-zÀ-ÿ]/g)?.length ?? 0;
  if (arabicChars > latinChars * 1.5) return "rtl";
  return "ltr";
}

/** Convert one logical line to visual draw order (shape + bidi + mirroring). */
export function logicalLineToVisual(
  logicalLine: string,
  direction: TextDirection,
): string {
  if (!logicalLine) return logicalLine;
  const shaped = shapeLogicalText(logicalLine);
  if (!textContainsArabic(shaped)) return shaped;
  try {
    const levels =
      direction === "rtl"
        ? bidi.getEmbeddingLevels(shaped, "rtl")
        : bidi.getEmbeddingLevels(shaped);
    return bidi.getReorderedString(shaped, levels);
  } catch {
    return shaped;
  }
}

/** @deprecated Use logicalLineToVisual — kept for callers/tests. */
export function prepareTextForPdf(text: string, locale?: Locale): string {
  return logicalLineToVisual(text, paragraphDirection(text, locale));
}

function measureVisualWidth(
  doc: PdfDoc,
  registry: PdfFontRegistry,
  visual: string,
  fontSize: number,
  bold: boolean,
): number {
  let width = 0;
  for (const run of splitIntoScriptRuns(visual)) {
    doc.font(registry.fontFor(run.script, bold)).fontSize(fontSize);
    width += doc.widthOfString(run.text);
  }
  return width;
}

function drawVisualRuns(
  doc: PdfDoc,
  registry: PdfFontRegistry,
  visual: string,
  x: number,
  y: number,
  fontSize: number,
  fillColor: string,
  bold: boolean,
  opts: {
    width?: number;
    align?: PdfTextOptions["align"];
    underline?: boolean;
    link?: string;
    lineBreak?: boolean;
    continued?: boolean;
  },
): void {
  const runs = splitIntoScriptRuns(visual);
  if (runs.length === 0) return;

  doc.fontSize(fontSize).fillColor(fillColor);

  const lineWidth = measureVisualWidth(doc, registry, visual, fontSize, bold);
  const align = opts.align ?? "left";
  const boxWidth = opts.width;

  let startX = x;
  if (boxWidth != null) {
    if (align === "right") startX = x + boxWidth - lineWidth;
    else if (align === "center") startX = x + (boxWidth - lineWidth) / 2;
  }

  if (runs.length === 1) {
    const run = runs[0]!;
    doc.font(registry.fontFor(run.script, bold));
    const textOpts: PDFKit.Mixins.TextOptions = {
      align,
      underline: opts.underline,
      link: opts.link,
      continued: opts.continued,
      lineBreak: opts.lineBreak ?? true,
    };
    if (boxWidth != null) textOpts.width = boxWidth;
    doc.text(run.text, startX, y, textOpts);
    return;
  }

  let cx = startX;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]!;
    const isLast = i === runs.length - 1;
    doc.font(registry.fontFor(run.script, bold));
    if (i === 0) {
      doc.text(run.text, cx, y, {
        continued: !isLast || opts.continued,
        lineBreak: isLast ? (opts.lineBreak ?? true) : false,
        underline: isLast ? opts.underline : false,
        link: isLast ? opts.link : undefined,
      });
    } else {
      doc.text(run.text, {
        continued: !isLast || opts.continued,
        lineBreak: isLast ? (opts.lineBreak ?? true) : false,
        underline: isLast ? opts.underline : false,
        link: isLast ? opts.link : undefined,
      });
    }
    cx += doc.widthOfString(run.text);
  }
}

export function pdfWidthOfString(
  doc: PdfDoc,
  registry: PdfFontRegistry,
  text: string,
  fontSize: number,
  bold = false,
  locale?: Locale,
): number {
  const safe = sanitizePdfText(text);
  const direction = paragraphDirection(safe, locale);
  const visual = logicalLineToVisual(safe, direction);
  return measureVisualWidth(doc, registry, visual, fontSize, bold);
}

/** Single-line mixed-script text at absolute position. */
export function pdfTextAt(
  doc: PdfDoc,
  registry: PdfFontRegistry,
  text: string,
  x: number,
  y: number,
  options: PdfTextOptions = {},
): void {
  const {
    fontSize = 10,
    fillColor = "#1A1D1F",
    bold = false,
    align = "left",
    width,
    underline,
    link,
    lineBreak = true,
    continued = false,
    locale,
  } = options;

  const safe = sanitizePdfText(text);
  if (!safe) return;
  const direction = paragraphDirection(safe, locale);
  const visual = logicalLineToVisual(safe, direction);
  drawVisualRuns(doc, registry, visual, x, y, fontSize, fillColor, bold, {
    width,
    align,
    underline,
    link,
    lineBreak,
    continued,
  });
}

function wrapLogicalToVisualLines(
  doc: PdfDoc,
  registry: PdfFontRegistry,
  logical: string,
  maxWidth: number,
  fontSize: number,
  bold: boolean,
  locale?: Locale,
): string[] {
  const direction = paragraphDirection(logical, locale);
  const tokens = logical.match(/\s+|\S+/g) ?? [];
  const lines: string[] = [];
  let logicalLine = "";

  const flush = () => {
    const trimmed = logicalLine.replace(/\s+$/u, "");
    if (trimmed) {
      lines.push(logicalLineToVisual(trimmed, direction));
    }
    logicalLine = "";
  };

  for (const token of tokens) {
    const candidate = logicalLine + token;
    const measureTarget = candidate.replace(/\s+$/u, "") || candidate;
    const visual = logicalLineToVisual(measureTarget, direction);
    const w = measureVisualWidth(doc, registry, visual, fontSize, bold);
    if (w > maxWidth && logicalLine.trim()) {
      flush();
      logicalLine = /^\s+$/.test(token) ? "" : token;
    } else {
      logicalLine = candidate;
    }
  }
  flush();
  return lines;
}

/** Measure wrapped block height without drawing (for pagination). */
export function pdfTextBlockHeight(
  doc: PdfDoc,
  registry: PdfFontRegistry,
  text: string,
  options: Pick<PdfTextOptions, "width" | "fontSize" | "bold" | "lineGap" | "locale"> = {},
): number {
  const { width = 499, fontSize = 10, bold = false, lineGap = 2, locale } = options;
  const safe = sanitizePdfText(text);
  if (!safe.trim()) return 0;

  const paragraphs = safe.split(/\n/);
  let lineCount = 0;
  for (let p = 0; p < paragraphs.length; p++) {
    if (p > 0) lineCount += 1;
    const para = paragraphs[p] ?? "";
    const visualLines = wrapLogicalToVisualLines(
      doc,
      registry,
      para,
      width,
      fontSize,
      bold,
      locale,
    );
    lineCount += Math.max(visualLines.length, 1);
  }
  if (lineCount === 0) return 0;
  return lineCount * fontSize + (lineCount - 1) * lineGap;
}

export type PdfPaginatedTextCtx = PdfPaginationCtx & {
  doc: PdfDoc;
  registry: PdfFontRegistry;
};

/** Wrapped block with automatic page breaks — returns final Y after text. */
export function pdfTextBlockPaginated(
  ctx: PdfPaginatedTextCtx,
  text: string,
  x: number,
  startY: number | null,
  options: PdfTextOptions = {},
): number {
  const {
    width = 499,
    fontSize = 10,
    fillColor = "#1A1D1F",
    bold = false,
    align = "left",
    lineGap = 2,
    locale,
  } = options;

  const safe = sanitizePdfText(text);
  if (!safe.trim()) {
    const y = startY ?? ctx.doc.y;
    ctx.doc.y = y;
    return y;
  }

  let cursorY = startY ?? ctx.doc.y;
  const lineStep = fontSize + lineGap;
  const paragraphs = safe.split(/\n/);

  for (let p = 0; p < paragraphs.length; p++) {
    if (p > 0) {
      if (cursorY + lineStep > ctx.contentBottom) {
        addContentPage(ctx);
        cursorY = startContentPageY();
      }
      cursorY += lineStep;
    }

    const visualLines = wrapLogicalToVisualLines(
      ctx.doc,
      ctx.registry,
      paragraphs[p] ?? "",
      width,
      fontSize,
      bold,
      locale,
    );

    for (const visual of visualLines) {
      if (cursorY + fontSize > ctx.contentBottom) {
        addContentPage(ctx);
        cursorY = startContentPageY();
      }
      drawVisualRuns(
        ctx.doc,
        ctx.registry,
        visual,
        x,
        cursorY,
        fontSize,
        fillColor,
        bold,
        { width, align, lineBreak: false },
      );
      cursorY += lineStep;
    }
  }

  ctx.doc.y = cursorY;
  return cursorY;
}

/** Wrapped block — returns final Y after text (no pagination — prefer pdfTextBlockPaginated). */
export function pdfTextBlock(
  doc: PdfDoc,
  registry: PdfFontRegistry,
  text: string,
  x: number,
  y: number,
  options: PdfTextOptions = {},
): number {
  const {
    width = 499,
    fontSize = 10,
    fillColor = "#1A1D1F",
    bold = false,
    align = "left",
    lineGap = 2,
    locale,
  } = options;

  const safe = sanitizePdfText(text);
  if (!safe.trim()) {
    doc.y = y;
    return y;
  }

  const paragraphs = safe.split(/\n/);
  let cursorY = y;

  for (let p = 0; p < paragraphs.length; p++) {
    const para = paragraphs[p] ?? "";
    if (p > 0) cursorY += fontSize + lineGap;

    const visualLines = wrapLogicalToVisualLines(
      doc,
      registry,
      para,
      width,
      fontSize,
      bold,
      locale,
    );

    for (const visual of visualLines) {
      drawVisualRuns(doc, registry, visual, x, cursorY, fontSize, fillColor, bold, {
        width,
        align,
        lineBreak: false,
      });
      cursorY += fontSize + lineGap;
    }
  }

  doc.y = cursorY;
  return cursorY;
}

/** Check logical Arabic word appears in PDF extract (presentation / visual order). */
export function arabicWordAppearsInPdfText(
  logicalWord: string,
  pdfText: string,
): boolean {
  if (pdfText.includes(logicalWord)) return true;
  const shaped = reshapeArabic(logicalWord);
  if (pdfText.includes(shaped)) return true;
  const presChars = [...shaped].filter((c) =>
    /[\uFB50-\uFDFF\uFE70-\uFEFF]/.test(c),
  );
  return (
    presChars.length > 0 && presChars.every((c) => pdfText.includes(c))
  );
}

/** True if extracted PDF text contains tofu / missing-glyph boxes. */
export function containsGlyphFallback(text: string): boolean {
  return /[\uFFFD\u25A1\u25AF]/.test(text);
}

/** Exported for unit tests — verify Arabic words stay semantically intact after shape+bidi. */
export function normalizeForSemanticCompare(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200E\u200F\u202A-\u202E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractArabicWords(text: string): string[] {
  return (
    text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g) ?? []
  );
}
