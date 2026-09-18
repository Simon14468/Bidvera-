/**
 * Format-agnostic semantic document units.
 * Bridges UDI structure → STI interpretation. Never admits requirements.
 * Filename, section title, and column header are weak context only.
 */

import type {
  DocumentStructuralBlock,
  DocumentTable,
  DocumentTableCell,
  NormalizedDocumentStructure,
} from "./types";
import { hasUniversalObligationModal } from "@/domain/semantic-tender-intelligence/obligation-lexicon";
import { normalizeSemanticSurface } from "@/domain/semantic-tender-intelligence/identity";
import {
  isTableResponseChrome,
  stripTableResponseChrome,
} from "@/domain/semantic-tender-intelligence/table-context";

/** Candidate-shaped harvest — not a canonical requirement. */
export type UnitHarvestDraft = {
  description: string;
  category: string | null;
  mandatory: boolean;
  sourceDocument: string | null;
  sourcePage: number | null;
  pageNumber: number | null;
  sourceSection: string | null;
  section: string | null;
  sourceCell: string | null;
  columnHeader: string | null;
  rowLabel: string | null;
  isTableHeader: boolean;
  precedingText: string | null;
  followingText: string | null;
  documentRole: string | null;
  packageDocumentRole: string | null;
  versionLabel: string | null;
  locator: string | null;
};

export type SemanticUnitKind =
  | "paragraph"
  | "list_item"
  | "table_row"
  | "heading"
  | "unknown";

export type SemanticUnitTableRelation = {
  tableId: string | null;
  columnHeader: string | null;
  rowLabel: string | null;
  sourceCell: string | null;
  mergeSpan: { rows: number; cols: number } | null;
  isHeader: boolean;
};

export type SemanticDocumentUnit = {
  id: string;
  text: string;
  kind: SemanticUnitKind;
  nonRequirement: boolean;
  documentId: string | null;
  fileName: string | null;
  page: number | null;
  sectionPath: string | null;
  precedingText: string | null;
  followingText: string | null;
  table: SemanticUnitTableRelation | null;
  /** UTI / package role — weak context, never semantic truth. */
  packageDocumentRole: string | null;
  versionLabel: string | null;
};

export type BuildSemanticUnitsInput = {
  structure: NormalizedDocumentStructure | null | undefined;
  documentId?: string | null;
  fileName?: string | null;
  packageDocumentRole?: string | null;
  versionLabel?: string | null;
  fallbackText?: string | null;
};


export function buildSemanticDocumentUnits(
  input: BuildSemanticUnitsInput,
): SemanticDocumentUnit[] {
  const structure = input.structure;
  const units: SemanticDocumentUnit[] = [];
  const fileName = input.fileName ?? null;
  const documentId = input.documentId ?? structure?.tables[0]?.provenance.documentId ?? null;
  const role = input.packageDocumentRole ?? null;
  const versionLabel = input.versionLabel ?? null;

  if (structure) {
    const sectionByPage = new Map<number, string>();
    for (const s of structure.sections) {
      if (s.page != null && s.title) sectionByPage.set(s.page, s.title);
    }

    const blockUnits = structure.blocks.map((block, i) =>
      unitFromBlock(block, i, {
        documentId,
        fileName,
        role,
        versionLabel,
        sectionByPage,
      }),
    );
    attachNeighbors(blockUnits);
    units.push(...blockUnits);

    for (const table of structure.tables) {
      units.push(...unitsFromTable(table, { documentId, fileName, role, versionLabel }));
    }
  }

  if (units.length === 0 && input.fallbackText?.trim()) {
    const paras = input.fallbackText
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const fallback = paras.map((text, i) =>
      makeUnit({
        id: `fallback:${fileName ?? "doc"}:${i}`,
        text,
        kind: "paragraph",
        nonRequirement: false,
        documentId,
        fileName,
        page: null,
        sectionPath: null,
        table: null,
        packageDocumentRole: role,
        versionLabel,
      }),
    );
    attachNeighbors(fallback);
    units.push(...fallback);
  }

  return units;
}

export function harvestDraftsFromUnits(
  units: SemanticDocumentUnit[],
): UnitHarvestDraft[] {
  const drafts: UnitHarvestDraft[] = [];
  const seen = new Set<string>();
  for (const unit of units) {
    try {
      if (unit.nonRequirement || unit.kind === "heading") continue;
      if (unit.table?.isHeader) continue;
      const text = stripTableResponseChrome(unit.text);
      if (text.length < 24) continue;
      if (isTableResponseChrome(text)) continue;
      if (!looksLikeObligationCandidate(text)) continue;
      const key = normalizeSemanticSurface(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      drafts.push(unitToDraft(unit));
    } catch {
      // Isolate a malformed unit — never abort package harvest.
    }
  }
  return drafts;
}

export function enrichDraftsFromUnits<T extends Partial<UnitHarvestDraft> & { requirement?: string | null; description?: string | null }>(
  drafts: T[],
  units: SemanticDocumentUnit[],
): T[] {
  if (units.length === 0) return drafts;
  return drafts.map((draft) => {
    const unit = findNearestUnit(draft, units);
    if (!unit) return draft;
    return {
      ...draft,
      sourceDocument: draft.sourceDocument ?? unit.fileName,
      sourcePage: draft.sourcePage ?? draft.pageNumber ?? unit.page,
      pageNumber: draft.pageNumber ?? draft.sourcePage ?? unit.page,
      sourceSection: draft.sourceSection ?? draft.section ?? unit.sectionPath,
      section: draft.section ?? draft.sourceSection ?? unit.sectionPath,
      sourceCell: draft.sourceCell ?? unit.table?.sourceCell ?? null,
      columnHeader: draft.columnHeader ?? unit.table?.columnHeader ?? null,
      rowLabel: draft.rowLabel ?? unit.table?.rowLabel ?? null,
      isTableHeader: draft.isTableHeader ?? unit.table?.isHeader ?? false,
      precedingText: draft.precedingText ?? unit.precedingText,
      followingText: draft.followingText ?? unit.followingText,
      documentRole: draft.documentRole ?? unit.packageDocumentRole,
      packageDocumentRole: draft.packageDocumentRole ?? unit.packageDocumentRole,
      versionLabel: draft.versionLabel ?? unit.versionLabel,
    };
  });
}

/** Structured procurement field — label+value, numbered clause, or table row. */
export function isStructuredDiscoveryCandidate(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 16) return false;
  if (/\|/.test(t) && t.split("|").filter((c) => c.trim().length > 2).length >= 2) {
    return true;
  }
  if (/^\d+(?:\.\d+)+\s+\S/.test(t)) return true;
  if (/^[A-Z][A-Za-z0-9 /&().-]{2,48}:\s+\S/.test(t) && t.split(/\s+/).length >= 4) {
    return true;
  }
  return false;
}

export function looksLikeObligationCandidate(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 24) return false;
  if (hasUniversalObligationModal(t)) return true;
  if (isStructuredDiscoveryCandidate(t)) return true;
  // Table rows often omit the modal but still bind a bidder-facing fact.
  if (/\b(?:iso|certif|turnover|experience|reference|bond|security|guarantee|garantie)\b/i.test(t)) {
    return t.split(" ").length >= 5;
  }
  return false;
}

function unitToDraft(unit: SemanticDocumentUnit): UnitHarvestDraft {
  const description = stripTableResponseChrome(unit.text) || unit.text;
  return {
    description,
    category: unit.kind === "table_row" ? "CONTRACTUAL" : null,
    mandatory: true,
    sourceDocument: unit.fileName,
    sourcePage: unit.page,
    pageNumber: unit.page,
    sourceSection: unit.sectionPath,
    section: unit.sectionPath,
    sourceCell: unit.table?.sourceCell ?? null,
    columnHeader: unit.table?.columnHeader ?? null,
    rowLabel: unit.table?.rowLabel ?? null,
    isTableHeader: unit.table?.isHeader ?? false,
    precedingText: unit.precedingText,
    followingText: unit.followingText,
    documentRole: unit.packageDocumentRole,
    packageDocumentRole: unit.packageDocumentRole,
    versionLabel: unit.versionLabel,
    locator: unit.id,
  };
}

function findNearestUnit(
  draft: Partial<UnitHarvestDraft> & { requirement?: string | null; description?: string | null },
  units: SemanticDocumentUnit[],
): SemanticDocumentUnit | null {
  const text = (draft.requirement ?? draft.description ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const needle = text.slice(0, 80).toLowerCase();
  const sameDoc = units.filter((u) => {
    if (!draft.sourceDocument) return true;
    const name = u.fileName ?? "";
    return (
      name === draft.sourceDocument ||
      name.includes(draft.sourceDocument) ||
      draft.sourceDocument.includes(name)
    );
  });
  const pool = sameDoc.length > 0 ? sameDoc : units;
  let best: SemanticDocumentUnit | null = null;
  let bestScore = 0;
  for (const unit of pool) {
    const hay = unit.text.toLowerCase();
    if (!hay) continue;
    if (hay.includes(needle) || needle.includes(hay.slice(0, 80))) {
      const score = Math.min(needle.length, hay.length);
      if (score > bestScore) {
        best = unit;
        bestScore = score;
      }
    }
  }
  return best;
}

function unitFromBlock(
  block: DocumentStructuralBlock,
  index: number,
  ctx: {
    documentId: string | null;
    fileName: string | null;
    role: string | null;
    versionLabel: string | null;
    sectionByPage: Map<number, string>;
  },
): SemanticDocumentUnit {
  const kind: SemanticUnitKind =
    block.kind === "heading"
      ? "heading"
      : block.kind === "list_item"
        ? "list_item"
        : block.kind === "table"
          ? "table_row"
          : block.kind === "paragraph"
            ? "paragraph"
            : "unknown";
  return makeUnit({
    id: `block:${ctx.fileName ?? ctx.documentId ?? "doc"}:${index}`,
    text: block.text,
    kind,
    nonRequirement: block.nonRequirement,
    documentId: ctx.documentId,
    fileName: ctx.fileName,
    page: block.page,
    sectionPath: block.section ?? (block.page != null ? ctx.sectionByPage.get(block.page) ?? null : null),
    table: null,
    packageDocumentRole: ctx.role,
    versionLabel: ctx.versionLabel,
  });
}

function unitsFromTable(
  table: DocumentTable,
  ctx: {
    documentId: string | null;
    fileName: string | null;
    role: string | null;
    versionLabel: string | null;
  },
): SemanticDocumentUnit[] {
  const units: SemanticDocumentUnit[] = [];
  const headers = table.headers;
  for (const row of table.rows) {
    if (row.length === 0) continue;
    const isHeader = row.every((c) => c.isHeader) || row.some((c) => c.isHeader && !c.text.trim());
    const rowLabel = firstDataCell(row)?.text ?? row[0]?.text ?? null;
    const joinedRaw = row
      .map((c) => c.text.trim())
      .filter((t) => t && !isTableResponseChrome(t))
      .join(" | ");
    const joined = stripTableResponseChrome(joinedRaw);
    if (!joined || isTableResponseChrome(joined)) continue;
    const primary = pickPrimaryCell(row);
    units.push(
      makeUnit({
        id: `table:${table.id}:${row[0]?.row ?? 0}`,
        text: joined,
        kind: isHeader ? "heading" : "table_row",
        nonRequirement: isHeader,
        documentId: table.provenance.documentId ?? ctx.documentId,
        fileName: table.provenance.fileName ?? ctx.fileName,
        page: table.provenance.pageOrSheet,
        sectionPath: table.sheetOrPage,
        table: {
          tableId: table.id,
          columnHeader: headerForCell(headers, primary),
          rowLabel,
          sourceCell: primary?.address ?? null,
          mergeSpan:
            primary?.rowspan || primary?.colspan
              ? { rows: primary.rowspan ?? 1, cols: primary.colspan ?? 1 }
              : null,
          isHeader,
        },
        packageDocumentRole: ctx.role,
        versionLabel: ctx.versionLabel,
      }),
    );
  }
  attachNeighbors(units);
  return units;
}

function pickPrimaryCell(row: DocumentTableCell[]): DocumentTableCell | null {
  const data = row.filter((c) => !c.isHeader && c.text.trim().length > 12);
  return data.sort((a, b) => b.text.length - a.text.length)[0] ?? row[0] ?? null;
}

function firstDataCell(row: DocumentTableCell[]): DocumentTableCell | undefined {
  return row.find((c) => !c.isHeader && c.text.trim());
}

function headerForCell(headers: string[], cell: DocumentTableCell | null): string | null {
  if (!cell) return null;
  const h = headers[cell.col];
  return h?.trim() ? h.trim() : null;
}

function makeUnit(
  partial: Omit<SemanticDocumentUnit, "precedingText" | "followingText"> & {
    precedingText?: string | null;
    followingText?: string | null;
  },
): SemanticDocumentUnit {
  return {
    ...partial,
    precedingText: partial.precedingText ?? null,
    followingText: partial.followingText ?? null,
  };
}

function attachNeighbors(units: SemanticDocumentUnit[]): void {
  for (let i = 0; i < units.length; i++) {
    const prev = units[i - 1];
    const next = units[i + 1];
    units[i]!.precedingText = prev?.text ?? null;
    units[i]!.followingText = next?.text ?? null;
  }
}
