import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import AdmZip from "adm-zip";
import {
  encryptBackupPayload,
  decryptBackupPayload,
  sha256Hex,
} from "@/services/backup/crypto";
import {
  isPooledDatabaseUrl,
  parseBackupSettings,
  restoreDatabaseUrlIsIsolated,
  sanitizeBackupError,
} from "@/services/backup/config";
import {
  cleanupExpiredBackups,
  inspectBackupStorage,
  listManifests,
  writeManifest,
} from "@/services/backup/store";
import { toPublicBackupRow, verifyBackup } from "@/services/backup/run";
import type { BackupManifest } from "@/services/backup/types";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function sampleManifest(over: Partial<BackupManifest> = {}): BackupManifest {
  return {
    id: over.id ?? "bck_test_1",
    formatVersion: 1,
    status: over.status ?? "SUCCESS",
    method: over.method ?? "prisma_logical",
    fileName: over.fileName ?? "bck_test_1.bak.enc",
    byteLength: over.byteLength ?? 12,
    checksumSha256: over.checksumSha256 ?? "abc",
    startedAt: over.startedAt ?? "2020-01-01T00:00:00.000Z",
    completedAt: over.completedAt ?? "2020-01-01T00:00:01.000Z",
    triggeredBy: over.triggeredBy ?? "manual",
    integrity: over.integrity ?? "verified",
    errorSafe: over.errorSafe ?? null,
    tableCounts: over.tableCounts ?? { company: 1 },
    fileCount: over.fileCount ?? 0,
    landingFileCount: over.landingFileCount ?? 0,
    restoreTest: over.restoreTest ?? null,
  };
}

describe("backup authorization and tenant isolation", () => {
  it("Super Admin actions require SA session; restore test is full Super Admin", () => {
    const src = readSrc("src/app/actions/super-admin.ts");
    const run = src.slice(src.indexOf("export async function saRunBackupNow"));
    assert.match(run, /requireWritableSuperAdmin/);
    assert.match(run, /runBackupNowForAdmin/);
    const verify = src.slice(src.indexOf("export async function saVerifyBackup"));
    assert.match(verify, /requireWritableSuperAdmin/);
    const restore = src.slice(src.indexOf("export async function saRestoreTestBackup"));
    assert.match(restore, /requireFullSuperAdmin/);
    assert.match(restore, /restoreTestBackupForAdmin/);
    const settings = src.slice(src.indexOf("export async function saSaveBackupSettings"));
    assert.match(settings, /requireWritableSuperAdmin/);
    const get = src.slice(src.indexOf("export async function saGetBackupDashboard"));
    assert.match(get, /requireSuperAdmin/);
    assert.doesNotMatch(get.slice(0, 400), /requireCompanyId/);
  });

  it("tenant users have no backup API and the page is Super Admin only", () => {
    const page = readSrc("src/app/(super-admin)/[saKey]/(panel)/backups/page.tsx");
    assert.match(page, /requireSuperAdmin/);
    assert.match(page, /getBackupDashboardForAdmin/);
    const actions = readSrc("src/app/actions/super-admin.ts");
    assert.doesNotMatch(actions, /requireCompanyIdApi/);
    const names = readSrc("src/app/actions.ts");
    assert.doesNotMatch(names, /saRunBackupNow|createPlatformBackup/);
  });

  it("restore-test service requires step-up password and production acknowledgement", () => {
    const src = readSrc("src/application/admin/backup-service.ts");
    assert.match(src, /confirmAdminPassword/);
    const restore = src.slice(src.indexOf("export async function restoreTestBackupForAdmin"));
    assert.match(restore, /acknowledge/);
    assert.match(restore, /BACKUP_RESTORE_TESTED/);
    assert.match(src, /BACKUP_COMPLETED/);
    assert.match(src, /BACKUP_SETTINGS_UPDATED/);
  });
});

describe("backup crypto, integrity, retention", () => {
  it("encrypts and decrypts a backup payload", () => {
    const plain = Buffer.from("bidvera-backup-fixture");
    const enc = encryptBackupPayload(plain);
    assert.notEqual(enc.equals(plain), true);
    assert.equal(decryptBackupPayload(enc).toString("utf8"), "bidvera-backup-fixture");
  });

  it("fails integrity when ciphertext is tampered", () => {
    const enc = encryptBackupPayload(Buffer.from("ok"));
    enc[enc.length - 1] ^= 0xff;
    assert.throws(() => decryptBackupPayload(enc));
  });

  it("cleans up backups older than the retention window", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bidvera-bak-"));
    try {
      await writeManifest(root, sampleManifest({ id: "old" }));
      await writeFile(path.join(root, "old.bak.enc"), Buffer.from("x"));
      await writeManifest(
        root,
        sampleManifest({
          id: "new",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        }),
      );
      await writeFile(path.join(root, "new.bak.enc"), Buffer.from("y"));
      const result = await cleanupExpiredBackups({
        root,
        retentionDays: 30,
        now: new Date("2026-01-01T00:00:00.000Z"),
      });
      assert.equal(result.deleted, 1);
      const left = await listManifests(root);
      assert.equal(left.length, 1);
      assert.equal(left[0]?.id, "new");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("verifyBackup records failed integrity for a truncated archive", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bidvera-bak-"));
    const prev = process.env.BACKUP_ROOT;
    process.env.BACKUP_ROOT = root;
    try {
      const id = "bck_bad";
      await writeManifest(
        root,
        sampleManifest({
          id,
          fileName: `${id}.bak.enc`,
          status: "SUCCESS",
          checksumSha256: "nope",
        }),
      );
      await writeFile(path.join(root, `${id}.bak.enc`), Buffer.from("not-an-archive"));
      const row = await verifyBackup(id);
      assert.equal(row.integrity, "failed");
      assert.equal(row.status, "SUCCESS");
      assert.ok(row.errorSafe);
    } finally {
      if (prev === undefined) delete process.env.BACKUP_ROOT;
      else process.env.BACKUP_ROOT = prev;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("verifyBackup accepts a real encrypted archive", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bidvera-bak-"));
    const prev = process.env.BACKUP_ROOT;
    process.env.BACKUP_ROOT = root;
    try {
      const zip = new AdmZip();
      zip.addFile(
        "recovery.json",
        Buffer.from(
          JSON.stringify({
            tableCounts: {
              company: 1,
              user: 1,
              subscription: 1,
              systemSetting: 1,
              adminUser: 1,
            },
          }),
        ),
      );
      const enc = encryptBackupPayload(zip.toBuffer());
      const id = "bck_ok";
      await writeFile(path.join(root, `${id}.bak.enc`), enc);
      await writeManifest(
        root,
        sampleManifest({
          id,
          fileName: `${id}.bak.enc`,
          checksumSha256: sha256Hex(enc),
          byteLength: enc.length,
        }),
      );
      const row = await verifyBackup(id);
      assert.equal(row.integrity, "verified");
      assert.equal(row.errorSafe, null);
    } finally {
      if (prev === undefined) delete process.env.BACKUP_ROOT;
      else process.env.BACKUP_ROOT = prev;
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("failed backup state and secret leakage", () => {
  it("public rows never include database URLs, AUTH_SECRET, or password hashes", () => {
    const row = toPublicBackupRow(
      sampleManifest({
        errorSafe: "dump failed",
      }),
    );
    const blob = JSON.stringify(row);
    assert.equal(blob.includes("postgresql://"), false);
    assert.equal(blob.includes("AUTH_SECRET"), false);
    assert.equal(blob.includes("passwordHash"), false);
    assert.equal(row.status, "SUCCESS");
  });

  it("failed manifests stay failed and are listed", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bidvera-bak-"));
    try {
      await writeManifest(
        root,
        sampleManifest({
          id: "fail1",
          status: "FAILED",
          fileName: null,
          integrity: "failed",
          errorSafe: "logical dump failed",
          checksumSha256: null,
        }),
      );
      const rows = await listManifests(root);
      assert.equal(rows[0]?.status, "FAILED");
      assert.equal(toPublicBackupRow(rows[0]!).integrity, "failed");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("redacts connection strings from backup errors", () => {
    const msg = sanitizeBackupError(
      new Error("connect postgresql://user:secret@host/db failed DATABASE_URL=postgres://x"),
    );
    assert.equal(msg.includes("secret"), false);
    assert.match(msg, /redacted/);
  });

  it("refuses pooled dump URLs and same-database restore URLs", () => {
    assert.equal(isPooledDatabaseUrl("postgresql://u:p@ep-x-pooler.aws.neon.tech/db"), true);
    assert.equal(isPooledDatabaseUrl("postgresql://u:p@ep-x.aws.neon.tech/db"), false);
    assert.equal(
      restoreDatabaseUrlIsIsolated({
        DATABASE_URL: "postgresql://localhost/prod",
        BACKUP_RESTORE_DATABASE_URL: "postgresql://localhost/prod",
      }).ok,
      false,
    );
    assert.equal(
      restoreDatabaseUrlIsIsolated({
        DATABASE_URL: "postgresql://localhost/prod",
        BACKUP_RESTORE_DATABASE_URL: "postgresql://localhost/staging",
      }).ok,
      true,
    );
    assert.equal(
      restoreDatabaseUrlIsIsolated({
        DATABASE_URL: "postgresql://localhost/prod",
      }).ok,
      false,
    );
  });

  it("storage inspector never reports READY when backup root is the upload root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bidvera-share-"));
    try {
      const status = await inspectBackupStorage({
        BACKUP_ROOT: root,
        STORAGE_ROOT: root,
        NODE_ENV: "production",
      });
      assert.equal(status.status, "COLOCATED_WITH_UPLOADS");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("invalid settings are rejected rather than silently defaulted on save", () => {
    assert.throws(() => parseBackupSettings({ enabled: true, intervalHours: 0 }));
  });
});

describe("backup wiring", () => {
  it("worker schedules backups and UI does not invent healthy state", () => {
    const worker = readSrc("src/worker/index.ts");
    assert.match(worker, /runScheduledPlatformBackup/);
    const ui = readSrc("src/components/super-admin/backup-admin.tsx");
    assert.match(ui, /r\.data\.status !== "SUCCESS"/);
    assert.match(ui, /integrity !== "verified"/);
    assert.doesNotMatch(ui, /Always healthy|backup is healthy/);
    const shell = readSrc("src/components/super-admin/sa-shell.tsx");
    assert.match(shell, /\/backups/);
  });

  it("does not log dump contents or secrets", () => {
    const run = readSrc("src/services/backup/run.ts");
    assert.match(run, /logInfo\("backup.completed"/);
    assert.match(run, /logError\("backup.failed"/);
    const completed = run.slice(run.indexOf('logInfo("backup.completed"'));
    assert.match(completed.slice(0, 280), /byteLength/);
    assert.doesNotMatch(completed.slice(0, 280), /tableCounts/);
    const dump = readSrc("src/services/backup/dump.ts");
    assert.doesNotMatch(dump, /console\.log\(rows\)/);
  });
});

describe("restore-test isolated DB restore + extraction safety", () => {
  it("runRestoreTest performs pg_restore when isolated URL is set (not a fake label)", () => {
    const run = readSrc("src/services/backup/run.ts");
    const fn = run.slice(run.indexOf("export async function runRestoreTest"));
    assert.match(fn, /extractBackupZipSafely/);
    assert.match(fn, /tryPgRestore/);
    assert.match(fn, /verifyIsolatedRestoreTables/);
    assert.match(fn, /pg_restore_isolated/);
    assert.match(fn, /archive_verify/);
    assert.doesNotMatch(fn, /isolated_url_configured/);
    assert.doesNotMatch(fn, /extractAllTo\(/);
  });

  it("tryPgRestore refuses production DATABASE_URL and requires isolation", async () => {
    const { tryPgRestore } = await import("@/services/backup/dump");
    const refused = await tryPgRestore({
      dumpFile: path.join(process.cwd(), "package.json"),
      env: {
        DATABASE_URL: "postgresql://u:p@localhost:5432/prod",
        BACKUP_RESTORE_DATABASE_URL: "postgresql://u:p@localhost:5432/prod",
      },
    });
    assert.equal(refused.ok, false);
    assert.match(refused.errorSafe ?? "", /must not equal DATABASE_URL|production/i);

    const missing = await tryPgRestore({
      dumpFile: path.join(process.cwd(), "package.json"),
      env: {
        DATABASE_URL: "postgresql://u:p@localhost:5432/prod",
      },
    });
    assert.equal(missing.ok, false);
    assert.match(missing.errorSafe ?? "", /not set/i);
  });

  it("rejects restore URL that matches production identity with different query strings", () => {
    assert.equal(
      restoreDatabaseUrlIsIsolated({
        DATABASE_URL: "postgresql://u:p@db.example:5432/prod?sslmode=require",
        BACKUP_RESTORE_DATABASE_URL: "postgresql://u:p@db.example:5432/prod",
      }).ok,
      false,
    );
  });

  it("rejects zip-slip and absolute paths during safe backup extract", async () => {
    const { extractBackupZipSafely } = await import("@/services/backup/extract");
    const tmp = await mkdtemp(path.join(os.tmpdir(), "bidvera-extract-"));
    try {
      const zipSlip = new AdmZip();
      zipSlip.addFile("placeholder.txt", Buffer.from("x"));
      const slipEntry = zipSlip.getEntries().find((e) => e.entryName === "placeholder.txt");
      assert.ok(slipEntry);
      slipEntry.entryName = "../escape.txt";
      await assert.rejects(
        () => extractBackupZipSafely(zipSlip, tmp),
        (error: unknown) =>
          error instanceof Error && /traversal|not allowed|escapes|invalid/i.test(error.message),
      );

      const zipAbs = new AdmZip();
      zipAbs.addFile("placeholder2.txt", Buffer.from("x"));
      const absEntry = zipAbs.getEntries().find((e) => e.entryName === "placeholder2.txt");
      assert.ok(absEntry);
      absEntry.entryName = "/etc/passwd";
      await assert.rejects(() => extractBackupZipSafely(zipAbs, tmp));

      const zipOk = new AdmZip();
      zipOk.addFile(
        "recovery.json",
        Buffer.from(
          JSON.stringify({
            tableCounts: {
              company: 1,
              user: 1,
              subscription: 1,
              systemSetting: 1,
              adminUser: 1,
            },
          }),
        ),
      );
      zipOk.addFile("files/a.txt", Buffer.from("file"));
      zipOk.addFile("landing/b.png", Buffer.from("img"));
      zipOk.addFile("db/postgres.dump", Buffer.from("DUMP"));
      const stats = await extractBackupZipSafely(zipOk, tmp);
      assert.equal(stats.hasRecoveryJson, true);
      assert.equal(stats.hasPostgresDump, true);
      assert.equal(stats.fileCount, 1);
      assert.equal(stats.landingCount, 1);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("corrupted ciphertext fails verifyBackup and restore-test records archive_verify failure path", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bidvera-bad-"));
    const prev = process.env.BACKUP_ROOT;
    process.env.BACKUP_ROOT = root;
    try {
      const id = "bck_corrupt";
      const bad = Buffer.from("not-a-valid-encrypted-backup-payload!!!!!!!!!!");
      await writeFile(path.join(root, `${id}.bak.enc`), bad);
      await writeManifest(
        root,
        sampleManifest({
          id,
          fileName: `${id}.bak.enc`,
          checksumSha256: sha256Hex(bad),
          integrity: "unverified",
        }),
      );
      const row = await verifyBackup(id);
      assert.equal(row.integrity, "failed");
    } finally {
      process.env.BACKUP_ROOT = prev;
      await rm(root, { recursive: true, force: true });
    }
  });

  it("docs distinguish archive_verify from pg_restore_isolated", () => {
    const docs = readSrc("docs/disaster-recovery.md");
    assert.match(docs, /pg_restore_isolated/);
    assert.match(docs, /archive_verify/);
    assert.match(docs, /never writes to production/);
  });
});
