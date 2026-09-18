/**
 * Universal File Recovery & Readiness — regression tests for all recovery classes.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStoredZipForTests } from "@/domain/tender-package/expand-tender-archive";
import {
  AUTO_REPAIR_USER_MESSAGE,
  recoverDiscoveredFile,
  recoverPdfBytes,
  recoverTextEncoding,
  runUniversalIntake,
  sha256Hex,
} from "@/domain/universal-intake";
import { validateDocumentFormat } from "@/domain/universal-intake/format-validate";

const MINI_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8",
);

function upload(name: string, bytes: Buffer, mime = "application/octet-stream") {
  return { fileName: name, mimeType: mime, fileSize: bytes.byteLength, bytes };
}

describe("File Recovery classes", () => {
  it("READY — clean PDF proceeds without repair", async () => {
    const out = await recoverDiscoveredFile({
      fileId: "f1",
      fileName: "notice.pdf",
      originalName: "notice.pdf",
      mimeType: "application/pdf",
      bytes: MINI_PDF,
    });
    assert.equal(out.report.recoveryClass, "READY");
    assert.equal(out.proceedToStorage, true);
    assert.equal(out.intakeState, "ACCEPTED");
    assert.equal(out.report.ocrRequired, false);
    assert.equal(out.report.originalSha256, sha256Hex(MINI_PDF));
  });

  it("AUTO_RECOVERABLE — strips leading junk before %PDF-", async () => {
    const junk = Buffer.concat([Buffer.from("XXXXX"), MINI_PDF]);
    const out = await recoverDiscoveredFile({
      fileId: "f2",
      fileName: "broken.pdf",
      originalName: "broken.pdf",
      mimeType: "application/pdf",
      bytes: junk,
    });
    assert.equal(out.report.recoveryClass, "AUTO_RECOVERABLE");
    assert.equal(out.proceedToStorage, true);
    assert.ok(out.bytes.subarray(0, 5).toString("ascii") === "%PDF-");
    assert.ok(out.report.recoveredSha256);
    assert.equal(out.report.userMessage, AUTO_REPAIR_USER_MESSAGE);
    assert.ok(out.report.attempts.some((a) => a.method === "STRIP_PDF_LEADING_JUNK" && a.success));
  });

  it("AUTO_RECOVERABLE — trims trailing junk after %%EOF", async () => {
    const dirty = Buffer.concat([MINI_PDF, Buffer.from("\nGARBAGE_TRAILER_BYTES")]);
    const probe = recoverPdfBytes("x.pdf", dirty);
    assert.ok(probe.repairedBytes);
    assert.ok(probe.attempts.some((a) => a.method === "TRIM_PDF_TRAILING_JUNK"));
  });

  it("AUTO_RECOVERABLE — scanned/image-only PDF schedules OCR (forceOcr)", async () => {
    // Synthetic image-only PDF sample (no text operators, has Image XObject)
    const scanned = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/XObject/Subtype/Image/Width 10/Height 10>>endobj\ntrailer\n%%EOF\n" +
        "X".repeat(3000),
      "utf8",
    );
    // Ensure header at start
    const body = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.from("/Image /XObject stream\n"),
      Buffer.alloc(2500, 0),
      Buffer.from("\n%%EOF\n"),
    ]);
    const out = await recoverDiscoveredFile({
      fileId: "f3",
      fileName: "scan.pdf",
      originalName: "scan.pdf",
      mimeType: "application/pdf",
      bytes: body,
    });
    assert.equal(out.report.recoveryClass, "AUTO_RECOVERABLE");
    assert.equal(out.report.ocrRequired, true);
    assert.equal(out.report.forceOcr, true);
    assert.equal(out.report.ocrUsed, false); // scheduled, not executed by default
    assert.equal(out.readiness, "NEEDS_OCR");
    assert.ok(out.report.userMessage);
    void scanned;
  });

  it("AUTO_RECOVERABLE — OCR execution path with injectable runner + low confidence flag", async () => {
    const body = Buffer.concat([
      Buffer.from("%PDF-1.4\n/Image /XObject\n"),
      Buffer.alloc(2500, 1),
      Buffer.from("\n%%EOF\n"),
    ]);
    const out = await recoverDiscoveredFile({
      fileId: "f4",
      fileName: "scan.pdf",
      originalName: "scan.pdf",
      mimeType: "application/pdf",
      bytes: body,
      executeOcrAtIntake: true,
      ocrRunner: async () => ({
        text: "Eligibility criteria apply.",
        pageCount: 1,
        pages: [{ page: 1, text: "Eligibility criteria apply.", confidence: 40, charCount: 28 }],
        meanConfidence: 40,
      }),
    });
    assert.equal(out.report.ocrUsed, true);
    assert.equal(out.report.extractionQuality, "ocr_low_confidence");
    assert.ok(out.report.warnings.some((w) => /low/i.test(w)));
    assert.ok(out.derivedOcrText?.includes("Eligibility"));
    assert.equal(out.report.derived?.kind, "ocr_text");
  });

  it("USER_ACTION_REQUIRED — encrypted PDF does not invent content", async () => {
    const enc = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Encrypt 2 0 R>>endobj\ntrailer<</Encrypt 2 0 R>>\n%%EOF\n" +
        "Y".repeat(100),
      "utf8",
    );
    const out = await recoverDiscoveredFile({
      fileId: "f5",
      fileName: "locked.pdf",
      originalName: "locked.pdf",
      mimeType: "application/pdf",
      bytes: enc,
    });
    assert.equal(out.report.recoveryClass, "USER_ACTION_REQUIRED");
    assert.equal(out.proceedToStorage, false);
    assert.equal(out.intakeState, "PASSWORD_PROTECTED");
    assert.ok(out.report.userActionRequired);
    assert.match(out.report.userActionRequired!, /password|encrypted|unlocked/i);
  });

  it("UNSUPPORTED — unknown binary rejected", async () => {
    const out = await recoverDiscoveredFile({
      fileId: "f6",
      fileName: "weird.dat",
      originalName: "weird.dat",
      mimeType: "application/octet-stream",
      bytes: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
    });
    assert.equal(out.report.recoveryClass, "UNSUPPORTED");
    assert.equal(out.proceedToStorage, false);
  });

  it("CORRUPTED_UNRECOVERABLE — PDF extension without PDF magic", async () => {
    const out = await recoverDiscoveredFile({
      fileId: "f7",
      fileName: "fake.pdf",
      originalName: "fake.pdf",
      mimeType: "application/pdf",
      bytes: Buffer.from("This is not a PDF file at all!!!!!!!!!!!"),
    });
    assert.equal(out.report.recoveryClass, "CORRUPTED_UNRECOVERABLE");
    assert.equal(out.proceedToStorage, false);
    assert.equal(out.intakeState, "CORRUPTED");
  });

  it("SECURITY_BLOCKED — via intake for PE bytes", async () => {
    const pe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const result = await runUniversalIntake([upload("virus.exe", pe)]);
    assert.equal(result.mayProceedToStorage, false);
    assert.ok(result.intake.files.some((f) => f.state === "REJECTED_DANGEROUS"));
    assert.ok(
      result.intake.files.some(
        (f) => f.recovery?.recoveryClass === "SECURITY_BLOCKED" || f.state === "REJECTED_DANGEROUS",
      ),
    );
  });

  it("AUTO_RECOVERABLE — text UTF-8 BOM stripped without inventing content", () => {
    const withBom = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("Mandatory registration required.\n"),
    ]);
    const rec = recoverTextEncoding(withBom);
    assert.ok(rec.repairedBytes);
    assert.equal(rec.repairedBytes!.toString("utf8"), "Mandatory registration required.\n");
  });

  it("AUTO_RECOVERABLE — misleading extension corrected from sniff", async () => {
    const out = await recoverDiscoveredFile({
      fileId: "f8",
      fileName: "notice.bin",
      originalName: "notice.bin",
      mimeType: "application/octet-stream",
      bytes: MINI_PDF,
    });
    assert.equal(out.report.recoveryClass, "AUTO_RECOVERABLE");
    assert.ok(out.displayName.toLowerCase().endsWith(".pdf"));
    assert.ok(
      out.report.attempts.some((a) => a.method === "CORRECT_EXTENSION_FROM_SNIFF" && a.success),
    );
  });

  it("partial package — valid PDF proceeds while corrupted peer is marked", async () => {
    const result = await runUniversalIntake([
      upload("good.pdf", MINI_PDF, "application/pdf"),
      upload("bad.pdf", Buffer.from("not-a-pdf!!!!!!!!!!"), "application/pdf"),
    ]);
    assert.equal(result.mayProceedToStorage, true);
    assert.ok((result.intake.proceedableFileCount ?? result.intake.acceptedFileCount) >= 1);
    assert.ok(
      result.intake.corruptedFileCount >= 1 ||
        result.intake.files.some(
          (f) =>
            f.state === "CORRUPTED" ||
            f.state === "REJECTED_SPOOFED_EXTENSION" ||
            f.state === "REJECTED_UNSUPPORTED" ||
            f.recovery?.recoveryClass === "CORRUPTED_UNRECOVERABLE" ||
            f.recovery?.recoveryClass === "UNSUPPORTED",
        ),
    );
  });

  it("intake surfaces non-blocking auto-repair user notice", async () => {
    const junk = Buffer.concat([Buffer.from("NOISE"), MINI_PDF]);
    const result = await runUniversalIntake([upload("fixed.pdf", junk, "application/pdf")]);
    assert.equal(result.mayProceedToStorage, true);
    assert.ok(
      result.intake.userNotices.some((n) => /repaired it automatically/i.test(n)) ||
        result.intake.files.some((f) => f.recovery?.userMessage === AUTO_REPAIR_USER_MESSAGE),
    );
    assert.ok(result.intake.files[0]?.recovery?.originalSha256);
  });

  it("duplicate filenames recorded as recovery rename", async () => {
    const zip = buildStoredZipForTests([
      { name: "same.pdf", data: MINI_PDF },
      { name: "folder/same.pdf", data: MINI_PDF },
    ]);
    const result = await runUniversalIntake([upload("dup.zip", zip)]);
    assert.equal(result.mayProceedToStorage, true);
    assert.ok(
      result.intake.files.some(
        (f) =>
          f.warningCodes.includes("DUPLICATE_FILENAME_RENAMED") ||
          f.recovery?.attempts.some((a) => a.method === "RENAME_DUPLICATE"),
      ),
    );
  });

  it("format-validate remains available for OCR-likely soft path", () => {
    const body = Buffer.concat([
      Buffer.from("%PDF-1.4\n/Image /XObject\nBT\n"), // has text ops → not OCR likely via old helper
      Buffer.alloc(100),
      Buffer.from("\n%%EOF\n"),
    ]);
    const v = validateDocumentFormat("x.pdf", body, "pdf");
    assert.equal(v.ok, true);
  });

  it("OOXML missing PK is CORRUPTED_UNRECOVERABLE", async () => {
    const out = await recoverDiscoveredFile({
      fileId: "f9",
      fileName: "broken.docx",
      originalName: "broken.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: Buffer.from("not-a-zip-container-at-all"),
    });
    assert.equal(out.report.recoveryClass, "CORRUPTED_UNRECOVERABLE");
    assert.equal(out.proceedToStorage, false);
  });
});
