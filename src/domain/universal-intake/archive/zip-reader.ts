/**
 * ZIP reader — magic-byte validated; password via adm-zip (ephemeral only).
 */

import { fromBufferPromise } from "yauzl";
import AdmZip from "adm-zip";
import { AppError, ErrorCode } from "@/lib/errors";
import type { ArchiveProcessLimits } from "@/domain/tender-package/archive-limits";
import {
  assertCompressionRatio,
  assertNotSymlink,
  passwordRequiredError,
  sanitizeArchiveEntryPath,
  wrongPasswordError,
} from "./security";
import type { ExtractedArchiveMember, ArchiveProvenance } from "./types";

export type ZipProbe = {
  encrypted: boolean;
  entryCount: number;
  readableWithoutPassword: boolean;
};

export async function probeZipEncryption(body: Buffer): Promise<ZipProbe> {
  let zipfile;
  try {
    zipfile = await fromBufferPromise(body, {
      lazyEntries: true,
      validateEntrySizes: false,
      strictFileNames: true,
    });
  } catch {
    throw new AppError(ErrorCode.VALIDATION, "The ZIP archive is corrupted or unreadable.", 400, {
      uploadStage: "ARCHIVE_EXTRACTION_FAILED",
      archiveIssueCode: "CORRUPTED_ARCHIVE",
    });
  }

  let encrypted = false;
  let entryCount = 0;
  try {
    for await (const entry of zipfile.eachEntry()) {
      entryCount += 1;
      if ((entry.generalPurposeBitFlag & 0x1) === 0x1) encrypted = true;
    }
  } catch {
    throw new AppError(ErrorCode.VALIDATION, "The ZIP archive is corrupted or unreadable.", 400, {
      uploadStage: "ARCHIVE_EXTRACTION_FAILED",
      archiveIssueCode: "CORRUPTED_ARCHIVE",
    });
  } finally {
    try {
      zipfile.close();
    } catch {
      /* ignore */
    }
  }

  return {
    encrypted,
    entryCount,
    readableWithoutPassword: !encrypted,
  };
}

export async function readZipMembers(input: {
  body: Buffer;
  archiveFileName: string;
  password?: string | null;
  limits: ArchiveProcessLimits;
  provenanceChain: string[];
  nestingDepth: number;
}): Promise<{
  members: ExtractedArchiveMember[];
  partialIssues: Array<{ path: string; message: string }>;
}> {
  const probe = await probeZipEncryption(input.body);

  if (probe.encrypted && !input.password) {
    throw passwordRequiredError(input.archiveFileName);
  }

  if (probe.encrypted && input.password) {
    return readZipMembersWithPassword(input);
  }

  return readZipMembersPlain(input);
}

async function readZipMembersPlain(input: {
  body: Buffer;
  archiveFileName: string;
  limits: ArchiveProcessLimits;
  provenanceChain: string[];
  nestingDepth: number;
}): Promise<{
  members: ExtractedArchiveMember[];
  partialIssues: Array<{ path: string; message: string }>;
}> {
  let zipfile;
  try {
    zipfile = await fromBufferPromise(input.body, {
      lazyEntries: true,
      validateEntrySizes: false,
      strictFileNames: true,
    });
  } catch {
    throw new AppError(ErrorCode.VALIDATION, "The ZIP archive is corrupted or unreadable.", 400, {
      uploadStage: "ARCHIVE_EXTRACTION_FAILED",
      archiveIssueCode: "CORRUPTED_ARCHIVE",
    });
  }

  const members: ExtractedArchiveMember[] = [];
  const partialIssues: Array<{ path: string; message: string }> = [];
  let scanned = 0;

  try {
    for await (const entry of zipfile.eachEntry()) {
      scanned += 1;
      if (scanned > input.limits.maxEntriesToScan) {
        throw new AppError(ErrorCode.VALIDATION, "Archive contains too many entries.", 400, {
          uploadStage: "ARCHIVE_EXTRACTION_FAILED",
          archiveIssueCode: "ENTRY_LIMIT",
        });
      }

      const fileName = entry.fileName;
      const isDirectory = /\/$/.test(fileName);
      const encrypted = (entry.generalPurposeBitFlag & 0x1) === 0x1;
      const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
      const isSymlink = (unixMode & 0xf000) === 0xa000;

      if (isDirectory) {
        sanitizeArchiveEntryPath(fileName.replace(/\/$/, ""), input.limits);
        continue;
      }

      const safePath = sanitizeArchiveEntryPath(fileName, input.limits);
      if (encrypted) {
        throw passwordRequiredError(input.archiveFileName);
      }
      assertNotSymlink(isSymlink);
      if (entry.uncompressedSize > input.limits.maxMemberBytes) {
        throw new AppError(
          ErrorCode.VALIDATION,
          `Archive member "${safePath}" exceeds the size limit.`,
          400,
          { uploadStage: "PACKAGE_LIMIT_EXCEEDED", archiveIssueCode: "SIZE_LIMIT" },
        );
      }
      assertCompressionRatio(
        entry.compressedSize,
        entry.uncompressedSize,
        safePath,
        input.limits,
      );

      try {
        const chunks: Buffer[] = [];
        let total = 0;
        const stream = await zipfile.openReadStreamPromise(entry);
        await new Promise<void>((res, rej) => {
          stream.on("data", (chunk: Buffer) => {
            total += chunk.length;
            if (total > input.limits.maxMemberBytes) {
              stream.destroy();
              rej(
                new AppError(
                  ErrorCode.VALIDATION,
                  `Archive member "${safePath}" exceeds the size limit while extracting.`,
                  400,
                ),
              );
              return;
            }
            chunks.push(chunk);
          });
          stream.on("error", rej);
          stream.on("end", () => res());
        });

        const bytes = Buffer.concat(chunks);
        const provenance: ArchiveProvenance = {
          chain: [...input.provenanceChain, input.archiveFileName],
          entryPath: safePath,
          nestingDepth: input.nestingDepth,
        };
        members.push({
          path: safePath,
          bytes,
          compressedSize: entry.compressedSize,
          uncompressedSize: bytes.byteLength,
          encrypted: false,
          isDirectory: false,
          isSymlink: false,
          provenance,
        });
      } catch (err) {
        if (err instanceof AppError && err.details && (err.details as { archiveIssueCode?: string }).archiveIssueCode) {
          throw err;
        }
        // Partial recovery — skip corrupt entry, continue
        partialIssues.push({
          path: safePath,
          message: err instanceof Error ? err.message : "Entry extraction failed",
        });
      }
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(ErrorCode.VALIDATION, "The ZIP archive is corrupted or unreadable.", 400, {
      uploadStage: "ARCHIVE_EXTRACTION_FAILED",
      archiveIssueCode: "CORRUPTED_ARCHIVE",
    });
  } finally {
    try {
      zipfile.close();
    } catch {
      /* ignore */
    }
  }

  return { members, partialIssues };
}

function readZipMembersWithPassword(input: {
  body: Buffer;
  archiveFileName: string;
  password?: string | null;
  limits: ArchiveProcessLimits;
  provenanceChain: string[];
  nestingDepth: number;
}): {
  members: ExtractedArchiveMember[];
  partialIssues: Array<{ path: string; message: string }>;
} {
  const password = input.password ?? "";
  let zip: AdmZip;
  try {
    zip = new AdmZip(input.body);
  } catch {
    throw new AppError(ErrorCode.VALIDATION, "The ZIP archive is corrupted or unreadable.", 400, {
      uploadStage: "ARCHIVE_EXTRACTION_FAILED",
      archiveIssueCode: "CORRUPTED_ARCHIVE",
    });
  }

  const members: ExtractedArchiveMember[] = [];
  const partialIssues: Array<{ path: string; message: string }> = [];
  const entries = zip.getEntries();
  if (entries.length > input.limits.maxEntriesToScan) {
    throw new AppError(ErrorCode.VALIDATION, "Archive contains too many entries.", 400, {
      uploadStage: "ARCHIVE_EXTRACTION_FAILED",
      archiveIssueCode: "ENTRY_LIMIT",
    });
  }

  let decryptedAny = false;
  let passwordFailure = false;

  for (const entry of entries) {
    if (entry.isDirectory) {
      try {
        sanitizeArchiveEntryPath(entry.entryName.replace(/\/$/, ""), input.limits);
      } catch (e) {
        if (e instanceof AppError) throw e;
      }
      continue;
    }

    let safePath: string;
    try {
      safePath = sanitizeArchiveEntryPath(entry.entryName, input.limits);
    } catch (e) {
      if (e instanceof AppError) throw e;
      continue;
    }

    try {
      const data = zip.readFile(entry, password) as Buffer | null;
      if (data == null) {
        passwordFailure = true;
        break;
      }
      decryptedAny = true;
      if (data.byteLength > input.limits.maxMemberBytes) {
        throw new AppError(
          ErrorCode.VALIDATION,
          `Archive member "${safePath}" exceeds the size limit.`,
          400,
          { uploadStage: "PACKAGE_LIMIT_EXCEEDED", archiveIssueCode: "SIZE_LIMIT" },
        );
      }
      assertCompressionRatio(
        entry.header?.compressedSize ?? data.byteLength,
        data.byteLength,
        safePath,
        input.limits,
      );
      members.push({
        path: safePath,
        bytes: data,
        compressedSize: entry.header?.compressedSize ?? data.byteLength,
        uncompressedSize: data.byteLength,
        encrypted: true,
        isDirectory: false,
        isSymlink: false,
        provenance: {
          chain: [...input.provenanceChain, input.archiveFileName],
          entryPath: safePath,
          nestingDepth: input.nestingDepth,
        },
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/password|invalid|bad password|wrong/i.test(msg) || !decryptedAny) {
        passwordFailure = true;
        break;
      }
      partialIssues.push({ path: safePath, message: "Could not extract encrypted entry." });
    }
  }

  if (passwordFailure || (members.length === 0 && entries.some((e) => !e.isDirectory))) {
    throw wrongPasswordError(input.archiveFileName);
  }

  return { members, partialIssues };
}
