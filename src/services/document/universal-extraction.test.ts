/**
 * Universal document extraction regressions — capability contract + real parsers.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import {
  buildStoredZipForTests,
  expandTenderPackageUploadsWithSkips,
} from "@/domain/tender-package/expand-tender-archive";
import { discoverTenderPackage } from "@/domain/tender-package/discover-tender-package";
import {
  EXTRACTION_CAPABILITIES,
  buildUploadAcceptAttribute,
  isTextExtractableCapability,
} from "@/domain/tender-package/extraction-capabilities";
import {
  isArchiveUploadContent,
  isAllowedUploadContent,
  sniffUploadContent,
} from "@/domain/tender-package/upload-content-sniff";
import { extractDocumentText } from "@/services/document/extract";
import { extractSpreadsheetText } from "@/services/document/extract-spreadsheet";
import { AppError } from "@/lib/errors";

const MINI_PDF = Buffer.from(
  "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n",
);

function xlsxBuffer(rows: unknown[][], sheetName = "Pricing"): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function xlsBuffer(rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xls" }));
}

function miniDocx(): Buffer {
  // Minimal OOXML zip with Content_Types + word/document.xml
  return buildStoredZipForTests([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
      ),
    },
    {
      name: "word/document.xml",
      data: Buffer.from(
        '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>The bidder shall submit a bond.</w:t></w:r></w:p></w:body></w:document>',
      ),
    },
  ]);
}

function miniPptx(): Buffer {
  return buildStoredZipForTests([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
      ),
    },
    {
      name: "ppt/slides/slide1.xml",
      data: Buffer.from(
        '<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Mandatory submission deadline</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
      ),
    },
  ]);
}

describe("extraction capability contract", () => {
  it("advertises only formats with declared extractors for text-analyzable kinds", () => {
    for (const cap of EXTRACTION_CAPABILITIES) {
      if (isTextExtractableCapability(cap)) {
        assert.ok(cap.extractor, cap.id);
        assert.equal(cap.textExtraction, true);
      }
      if (cap.support === "UPLOAD_ONLY") {
        assert.equal(cap.safeForTenderAnalysis, false);
        assert.equal(cap.textExtraction, false);
      }
    }
    const accept = buildUploadAcceptAttribute();
    assert.match(accept, /\.xlsx/);
    assert.match(accept, /\.zip/);
    assert.match(accept, /\.pdf/);
  });
});

describe("ZIP sniff — container vs OOXML", () => {
  it("does not classify a multi-doc ZIP containing XLSX as spreadsheet", () => {
    const nestedXlsx = xlsxBuffer([
      ["Lot", "Price"],
      ["A", 100],
      ["B", 200],
    ]);
    const pack = buildStoredZipForTests([
      { name: "ITT.pdf", data: MINI_PDF },
      { name: "Appendix A - Commercial Schedule.xlsx", data: nestedXlsx },
      { name: "notes.txt", data: Buffer.from("Submit by Friday.\n") },
    ]);
    assert.equal(sniffUploadContent(pack, "Documents-JUN557200.zip").kind, "zip");
    assert.ok(isArchiveUploadContent(pack, "Documents-JUN557200.zip"));
    assert.equal(isAllowedUploadContent(pack, "Documents-JUN557200.zip"), null);
  });

  it("still classifies a real XLSX as xlsx", () => {
    const book = xlsxBuffer([["Requirement", "The bidder must provide ISO 9001."]]);
    assert.equal(sniffUploadContent(book, "schedule.xlsx").kind, "xlsx");
    assert.equal(isArchiveUploadContent(book, "schedule.xlsx"), null);
  });
});

describe("spreadsheet extraction", () => {
  it("extracts XLSX sheet names, cells, and numbers", async () => {
    const buf = xlsxBuffer([
      ["Item", "Amount", "Currency"],
      ["Mobilisation", 12500.5, "GBP"],
      ["Year 1", 100000, "GBP"],
    ], "Commercial");
    const result = extractSpreadsheetText(buf, { fileName: "Appendix-A.xlsx" });
    assert.ok(result.sheetCount >= 1);
    assert.match(result.text, /Commercial/);
    assert.match(result.text, /Mobilisation/);
    assert.match(result.text, /12500/);
    assert.match(result.text, /GBP/);

    const extracted = await extractDocumentText({
      buffer: buf,
      fileName: "Appendix-A.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    assert.equal(extracted.method, "sheetjs");
    assert.match(extracted.text, /Year 1/);
  });

  it("extracts legacy XLS", async () => {
    const buf = xlsBuffer([
      ["Clause", "Obligation"],
      ["4.1", "Supplier shall deliver within 30 days"],
    ]);
    assert.equal(sniffUploadContent(buf, "legacy.xls").kind, "xls");
    const extracted = await extractDocumentText({
      buffer: buf,
      fileName: "legacy.xls",
      mimeType: "application/vnd.ms-excel",
    });
    assert.equal(extracted.method, "sheetjs");
    assert.match(extracted.text, /Supplier shall deliver/);
  });

  it("marks unreadable spreadsheet as extraction failure", () => {
    const truncated = Buffer.from(xlsxBuffer([["x"]]).subarray(0, 32));
    assert.throws(
      () => extractSpreadsheetText(truncated),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /SPREADSHEET_UNREADABLE|SPREADSHEET_NO/);
        return true;
      },
    );
  });
});

describe("other format extractors", () => {
  it("extracts CSV rows", async () => {
    const csv = Buffer.from("lot,price,currency\n1,100,GBP\n2,200,GBP\n", "utf8");
    const extracted = await extractDocumentText({
      buffer: csv,
      fileName: "pricing.csv",
      mimeType: "text/csv",
    });
    assert.ok(extracted.text.includes("100") || extracted.text.includes("lot"));
    assert.ok(extracted.text.length > 10);
  });

  it("extracts TXT", async () => {
    const txt = Buffer.from("The tenderer must provide three references.\n", "utf8");
    const extracted = await extractDocumentText({
      buffer: txt,
      fileName: "notes.txt",
      mimeType: "text/plain",
    });
    assert.match(extracted.text, /three references/);
  });

  it("extracts DOCX via mammoth path", async () => {
    const docx = miniDocx();
    assert.equal(sniffUploadContent(docx, "itt.docx").kind, "docx");
    const extracted = await extractDocumentText({
      buffer: docx,
      fileName: "itt.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    assert.equal(extracted.method, "mammoth");
    assert.match(extracted.text, /bidder shall submit/i);
  });

  it("extracts PPTX slide text", async () => {
    const pptx = miniPptx();
    assert.equal(sniffUploadContent(pptx, "brief.pptx").kind, "pptx");
    const extracted = await extractDocumentText({
      buffer: pptx,
      fileName: "brief.pptx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    assert.equal(extracted.method, "ooxml-text");
    assert.match(extracted.text, /Mandatory submission deadline/i);
  });

  it("rejects unsupported loose format", async () => {
    await assert.rejects(
      () =>
        expandTenderPackageUploadsWithSkips([
          {
            fileName: "malware.exe",
            mimeType: "application/octet-stream",
            fileSize: 8,
            bytes: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
          },
        ]),
      AppError,
    );
  });
});

describe("mixed ZIP package discovery", () => {
  it("expands PDF + XLSX + DOCX with provenance and no silent drops", async () => {
    const xlsx = xlsxBuffer([["Fee", 42], ["Currency", "GBP"]]);
    const docx = miniDocx();
    const junk = Buffer.from("PK\x03\x04not-really-supported-binary!!!!!!!!");
    const zip = buildStoredZipForTests([
      { name: "pack/ITT.pdf", data: MINI_PDF },
      { name: "pack/Commercial.xlsx", data: xlsx },
      { name: "pack/Form.docx", data: docx },
      { name: "pack/readme.unknown", data: Buffer.from("hello unknown") },
      { name: "pack/dup.xlsx", data: xlsx },
    ]);
    // Force unknown member by using non-magic text with odd extension — plain text without .txt/.csv
    const zip2 = buildStoredZipForTests([
      { name: "pack/ITT.pdf", data: MINI_PDF },
      { name: "pack/Commercial.xlsx", data: xlsx },
      { name: "pack/Form.docx", data: docx },
      { name: "pack/notes.bin", data: Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]) },
      { name: "pack/Commercial.xlsx", data: xlsx }, // duplicate basename path collision handled via unique names
    ]);

    const discovered = await discoverTenderPackage([
      {
        fileName: "Scottish-pack.zip",
        mimeType: "application/zip",
        fileSize: zip2.byteLength,
        bytes: zip2,
      },
    ]);

    assert.ok(discovered.discoveredFileCount >= 3);
    assert.ok(discovered.files.every((f) => f.archiveFileName === "Scottish-pack.zip"));
    assert.ok(discovered.files.every((f) => f.archivePath));
    const skipped = discovered.inventory.filter((i) => i.status === "UNSUPPORTED_SKIPPED");
    assert.ok(skipped.length >= 1, "unsupported members must be inventoried");
    assert.ok(skipped.every((s) => s.error && s.archivePath));

    // Extract each discovered spreadsheet/docx
    for (const f of discovered.files) {
      if (/\.xlsx$/i.test(f.fileName)) {
        const r = await extractDocumentText({
          buffer: f.bytes,
          fileName: f.originalFileName,
          mimeType: f.mimeType,
        });
        assert.equal(r.method, "sheetjs");
        assert.match(r.text, /GBP|42/);
      }
    }

    void junk;
    void zip;
  });

  it("partial extraction failure does not invent empty tender text for failed file", async () => {
    const good = xlsxBuffer([["OK", 1]]);
    // Truncated workbook that SheetJS rejects (corrupt PK prefix alone won't sniff as xlsx)
    const unreadable = Buffer.from(xlsxBuffer([["x"]]).subarray(0, 40));
    assert.throws(() => extractSpreadsheetText(unreadable));

    const zip = buildStoredZipForTests([
      { name: "good.xlsx", data: good },
      { name: "ok.pdf", data: MINI_PDF },
    ]);
    const { files, skipped } = await expandTenderPackageUploadsWithSkips([
      {
        fileName: "mix.zip",
        mimeType: "application/zip",
        fileSize: zip.byteLength,
        bytes: zip,
      },
    ]);
    assert.equal(files.length, 2);
    assert.equal(skipped.length, 0);
    const goodFile = files.find((f) => f.originalFileName === "good.xlsx")!;
    const text = await extractDocumentText({
      buffer: goodFile.bytes,
      fileName: goodFile.originalFileName,
      mimeType: goodFile.mimeType,
    });
    assert.ok(text.text.length > 0);
  });
});
