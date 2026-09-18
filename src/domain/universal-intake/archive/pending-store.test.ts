/**
 * Pending archive store must be multi-instance safe (disk under STORAGE_ROOT).
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, after } from "node:test";
import {
  createPendingArchiveSession,
  destroyPendingArchiveSession,
  loadPendingArchiveSession,
  pendingArchiveRoot,
} from "./pending-store";

describe("pending archive store (multi-instance disk)", () => {
  let root: string;
  let prevStorage: string | undefined;

  after(async () => {
    if (prevStorage === undefined) delete process.env.STORAGE_ROOT;
    else process.env.STORAGE_ROOT = prevStorage;
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("persists session.json under STORAGE_ROOT so another process can load it", async () => {
    root = await mkdtemp(path.join(tmpdir(), "bidvera-pending-"));
    prevStorage = process.env.STORAGE_ROOT;
    process.env.STORAGE_ROOT = root;

    assert.equal(pendingArchiveRoot(), path.join(root, "pending-archives"));

    const created = await createPendingArchiveSession({
      companyId: "co_a",
      passwordFileIndex: 0,
      uploads: [
        {
          fileName: "secret.zip",
          mimeType: "application/zip",
          fileSize: 4,
          bytes: Buffer.from("PK\u0003\u0004"),
          needsPassword: true,
        },
      ],
    });

    // Simulate another instance: no in-memory Map — load from disk only.
    const loaded = await loadPendingArchiveSession(created.token, "co_a");
    assert.ok(loaded);
    assert.equal(loaded!.session.companyId, "co_a");
    assert.equal(loaded!.uploadsWithBytes[0]!.fileName, "secret.zip");
    assert.ok(loaded!.uploadsWithBytes[0]!.bytes.equals(Buffer.from("PK\u0003\u0004")));

    const wrongTenant = await loadPendingArchiveSession(created.token, "co_other");
    assert.equal(wrongTenant, null);

    await destroyPendingArchiveSession(created.token);
    const gone = await loadPendingArchiveSession(created.token, "co_a");
    assert.equal(gone, null);
  });
});
