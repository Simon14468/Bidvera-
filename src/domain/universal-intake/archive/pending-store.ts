/**
 * Ephemeral pending-archive store for password unlock.
 * Stores archive BYTES + session metadata on disk under STORAGE_ROOT — never passwords.
 * Disk is the source of truth so multiple app instances can unlock on any node
 * that shares STORAGE_ROOT.
 */

import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ARCHIVE_LIMITS } from "@/domain/tender-package/archive-limits";

export type PendingArchiveUpload = {
  fileName: string;
  mimeType: string;
  fileSize: number;
  /** Relative path under pending root — bytes on disk, not password. */
  storageRelativePath: string;
  needsPassword: boolean;
};

export type PendingArchiveSession = {
  token: string;
  companyId: string;
  createdAt: number;
  expiresAt: number;
  title?: string;
  idempotencyKey?: string;
  uploads: PendingArchiveUpload[];
  /** Index of the archive awaiting password. */
  passwordFileIndex: number;
};

const SESSION_FILE = "session.json";

/** Pending archives live under STORAGE_ROOT so multi-instance shares one volume. */
export function pendingArchiveRoot(): string {
  const base =
    process.env.STORAGE_ROOT?.trim() ||
    path.join(process.cwd(), ".data", "uploads");
  return path.join(base, "pending-archives");
}

function sessionDir(token: string): string {
  return path.join(pendingArchiveRoot(), token);
}

function sessionMetaPath(token: string): string {
  return path.join(sessionDir(token), SESSION_FILE);
}

function assertSafeToken(token: string): void {
  if (!/^ap_[a-f0-9]{32}$/.test(token)) {
    throw new Error("Invalid pending archive token.");
  }
}

async function writeSessionMeta(session: PendingArchiveSession): Promise<void> {
  const file = sessionMetaPath(session.token);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(session), "utf8");
  await fs.rename(tmp, file);
}

async function readSessionMeta(token: string): Promise<PendingArchiveSession | null> {
  try {
    const raw = await fs.readFile(sessionMetaPath(token), "utf8");
    const parsed = JSON.parse(raw) as PendingArchiveSession;
    if (!parsed || parsed.token !== token || !parsed.companyId || !Array.isArray(parsed.uploads)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function createPendingArchiveSession(input: {
  companyId: string;
  uploads: Array<{
    fileName: string;
    mimeType: string;
    fileSize: number;
    bytes: Buffer;
    needsPassword: boolean;
  }>;
  passwordFileIndex: number;
  title?: string;
  idempotencyKey?: string;
}): Promise<PendingArchiveSession> {
  const token = `ap_${randomBytes(16).toString("hex")}`;
  assertSafeToken(token);
  const dir = sessionDir(token);
  await fs.mkdir(dir, { recursive: true });

  const uploads: PendingArchiveUpload[] = [];
  for (let i = 0; i < input.uploads.length; i++) {
    const u = input.uploads[i]!;
    const rel = `${i}-${sanitizeName(u.fileName)}`;
    await fs.writeFile(path.join(dir, rel), u.bytes);
    uploads.push({
      fileName: u.fileName,
      mimeType: u.mimeType,
      fileSize: u.fileSize,
      storageRelativePath: rel,
      needsPassword: u.needsPassword,
    });
  }

  const now = Date.now();
  const session: PendingArchiveSession = {
    token,
    companyId: input.companyId,
    createdAt: now,
    expiresAt: now + ARCHIVE_LIMITS.passwordPendingTtlMs,
    title: input.title,
    idempotencyKey: input.idempotencyKey,
    uploads,
    passwordFileIndex: input.passwordFileIndex,
  };
  await writeSessionMeta(session);
  return session;
}

export async function loadPendingArchiveSession(
  token: string,
  companyId: string,
): Promise<{
  session: PendingArchiveSession;
  uploadsWithBytes: Array<{
    fileName: string;
    mimeType: string;
    fileSize: number;
    bytes: Buffer;
    needsPassword: boolean;
  }>;
} | null> {
  if (!/^ap_[a-f0-9]{32}$/.test(token)) return null;

  const session = await readSessionMeta(token);
  if (!session || session.companyId !== companyId) return null;
  if (Date.now() > session.expiresAt) {
    await destroyPendingArchiveSession(token);
    return null;
  }

  const dir = sessionDir(token);
  const uploadsWithBytes = [];
  for (const u of session.uploads) {
    if (
      !u.storageRelativePath ||
      u.storageRelativePath.includes("..") ||
      u.storageRelativePath.includes("/") ||
      u.storageRelativePath.includes("\\")
    ) {
      await destroyPendingArchiveSession(token);
      return null;
    }
    const full = path.resolve(dir, u.storageRelativePath);
    if (!full.startsWith(path.resolve(dir) + path.sep)) {
      await destroyPendingArchiveSession(token);
      return null;
    }
    const bytes = await fs.readFile(full);
    uploadsWithBytes.push({
      fileName: u.fileName,
      mimeType: u.mimeType,
      fileSize: u.fileSize,
      bytes,
      needsPassword: u.needsPassword,
    });
  }
  return { session, uploadsWithBytes };
}

export async function destroyPendingArchiveSession(token: string): Promise<void> {
  if (!/^ap_[a-f0-9]{32}$/.test(token)) return;
  const dir = sessionDir(token);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}
