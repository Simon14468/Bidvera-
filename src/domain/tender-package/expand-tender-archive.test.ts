import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError } from "@/lib/errors";
import { ARCHIVE_LIMITS } from "./archive-limits";
import {
  buildStoredZipForTests,
  expandTenderPackageUploads,
  sanitizeArchiveEntryPath,
} from "./expand-tender-archive";
import {
  isAllowedUploadContent,
  isArchiveUploadContent,
  sniffUploadContent,
} from "./upload-content-sniff";

const MINI_PDF = Buffer.from(
  "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n",
);

function asUpload(fileName: string, bytes: Buffer, mimeType = "application/octet-stream") {
  return {
    fileName,
    mimeType,
    fileSize: bytes.byteLength,
    bytes,
  };
}

async function expectValidation(fn: () => Promise<unknown>, messagePart?: RegExp | string) {
  await assert.rejects(fn, (err: unknown) => {
    assert.ok(err instanceof AppError, `expected AppError, got ${String(err)}`);
    assert.equal(err.status, 400);
    if (messagePart) {
      if (typeof messagePart === "string") {
        assert.match(err.message, new RegExp(messagePart, "i"));
      } else {
        assert.match(err.message, messagePart);
      }
    }
    return true;
  });
}

describe("sanitizeArchiveEntryPath", () => {
  it("accepts relative nested paths", () => {
    assert.equal(sanitizeArchiveEntryPath("docs/ITT.pdf"), "docs/ITT.pdf");
    assert.equal(sanitizeArchiveEntryPath("./lot1/spec.pdf"), "lot1/spec.pdf");
  });

  it("rejects path traversal and absolute paths", () => {
    assert.throws(() => sanitizeArchiveEntryPath("../secret.pdf"), AppError);
    assert.throws(() => sanitizeArchiveEntryPath("a/../../b.pdf"), AppError);
    assert.throws(() => sanitizeArchiveEntryPath("/etc/passwd"), AppError);
    assert.throws(() => sanitizeArchiveEntryPath("C:/Windows/x.pdf"), AppError);
  });
});

describe("archive content sniffing", () => {
  it("classifies plain ZIP as archive, not a document", () => {
    const zip = buildStoredZipForTests([{ name: "a.pdf", data: MINI_PDF }]);
    assert.equal(sniffUploadContent(zip).kind, "zip");
    assert.ok(isArchiveUploadContent(zip));
    assert.equal(isAllowedUploadContent(zip), null);
  });

  it("classifies RAR magic as archive", () => {
    const rar = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00, 0xff, 0, 0, 0, 0]);
    assert.equal(sniffUploadContent(rar).kind, "rar");
    assert.ok(isArchiveUploadContent(rar));
    assert.equal(isAllowedUploadContent(rar), null);
  });

  it("keeps DOCX (ZIP + word/) as a document, not an archive", () => {
    const payload = Buffer.from("PK\x03\x04xxxxword/document.xmlrest!!");
    assert.equal(sniffUploadContent(payload).kind, "docx");
    assert.equal(isArchiveUploadContent(payload), null);
    assert.ok(isAllowedUploadContent(payload));
  });

  it("sniffs PNG / JPEG / TXT / CSV", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    assert.equal(sniffUploadContent(png).kind, "png");
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    assert.equal(sniffUploadContent(jpeg).kind, "jpeg");
    const txt = Buffer.from("Eligibility: company must be registered.\n");
    assert.equal(sniffUploadContent(txt, "notes.txt").kind, "txt");
    const csv = Buffer.from("lot,price\n1,100\n");
    assert.equal(sniffUploadContent(csv, "pricing.csv").kind, "csv");
  });

  it("rejects executable bytes even with .pdf name", () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    assert.equal(sniffUploadContent(exe, "virus.pdf").kind, "unknown");
    assert.equal(isAllowedUploadContent(exe, "virus.pdf"), null);
  });
});

describe("expandTenderPackageUploads — ZIP packages", () => {
  it("expands a multi-document ZIP into one flat tender package with provenance", async () => {
    const zip = buildStoredZipForTests([
      { name: "ITT.pdf", data: MINI_PDF },
      { name: "annexes/BoQ.pdf", data: MINI_PDF },
      { name: "readme.txt", data: Buffer.from("ignore optional notes about submission") },
    ]);
    const out = await expandTenderPackageUploads([asUpload("kenya-package.zip", zip)]);
    assert.equal(out.length, 3);
    assert.ok(out.some((f) => f.fileName === "ITT.pdf"));
    assert.ok(out.some((f) => f.fileName === "annexes__BoQ.pdf"));
    assert.ok(out.some((f) => f.fileName === "readme.txt"));
    assert.ok(out.filter((f) => f.mimeType === "application/pdf").length === 2);
  });

  it("expands ZIP containing many supported files as one package", async () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      name: `lot/doc-${i}.pdf`,
      data: MINI_PDF,
    }));
    const zip = buildStoredZipForTests(entries);
    const out = await expandTenderPackageUploads([asUpload("big-pack.zip", zip)]);
    assert.equal(out.length, 12);
    assert.ok(out.every((f) => f.mimeType === "application/pdf"));
    assert.ok(out.every((f) => f.fileName.startsWith("lot__doc-")));
  });

  it("passes through loose PDF uploads unchanged (single-file regression)", async () => {
    const out = await expandTenderPackageUploads([
      asUpload("solo.pdf", MINI_PDF, "application/pdf"),
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.fileName, "solo.pdf");
    assert.equal(out[0]!.mimeType, "application/pdf");
  });

  it("accepts many loose PDFs as one package", async () => {
    const files = Array.from({ length: 8 }, (_, i) =>
      asUpload(`part-${i}.pdf`, MINI_PDF, "application/pdf"),
    );
    const out = await expandTenderPackageUploads(files);
    assert.equal(out.length, 8);
  });

  it("accepts mixed supported loose documents", async () => {
    const out = await expandTenderPackageUploads([
      asUpload("a.pdf", MINI_PDF, "application/pdf"),
      asUpload("notes.txt", Buffer.from("Mandatory registration certificate required.\n"), "text/plain"),
      asUpload("prices.csv", Buffer.from("item,qty\nA,1\n"), "text/csv"),
    ]);
    assert.equal(out.length, 3);
    assert.ok(out.some((f) => f.mimeType === "text/plain"));
    assert.ok(out.some((f) => f.mimeType === "text/csv"));
  });

  it("merges loose files with archive members as one package", async () => {
    const zip = buildStoredZipForTests([{ name: "inside.pdf", data: MINI_PDF }]);
    const out = await expandTenderPackageUploads([
      asUpload("extra.pdf", MINI_PDF, "application/pdf"),
      asUpload("bundle.zip", zip),
    ]);
    assert.equal(out.length, 2);
    assert.ok(out.some((f) => f.fileName === "extra.pdf"));
    assert.ok(out.some((f) => f.fileName === "inside.pdf"));
  });

  it("rejects corrupted ZIP bytes", async () => {
    const junk = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("this is not a valid zip central directory"),
    ]);
    await expectValidation(
      () => expandTenderPackageUploads([asUpload("bad.zip", junk)]),
      /corrupt|unreadable/i,
    );
  });

  it("rejects encrypted ZIP members without password (PASSWORD_REQUIRED)", async () => {
    const zip = buildStoredZipForTests([
      { name: "secret.pdf", data: MINI_PDF, encrypted: true },
    ]);
    await expectValidation(
      () => expandTenderPackageUploads([asUpload("enc.zip", zip)]),
      /password protected/i,
    );
  });

  it("expands nested archives within configured nesting depth", async () => {
    const inner = buildStoredZipForTests([{ name: "a.pdf", data: MINI_PDF }]);
    const outer = buildStoredZipForTests([{ name: "nested.zip", data: inner }]);
    const out = await expandTenderPackageUploads([asUpload("outer.zip", outer)]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.originalFileName, "a.pdf");
    assert.ok(
      out[0]!.provenanceChain?.includes("outer.zip") || out[0]!.archiveFileName === "outer.zip",
    );
  });

  it("rejects nested archives that exceed nesting depth", async () => {
    const leaf = buildStoredZipForTests([{ name: "a.pdf", data: MINI_PDF }]);
    const outer = buildStoredZipForTests([{ name: "leaf.zip", data: leaf }]);
    const { processArchive } = await import("@/domain/universal-intake/archive/process");
    await assert.rejects(
      () =>
        processArchive({
          fileName: "outer.zip",
          bytes: outer,
          limits: { maxNestingDepth: 0 },
        }),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.match(err.message, /nesting depth/i);
        return true;
      },
    );
  });

  it("rejects path traversal entries", async () => {
    const zip = buildStoredZipForTests([{ name: "../evil.pdf", data: MINI_PDF }]);
    await expectValidation(
      () => expandTenderPackageUploads([asUpload("trav.zip", zip)]),
      /traversal|invalid|unreadable|absolute/i,
    );
  });

  it("rejects archives that exceed the max extracted document count", async () => {
    const n = ARCHIVE_LIMITS.maxMembers + 1;
    const entries = Array.from({ length: n }, (_, i) => ({
      name: `doc-${i}.pdf`,
      data: MINI_PDF,
    }));
    const zip = buildStoredZipForTests(entries);
    await expectValidation(
      () => expandTenderPackageUploads([asUpload("too-many.zip", zip)]),
      /maximum of/i,
    );
  });

  it("rejects archives with only unsupported members", async () => {
    const zip = buildStoredZipForTests([
      { name: "notes.md", data: Buffer.from("hello markdown") },
      { name: "photo.bin", data: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]) },
    ]);
    await expectValidation(
      () => expandTenderPackageUploads([asUpload("empty-docs.zip", zip)]),
      /does not contain supported/i,
    );
  });

  it("rejects spoofed extension that is not a real archive or document", async () => {
    await expectValidation(
      () =>
        expandTenderPackageUploads([
          asUpload("fake.zip", Buffer.from("MZ not an archive!!!!"), "application/zip"),
        ]),
      /Package rejected|Unsupported|executable/i,
    );
  });

  it("rejects dangerous executable content inside a ZIP", async () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0, 0, 0, 0]);
    const zip = buildStoredZipForTests([
      { name: "payload.exe", data: exe },
      { name: "cover.pdf", data: MINI_PDF },
    ]);
    await expectValidation(
      () => expandTenderPackageUploads([asUpload("malware.zip", zip)]),
      /dangerous|executable|Package rejected/i,
    );
  });
});

describe("expandTenderPackageUploads — RAR", () => {
  it("rejects corrupted RAR payload after magic-byte detection", async () => {
    const rar = Buffer.alloc(64, 0);
    rar[0] = 0x52;
    rar[1] = 0x61;
    rar[2] = 0x72;
    rar[3] = 0x21;
    rar[4] = 0x1a;
    rar[5] = 0x07;
    rar[6] = 0x00;
    assert.equal(sniffUploadContent(rar).kind, "rar");
    await expectValidation(
      () => expandTenderPackageUploads([asUpload("bad.rar", rar)]),
      /RAR|corrupt|encrypted|unreadable/i,
    );
  });

  it("routes RAR magic through the same package expansion boundary as ZIP", async () => {
    // Successful multi-doc RAR extraction requires a real RAR fixture; routing + rejection
    // prove the canonical boundary treats RAR as a package, not a document.
    const rar = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00, 0x00, 0xff, 0xff]);
    assert.equal(isArchiveUploadContent(rar)?.kind, "rar");
    assert.equal(isAllowedUploadContent(rar), null);
    await expectValidation(() => expandTenderPackageUploads([asUpload("pack.rar", rar)]));
  });
});
