import { UPLOAD_LIMITS } from "@/config/server";
import { AppError, ErrorCode } from "@/lib/errors";
import { isAllowedUploadContent } from "@/domain/tender-package/upload-content-sniff";
import { createHash } from "crypto";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";

export interface StoredObject {
  storageKey: string;
  checksumSha256: string;
  byteLength: number;
  /** Authoritative MIME from content sniff (not client-claimed). */
  detectedMimeType: string;
}

export interface StorageService {
  putObject(input: {
    companyId: string;
    tenderId: string;
    fileName: string;
    mimeType: string;
    body: Buffer;
  }): Promise<StoredObject>;
  getObject(storageKey: string): Promise<Buffer>;
  deleteObject(storageKey: string): Promise<void>;
}

function assertSize(size: number) {
  if (size <= 0 || size > UPLOAD_LIMITS.maxFileBytes) {
    throw new AppError(
      ErrorCode.VALIDATION,
      `File exceeds the ${Math.floor(UPLOAD_LIMITS.maxFileBytes / (1024 * 1024))}MB upload limit.`,
      400,
    );
  }
}

/**
 * Local filesystem storage for MVP.
 * Swap for S3/R2 by implementing StorageService — callers stay unchanged.
 */
export class LocalStorageService implements StorageService {
  constructor(private readonly root = process.env.STORAGE_ROOT ?? ".data/uploads") {}

  async putObject(input: {
    companyId: string;
    tenderId: string;
    fileName: string;
    mimeType: string;
    body: Buffer;
  }): Promise<StoredObject> {
    assertSize(input.body.byteLength);

    // Content sniff is authoritative — client MIME/extension are hints only.
    const sniffed = isAllowedUploadContent(input.body, input.fileName);
    if (!sniffed) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "Upload a supported tender document. File content does not match a supported document type.",
        400,
      );
    }

    const claimed = (input.mimeType || "").toLowerCase().trim();
    const allowed = UPLOAD_LIMITS.allowedMimeTypes as readonly string[];
    if (claimed && !allowed.includes(claimed) && claimed !== "application/octet-stream") {
      throw new AppError(ErrorCode.VALIDATION, "Unsupported document type.", 400);
    }
    if (claimed && allowed.includes(claimed) && claimed !== sniffed.mimeType) {
      throw new AppError(
        ErrorCode.VALIDATION,
        "File content does not match the declared document type.",
        400,
      );
    }

    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageKey = `${input.companyId}/${input.tenderId}/${Date.now()}-${safeName}`;
    const fullPath = path.join(this.root, storageKey);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.body);
    return {
      storageKey,
      checksumSha256: createHash("sha256").update(input.body).digest("hex"),
      byteLength: input.body.byteLength,
      detectedMimeType: sniffed.mimeType,
    };
  }

  async getObject(storageKey: string): Promise<Buffer> {
    return readFile(resolveStoragePath(this.root, storageKey));
  }

  async deleteObject(storageKey: string): Promise<void> {
    await unlink(resolveStoragePath(this.root, storageKey)).catch(() => undefined);
  }
}

function resolveStoragePath(root: string, storageKey: string): string {
  const normalized = path.normalize(storageKey).replace(/^([/\\])+/, "");
  if (
    !normalized ||
    normalized.includes("..") ||
    path.isAbsolute(normalized) ||
    /^[a-zA-Z]:/.test(normalized)
  ) {
    throw new AppError(ErrorCode.FORBIDDEN, "Invalid storage key.", 403);
  }
  const rootResolved = path.resolve(root);
  const full = path.resolve(rootResolved, normalized);
  const prefix = rootResolved.endsWith(path.sep)
    ? rootResolved
    : rootResolved + path.sep;
  if (full !== rootResolved && !full.startsWith(prefix)) {
    throw new AppError(ErrorCode.FORBIDDEN, "Invalid storage key.", 403);
  }
  return full;
}

export const storageService: StorageService = new LocalStorageService();
