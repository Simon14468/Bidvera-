import assert from "node:assert/strict";
import { describe, it } from "node:test";
import PDFDocument from "pdfkit";
import { registerAllPdfFonts } from "@/services/reports/premium-pdf-fonts";
import { PDF_LAYOUT } from "@/services/reports/premium-pdf-theme";
import {
  extractArabicWords,
  logicalLineToVisual,
  normalizeForSemanticCompare,
  paragraphDirection,
  pdfTextBlockPaginated,
  shapeLogicalText,
} from "@/services/reports/premium-pdf-text";

describe("premium PDF text — Arabic shaping & bidi", () => {
  it("preserves French and English when shaping mixed logical text", () => {
    const input =
      "Fourniture et installation — équipement audiovisuel / توريد وتركيب";
    const shaped = shapeLogicalText(input);
    assert.ok(shaped.includes("équipement"));
    assert.ok(shaped.includes("Fourniture"));
    assert.ok(/[\uFB50-\uFDFF\uFE70-\uFEFF]/.test(shaped));
  });

  it("uses RTL paragraph direction for Arabic UI locale labels", () => {
    assert.equal(paragraphDirection("3 متطلبات · 1 جاهز", "ar"), "rtl");
    assert.equal(paragraphDirection("Verify warranty coverage", "ar"), "ltr");
    assert.equal(
      paragraphDirection("L'installation et la livraison — خطة", "fr"),
      "ltr",
    );
  });

  it("keeps Arabic words semantically intact through shape + bidi roundtrip", () => {
    const samples = [
      "تقرير قرار بيدفراء",
      "يجب التحقق من الضمان",
      "وزارة التربية",
      "يحتاج تحقق",
    ];
    for (const sample of samples) {
      const shaped = shapeLogicalText(sample);
      const visualRtl = logicalLineToVisual(sample, "rtl");
      const wordsBefore = extractArabicWords(sample);
      const wordsAfter = extractArabicWords(
        normalizeForSemanticCompare(`${shaped} ${visualRtl}`),
      );
      for (const w of wordsBefore) {
        assert.ok(
          wordsAfter.some((x) => x.includes(w) || w.includes(x)),
          `lost Arabic word "${w}" in pipeline`,
        );
      }
    }
  });

  it("orders mixed English label + Arabic value correctly under RTL", () => {
    const visual = logicalLineToVisual("REVIEW : التوصية", "rtl");
    assert.ok(visual.includes("REVIEW"));
    assert.match(visual, /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/);
  });

  it("pdfTextBlockPaginated breaks long text across pages without leaving doc.y past content bottom", () => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
    const registry = registerAllPdfFonts(doc);
    doc.y = PDF_LAYOUT.contentBottom - 20;
    const ctx = {
      doc,
      registry,
      contentBottom: PDF_LAYOUT.contentBottom,
      pageCount: 1,
    };
    const longText = Array.from({ length: 80 }, (_, i) => `Line ${i + 1} of paginated body text.`).join(
      " ",
    );
    pdfTextBlockPaginated(ctx, longText, PDF_LAYOUT.marginX, doc.y, {
      width: PDF_LAYOUT.contentWidth,
      fontSize: 10,
      lineGap: 2,
    });
    assert.ok(ctx.pageCount >= 2, "long text should span multiple pages");
    assert.ok(
      doc.y <= PDF_LAYOUT.contentBottom + 1,
      `doc.y ${doc.y} should stay within content band on final page`,
    );
  });
});
