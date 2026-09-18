/**
 * Lightweight OOXML text extraction (XLSX / PPTX / DOCX) via yauzl — no parallel analysis path.
 * Used only at document text-extraction handoff into the existing pipeline.
 */

import { fromBufferPromise } from "yauzl";
import { sanitizeExtractedText } from "@/services/document/extract-sanitize";
import {
  emptyStructure,
  structureFromTableMatrix,
} from "@/domain/document-intelligence/structure";
import type { NormalizedDocumentStructure } from "@/domain/document-intelligence/types";

function stripXml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function readMatchingZipEntriesNamed(
  body: Buffer,
  match: (name: string) => boolean,
  maxEntries = 80,
): Promise<Array<{ name: string; xml: string }>> {
  const zipfile = await fromBufferPromise(body, {
    lazyEntries: true,
    validateEntrySizes: false,
    strictFileNames: true,
  });
  const parts: Array<{ name: string; xml: string }> = [];
  try {
    for await (const entry of zipfile.eachEntry()) {
      if (/\/$/.test(entry.fileName)) continue;
      if (!match(entry.fileName)) continue;
      if (entry.uncompressedSize > 8 * 1024 * 1024) continue;
      const chunks: Buffer[] = [];
      let total = 0;
      const stream = await zipfile.openReadStreamPromise(entry);
      await new Promise<void>((res, rej) => {
        stream.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > 8 * 1024 * 1024) {
            stream.destroy();
            rej(new Error("OOXML part too large"));
            return;
          }
          chunks.push(chunk);
        });
        stream.on("error", rej);
        stream.on("end", () => res());
      });
      parts.push({ name: entry.fileName, xml: Buffer.concat(chunks).toString("utf8") });
      if (parts.length >= maxEntries) break;
    }
  } finally {
    try {
      zipfile.close();
    } catch {
      /* ignore */
    }
  }
  return parts;
}

async function readMatchingZipEntries(
  body: Buffer,
  match: (name: string) => boolean,
  maxEntries = 40,
): Promise<string[]> {
  const named = await readMatchingZipEntriesNamed(body, match, maxEntries);
  return named.map((p) => p.xml);
}

/** Extract readable cell/shared-string text from an XLSX buffer. */
export async function extractXlsxText(buffer: Buffer): Promise<string> {
  const xmlParts = await readMatchingZipEntries(
    buffer,
    (name) =>
      /xl\/sharedStrings\.xml$/i.test(name) ||
      /xl\/worksheets\/sheet\d+\.xml$/i.test(name),
  );
  return sanitizeExtractedText(xmlParts.map(stripXml).filter(Boolean).join("\n"));
}

/** Extract readable slide text from a PPTX buffer. */
export async function extractPptxText(buffer: Buffer): Promise<string> {
  const structured = await extractPptxStructured(buffer);
  return structured.text;
}

export type OoxmlStructuredExtract = {
  text: string;
  structure: NormalizedDocumentStructure;
  pageCount: number;
};

/** PPTX slides as page-equivalent structure. */
export async function extractPptxStructured(
  buffer: Buffer,
): Promise<OoxmlStructuredExtract> {
  const parts = await readMatchingZipEntriesNamed(
    buffer,
    (name) => /ppt\/slides\/slide\d+\.xml$/i.test(name),
  );
  parts.sort((a, b) => slideNumber(a.name) - slideNumber(b.name));
  const structure = emptyStructure();
  const textParts: string[] = [];
  for (const part of parts) {
    const slide = slideNumber(part.name);
    const text = sanitizeExtractedText(stripXml(part.xml));
    if (!text) continue;
    structure.pages.push({ page: slide, charCount: text.length, method: "ooxml-text" });
    structure.blocks.push({
      kind: "paragraph",
      text,
      page: slide,
      section: `slide-${slide}`,
      nonRequirement: false,
    });
    structure.sections.push({ title: `Slide ${slide}`, page: slide });
    textParts.push(`--- Page ${slide} (ooxml-text) ---\n${text}`);
  }
  return {
    text: sanitizeExtractedText(textParts.join("\n\n")),
    structure,
    pageCount: structure.pages.length,
  };
}

/** DOCX paragraphs, headings, and tables from word/document.xml. */
export async function extractDocxStructured(
  buffer: Buffer,
  opts?: { fileName?: string | null; documentId?: string | null },
): Promise<OoxmlStructuredExtract | null> {
  const parts = await readMatchingZipEntriesNamed(
    buffer,
    (name) => /word\/document\.xml$/i.test(name),
    4,
  );
  const xml = parts[0]?.xml;
  if (!xml) return null;
  const structure = emptyStructure();
  const textParts: string[] = [];
  let tableIndex = 0;
  let currentSection: string | null = null;

  const tables = [...xml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/gi)];
  for (const match of tables) {
    const rows = [...match[0].matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/gi)].map((row) =>
      [...row[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/gi)].map((tc) => stripXml(tc[0])),
    );
    if (rows.length < 1 || rows.every((r) => r.every((c) => !c))) continue;
    const { table, blocks } = structureFromTableMatrix({
      sheetName: `docx-table-${tableIndex + 1}`,
      rows,
      documentId: opts?.documentId ?? null,
      fileName: opts?.fileName ?? null,
      sheetIndex: tableIndex,
    });
    structure.tables.push(table);
    structure.blocks.push(...blocks);
    tableIndex += 1;
  }

  const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/gi)];
  for (const match of paragraphs) {
    const raw = match[0];
    if (/<w:tbl\b/i.test(raw)) continue;
    const text = stripXml(raw);
    if (!text) continue;
    const style = raw.match(/w:pStyle[^>]*w:val="([^"]+)"/i)?.[1] ?? "";
    const isHeading = /heading|title|titre/i.test(style);
    if (isHeading) {
      currentSection = text.slice(0, 160);
      structure.sections.push({ title: currentSection, page: null });
    }
    structure.blocks.push({
      kind: isHeading ? "heading" : "paragraph",
      text,
      page: null,
      section: currentSection,
      nonRequirement: isHeading,
    });
    textParts.push(text);
  }

  const text = sanitizeExtractedText(textParts.join("\n\n"));
  if (!text) return null;
  structure.pages.push({ page: 1, charCount: text.length, method: "ooxml-text" });
  return { text, structure, pageCount: 1 };
}

function slideNumber(name: string): number {
  const m = name.match(/slide(\d+)\.xml$/i);
  return m ? Number(m[1]) : 0;
}
