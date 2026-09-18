/**
 * RAR reader — magic-byte validated; password via node-unrar-js (ephemeral only).
 */

import { createExtractorFromData } from "node-unrar-js";
import { AppError, ErrorCode } from "@/lib/errors";
import type { ArchiveProcessLimits } from "@/domain/tender-package/archive-limits";
import {
  assertCompressionRatio,
  passwordRequiredError,
  sanitizeArchiveEntryPath,
  wrongPasswordError,
} from "./security";
import type { ExtractedArchiveMember } from "./types";

export async function probeRarEncryption(body: Buffer): Promise<{
  encrypted: boolean;
  headerEncrypted: boolean;
}> {
  try {
    const extractor = await createExtractorFromData({
      data: Uint8Array.from(body).buffer,
    });
    const list = extractor.getFileList();
    const headerEncrypted = Boolean(list.arcHeader.flags.headerEncrypted);
    let encrypted = headerEncrypted;
    for (const h of list.fileHeaders) {
      if (h.flags.encrypted) encrypted = true;
    }
    return { encrypted, headerEncrypted };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "";
    if (/PASSWORD|ERAR_MISSING_PASSWORD|encrypted/i.test(reason)) {
      return { encrypted: true, headerEncrypted: true };
    }
    throw new AppError(
      ErrorCode.VALIDATION,
      "The RAR archive is corrupted or unreadable.",
      400,
      { uploadStage: "ARCHIVE_EXTRACTION_FAILED", archiveIssueCode: "CORRUPTED_ARCHIVE" },
    );
  }
}

export async function readRarMembers(input: {
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
  const password = input.password ?? "";

  if (!password) {
    const probe = await probeRarEncryption(input.body);
    if (probe.encrypted) {
      throw passwordRequiredError(input.archiveFileName);
    }
  }

  let extractor;
  try {
    extractor = await createExtractorFromData({
      data: Uint8Array.from(input.body).buffer,
      password: password || undefined,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "";
    if (/ERAR_BAD_PASSWORD|Wrong password|bad password/i.test(reason)) {
      throw wrongPasswordError(input.archiveFileName);
    }
    if (/ERAR_MISSING_PASSWORD|PASSWORD|password|encrypted/i.test(reason)) {
      throw password ? wrongPasswordError(input.archiveFileName) : passwordRequiredError(input.archiveFileName);
    }
    // Header-encrypted RAR often reports "damaged" on wrong password
    if (password && /damaged|corrupt|header or data/i.test(reason)) {
      throw wrongPasswordError(input.archiveFileName);
    }
    throw new AppError(
      ErrorCode.VALIDATION,
      "The RAR archive is corrupted or unreadable.",
      400,
      { uploadStage: "ARCHIVE_EXTRACTION_FAILED", archiveIssueCode: "CORRUPTED_ARCHIVE" },
    );
  }

  try {
    const list = extractor.getFileList();
    if (list.arcHeader.flags.headerEncrypted && !password) {
      throw passwordRequiredError(input.archiveFileName);
    }

    const headers: Array<{
      name: string;
      flags: { encrypted: boolean; directory: boolean };
      packSize: number;
      unpSize: number;
    }> = [];
    for (const h of list.fileHeaders) {
      headers.push(h);
      if (headers.length > input.limits.maxEntriesToScan) {
        throw new AppError(ErrorCode.VALIDATION, "Archive contains too many entries.", 400, {
          uploadStage: "ARCHIVE_EXTRACTION_FAILED",
          archiveIssueCode: "ENTRY_LIMIT",
        });
      }
    }

    for (const h of headers) {
      if (h.flags.directory) {
        sanitizeArchiveEntryPath(h.name.replace(/\/$/, ""), input.limits);
        continue;
      }
      const safePath = sanitizeArchiveEntryPath(h.name, input.limits);
      if (h.flags.encrypted && !password) {
        throw passwordRequiredError(input.archiveFileName);
      }
      if (h.unpSize > input.limits.maxMemberBytes) {
        throw new AppError(
          ErrorCode.VALIDATION,
          `Archive member "${safePath}" exceeds the size limit.`,
          400,
          { uploadStage: "PACKAGE_LIMIT_EXCEEDED", archiveIssueCode: "SIZE_LIMIT" },
        );
      }
      assertCompressionRatio(h.packSize, h.unpSize, safePath, input.limits);
    }

    const wanted = headers.filter((h) => !h.flags.directory).map((h) => h.name);
    const extracted = extractor.extract({
      files: wanted,
      password: password || undefined,
    });

    const members: ExtractedArchiveMember[] = [];
    const partialIssues: Array<{ path: string; message: string }> = [];

    for (const file of extracted.files) {
      const header = file.fileHeader;
      if (header.flags.directory) continue;
      const safePath = sanitizeArchiveEntryPath(header.name, input.limits);
      const extraction = file.extraction;
      if (!extraction) {
        if (header.flags.encrypted) {
          throw wrongPasswordError(input.archiveFileName);
        }
        partialIssues.push({ path: safePath, message: "Could not extract RAR entry." });
        continue;
      }
      const bytes = Buffer.from(extraction);
      if (bytes.byteLength > input.limits.maxMemberBytes) {
        throw new AppError(
          ErrorCode.VALIDATION,
          `Archive member "${safePath}" exceeds the size limit.`,
          400,
          { uploadStage: "PACKAGE_LIMIT_EXCEEDED", archiveIssueCode: "SIZE_LIMIT" },
        );
      }
      members.push({
        path: safePath,
        bytes,
        compressedSize: header.packSize,
        uncompressedSize: bytes.byteLength,
        encrypted: Boolean(header.flags.encrypted),
        isDirectory: false,
        isSymlink: false,
        provenance: {
          chain: [...input.provenanceChain, input.archiveFileName],
          entryPath: safePath,
          nestingDepth: input.nestingDepth,
        },
      });
    }

    return { members, partialIssues };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const reason = err instanceof Error ? err.message : "";
    if (/ERAR_BAD_PASSWORD|Wrong password|bad password/i.test(reason)) {
      throw wrongPasswordError(input.archiveFileName);
    }
    if (/ERAR_MISSING_PASSWORD|PASSWORD|password|encrypted/i.test(reason)) {
      throw password ? wrongPasswordError(input.archiveFileName) : passwordRequiredError(input.archiveFileName);
    }
    if (password && /damaged|corrupt|header or data/i.test(reason)) {
      throw wrongPasswordError(input.archiveFileName);
    }
    throw new AppError(
      ErrorCode.VALIDATION,
      "The RAR archive is corrupted or unreadable.",
      400,
      { uploadStage: "ARCHIVE_EXTRACTION_FAILED", archiveIssueCode: "CORRUPTED_ARCHIVE" },
    );
  }
}
