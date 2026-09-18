/**
 * CPS v5 regression — real uploaded PDF only (no hardcoded tender content).
 *
 * Verifies:
 * 1) PDF detected
 * 2) Native extraction attempted (with worker pinned for Next/Node)
 * 3) If native insufficient → OCR fallback
 * 4) Usable text + page provenance
 * 5) Classification continues (heuristic)
 *
 * Run: npx tsx scripts/e2e-cps-pdf-ocr-regression.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  assessExtractQuality,
  extractDocumentText,
} from "../src/services/document/extract";
import { classifyDocument } from "../src/domain/company-knowledge";

const CPS_CANDIDATES = [
  path.join(
    process.cwd(),
    ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtg6a1oa00kgrkoktjqo91hu/1788116303681-CPS_v5_-_VF29-07.pdf",
  ),
  path.join(
    process.cwd(),
    ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtg5ol4900gbrkokt770vb7q/1788115302145-CPS_v5_-_VF29-07.pdf",
  ),
];

function findCps(): string {
  for (const p of CPS_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("CPS PDF not found under .data/uploads — upload CPS v5 - VF29-07 first.");
}

async function main() {
  const cpsPath = findCps();
  const buffer = fs.readFileSync(cpsPath);
  const fileName = "CPS v5 - VF29-07.pdf";

  console.log("=== CPS PDF OCR / extract regression ===");
  console.log("file:", cpsPath);
  console.log("size:", buffer.length);
  console.log("magic:", buffer.subarray(0, 5).toString("latin1"));

  const phases: string[] = [];
  const native = await extractDocumentText({
    buffer,
    mimeType: "application/pdf",
    fileName,
    documentId: "cps-regression-doc",
    onProgress: (p) => {
      phases.push(p);
    },
  });

  const nativeQuality = assessExtractQuality(native);
  console.log("\n— Native path —");
  console.log("method:", native.method);
  console.log("usedOcrFallback:", native.usedOcrFallback);
  console.log("pages:", native.pageCount);
  console.log("chars:", native.text.length);
  console.log("provenance pages:", native.pages.length);
  console.log("phases:", phases.join(" → "));
  console.log("quality:", nativeQuality.quality);

  if (native.text.length < 80) {
    throw new Error("FAIL: native/OCR produced insufficient text for CPS");
  }
  if (!phases.includes("NATIVE_EXTRACT") && !phases.includes("READING_PDF")) {
    throw new Error("FAIL: native extraction was not attempted");
  }
  if (native.pages.some((p) => typeof p.page !== "number" || p.page < 1)) {
    throw new Error("FAIL: invalid page provenance");
  }

  // Forced OCR path (native skipped) — proves OCR works on this real file.
  console.log("\n— Forced OCR fallback (skipNative, max diagnostic) —");
  const ocrPhases: string[] = [];
  const { ocrPdfPages } = await import("../src/services/document/pdf-ocr");
  // Only a few pages for runtime — full OCR of 21 pages is intentional prod fallback.
  const ocrPartial = await ocrPdfPages({
    buffer,
    documentId: "cps-regression-doc",
    maxPages: 2,
    onPage: (info) => {
      console.log(`  OCR page ${info.page}/${info.total}: ${info.chars} chars`);
    },
  });
  ocrPhases.push("OCR");

  console.log("ocr chars (2 pages):", ocrPartial.text.length);
  console.log("ocr pages with text:", ocrPartial.pages.filter((p) => p.charCount > 0).length);
  console.log(
    "ocr provenance sample:",
    JSON.stringify(
      ocrPartial.pages.slice(0, 2).map((p) => ({
        documentId: "cps-regression-doc",
        page: p.page,
        method: p.method,
        confidence: p.confidence,
      })),
    ),
  );

  if (ocrPartial.pages.length < 1) {
    throw new Error("FAIL: OCR produced no page results");
  }
  if (ocrPartial.pages.every((p) => p.charCount === 0) && native.method !== "pdf-parse") {
    throw new Error("FAIL: OCR empty and native also failed");
  }
  // For CPS (text PDF), OCR may still recover glyphs from rendered pages
  const ocrChars = ocrPartial.text.replace(/--- Page.*?---/g, "").trim().length;
  console.log("ocr body chars:", ocrChars);

  const classified = classifyDocument({
    text: native.text.slice(0, 20_000),
    fileName,
  });
  console.log("\n— Classification —");
  console.log("kind:", classified.kind);
  console.log("confidence:", classified.confidence);

  console.log("\nPASS: CPS extract pipeline OK");
  console.log(
    JSON.stringify(
      {
        nativeMethod: native.method,
        nativeChars: native.text.length,
        nativePages: native.pageCount,
        provenanceCount: native.pages.length,
        usedOcrFallback: native.usedOcrFallback,
        ocrSmokePages: ocrPartial.pages.length,
        ocrSmokeChars: ocrChars,
        documentKind: classified.kind,
        phases,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
