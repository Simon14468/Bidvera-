import assert from "node:assert/strict";
import { describe, it } from "node:test";
import PDFDocument from "pdfkit";
import {
  detectScriptsInText,
  registerPdfFonts,
} from "@/services/reports/premium-pdf-fonts";

describe("premium PDF fonts — script-aware registration", () => {
  it("detects only latin for FR/EN report text", () => {
    const scripts = detectScriptsInText(
      "The bidder shall submit ISO 9001. Fourniture et installation.",
    );
    assert.deepEqual([...scripts], ["latin"]);
  });

  it("detects Arabic without treating it as CJK", () => {
    const scripts = detectScriptsInText("يجب على العارض تقديم شهادة ISO 9001");
    assert.ok(scripts.has("latin"));
    assert.ok(scripts.has("arabic"));
    assert.equal(scripts.has("cjk"), false);
  });

  it("detects CJK when Han characters are present", () => {
    const scripts = detectScriptsInText("投标人应提交ISO 9001证书");
    assert.ok(scripts.has("cjk"));
  });

  it("latin-only registration does not bind Arabic or CJK faces", () => {
    const doc = new PDFDocument({ size: "A4" });
    const registry = registerPdfFonts(doc, detectScriptsInText("Submit the bid form."));
    assert.equal(registry.arabic.regular, registry.latin.regular);
    assert.equal(registry.cjk.regular, registry.latin.regular);
    doc.end();
  });

  it("Arabic text binds Arabic faces and still skips CJK", () => {
    const doc = new PDFDocument({ size: "A4" });
    const registry = registerPdfFonts(
      doc,
      detectScriptsInText("يجب التحقق من الضمان"),
    );
    assert.equal(registry.arabic.regular, "Bidvera-Arabic");
    assert.equal(registry.cjk.regular, registry.latin.regular);
    doc.end();
  });
});
