/**
 * PDF extraction production readiness — synthetic fixtures only.
 * Generates PDFs with pdfkit; never uses customer documents.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, describe, it } from "node:test";
import PDFDocument from "pdfkit";
import {
  assessExtractQuality,
  extractDocumentText,
  isPdfEncrypted,
  MIN_USABLE_EXTRACT_CHARS,
} from "@/services/document/extract";
import { terminateOcrWorker } from "@/services/document/pdf-ocr";
import { AppError } from "@/lib/errors";

function pdfBuffer(
  draw: (doc: InstanceType<typeof PDFDocument>) => void,
  opts?: { fontPath?: string },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    if (opts?.fontPath && existsSync(opts.fontPath)) {
      doc.font(opts.fontPath);
    } else {
      doc.font("Helvetica");
    }
    draw(doc);
    doc.end();
  });
}

const WIN_ARABIC_FONT = "C:\\Windows\\Fonts\\arial.ttf";
const hasArabicFont = existsSync(WIN_ARABIC_FONT);

describe("PDF extraction production readiness (synthetic)", () => {
  after(async () => {
    await terminateOcrWorker();
  });

  it("extracts English text PDF with page markers", async () => {
    const buffer = await pdfBuffer((doc) => {
      doc.fontSize(14).text("TENDER NOTICE — English");
      doc.moveDown();
      doc.text("The bidder shall submit a bid bond of 2 percent.");
      doc.text("Submission deadline: 15 June 2026.");
    });
    const t0 = Date.now();
    const result = await extractDocumentText({
      buffer,
      mimeType: "application/pdf",
      fileName: "en-tender.pdf",
      documentId: "syn-en",
    });
    const ms = Date.now() - t0;
    assert.equal(result.method, "pdf-parse");
    assert.equal(result.usedOcrFallback, false);
    assert.ok(result.text.includes("bid bond") || result.text.includes("bidder"));
    assert.ok(result.text.includes("--- Page"));
    assert.ok(result.text.length >= MIN_USABLE_EXTRACT_CHARS);
    const q = assessExtractQuality(result);
    assert.equal(q.quality, "ok");
    assert.ok(ms < 30_000, `EN extract took ${ms}ms`);
  });

  it("extracts French text PDF without corruption", async () => {
    const buffer = await pdfBuffer((doc) => {
      doc.fontSize(14).text("APPEL D'OFFRES — Cahier des charges");
      doc.moveDown();
      doc.text(
        "Le soumissionnaire doit fournir une caution de soumission de deux pour cent.",
      );
      doc.text("Date limite de depot: 15 juin 2026.");
      doc.text("Prescriptions techniques obligatoires pour le marche.");
    });
    const result = await extractDocumentText({
      buffer,
      mimeType: "application/pdf",
      fileName: "fr-ao.pdf",
      documentId: "syn-fr",
    });
    assert.equal(result.method, "pdf-parse");
    assert.ok(
      /soumissionnaire|caution|Prescriptions|OFFRES/i.test(result.text),
      `French markers missing: ${result.text.slice(0, 200)}`,
    );
    assert.ok(!looksCorruptedLatin(result.text));
  });

  it("extracts multi-page PDF in page order", async () => {
    const buffer = await pdfBuffer((doc) => {
      doc.fontSize(14).text("PAGE_ONE_MARKER unique alpha");
      doc.addPage();
      doc.text("PAGE_TWO_MARKER unique beta");
      doc.addPage();
      doc.text("PAGE_THREE_MARKER unique gamma");
    });
    const result = await extractDocumentText({
      buffer,
      mimeType: "application/pdf",
      fileName: "multi.pdf",
      documentId: "syn-multi",
    });
    assert.ok((result.pageCount ?? 0) >= 3);
    const i1 = result.text.indexOf("PAGE_ONE_MARKER");
    const i2 = result.text.indexOf("PAGE_TWO_MARKER");
    const i3 = result.text.indexOf("PAGE_THREE_MARKER");
    assert.ok(i1 >= 0 && i2 > i1 && i3 > i2, "page order incorrect");
    assert.ok(result.pages.length >= 1);
    const pages = result.pages.map((p) => p.page);
    for (let i = 1; i < pages.length; i++) {
      assert.ok(pages[i]! >= pages[i - 1]!, "provenance page order");
    }
  });

  it(
    "extracts Arabic PDF when system Arabic font is available",
    { skip: !hasArabicFont },
    async () => {
      const buffer = await pdfBuffer(
        (doc) => {
          doc.fontSize(16).text("مناقصة — وثيقة تقنية");
          doc.moveDown();
          doc.text("يجب على المتنافس تقديم ضمان مؤقت بنسبة اثنين في المائة.");
          doc.text("آخر أجل لتقديم العروض: 15 يونيو 2026.");
        },
        { fontPath: WIN_ARABIC_FONT },
      );
      const result = await extractDocumentText({
        buffer,
        mimeType: "application/pdf",
        fileName: "ar-tender.pdf",
        documentId: "syn-ar",
      });
      // Native extract should preserve Arabic letters (not mojibake boxes only).
      assert.ok(
        /[\u0600-\u06FF]{3,}/.test(result.text),
        `Arabic letters missing/corrupted: ${result.text.slice(0, 300)}`,
      );
      assert.ok(result.text.length >= MIN_USABLE_EXTRACT_CHARS);
    },
  );

  it(
    "extracts mixed Arabic/French/English when Arabic font available",
    { skip: !hasArabicFont },
    async () => {
      const buffer = await pdfBuffer(
        (doc) => {
          doc.fontSize(12).text("Mixed tender / Appel d'offres / مناقصة");
          doc.text("English: The bidder shall provide a warranty of 24 months.");
          doc.text("Francais: Le soumissionnaire fournit une garantie de 24 mois.");
          doc.text("العربية: يجب تقديم ضمان لمدة 24 شهرا.");
        },
        { fontPath: WIN_ARABIC_FONT },
      );
      const result = await extractDocumentText({
        buffer,
        mimeType: "application/pdf",
        fileName: "mixed-arf.pdf",
        documentId: "syn-mix",
      });
      assert.ok(/bidder|warranty|warranty|24/i.test(result.text));
      assert.ok(/soumissionnaire|garantie/i.test(result.text));
      assert.ok(/[\u0600-\u06FF]{3,}/.test(result.text));
    },
  );

  it("rejects encrypted PDF without false success", async () => {
    const fake = Buffer.from(
      "%PDF-1.7\n1 0 obj\n<< /Encrypt 2 0 R /Type /Catalog >>\nendobj\ntrailer\n%%EOF\n",
      "latin1",
    );
    assert.equal(isPdfEncrypted(fake), true);
    await assert.rejects(
      () =>
        extractDocumentText({
          buffer: fake,
          mimeType: "application/pdf",
          fileName: "enc.pdf",
        }),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).status, 400);
        assert.ok(!(err as AppError).message.includes("at Object."));
        return true;
      },
    );
  });

  it("rejects malformed/corrupted PDF without false success", async () => {
    const corrupt = Buffer.from("%PDF-1.7\nthis is not a valid pdf stream\n", "utf8");
    await assert.rejects(
      () =>
        extractDocumentText({
          buffer: corrupt,
          mimeType: "application/pdf",
          fileName: "corrupt.pdf",
          skipNative: false,
        }),
      (err: unknown) => err instanceof AppError || err instanceof Error,
    );
  });

  it("rejects empty/unusable PDF without marking success", async () => {
    // Minimal valid-ish empty catalog — no extractable text
    const empty = Buffer.from(
      "%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [] /Count 0 >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF\n",
      "latin1",
    );
    await assert.rejects(
      () =>
        extractDocumentText({
          buffer: empty,
          mimeType: "application/pdf",
          fileName: "empty.pdf",
        }),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        const msg = (err as AppError).message;
        assert.ok(/encrypt|corrupt|unreadable|scans|extract/i.test(msg));
        assert.ok(!msg.includes("TypeError"));
        return true;
      },
    );
  });

  it("handles large multi-page synthetic PDF within timeout budget", async () => {
    const buffer = await pdfBuffer((doc) => {
      for (let i = 1; i <= 25; i++) {
        if (i > 1) doc.addPage();
        doc
          .fontSize(11)
          .text(
            `Large synthetic page ${i}. Requirement ${i}: The contractor shall deliver item ${i} with warranty of twelve months and insurance coverage. `.repeat(
              8,
            ),
          );
      }
    });
    assert.ok(buffer.byteLength < 25 * 1024 * 1024);
    const t0 = Date.now();
    const result = await extractDocumentText({
      buffer,
      mimeType: "application/pdf",
      fileName: "large-25p.pdf",
      documentId: "syn-large",
    });
    const ms = Date.now() - t0;
    assert.equal(result.method, "pdf-parse");
    assert.ok((result.pageCount ?? 0) >= 20);
    assert.ok(result.text.includes("Large synthetic page 1"));
    assert.ok(result.text.includes("Large synthetic page 25"));
    assert.ok(ms < 60_000, `large PDF took ${ms}ms`);
  });

  it("OCR fallback path runs when forced (path exists)", async () => {
    const buffer = await pdfBuffer((doc) => {
      doc.fontSize(18).text("OCR PATH PROBE TOKEN ALPHA");
      doc.text("The bidder shall submit technical specifications.");
      doc.text("Mandatory insurance and performance bond required.");
    });
    const t0 = Date.now();
    const result = await extractDocumentText({
      buffer,
      mimeType: "application/pdf",
      fileName: "ocr-probe.pdf",
      documentId: "syn-ocr",
      forceOcr: true,
      skipNative: true,
    });
    const ms = Date.now() - t0;
    assert.equal(result.method, "OCR");
    assert.ok(result.usedOcrFallback || result.method === "OCR");
    assert.ok(result.text.length >= MIN_USABLE_EXTRACT_CHARS);
    // OCR should recover some Latin tokens (engine-dependent spelling).
    assert.ok(
      /bidder|technical|insurance|bond|ALPHA|PATH|PROBE/i.test(result.text),
      `OCR text unexpected: ${result.text.slice(0, 400)}`,
    );
    assert.ok(ms < 180_000, `OCR took ${ms}ms`);
  });

  it("runs concurrent native extractions without cross-contamination", async () => {
    const a = await pdfBuffer((doc) => {
      doc.text("CONCURRENT_DOC_A unique token alpha-only content for isolation.");
      doc.text("Requirement A: warranty twenty four months mandatory.");
    });
    const b = await pdfBuffer((doc) => {
      doc.text("CONCURRENT_DOC_B unique token beta-only content for isolation.");
      doc.text("Requirement B: performance bond two percent required.");
    });
    const [ra, rb] = await Promise.all([
      extractDocumentText({
        buffer: a,
        mimeType: "application/pdf",
        fileName: "a.pdf",
        documentId: "syn-conc-a",
      }),
      extractDocumentText({
        buffer: b,
        mimeType: "application/pdf",
        fileName: "b.pdf",
        documentId: "syn-conc-b",
      }),
    ]);
    assert.ok(ra.text.includes("CONCURRENT_DOC_A"));
    assert.ok(rb.text.includes("CONCURRENT_DOC_B"));
    assert.ok(!ra.text.includes("CONCURRENT_DOC_B"));
    assert.ok(!rb.text.includes("CONCURRENT_DOC_A"));
  });
});

function looksCorruptedLatin(text: string): boolean {
  // High ratio of replacement chars or PDF binary markers in "text"
  if (text.includes("%PDF-")) return true;
  const bad = (text.match(/\uFFFD/g) ?? []).length;
  return bad > 5;
}
