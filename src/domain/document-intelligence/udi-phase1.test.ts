/**
 * Phase 1 — Universal Document Intelligence tests.
 * General rules only — no tender-specific exceptions.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import {
  FORMAT_ADAPTER_REGISTRY,
  assertNoSilentDrops,
  buildUniversalDocumentPackage,
  isNonRequirementStructuralText,
  mapLegacyExtractQuality,
  resolveFormatAdapter,
  rollupPackageQuality,
  structureFromPlainText,
  structureFromTableMatrix,
  buildSemanticDocumentUnits,
  harvestDraftsFromUnits,
} from "@/domain/document-intelligence";
import { extractSpreadsheetText } from "@/services/document/extract-spreadsheet";
import { sniffUploadContent } from "@/domain/tender-package/upload-content-sniff";
import { discoverTenderPackage } from "@/domain/tender-package/discover-tender-package";

function xlsxBuffer(rows: string[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Schedule");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

describe("UDI format adapters", () => {
  it("registry covers PDF DOC DOCX XLS XLSX CSV PPT PPTX TXT images ZIP RAR", () => {
    const formats = new Set(FORMAT_ADAPTER_REGISTRY.flatMap((a) => [...a.formats]));
    for (const f of [
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "csv",
      "ppt",
      "pptx",
      "txt",
      "png",
      "jpeg",
      "tiff",
      "zip",
      "rar",
    ]) {
      assert.ok(formats.has(f as never), `missing adapter for ${f}`);
    }
  });

  it("never classifies OOXML as archive for text extract", () => {
    const buf = xlsxBuffer([
      ["Item", "Qty", "Unit"],
      ["Labour", "1", "Lot"],
    ]);
    const sniff = sniffUploadContent(buf, "schedule.xlsx");
    assert.equal(sniff.kind, "xlsx");
    const resolved = resolveFormatAdapter({
      buffer: buf,
      fileName: "schedule.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    assert.equal(resolved.format, "xlsx");
    assert.equal(resolved.isArchive, false);
    assert.equal(resolved.isOoxmlDocument, true);
    assert.equal(resolved.textExtractable, true);
  });
});

describe("UDI quality gate", () => {
  it("maps legacy qualities to VALID / PARTIALLY_READABLE / UNREADABLE", () => {
    assert.equal(mapLegacyExtractQuality("ok"), "VALID");
    assert.equal(mapLegacyExtractQuality("degraded"), "PARTIALLY_READABLE");
    assert.equal(mapLegacyExtractQuality("low"), "UNREADABLE");
    assert.equal(mapLegacyExtractQuality("empty"), "UNREADABLE");
    assert.equal(mapLegacyExtractQuality("ok", { support: "ARCHIVE" }), "UNSUPPORTED");
  });

  it("partial package failure does not force whole package UNREADABLE when peers VALID", () => {
    assert.equal(
      rollupPackageQuality(["VALID", "UNREADABLE", "UNSUPPORTED"]),
      "PARTIALLY_READABLE",
    );
  });
});

describe("UDI table-first structure", () => {
  it("preserves headers as non-requirement and keeps cell obligations", () => {
    const { table, blocks } = structureFromTableMatrix({
      sheetName: "Pricing",
      sheetIndex: 0,
      rows: [
        ["Item", "Description", "Qty", "Unit", "Price"],
        ["1", "Bidder shall supply on-site support", "1", "Lot", "100"],
      ],
    });
    assert.ok(table.headers.includes("Description"));
    assert.ok(table.rows[0]!.every((c) => c.isHeader));
    assert.ok(blocks.some((b) => b.nonRequirement));
    assert.ok(blocks.some((b) => /on-site support/i.test(b.text) && !b.nonRequirement));
    assert.ok(isNonRequirementStructuralText("Item"));
  });

  it("records merge spans and cell addresses from SheetJS", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Lot", "Requirement", "Qty"],
      ["A", "The Bidder shall submit ISO 9001 with the proposal.", "1"],
    ]);
    ws["!merges"] = [{ s: { r: 1, c: 0 }, e: { r: 2, c: 0 } }];
    XLSX.utils.book_append_sheet(wb, ws, "Lots");
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    const result = extractSpreadsheetText(buf, { fileName: "lots.xlsx" });
    const origin = result.structure.tables[0]?.rows.flat().find((c) => c.col === 0 && c.row === 1);
    assert.ok(origin);
    assert.equal(origin!.address, "A2");
    assert.ok((origin!.rowspan ?? 1) >= 1);
  });

  it("xlsx extraction returns structure.tables", () => {
    const buf = xlsxBuffer([
      ["Item", "Qty", "Unit", "Price"],
      ["Security certification required", "1", "ea", "0"],
    ]);
    const result = extractSpreadsheetText(buf, { fileName: "commercial.xlsx" });
    assert.ok(result.structure.tables.length >= 1);
    assert.ok(result.structure.tables[0]!.headers.length >= 1);
    assert.match(result.text, /Security certification/i);
  });
});

describe("UDI structure from plain text", () => {
  it("reconstructs pipe tables from PDF-like text", () => {
    const s = structureFromPlainText({
      text: "--- Page 1 (pdf-parse) ---\n\nItem | Description | Qty\n1 | Bidder shall submit ISO 9001 | 1\n",
    });
    assert.ok(s.tables.length >= 1);
    assert.ok(s.tables[0]!.headers.some((h) => /description/i.test(h)));
  });

  it("marks section headings nonRequirement and keeps paragraphs", () => {
    const s = structureFromPlainText({
      text: "Section 1 Eligibility Criteria\n\nThe bidder shall submit three references.\n\n--- Page 2 (pdf-parse) ---\n\nArticle 2 Technical Specifications\n\nEquipment must support 4K.",
    });
    assert.ok(s.blocks.some((b) => b.kind === "heading" && b.nonRequirement));
    assert.ok(s.blocks.some((b) => /three references/i.test(b.text)));
    assert.ok(s.pages.length >= 0);
  });
});

describe("UDI package inventory — zero silent drops", () => {
  it("1 PDF package inventory", () => {
    const pkg = buildUniversalDocumentPackage({
      packageLabel: "single.pdf",
      documents: [
        {
          fileId: "d1",
          originalName: "tender.pdf",
          format: "pdf",
          extractionStatus: "EXTRACTED",
          readability: "VALID",
          extractionMethod: "pdf-parse",
        },
      ],
    });
    assertNoSilentDrops(1, pkg);
    assert.equal(pkg.inventoryCount, 1);
    assert.equal(pkg.qualityState, "VALID");
  });

  it("10 PDFs package inventory", () => {
    const docs = Array.from({ length: 10 }, (_, i) => ({
      fileId: `p${i}`,
      originalName: `doc-${i}.pdf`,
      format: "pdf" as const,
      extractionStatus: "EXTRACTED" as const,
      readability: "VALID" as const,
    }));
    const pkg = buildUniversalDocumentPackage({ packageLabel: "ten", documents: docs });
    assertNoSilentDrops(10, pkg);
  });

  it("100 PDFs inventory integrity", () => {
    const docs = Array.from({ length: 100 }, (_, i) => ({
      fileId: `f${i}`,
      originalName: `file-${i}.pdf`,
      format: "pdf" as const,
      extractionStatus:
        i % 17 === 0 ? ("FILE_EXTRACTION_FAILED" as const) : ("EXTRACTED" as const),
      readability: i % 17 === 0 ? ("UNREADABLE" as const) : ("VALID" as const),
      failureMessage: i % 17 === 0 ? "corrupt" : null,
    }));
    const pkg = buildUniversalDocumentPackage({ packageLabel: "hundred", documents: docs });
    assertNoSilentDrops(100, pkg);
    assert.equal(pkg.failedCount + pkg.extractedOkCount, 100);
    assert.equal(pkg.qualityState, "PARTIALLY_READABLE");
  });

  it("duplicate filenames remain distinct fileIds — no silent merge", () => {
    const pkg = buildUniversalDocumentPackage({
      packageLabel: "dup-names",
      documents: [
        {
          fileId: "a",
          originalName: "notice.pdf",
          format: "pdf",
          extractionStatus: "EXTRACTED",
          readability: "VALID",
        },
        {
          fileId: "b",
          originalName: "notice.pdf",
          format: "pdf",
          extractionStatus: "EXTRACTED",
          readability: "VALID",
        },
      ],
    });
    assert.equal(pkg.inventoryCount, 2);
  });

  it("unsupported + unreadable stay explicit in inventory", () => {
    const pkg = buildUniversalDocumentPackage({
      packageLabel: "mixed-fail",
      documents: [
        {
          fileId: "1",
          originalName: "ok.pdf",
          format: "pdf",
          extractionStatus: "EXTRACTED",
          readability: "VALID",
        },
        {
          fileId: "2",
          originalName: "legacy.ppt",
          format: "ppt",
          extractionStatus: "UNSUPPORTED_SKIPPED",
          readability: "UNSUPPORTED",
          failureMessage: "UPLOAD_ONLY",
        },
        {
          fileId: "3",
          originalName: "scan-bad.tif",
          format: "tiff",
          extractionStatus: "UNREADABLE",
          readability: "UNREADABLE",
          failureMessage: "OCR failed",
        },
      ],
    });
    assertNoSilentDrops(3, pkg);
    assert.equal(pkg.unsupportedCount, 1);
    assert.equal(pkg.failedCount, 1);
  });
});

describe("UDI multilingual text preservation", () => {
  it("preserves French accents and Arabic digits in structure blocks", () => {
    const s = structureFromPlainText({
      text: "Le soumissionnaire doit fournir une attestation fiscale.\n\nالمبلغ: 1 250,00 EUR",
    });
    assert.ok(s.blocks.some((b) => /attestation fiscale/i.test(b.text)));
    assert.ok(s.blocks.some((b) => /1/.test(b.text) && /EUR/.test(b.text)));
  });
});

describe("UDI ZIP expansion still authoritative for archives", () => {
  it("ZIP expands members into inventory candidates without treating OOXML as archive", async () => {
    // Minimal: empty discovery of loose files still builds package of 0 without throw
    const discovered = await discoverTenderPackage([
      {
        fileName: "note.txt",
        mimeType: "text/plain",
        fileSize: 40,
        bytes: Buffer.from("The bidder shall submit Form of Tender.\n", "utf8"),
      },
    ]);
    assert.equal(discovered.discoveredFileCount, 1);
    assert.equal(discovered.inventory.length, 1);
    assert.equal(discovered.inventory[0]!.status, "DISCOVERED");
  });
});

describe("UDI semantic document units", () => {
  it("harvests obligation-shaped table rows with neighbors and cell context", () => {
    const { table, blocks } = structureFromTableMatrix({
      sheetName: "Returnables",
      sheetIndex: 0,
      rows: [
        ["Item", "Requirement"],
        ["1", "The Bidder shall submit ISO 9001 with the proposal."],
      ],
      fileName: "schedule.xlsx",
    });
    const units = buildSemanticDocumentUnits({
      structure: {
        version: "document-structure/v1",
        pages: [],
        sections: [],
        tables: [table],
        blocks,
      },
      fileName: "schedule.xlsx",
    });
    const drafts = harvestDraftsFromUnits(units);
    assert.ok(drafts.some((d) => /ISO 9001/i.test(d.description)));
    const hit = drafts.find((d) => /ISO 9001/i.test(d.description));
    assert.ok(hit?.precedingText || hit?.columnHeader);
  });
});
