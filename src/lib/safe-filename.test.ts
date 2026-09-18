import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeContentDispositionFilename } from "@/lib/safe-filename";

describe("L7 Content-Disposition filename sanitization", () => {
  it("preserves normal filenames", () => {
    assert.equal(safeContentDispositionFilename("proposal-v2.pdf"), "proposal-v2.pdf");
  });

  it("strips quotes, CR/LF, path traversal, and control characters", () => {
    assert.equal(
      safeContentDispositionFilename('evil\r\nfilename="x.pdf'),
      "evilfilename=_x.pdf",
    );
    assert.equal(safeContentDispositionFilename("../../etc/passwd"), "passwd");
    assert.equal(safeContentDispositionFilename("ok\u0000name.pdf"), "okname.pdf");
  });

  it("falls back when the name is empty after sanitizing", () => {
    assert.equal(safeContentDispositionFilename("///"), "download");
    assert.equal(safeContentDispositionFilename(""), "download");
  });
});
