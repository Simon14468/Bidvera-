/**
 * Canonical Archive Processing — comprehensive security & password tests.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { AppError } from "@/lib/errors";
import {
  buildEncryptedZipForTests,
  buildStoredZipForTests,
  expandTenderPackageUploads,
  expandTenderPackageUploadsWithSkips,
} from "@/domain/tender-package/expand-tender-archive";
import { processArchive } from "@/domain/universal-intake/archive/process";
import { redactSecretsForLog } from "@/domain/universal-intake/archive/security";

const MINI_PDF = Buffer.from(
  "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n",
);

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

function asUpload(fileName: string, bytes: Buffer, mimeType = "application/octet-stream") {
  return { fileName, mimeType, fileSize: bytes.byteLength, bytes };
}

function loadFixture(name: string): Buffer {
  return fs.readFileSync(path.join(FIXTURES, name));
}

/** Stored ZIP with Unix symlink mode in external attributes. */
function buildSymlinkZip(name: string, target: Buffer): Buffer {
  const nameBuf = Buffer.from(name, "utf8");
  const data = target;
  const local = Buffer.alloc(30 + nameBuf.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0, 12);
  // crc
  let c = ~0;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]!;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  const crc = ~c >>> 0;
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  nameBuf.copy(local, 30);
  const localFull = Buffer.concat([local, data]);

  const central = Buffer.alloc(46 + nameBuf.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  // Unix symlink: S_IFLNK (0xa000) in high 16 bits of external attrs
  central.writeUInt32LE(0xa0000000, 38);
  central.writeUInt32LE(0, 42);
  nameBuf.copy(central, 46);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(localFull.length, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localFull, central, end]);
}

/** Deflated ZIP entry with extreme compression ratio (zip bomb pattern). */
function buildBombZip(): Buffer {
  const uncompressed = Buffer.alloc(200_000, 0x00);
  const compressed = deflateRawSync(uncompressed);
  assert.ok(uncompressed.length / Math.max(compressed.length, 1) > 100);

  const nameBuf = Buffer.from("zeros.pdf", "utf8");
  // Pretend PDF magic at start so content would look document-like if extracted
  uncompressed[0] = 0x25;
  uncompressed[1] = 0x50;
  uncompressed[2] = 0x44;
  uncompressed[3] = 0x46;
  const recompressed = deflateRawSync(uncompressed);

  let c = ~0;
  for (let i = 0; i < uncompressed.length; i++) {
    c ^= uncompressed[i]!;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  const crc = ~c >>> 0;

  const local = Buffer.alloc(30 + nameBuf.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(recompressed.length, 18);
  local.writeUInt32LE(uncompressed.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  nameBuf.copy(local, 30);
  const localFull = Buffer.concat([local, recompressed]);

  const central = Buffer.alloc(46 + nameBuf.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(recompressed.length, 20);
  central.writeUInt32LE(uncompressed.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(0, 42);
  nameBuf.copy(central, 46);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(localFull.length, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localFull, central, end]);
}

describe("Archive Processing — normal ZIP", () => {
  it("extracts multi-document ZIP with provenance", async () => {
    const zip = buildStoredZipForTests([
      { name: "ITT.pdf", data: MINI_PDF },
      { name: "notes.txt", data: Buffer.from("Mandatory registration required.\n") },
    ]);
    const out = await expandTenderPackageUploads([asUpload("pack.zip", zip)]);
    assert.equal(out.length, 2);
    assert.ok(out.every((f) => f.archiveFileName === "pack.zip"));
  });
});

describe("Archive Processing — normal RAR", () => {
  it("extracts supported members from a real RAR fixture (ratio override)", async () => {
    const rar = loadFixture("FolderTest.rar");
    const result = await processArchive({
      fileName: "FolderTest.rar",
      bytes: rar,
      limits: { maxCompressionRatio: 250 },
    });
    assert.ok(result.status === "EXTRACTED" || result.status === "PARTIAL_RECOVERY");
    assert.ok(result.members.length >= 1);
    assert.ok(result.members.some((m) => m.path.includes("2中文.txt")));
  });
});

describe("Archive Processing — encrypted ZIP", () => {
  it("marks PASSWORD_REQUIRED without continuing extraction", async () => {
    const zip = buildEncryptedZipForTests([{ name: "secret.pdf", data: MINI_PDF }], "s3cret");
    const result = await processArchive({ fileName: "enc.zip", bytes: zip });
    assert.equal(result.status, "PASSWORD_REQUIRED");
    assert.equal(result.members.length, 0);
    assert.match(result.userMessage ?? "", /password protected/i);
  });

  it("continues with correct ephemeral password", async () => {
    const zip = buildEncryptedZipForTests([{ name: "secret.pdf", data: MINI_PDF }], "s3cret");
    const out = await expandTenderPackageUploads([asUpload("enc.zip", zip)], {
      passwordsByFileName: { "enc.zip": "s3cret" },
    });
    assert.equal(out.length, 1);
    assert.equal(out[0]!.originalFileName, "secret.pdf");
  });

  it("returns WRONG_PASSWORD without corrupting retryability", async () => {
    const zip = buildEncryptedZipForTests([{ name: "secret.pdf", data: MINI_PDF }], "s3cret");
    const wrong = await processArchive({
      fileName: "enc.zip",
      bytes: zip,
      password: "nope",
    });
    assert.equal(wrong.status, "WRONG_PASSWORD");
    const again = await processArchive({
      fileName: "enc.zip",
      bytes: zip,
      password: "s3cret",
    });
    assert.equal(again.status, "EXTRACTED");
    assert.equal(again.members.length, 1);
  });
});

describe("Archive Processing — encrypted RAR", () => {
  it("requires password for HeaderEnc1234.rar", async () => {
    const rar = loadFixture("HeaderEnc1234.rar");
    const result = await processArchive({ fileName: "HeaderEnc1234.rar", bytes: rar });
    assert.equal(result.status, "PASSWORD_REQUIRED");
  });

  it("extracts with correct password", async () => {
    const rar = loadFixture("HeaderEnc1234.rar");
    const out = await expandTenderPackageUploads([asUpload("HeaderEnc1234.rar", rar)], {
      passwordsByFileName: { "HeaderEnc1234.rar": "1234" },
    });
    assert.ok(out.length >= 1);
    assert.ok(out.every((f) => f.source === "rar"));
  });

  it("rejects wrong password and allows retry", async () => {
    const rar = loadFixture("HeaderEnc1234.rar");
    const wrong = await processArchive({
      fileName: "HeaderEnc1234.rar",
      bytes: rar,
      password: "bad",
    });
    assert.equal(wrong.status, "WRONG_PASSWORD");
    const ok = await processArchive({
      fileName: "HeaderEnc1234.rar",
      bytes: rar,
      password: "1234",
    });
    assert.ok(ok.status === "EXTRACTED" || ok.status === "PARTIAL_RECOVERY");
    assert.ok(ok.members.length >= 1);
  });
});

describe("Archive Processing — nested / corrupted / security", () => {
  it("recursively expands nested ZIP with provenance chain", async () => {
    const inner = buildStoredZipForTests([{ name: "deep.pdf", data: MINI_PDF }]);
    const outer = buildStoredZipForTests([{ name: "inner.zip", data: inner }]);
    const out = await expandTenderPackageUploads([asUpload("outer.zip", outer)]);
    assert.equal(out.length, 1);
    assert.deepEqual(out[0]!.provenanceChain, ["outer.zip", "inner.zip"]);
  });

  it("marks corrupted archive as CORRUPTED", async () => {
    const junk = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("not-a-zip"),
    ]);
    const result = await processArchive({ fileName: "bad.zip", bytes: junk });
    assert.equal(result.status, "CORRUPTED");
  });

  it("rejects archive bombs by compression ratio", async () => {
    const bomb = buildBombZip();
    await assert.rejects(
      () => expandTenderPackageUploads([asUpload("bomb.zip", bomb)]),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.match(err.message, /compression ratio|bomb/i);
        return true;
      },
    );
  });

  it("rejects path traversal", async () => {
    const zip = buildStoredZipForTests([{ name: "../evil.pdf", data: MINI_PDF }]);
    await assert.rejects(() => expandTenderPackageUploads([asUpload("t.zip", zip)]), AppError);
  });

  it("rejects symlinks", async () => {
    const zip = buildSymlinkZip("link.pdf", MINI_PDF);
    await assert.rejects(
      () => expandTenderPackageUploads([asUpload("sym.zip", zip)]),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.match(err.message, /symbolic link/i);
        return true;
      },
    );
  });

  it("rejects executable payloads", async () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0, 0, 0, 0]);
    const zip = buildStoredZipForTests([
      { name: "payload.exe", data: exe },
      { name: "cover.pdf", data: MINI_PDF },
    ]);
    await assert.rejects(() => expandTenderPackageUploads([asUpload("m.zip", zip)]), AppError);
  });

  it("accepts large packages under configurable file-count limit", async () => {
    const entries = Array.from({ length: 40 }, (_, i) => ({
      name: `doc-${i}.pdf`,
      data: MINI_PDF,
    }));
    const zip = buildStoredZipForTests(entries);
    const out = await expandTenderPackageUploads([asUpload("large.zip", zip)]);
    assert.equal(out.length, 40);
  });

  it("renames duplicate filenames with provenance", async () => {
    const zip = buildStoredZipForTests([
      { name: "same.pdf", data: MINI_PDF },
      { name: "folder/same.pdf", data: MINI_PDF },
    ]);
    const { files } = await expandTenderPackageUploadsWithSkips([asUpload("dup.zip", zip)]);
    assert.equal(files.length, 2);
    assert.notEqual(files[0]!.fileName, files[1]!.fileName);
  });

  it("skips unsupported members while keeping valid documents (mixed)", async () => {
    const zip = buildStoredZipForTests([
      { name: "ok.pdf", data: MINI_PDF },
      { name: "notes.md", data: Buffer.from("# markdown") },
      { name: "readme.txt", data: Buffer.from("Eligibility criteria apply.\n") },
    ]);
    const { files, skipped } = await expandTenderPackageUploadsWithSkips([
      asUpload("mixed.zip", zip),
    ]);
    assert.equal(files.length, 2);
    assert.ok(skipped.length >= 1);
    assert.ok(skipped.every((s) => s.status === "UNSUPPORTED_SKIPPED"));
  });

  it("never redacts by leaking password fields into logs", () => {
    const redacted = redactSecretsForLog({
      password: "super-secret",
      fileName: "enc.zip",
      nested: { passwd: "x", ok: 1 },
    }) as Record<string, unknown>;
    assert.equal(redacted.password, "[redacted]");
    assert.equal((redacted.nested as Record<string, unknown>).passwd, "[redacted]");
    assert.equal((redacted.nested as Record<string, unknown>).ok, 1);
  });
});
