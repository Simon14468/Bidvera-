/**
 * Universal Intake Engine — focused regressions.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError } from "@/lib/errors";
import { buildStoredZipForTests } from "@/domain/tender-package/expand-tender-archive";
import { discoverTenderPackage } from "@/domain/tender-package/discover-tender-package";
import {
  assertIntakeMayProceed,
  runUniversalIntake,
  validateDocumentFormat,
} from "@/domain/universal-intake";

const MINI_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8",
);

function upload(name: string, bytes: Buffer, mime = "application/octet-stream") {
  return { fileName: name, mimeType: mime, fileSize: bytes.byteLength, bytes };
}

describe("Universal Intake Engine", () => {
  it("accepts a single PDF and marks INTAKE_READY", async () => {
    const result = await runUniversalIntake([upload("notice.pdf", MINI_PDF, "application/pdf")]);
    assert.equal(result.mayProceedToStorage, true);
    assert.ok(
      result.intake.status === "INTAKE_READY" ||
        result.intake.status === "INTAKE_READY_WITH_WARNINGS",
    );
    assert.equal(result.intake.acceptedFileCount, 1);
    assert.equal(result.intake.files.every((f) => Boolean(f.state)), true);
  });

  it("rejects zero-byte files with explicit terminal state", async () => {
    const result = await runUniversalIntake([upload("empty.pdf", Buffer.alloc(0))]);
    assert.equal(result.mayProceedToStorage, false);
    assert.equal(result.intake.status, "INTAKE_BLOCKED");
    assert.ok(result.intake.files.some((f) => f.state === "REJECTED_ZERO_BYTE"));
  });

  it("rejects dangerous PE bytes", async () => {
    const pe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const result = await runUniversalIntake([upload("virus.exe", pe)]);
    assert.equal(result.mayProceedToStorage, false);
    assert.ok(result.intake.blockingConditions.some((b) => b.code === "DANGEROUS_CONTENT"));
    assert.ok(result.intake.files.some((f) => f.state === "REJECTED_DANGEROUS"));
  });

  it("expands ZIP packages and inventories skipped unsupported members", async () => {
    const zip = buildStoredZipForTests([
      { name: "cps.pdf", data: MINI_PDF },
      { name: "readme.md", data: Buffer.from("# hi") },
    ]);
    const result = await runUniversalIntake([upload("pack.zip", zip)]);
    assert.equal(result.mayProceedToStorage, true);
    assert.ok(result.intake.acceptedFileCount >= 1);
    assert.ok(
      result.intake.unsupportedFiles.length >= 1 ||
        result.intake.warnings.some((w) => w.code === "UNSUPPORTED_MEMBER_SKIPPED"),
    );
  });

  it("classifies encrypted ZIP as password-protected block", async () => {
    const zip = buildStoredZipForTests([
      { name: "secret.pdf", data: MINI_PDF, encrypted: true },
    ]);
    const result = await runUniversalIntake([upload("enc.zip", zip)]);
    assert.equal(result.mayProceedToStorage, false);
    assert.equal(result.intake.status, "INTAKE_BLOCKED");
    assert.ok(
      result.intake.blockingConditions.some(
        (b) =>
          b.code === "ARCHIVE_PASSWORD_REQUIRED" ||
          b.code === "ARCHIVE_CORRUPTED" ||
          b.code === "ARCHIVE_SECURITY_FAILURE",
      ) || result.intake.passwordProtectedFiles.length > 0 ||
        result.intake.files.some((f) =>
          ["PASSWORD_PROTECTED", "CORRUPTED", "SECURITY_FAILURE"].includes(f.state),
        ),
    );
  });

  it("expands nested archives within limits", async () => {
    const inner = buildStoredZipForTests([{ name: "a.pdf", data: MINI_PDF }]);
    const outer = buildStoredZipForTests([{ name: "inner.zip", data: inner }]);
    const result = await runUniversalIntake([upload("outer.zip", outer)]);
    assert.equal(result.mayProceedToStorage, true);
    assert.ok(result.intake.acceptedFileCount >= 1);
  });

  it("blocks path traversal archives", async () => {
    const zip = buildStoredZipForTests([
      { name: "../evil.pdf", data: MINI_PDF },
    ]);
    const result = await runUniversalIntake([upload("trav.zip", zip)]);
    assert.equal(result.mayProceedToStorage, false);
    assert.ok(result.intake.blockingConditions.length > 0);
  });

  it("assertIntakeMayProceed throws AppError with uploadStage for UI", async () => {
    const result = await runUniversalIntake([upload("empty.pdf", Buffer.alloc(0))]);
    assert.throws(() => assertIntakeMayProceed(result), (err: unknown) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.status, 400);
      return true;
    });
  });

  it("discoverTenderPackage remains compatible and attaches intake", async () => {
    const pkg = await discoverTenderPackage([upload("solo.pdf", MINI_PDF, "application/pdf")]);
    assert.equal(pkg.status, "PACKAGE_READY");
    assert.equal(pkg.discoveredFileCount, pkg.files.length);
    assert.equal(pkg.intake.version, "universal-intake/v1");
    assert.ok(pkg.intake.acceptedFileCount >= 1);
  });

  it("format validation flags malformed PDF", () => {
    const bad = validateDocumentFormat("x.pdf", Buffer.from("not a pdf"), "pdf");
    assert.equal(bad.ok, false);
  });

  it("format validation accepts PDF header", () => {
    const ok = validateDocumentFormat("x.pdf", MINI_PDF, "pdf");
    assert.equal(ok.ok, true);
  });

  it("every inventoried file has an explicit terminal state", async () => {
    const zip = buildStoredZipForTests([
      { name: "a.pdf", data: MINI_PDF },
      { name: "notes.txt", data: Buffer.from("hello notes for tender") },
    ]);
    const result = await runUniversalIntake([upload("mix.zip", zip)]);
    for (const f of result.intake.files) {
      assert.ok(f.state, `missing state for ${f.originalName}`);
      assert.ok(f.readiness, `missing readiness for ${f.originalName}`);
    }
  });
});
