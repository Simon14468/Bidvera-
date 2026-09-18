import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessExtractQuality,
  DOCUMENT_ENCRYPTED_CODE,
  isPdfEncrypted,
  MIN_USABLE_EXTRACT_CHARS,
} from "./extract";
import { looksLikeBinaryGarbage, sanitizeExtractedText } from "./extract-sanitize";

describe("document extract quality & encryption", () => {
  it("detects encrypted PDF markers without decoding as UTF-8 text", () => {
    const fake = Buffer.from(
      "%PDF-1.7\n1 0 obj\n<< /Encrypt 2 0 R /Type /Catalog >>\nendobj\n",
      "latin1",
    );
    assert.equal(isPdfEncrypted(fake), true);
    assert.equal(DOCUMENT_ENCRYPTED_CODE, "DOCUMENT_ENCRYPTED");
  });

  it("does not flag normal PDF headers as encrypted", () => {
    const fake = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n", "latin1");
    assert.equal(isPdfEncrypted(fake), false);
  });

  it("rejects raw PDF binary mistaken for text", () => {
    assert.equal(looksLikeBinaryGarbage("%PDF-1.7 binary junk"), true);
  });

  it("sanitizes nulls but keeps multilingual letters", () => {
    const out = sanitizeExtractedText("Appel d’offres\u0000 صفقة");
    assert.ok(out.includes("Appel"));
    assert.ok(out.includes("صفقة"));
    assert.ok(!out.includes("\u0000"));
  });

  it("marks empty OCR results as unusable", () => {
    const q = assessExtractQuality({
      text: "",
      method: "OCR",
      pageCount: 3,
    });
    assert.equal(q.quality, "empty");
    assert.ok(q.userMessage?.includes("encrypted, corrupted, or contain unreadable scans"));
  });

  it("does not cap sanitized extract at 200k characters", () => {
    const raw = `HEAD ${"Z".repeat(210_000)} TAIL_AFTER_200K`;
    const out = sanitizeExtractedText(raw);
    assert.ok(out.length > 200_000);
    assert.ok(out.includes("TAIL_AFTER_200K"));
  });

  it("accepts substantial native extract", () => {
    const text = "A".repeat(MIN_USABLE_EXTRACT_CHARS + 10);
    const q = assessExtractQuality({
      text,
      method: "pdf-parse",
      pageCount: 1,
    });
    assert.equal(q.quality, "ok");
  });
});
