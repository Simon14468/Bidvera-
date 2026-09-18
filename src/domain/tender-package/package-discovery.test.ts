import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError } from "@/lib/errors";
import { mapWithConcurrency } from "@/lib/concurrency";
import { UPLOAD_LIMITS } from "@/config/server";
import { ARCHIVE_LIMITS } from "./archive-limits";
import { discoverTenderPackage, assertPackageInventoryComplete } from "./discover-tender-package";
import { buildStoredZipForTests } from "./expand-tender-archive";

const MINI_PDF = Buffer.from(
  "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n",
);

function upload(name: string, bytes: Buffer, mime = "application/octet-stream") {
  return { fileName: name, mimeType: mime, fileSize: bytes.byteLength, bytes };
}

describe("package discovery — A–P", () => {
  it("A — single PDF discovers exactly 1 file", async () => {
    const pkg = await discoverTenderPackage([upload("solo.pdf", MINI_PDF, "application/pdf")]);
    assert.equal(pkg.discoveredFileCount, 1);
    assert.equal(pkg.files.length, 1);
    assert.equal(pkg.inventory.length, 1);
    assert.equal(pkg.status, "PACKAGE_READY");
    assert.equal(pkg.inventory[0]!.originalFileName, "solo.pdf");
    assert.equal(pkg.inventory[0]!.source, "loose");
  });

  it("B — long PDF still discovers exactly 1 file", async () => {
    const long = Buffer.concat([MINI_PDF, Buffer.alloc(200_000, 0x20), Buffer.from("\n%%EOF\n")]);
    long[0] = 0x25;
    long[1] = 0x50;
    long[2] = 0x44;
    long[3] = 0x46;
    const pkg = await discoverTenderPackage([upload("long.pdf", long)]);
    assert.equal(pkg.discoveredFileCount, 1);
    assert.equal(pkg.files[0]!.fileSize, long.byteLength);
  });

  it("C — multiple loose files", async () => {
    const pkg = await discoverTenderPackage([
      upload("a.pdf", MINI_PDF),
      upload("b.pdf", MINI_PDF),
      upload("c.txt", Buffer.from("Mandatory certificate required.\n"), "text/plain"),
    ]);
    assert.equal(pkg.discoveredFileCount, 3);
    assert.equal(pkg.discoveredFileCount, pkg.files.length);
  });

  it("D — ZIP with 3 files", async () => {
    const zip = buildStoredZipForTests([
      { name: "ITT.pdf", data: MINI_PDF },
      { name: "CPS.pdf", data: MINI_PDF },
      { name: "annex/BoQ.pdf", data: MINI_PDF },
    ]);
    const pkg = await discoverTenderPackage([upload("pack.zip", zip)]);
    assert.equal(pkg.discoveredFileCount, 3);
    assert.ok(pkg.inventory.every((f) => f.source === "zip"));
    assert.ok(pkg.inventory.some((f) => f.archivePath === "annex/BoQ.pdf"));
  });

  it("E — ZIP with 20 files", async () => {
    const zip = buildStoredZipForTests(
      Array.from({ length: 20 }, (_, i) => ({ name: `d${i}.pdf`, data: MINI_PDF })),
    );
    const pkg = await discoverTenderPackage([upload("20.zip", zip)]);
    assert.equal(pkg.discoveredFileCount, 20);
    assert.equal(pkg.inventory.length, 20);
  });

  it("F — ZIP with 100 files (package max)", async () => {
    assert.equal(UPLOAD_LIMITS.maxFilesPerPackage, 100);
    assert.equal(ARCHIVE_LIMITS.maxMembers, 100);
    const zip = buildStoredZipForTests(
      Array.from({ length: 100 }, (_, i) => ({ name: `f${i}.pdf`, data: MINI_PDF })),
    );
    const pkg = await discoverTenderPackage([upload("100.zip", zip)]);
    assert.equal(pkg.discoveredFileCount, 100);
  });

  it("G — ZIP with 101 files is rejected (PACKAGE_LIMIT_EXCEEDED)", async () => {
    const zip = buildStoredZipForTests(
      Array.from({ length: 101 }, (_, i) => ({ name: `f${i}.pdf`, data: MINI_PDF })),
    );
    await assert.rejects(
      () => discoverTenderPackage([upload("101.zip", zip)]),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err.details as { uploadStage?: string })?.uploadStage, "PACKAGE_LIMIT_EXCEEDED");
        return true;
      },
    );
  });

  it("H — mixed supported formats", async () => {
    const pkg = await discoverTenderPackage([
      upload("a.pdf", MINI_PDF),
      upload("n.txt", Buffer.from("Eligibility rules apply.\n"), "text/plain"),
      upload("p.csv", Buffer.from("lot,price\n1,10\n"), "text/csv"),
      upload(
        "i.png",
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
      ),
    ]);
    assert.equal(pkg.discoveredFileCount, 4);
  });

  it("I — malformed archive", async () => {
    const junk = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("broken")]);
    await assert.rejects(
      () => discoverTenderPackage([upload("bad.zip", junk)]),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(
          (err.details as { uploadStage?: string })?.uploadStage,
          "ARCHIVE_EXTRACTION_FAILED",
        );
        return true;
      },
    );
  });

  it("J — nested archive expanded with provenance", async () => {
    const inner = buildStoredZipForTests([{ name: "a.pdf", data: MINI_PDF }]);
    const outer = buildStoredZipForTests([{ name: "nested.zip", data: inner }]);
    const pkg = await discoverTenderPackage([upload("outer.zip", outer)]);
    assert.equal(pkg.discoveredFileCount, 1);
    assert.equal(pkg.files[0]!.originalFileName, "a.pdf");
  });

  it("K — path traversal rejected", async () => {
    const zip = buildStoredZipForTests([{ name: "../evil.pdf", data: MINI_PDF }]);
    await assert.rejects(() => discoverTenderPackage([upload("trav.zip", zip)]), AppError);
  });

  it("L — duplicate filenames get unique storage names with provenance", async () => {
    const zip = buildStoredZipForTests([
      { name: "same.pdf", data: MINI_PDF },
      { name: "folder/same.pdf", data: MINI_PDF },
    ]);
    const pkg = await discoverTenderPackage([upload("dup.zip", zip)]);
    assert.equal(pkg.discoveredFileCount, 2);
    const names = pkg.files.map((f) => f.fileName);
    assert.equal(new Set(names).size, 2);
    assert.ok(names.some((n) => n.includes("folder") || n.includes("same")));
  });

  it("M — inventory survives one conceptual failed extraction (count preserved)", async () => {
    const pkg = await discoverTenderPackage([
      upload("ok.pdf", MINI_PDF),
      upload("also.pdf", MINI_PDF),
    ]);
    assert.equal(pkg.discoveredFileCount, 2);
    // Extraction failure is downstream — discovery still reports both files.
    assertPackageInventoryComplete({
      discoveredFileCount: pkg.discoveredFileCount,
      persistedFileCount: 2,
    });
    assert.throws(() =>
      assertPackageInventoryComplete({ discoveredFileCount: 2, persistedFileCount: 1 }),
    );
  });

  it("N — package provenance fields present on every inventory row", async () => {
    const zip = buildStoredZipForTests([{ name: "docs/ITT.pdf", data: MINI_PDF }]);
    const pkg = await discoverTenderPackage([upload("src.zip", zip)]);
    const row = pkg.inventory[0]!;
    assert.ok(row.discoveryId.startsWith("disc_"));
    assert.equal(row.originalFileName, "ITT.pdf");
    assert.equal(row.archiveFileName, "src.zip");
    assert.equal(row.archivePath, "docs/ITT.pdf");
    assert.equal(row.source, "zip");
    assert.equal(row.status, "DISCOVERED");
  });

  it("O — bounded concurrency preserves order and isolates item results", async () => {
    let maxInFlight = 0;
    let inFlight = 0;
    const outcomes = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 8));
      inFlight -= 1;
      if (n === 3) return { ok: false as const, n };
      return { ok: true as const, n };
    });
    assert.deepEqual(
      outcomes.map((o) => o.n),
      [1, 2, 3, 4, 5, 6],
    );
    assert.equal(outcomes.filter((o) => o.ok).length, 5);
    assert.ok(maxInFlight <= 2);
  });

  it("P — tenant isolation contract: discovery does not invent cross-tenant ids", async () => {
    const a = await discoverTenderPackage([upload("a.pdf", MINI_PDF)]);
    const b = await discoverTenderPackage([upload("b.pdf", MINI_PDF)]);
    assert.notEqual(a.files[0]!.discoveryId, b.files[0]!.discoveryId);
    assert.equal(a.sourceUploadCount, 1);
    assert.equal(b.sourceUploadCount, 1);
  });

  it("discoveredFileCount === eligible files; skipped members stay in inventory", async () => {
    const zip = buildStoredZipForTests([
      { name: "a.pdf", data: MINI_PDF },
      { name: "skip.md", data: Buffer.from("# not supported") },
      { name: "b.pdf", data: MINI_PDF },
    ]);
    const pkg = await discoverTenderPackage([upload("mix.zip", zip)]);
    assert.equal(pkg.discoveredFileCount, 2);
    assert.equal(pkg.files.length, 2);
    assert.equal(pkg.inventory.filter((f) => f.status === "DISCOVERED").length, 2);
    const skipped = pkg.inventory.filter((f) => f.status === "UNSUPPORTED_SKIPPED");
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0]!.originalFileName, "skip.md");
    assert.ok(skipped[0]!.error);
    assert.equal(pkg.inventory.length, 3);
  });

  it("UI/API package limit is 100, not 5", () => {
    assert.equal(UPLOAD_LIMITS.maxFilesPerPackage, 100);
    assert.notEqual(UPLOAD_LIMITS.maxFilesPerPackage, 5);
  });
});
