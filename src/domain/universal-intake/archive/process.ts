/**
 * Canonical Archive Processing — ZIP / RAR secure extraction with nesting + passwords.
 * Passwords are ephemeral call arguments only — never logged or persisted.
 */

import path from "node:path";
import { randomBytes } from "node:crypto";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  isArchiveUploadContent,
  isAllowedUploadContent,
  isDocumentUploadKind,
  sniffUploadContent,
} from "@/domain/tender-package/upload-content-sniff";
import type { PackageFileSource } from "@/domain/tender-package/package-discovery-types";
import {
  assertNotExecutablePayload,
  looksLikeNestedArchiveName,
  passwordRequiredError,
  redactSecretsForLog,
  resolveLimits,
  wrongPasswordError,
} from "./security";
import { readZipMembers } from "./zip-reader";
import { readRarMembers } from "./rar-reader";
import type {
  ArchiveFormat,
  ArchiveOpenOptions,
  ArchiveProcessIssue,
  ArchiveProcessResult,
  ExtractedArchiveMember,
} from "./types";

export type PackageUploadFile = {
  discoveryId: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  bytes: Buffer;
  source: PackageFileSource;
  archiveFileName: string | null;
  archivePath: string | null;
  /** archive → nested → file provenance chain */
  provenanceChain?: string[];
  /** Intake recovery report — never includes passwords or invented content. */
  recovery?: import("@/domain/universal-intake/recovery/types").FileRecoveryReport | null;
};

export type PackageSkippedMember = {
  discoveryId: string;
  originalFileName: string;
  archiveFileName: string;
  archivePath: string;
  reason: string;
  status: "UNSUPPORTED_SKIPPED" | "FILE_EXTRACTION_FAILED";
  provenanceChain?: string[];
};

export type ExpandTenderPackageResult = {
  files: PackageUploadFile[];
  skipped: PackageSkippedMember[];
  recoveryWarnings: string[];
};

function newDiscoveryId(): string {
  return `disc_${randomBytes(8).toString("hex")}`;
}

function detectFormat(bytes: Buffer, fileName: string): ArchiveFormat | null {
  const kind = isArchiveUploadContent(bytes, fileName);
  if (!kind) return null;
  return kind.kind === "rar" ? "rar" : "zip";
}

/**
 * Process a single archive buffer (optionally with ephemeral password).
 * Nested archives are expanded recursively within configured depth limits.
 */
export async function processArchive(
  options: ArchiveOpenOptions,
): Promise<ArchiveProcessResult> {
  const limits = resolveLimits(options.limits);
  const nestingDepth = options.nestingDepth ?? 0;
  const provenanceChain = options.provenanceChain ?? [];
  const format = detectFormat(options.bytes, options.fileName);

  if (!format) {
    return {
      status: "CORRUPTED",
      format: null,
      archiveFileName: options.fileName,
      members: [],
      extractedCount: 0,
      issues: [
        {
          code: "MALFORMED",
          message: `"${options.fileName}" is not a valid ZIP or RAR archive (content detection).`,
          recoverable: false,
        },
      ],
      recoveredPartially: false,
      userMessage: `"${options.fileName}" is not a valid ZIP or RAR archive.`,
    };
  }

  if (options.bytes.byteLength > limits.maxArchiveBytes) {
    throw new AppError(
      ErrorCode.VALIDATION,
      `Archive exceeds the ${Math.floor(limits.maxArchiveBytes / (1024 * 1024))}MB file size limit.`,
      400,
      { uploadStage: "PACKAGE_LIMIT_EXCEEDED", archiveIssueCode: "SIZE_LIMIT" },
    );
  }

  try {
    const reader = format === "zip" ? readZipMembers : readRarMembers;
    const { members, partialIssues } = await reader({
      body: options.bytes,
      archiveFileName: options.fileName,
      password: options.password,
      limits,
      provenanceChain,
      nestingDepth,
    });

    // Nested expansion
    const flat: ExtractedArchiveMember[] = [];
    const issues: ArchiveProcessIssue[] = partialIssues.map((p) => ({
      code: "CORRUPTED_ENTRY" as const,
      message: p.message,
      entryPath: p.path,
      recoverable: true,
    }));

    for (const member of members) {
      assertNotExecutablePayload(member.bytes, member.path);

      const nestedByMagic = isArchiveUploadContent(member.bytes, member.path);
      const nestedByName = looksLikeNestedArchiveName(member.path);

      if (nestedByMagic || nestedByName) {
        if (nestingDepth >= limits.maxNestingDepth) {
          throw new AppError(
            ErrorCode.VALIDATION,
            `Nested archive "${member.path}" exceeds the maximum nesting depth (${limits.maxNestingDepth}).`,
            400,
            {
              uploadStage: "ARCHIVE_EXTRACTION_FAILED",
              archiveIssueCode: "NESTING_LIMIT",
            },
          );
        }
        if (!nestedByMagic) {
          issues.push({
            code: "MALFORMED",
            message: `Nested archive name "${member.path}" failed content validation.`,
            entryPath: member.path,
            recoverable: false,
          });
          continue;
        }

        const nested = await processArchive({
          fileName: path.posix.basename(member.path),
          bytes: member.bytes,
          password: options.password,
          nestingDepth: nestingDepth + 1,
          provenanceChain: [...provenanceChain, options.fileName],
          limits,
        });

        if (nested.status === "PASSWORD_REQUIRED") {
          throw passwordRequiredError(nested.archiveFileName);
        }
        if (nested.status === "WRONG_PASSWORD") {
          throw wrongPasswordError(nested.archiveFileName);
        }
        if (nested.status === "CORRUPTED" && nested.members.length === 0) {
          issues.push({
            code: "CORRUPTED_ARCHIVE",
            message: nested.userMessage ?? `Nested archive "${member.path}" is corrupted.`,
            entryPath: member.path,
            recoverable: false,
          });
          continue;
        }
        issues.push(...nested.issues);
        flat.push(...nested.members);
        continue;
      }

      flat.push(member);
    }

    const recoveredPartially = partialIssues.length > 0 && flat.length > 0;
    if (flat.length === 0 && partialIssues.length > 0) {
      return {
        status: "CORRUPTED",
        format,
        archiveFileName: options.fileName,
        members: [],
        extractedCount: 0,
        issues,
        recoveredPartially: false,
        userMessage: `Archive "${options.fileName}" is corrupted and no files could be recovered.`,
      };
    }

    return {
      status: recoveredPartially ? "PARTIAL_RECOVERY" : "EXTRACTED",
      format,
      archiveFileName: options.fileName,
      members: flat,
      extractedCount: flat.length,
      issues,
      recoveredPartially,
      userMessage: recoveredPartially
        ? `Some entries in "${options.fileName}" were corrupted and skipped; remaining files were recovered.`
        : null,
    };
  } catch (err) {
    if (err instanceof AppError) {
      const code = (err.details as { archiveIssueCode?: string } | undefined)?.archiveIssueCode;
      if (code === "PASSWORD_REQUIRED") {
        return {
          status: "PASSWORD_REQUIRED",
          format,
          archiveFileName: options.fileName,
          members: [],
          extractedCount: 0,
          issues: [
            {
              code: "PASSWORD_REQUIRED",
              message: "This file is password protected. Enter the password to continue.",
              recoverable: true,
            },
          ],
          recoveredPartially: false,
          userMessage: "This file is password protected. Enter the password to continue.",
        };
      }
      if (code === "WRONG_PASSWORD") {
        return {
          status: "WRONG_PASSWORD",
          format,
          archiveFileName: options.fileName,
          members: [],
          extractedCount: 0,
          issues: [
            {
              code: "WRONG_PASSWORD",
              message: "Incorrect password. Please try again.",
              recoverable: true,
            },
          ],
          recoveredPartially: false,
          userMessage: "Incorrect password. Please try again.",
        };
      }
      if (code === "CORRUPTED_ARCHIVE" || code === "MALFORMED") {
        return {
          status: "CORRUPTED",
          format,
          archiveFileName: options.fileName,
          members: [],
          extractedCount: 0,
          issues: [
            {
              code: "CORRUPTED_ARCHIVE",
              message: err.message,
              recoverable: false,
            },
          ],
          recoveredPartially: false,
          userMessage: err.message,
        };
      }
      throw err;
    }
    // Never include options.password in any message
    void redactSecretsForLog({ file: options.fileName });
    return {
      status: "CORRUPTED",
      format,
      archiveFileName: options.fileName,
      members: [],
      extractedCount: 0,
      issues: [
        {
          code: "CORRUPTED_ARCHIVE",
          message: "The archive is corrupted or unreadable.",
          recoverable: false,
        },
      ],
      recoveredPartially: false,
      userMessage: `Archive "${options.fileName}" is corrupted or unreadable.`,
    };
  }
}

function toSupportedDocument(
  member: ExtractedArchiveMember,
  archiveFileName: string,
  archiveSource: "zip" | "rar",
  usedNames: Set<string>,
): { doc: PackageUploadFile } | { skipped: PackageSkippedMember } {
  assertNotExecutablePayload(member.bytes, member.path);

  const sniffed = isAllowedUploadContent(member.bytes, member.path);
  if (!sniffed) {
    return {
      skipped: {
        discoveryId: newDiscoveryId(),
        originalFileName: path.posix.basename(member.path),
        archiveFileName,
        archivePath: member.path,
        reason: "Unsupported or unreadable archive member — not a supported tender document type.",
        status: "UNSUPPORTED_SKIPPED",
        provenanceChain: member.provenance.chain,
      },
    };
  }

  const relative = member.path.replace(/\//g, "__");
  let fileName = relative || path.posix.basename(member.path);
  if (usedNames.has(fileName.toLowerCase())) {
    const stem = archiveFileName.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_");
    fileName = `${stem}__${fileName}`;
  }
  let unique = fileName;
  let n = 2;
  while (usedNames.has(unique.toLowerCase())) {
    unique = fileName.replace(/(\.[^.]+)?$/, `_${n}$1`);
    n += 1;
  }
  usedNames.add(unique.toLowerCase());

  return {
    doc: {
      discoveryId: newDiscoveryId(),
      fileName: unique,
      originalFileName: path.posix.basename(member.path),
      mimeType: sniffed.mimeType,
      fileSize: member.bytes.byteLength,
      bytes: member.bytes,
      source: archiveSource,
      archiveFileName,
      archivePath: member.path,
      provenanceChain: member.provenance.chain,
    },
  };
}

/**
 * Expand uploads (loose docs + ZIP/RAR) with optional ephemeral passwords by file name.
 * Passwords map is never persisted — callers must not log it.
 */
export async function expandTenderPackageUploadsWithSkips(
  files: Array<{
    fileName: string;
    mimeType: string;
    fileSize: number;
    bytes: Buffer;
  }>,
  options?: {
    /** Ephemeral passwords keyed by exact upload fileName. Never log. */
    passwordsByFileName?: Record<string, string>;
  },
): Promise<ExpandTenderPackageResult> {
  if (files.length === 0) {
    throw new AppError(ErrorCode.VALIDATION, "At least one file is required.", 400, {
      uploadStage: "UPLOAD_FAILED",
    });
  }

  const limits = resolveLimits();
  const usedNames = new Set<string>();
  const out: PackageUploadFile[] = [];
  const skipped: PackageSkippedMember[] = [];
  const recoveryWarnings: string[] = [];
  let totalBytes = 0;

  for (const file of files) {
    if (file.bytes.byteLength <= 0) {
      throw new AppError(ErrorCode.VALIDATION, `File "${file.fileName}" is empty.`, 400, {
        uploadStage: "UPLOAD_FAILED",
      });
    }
    if (file.bytes.byteLength > limits.maxArchiveBytes) {
      throw new AppError(
        ErrorCode.VALIDATION,
        `File "${file.fileName}" exceeds the ${Math.floor(limits.maxArchiveBytes / (1024 * 1024))}MB file size limit.`,
        400,
        { uploadStage: "PACKAGE_LIMIT_EXCEEDED" },
      );
    }

    assertNotExecutablePayload(file.bytes, file.fileName);

    const sniffed = sniffUploadContent(file.bytes, file.fileName);
    const asArchive = isArchiveUploadContent(file.bytes, file.fileName);

    if (asArchive || sniffed.kind === "zip" || sniffed.kind === "rar") {
      const password = options?.passwordsByFileName?.[file.fileName] ?? null;
      const processed = await processArchive({
        fileName: file.fileName,
        bytes: file.bytes,
        password,
        nestingDepth: 0,
        provenanceChain: [],
      });

      if (processed.status === "PASSWORD_REQUIRED") {
        throw passwordRequiredError(file.fileName);
      }
      if (processed.status === "WRONG_PASSWORD") {
        throw wrongPasswordError(file.fileName);
      }
      if (processed.status === "CORRUPTED" && processed.members.length === 0) {
        throw new AppError(
          ErrorCode.VALIDATION,
          processed.userMessage ?? `Archive "${file.fileName}" is corrupted.`,
          400,
          { uploadStage: "ARCHIVE_EXTRACTION_FAILED", archiveIssueCode: "CORRUPTED_ARCHIVE" },
        );
      }
      if (processed.recoveredPartially && processed.userMessage) {
        recoveryWarnings.push(processed.userMessage);
      }

      const archiveSource = processed.format === "rar" ? "rar" : "zip";
      for (const member of processed.members) {
        const result = toSupportedDocument(member, file.fileName, archiveSource, usedNames);
        if ("skipped" in result) {
          skipped.push(result.skipped);
          continue;
        }
        if (out.length >= limits.maxMembers) {
          throw new AppError(
            ErrorCode.VALIDATION,
            `A Tender Package accepts a maximum of ${limits.maxMembers} documents after archive extraction.`,
            400,
            { uploadStage: "PACKAGE_LIMIT_EXCEEDED" },
          );
        }
        totalBytes += result.doc.bytes.byteLength;
        if (totalBytes > limits.maxTotalExtractedBytes) {
          throw new AppError(
            ErrorCode.VALIDATION,
            "Tender package exceeds the total size limit.",
            400,
            { uploadStage: "PACKAGE_LIMIT_EXCEEDED" },
          );
        }
        out.push(result.doc);
      }

      if (out.length === 0 && skipped.length > 0) {
        throw new AppError(
          ErrorCode.VALIDATION,
          `Archive "${file.fileName}" does not contain supported tender documents.`,
          400,
          { uploadStage: "ARCHIVE_EXTRACTION_FAILED" },
        );
      }
      continue;
    }

    if (isDocumentUploadKind(sniffed.kind)) {
      if (out.length >= limits.maxMembers) {
        throw new AppError(
          ErrorCode.VALIDATION,
          `A Tender Package accepts a maximum of ${limits.maxMembers} documents.`,
          400,
          { uploadStage: "PACKAGE_LIMIT_EXCEEDED" },
        );
      }
      let name = file.fileName;
      if (usedNames.has(name.toLowerCase())) {
        const stem = name.replace(/(\.[^.]+)?$/, "");
        const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
        let n = 2;
        while (usedNames.has(`${stem}_${n}${ext}`.toLowerCase())) n += 1;
        name = `${stem}_${n}${ext}`;
      }
      usedNames.add(name.toLowerCase());
      totalBytes += file.bytes.byteLength;
      if (totalBytes > limits.maxTotalExtractedBytes) {
        throw new AppError(
          ErrorCode.VALIDATION,
          "Tender package exceeds the total size limit.",
          400,
          { uploadStage: "PACKAGE_LIMIT_EXCEEDED" },
        );
      }
      out.push({
        discoveryId: newDiscoveryId(),
        fileName: name,
        originalFileName: path.posix.basename(file.fileName.replace(/\\/g, "/")),
        mimeType: sniffed.mimeType,
        fileSize: file.bytes.byteLength,
        bytes: file.bytes,
        source: "loose",
        archiveFileName: null,
        archivePath: null,
        provenanceChain: [],
      });
      continue;
    }

    throw new AppError(
      ErrorCode.VALIDATION,
      `Unsupported file "${file.fileName}". Upload supported tender documents or a ZIP/RAR package.`,
      400,
      { uploadStage: "UNSUPPORTED_FILE" },
    );
  }

  if (out.length === 0) {
    throw new AppError(ErrorCode.VALIDATION, "No supported tender documents were found in the upload.", 400, {
      uploadStage: "UPLOAD_FAILED",
    });
  }

  return { files: out, skipped, recoveryWarnings };
}

export async function expandTenderPackageUploads(
  files: Array<{
    fileName: string;
    mimeType: string;
    fileSize: number;
    bytes: Buffer;
  }>,
  options?: { passwordsByFileName?: Record<string, string> },
): Promise<PackageUploadFile[]> {
  const result = await expandTenderPackageUploadsWithSkips(files, options);
  return result.files;
}
