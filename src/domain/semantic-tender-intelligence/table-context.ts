/**
 * Table semantics — preserve row/column/header/unit/threshold/lot/source.
 * Never admit table headers or labels as bidder requirements.
 */

import type { TableSemanticContext } from "./types";

const HEADER_TOKENS =
  /^(?:item|no\.?|ref\.?|#|description|specification|requirement|qty|quantity|unit|uom|price|amount|mandatory|optional|notes?|lot|threshold|min|max|criteria|compliance|remarks?|comments?|offered|response)\s*$/i;

const RESPONSE_CHROME =
  /^(?:[☐☑✓✗]\s*)?(?:yes|no)(?:\s*[☐☑✓✗]\s*(?:yes|no))?$|^(?:insert\s+details|tick\s+(?:yes|no)|check\s+as\s+applicable)\b/i;

const HEADER_VOCAB =
  "(?:item|description|qty|quantity|unit|price|amount|mandatory|optional|notes?|ref\\.?|requirement|lot)";

const HEADER_ROW = new RegExp(
  `^${HEADER_VOCAB}(?:\\s*[\\t|,;]\\s*${HEADER_VOCAB})+\\s*$`,
  "i",
);

const HEADER_ROW_SPACED = new RegExp(
  `^${HEADER_VOCAB}(?:\\s+${HEADER_VOCAB}){2,}\\s*$`,
  "i",
);

const UNIT_TOKEN =
  /\b(?:mm|cm|m|km|kg|g|mbps|gbps|mhz|ghz|v|vac|vdc|a|w|kw|%|pcs?|nos?|lot|sets?|hours?|days?|months?|years?)\b/i;

const THRESHOLD_TOKEN =
  /\b(?:(?:min(?:imum)?|max(?:imum)?|at\s+least|not\s+less\s+than|≥|<=|>=)\s*:?\s*\d+[.,]?\d*\s*%?|\d+[.,]?\d*\s*(?:mbps|gbps|v|a|w|%))\b/i;

const LOT_TOKEN = /\b(?:lot|package)\s*(?:no\.?|number|n[°o])?\s*([0-9IVXLC]+)\b/i;

/**
 * Build table context from explicit fields and/or cell text heuristics.
 */
export function buildTableSemanticContext(input: {
  text: string;
  columnHeader?: string | null;
  rowLabel?: string | null;
  sourceCell?: string | null;
  sourceLocation?: string | null;
  isHeader?: boolean;
}): TableSemanticContext {
  const text = (input.text ?? "").replace(/\s+/g, " ").trim();
  const columnHeader = input.columnHeader?.trim() || null;
  const rowLabel = input.rowLabel?.trim() || null;

  const isTableHeader =
    input.isHeader === true ||
    HEADER_TOKENS.test(text) ||
    HEADER_ROW.test(text) ||
    HEADER_ROW_SPACED.test(text) ||
    RESPONSE_CHROME.test(text) ||
    (Boolean(columnHeader) &&
      (HEADER_TOKENS.test(columnHeader!) || RESPONSE_CHROME.test(columnHeader!)) &&
      text.length < 40);

  const unitMatch = text.match(UNIT_TOKEN);
  const thresholdMatch = text.match(THRESHOLD_TOKEN);
  const lotMatch = text.match(LOT_TOKEN);
  const conditionInCell =
    text.match(
      /\b((?:if|unless|when|where(?:\s+applicable)?|provided\s+that)[^.;]{3,120})/i,
    )?.[1] ?? null;

  return {
    isTableHeader,
    columnHeader,
    rowLabel,
    unit: unitMatch?.[0] ?? null,
    threshold: thresholdMatch?.[0] ?? null,
    lotNumber: lotMatch?.[1] ?? null,
    conditionInCell,
    sourceLocation:
      input.sourceLocation?.trim() ||
      input.sourceCell?.trim() ||
      (rowLabel || columnHeader
        ? [rowLabel, columnHeader].filter(Boolean).join(" / ")
        : null),
  };
}

export function isTableHeaderText(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  return HEADER_TOKENS.test(t) || HEADER_ROW.test(t) || HEADER_ROW_SPACED.test(t);
}

/** Yes/No, insert-details, and similar response columns are not obligations. */
export function isTableResponseChrome(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  return !t || RESPONSE_CHROME.test(t);
}

const CELL_ADDRESS_PREFIX = /(?:^|[\s|,;])[A-Z]{1,3}\d{1,4}=/g;

/** Drop response-column residue and spreadsheet cell-address prefixes from a harvested row. */
export function stripTableResponseChrome(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\[(?:Spreadsheet|Sheet|Cells):[^\]]*\]/gi, " ")
    .replace(CELL_ADDRESS_PREFIX, " ")
    .replace(/^[A-Z]{1,3}\d{1,4}=/g, "")
    .replace(/[☐☑✓✗]\s*(?:Yes|No)/gi, " ")
    .replace(/\bInsert\s+details\b[\s\S]{0,120}/gi, " ")
    .replace(/\s*[|\t]+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Enrich obligation text with table headers/units without inventing requirements.
 * Headers alone never become the requirement body.
 */
export function enrichRequirementWithTableContext(
  text: string,
  table: TableSemanticContext | null | undefined,
): string {
  if (!table || table.isTableHeader) return text;
  const t = text.replace(/\s+/g, " ").trim();
  const bits: string[] = [];
  if (table.rowLabel && !t.toLowerCase().includes(table.rowLabel.toLowerCase())) {
    bits.push(`Row: ${table.rowLabel}`);
  }
  if (table.columnHeader && !t.toLowerCase().includes(table.columnHeader.toLowerCase())) {
    bits.push(`Column: ${table.columnHeader}`);
  }
  if (table.unit && !new RegExp(`\\b${table.unit}\\b`, "i").test(t)) {
    bits.push(`Unit: ${table.unit}`);
  }
  if (table.threshold && !t.includes(table.threshold)) {
    bits.push(`Threshold: ${table.threshold}`);
  }
  if (table.lotNumber && !new RegExp(`\\blot\\s*${table.lotNumber}\\b`, "i").test(t)) {
    bits.push(`Lot ${table.lotNumber}`);
  }
  if (table.conditionInCell && !t.toLowerCase().includes(table.conditionInCell.slice(0, 12).toLowerCase())) {
    bits.push(table.conditionInCell);
  }
  if (bits.length === 0) return t;
  return `${t} [${bits.join("; ")}]`;
}
