/**
 * Structure normalization — pages, headings, paragraphs, tables.
 * Never invents content; never promotes headers to requirements.
 */

import type {
  DocumentStructuralBlock,
  DocumentTable,
  DocumentTableCell,
  NormalizedDocumentStructure,
} from "./types";

const HEADING_LINE =
  /^(?:section|article|chapter|partie|annexe|appendix|schedule)\s+[\dIVXLC.]+/i;

const TABLE_HEADER_TOKENS =
  /^(?:item|description|qty|quantity|unit|price|amount|mandatory|optional|notes?|ref\.?|requirement|lot)$/i;

export type TableMergeRange = {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};

export function emptyStructure(): NormalizedDocumentStructure {
  return {
    version: "document-structure/v1",
    pages: [],
    sections: [],
    tables: [],
    blocks: [],
  };
}

function cell(
  input: Omit<DocumentTableCell, "rowspan" | "colspan" | "address" | "isHeader"> &
    Partial<Pick<DocumentTableCell, "rowspan" | "colspan" | "address" | "isHeader">>,
): DocumentTableCell {
  return {
    row: input.row,
    col: input.col,
    text: input.text,
    address: input.address ?? null,
    isHeader: input.isHeader ?? false,
    rowspan: input.rowspan ?? null,
    colspan: input.colspan ?? null,
  };
}

/**
 * Build light structural blocks from plain text (PDF/DOCX/TXT).
 * Reconstructs simple pipe / tab / aligned-column tables without inventing cells.
 */
export function structureFromPlainText(input: {
  text: string;
  documentId?: string | null;
  fileName?: string | null;
  pages?: Array<{ page: number; method: string | null; charCount: number }>;
}): NormalizedDocumentStructure {
  const structure = emptyStructure();
  structure.pages = (input.pages ?? []).map((p) => ({
    page: p.page,
    charCount: p.charCount,
    method: p.method,
  }));

  const cleaned = input.text.replace(/\r\n/g, "\n");
  const pageChunks = cleaned.split(/\n---\s*Page\s+(\d+)[^\n]*---\n/i);
  const segments: Array<{ page: number | null; body: string }> = [];

  if (pageChunks.length === 1) {
    segments.push({ page: null, body: cleaned });
  } else {
    if (pageChunks[0]?.trim()) segments.push({ page: null, body: pageChunks[0]! });
    for (let i = 1; i < pageChunks.length; i += 2) {
      const page = Number(pageChunks[i]);
      const body = pageChunks[i + 1] ?? "";
      segments.push({ page: Number.isFinite(page) ? page : null, body });
    }
  }

  let tableIndex = 0;
  for (const seg of segments) {
    const lines = seg.body.split("\n");
    const consumed = new Set<number>();
    const tables = extractPlainTextTables(lines, {
      documentId: input.documentId ?? null,
      fileName: input.fileName ?? null,
      page: seg.page,
      startIndex: tableIndex,
    });
    tableIndex += tables.length;
    for (const found of tables) {
      structure.tables.push(found.table);
      for (const idx of found.lineIndexes) consumed.add(idx);
    }

    const leftover = lines
      .map((line, i) => (consumed.has(i) ? "" : line))
      .join("\n");
    const paras = leftover
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    for (const para of paras) {
      const isHeading =
        HEADING_LINE.test(para) ||
        (para.length < 80 &&
          !/[.!?]$/.test(para) &&
          /^[A-Z0-9]/.test(para) &&
          para.split(" ").length <= 12);
      if (isHeading && HEADING_LINE.test(para)) {
        structure.sections.push({ title: para.slice(0, 160), page: seg.page });
      }
      structure.blocks.push({
        kind: isHeading && HEADING_LINE.test(para) ? "heading" : "paragraph",
        text: para,
        page: seg.page,
        section: null,
        nonRequirement: Boolean(isHeading && HEADING_LINE.test(para)),
      });
    }
  }

  if (structure.blocks.length > 5_000) {
    structure.blocks = structure.blocks.slice(0, 5_000);
  }

  return structure;
}

/**
 * Build first-class table structure from SheetJS-style row matrix.
 */
export function structureFromTableMatrix(input: {
  sheetName: string;
  rows: string[][];
  documentId?: string | null;
  fileName?: string | null;
  sheetIndex: number;
  addresses?: Array<Array<string | null>>;
  merges?: TableMergeRange[];
}): { table: DocumentTable; blocks: DocumentStructuralBlock[] } {
  const matrix = input.rows.filter((r) => r.some((c) => String(c ?? "").trim().length > 0));
  const headerRow = matrix[0] ?? [];
  const headers = headerRow.map((c) => String(c ?? "").trim());
  const headerLooksLikeLabels =
    headers.filter((h) => TABLE_HEADER_TOKENS.test(h)).length >= 2 ||
    headers.every((h) => h.length > 0 && h.length < 40);

  const dataRows = matrix.slice(headerLooksLikeLabels ? 1 : 0);
  const cellsByRow: DocumentTableCell[][] = [];
  const mergeMap = indexMerges(input.merges ?? []);

  const pushRow = (rowValues: string[], rowIndex: number, header: boolean) => {
    cellsByRow.push(
      rowValues.map((text, col) => {
        const span = mergeMap.get(`${rowIndex}:${col}`);
        return cell({
          row: rowIndex,
          col,
          text: String(text ?? "").trim(),
          address: input.addresses?.[rowIndex]?.[col] ?? null,
          isHeader: header,
          rowspan: span?.rows ?? null,
          colspan: span?.cols ?? null,
        });
      }),
    );
  };

  if (headerLooksLikeLabels) {
    pushRow(headers, 0, true);
  }

  dataRows.forEach((row, ri) => {
    const rowIndex = headerLooksLikeLabels ? ri + 1 : ri;
    pushRow(row.map((c) => String(c ?? "")), rowIndex, false);
  });

  const table: DocumentTable = {
    id: `table:${input.sheetName}:${input.sheetIndex}`,
    sheetOrPage: input.sheetName,
    headers: headerLooksLikeLabels ? headers : [],
    rows: cellsByRow,
    notes: [],
    provenance: {
      documentId: input.documentId ?? null,
      fileName: input.fileName ?? null,
      pageOrSheet: input.sheetIndex + 1,
    },
  };

  const blocks: DocumentStructuralBlock[] = [];
  if (headerLooksLikeLabels) {
    blocks.push({
      kind: "heading",
      text: headers.join(" | "),
      page: input.sheetIndex + 1,
      section: input.sheetName,
      nonRequirement: true,
    });
  }
  for (const row of dataRows) {
    const joined = row.map((c) => String(c ?? "").trim()).filter(Boolean).join(" | ");
    if (!joined) continue;
    blocks.push({
      kind: "table",
      text: joined,
      page: input.sheetIndex + 1,
      section: input.sheetName,
      nonRequirement: false,
    });
  }

  return { table, blocks };
}

export function isNonRequirementStructuralText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (HEADING_LINE.test(t)) return true;
  if (TABLE_HEADER_TOKENS.test(t)) return true;
  if (/^(?:item|qty|unit|price)$/i.test(t)) return true;
  return false;
}

function indexMerges(
  merges: TableMergeRange[],
): Map<string, { rows: number; cols: number }> {
  const map = new Map<string, { rows: number; cols: number }>();
  for (const m of merges) {
    const rows = m.endRow - m.startRow + 1;
    const cols = m.endCol - m.startCol + 1;
    if (rows <= 1 && cols <= 1) continue;
    map.set(`${m.startRow}:${m.startCol}`, { rows, cols });
  }
  return map;
}

function extractPlainTextTables(
  lines: string[],
  ctx: {
    documentId: string | null;
    fileName: string | null;
    page: number | null;
    startIndex: number;
  },
): Array<{ table: DocumentTable; lineIndexes: number[] }> {
  const found: Array<{ table: DocumentTable; lineIndexes: number[] }> = [];
  let i = 0;
  let local = 0;
  while (i < lines.length) {
    const kind = tableLineKind(lines[i]!);
    if (!kind) {
      i += 1;
      continue;
    }
    const run: number[] = [i];
    let j = i + 1;
    while (j < lines.length && tableLineKind(lines[j]!) === kind) {
      run.push(j);
      j += 1;
    }
    if (run.length >= 2) {
      const matrix = run.map((idx) => splitTableLine(lines[idx]!, kind));
      const { table } = structureFromTableMatrix({
        sheetName: ctx.page != null ? `page-${ctx.page}` : "plain-table",
        rows: matrix,
        documentId: ctx.documentId,
        fileName: ctx.fileName,
        sheetIndex: ctx.startIndex + local,
      });
      table.provenance.pageOrSheet = ctx.page;
      found.push({ table, lineIndexes: run });
      local += 1;
    }
    i = j;
  }
  return found;
}

function tableLineKind(line: string): "pipe" | "tab" | "aligned" | null {
  const t = line.trim();
  if (!t) return null;
  if ((t.match(/\|/g) ?? []).length >= 2) return "pipe";
  if (t.split("\t").length >= 3) return "tab";
  if (/(?:\s{2,}\S+){2,}/.test(t) && t.length < 240) return "aligned";
  return null;
}

function splitTableLine(line: string, kind: "pipe" | "tab" | "aligned"): string[] {
  if (kind === "pipe") {
    return line
      .split("|")
      .map((c) => c.trim())
      .filter((c, i, arr) => !(c === "" && (i === 0 || i === arr.length - 1)));
  }
  if (kind === "tab") return line.split("\t").map((c) => c.trim());
  return line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
}
