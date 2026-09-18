/**
 * Spreadsheet text extraction (XLS / XLSX) via SheetJS.
 * Preserves sheet names, cell values, numeric/date/currency display, and table structure.
 */

import * as XLSX from "xlsx";
import { sanitizeExtractedText } from "@/services/document/extract-sanitize";
import {
  emptyStructure,
  structureFromTableMatrix,
} from "@/domain/document-intelligence/structure";
import type { NormalizedDocumentStructure } from "@/domain/document-intelligence/types";

export type SpreadsheetSheetExtract = {
  sheetName: string;
  rowCount: number;
  text: string;
  /** Raw display matrix for table-first structure. */
  matrix: string[][];
};

export type SpreadsheetExtractResult = {
  text: string;
  sheetCount: number;
  sheets: SpreadsheetSheetExtract[];
  method: "sheetjs";
  structure: NormalizedDocumentStructure;
};

function formatCellDisplay(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return String(value).trim();
}

/**
 * Extract analyzable text from an Excel workbook buffer.
 * Throws on unreadable / empty workbooks so callers can mark EXTRACTION_FAILED.
 */
export function extractSpreadsheetText(
  buffer: Buffer,
  opts?: { fileName?: string | null; documentId?: string | null },
): SpreadsheetExtractResult {
  if (!buffer?.byteLength) {
    throw new Error("SPREADSHEET_EMPTY_BUFFER");
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      cellNF: true,
      cellText: true,
      dense: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "read_failed";
    throw new Error(`SPREADSHEET_UNREADABLE:${msg}`);
  }

  const sheetNames = workbook.SheetNames ?? [];
  if (sheetNames.length === 0) {
    throw new Error("SPREADSHEET_NO_SHEETS");
  }

  const fileLabel = opts?.fileName?.trim() || "spreadsheet";
  const sheets: SpreadsheetSheetExtract[] = [];
  const parts: string[] = [`[Spreadsheet: ${fileLabel}]`];
  const structure = emptyStructure();

  for (let sheetIndex = 0; sheetIndex < sheetNames.length; sheetIndex++) {
    const sheetName = sheetNames[sheetIndex]!;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    try {

    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    }) as unknown[][];

    const merges = (sheet["!merges"] ?? []).map((m) => ({
      startRow: m.s.r,
      startCol: m.s.c,
      endRow: m.e.r,
      endCol: m.e.c,
    }));

    const matrix: string[][] = [];
    const addresses: Array<Array<string | null>> = [];
    let rowCount = 0;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const displayRow: string[] = [];
      const addressRow: Array<string | null> = [];
      for (let c = 0; c < row.length; c++) {
        const display = formatCellDisplay(row[c]);
        displayRow.push(display);
        const addr = XLSX.utils.encode_cell({ r, c });
        addressRow.push(display ? addr : null);
      }
      if (displayRow.every((x) => !x)) continue;
      matrix.push(displayRow);
      addresses.push(addressRow);
      rowCount += 1;
    }

    const { table, blocks } = structureFromTableMatrix({
      sheetName,
      rows: matrix,
      documentId: opts?.documentId ?? null,
      fileName: fileLabel,
      sheetIndex,
      addresses,
      merges,
    });
    structure.tables.push(table);
    structure.blocks.push(...blocks);
    structure.pages.push({
      page: sheetIndex + 1,
      charCount: 0,
      method: "sheetjs",
    });
    structure.sections.push({ title: sheetName, page: sheetIndex + 1 });

    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false, FS: "\t" }).trim();
    const sheetBlock = [
      `[Sheet: ${sheetName} · file=${fileLabel}]`,
      csv,
    ]
      .filter(Boolean)
      .join("\n");

    structure.pages[structure.pages.length - 1]!.charCount = sheetBlock.length;
    sheets.push({ sheetName, rowCount, text: sheetBlock, matrix });
    parts.push(sheetBlock);
    } catch {
      parts.push(`[Sheet: ${sheetName} · EXTRACTION_FAILURE]`);
      structure.pages.push({
        page: sheetIndex + 1,
        charCount: 0,
        method: "sheetjs",
      });
    }
  }

  const text = sanitizeExtractedText(parts.join("\n\n"));
  if (!text || text.length < 8) {
    throw new Error("SPREADSHEET_NO_TEXT");
  }

  return {
    text,
    sheetCount: sheets.length,
    sheets,
    method: "sheetjs",
    structure,
  };
}
