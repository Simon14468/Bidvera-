/**
 * Canonical archive processing types — ZIP / RAR secure extraction.
 * Passwords are NEVER part of these persisted/serializable structures.
 */

export type ArchiveFormat = "zip" | "rar";

export type ArchiveMemberKind = "document" | "nested_archive" | "unsupported" | "directory";

export type ArchiveProvenance = {
  /** Outer → inner archive file names. */
  chain: string[];
  /** Relative path inside the immediate parent archive. */
  entryPath: string;
  nestingDepth: number;
};

export type ExtractedArchiveMember = {
  path: string;
  bytes: Buffer;
  compressedSize: number;
  uncompressedSize: number;
  encrypted: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  provenance: ArchiveProvenance;
};

export type ArchiveProcessStatus =
  | "EXTRACTED"
  | "PASSWORD_REQUIRED"
  | "WRONG_PASSWORD"
  | "CORRUPTED"
  | "SECURITY_FAILURE"
  | "PARTIAL_RECOVERY";

export type ArchiveProcessIssue = {
  code:
    | "PASSWORD_REQUIRED"
    | "WRONG_PASSWORD"
    | "CORRUPTED_ENTRY"
    | "CORRUPTED_ARCHIVE"
    | "PATH_TRAVERSAL"
    | "SYMLINK"
    | "EXECUTABLE"
    | "BOMB_RATIO"
    | "NESTING_LIMIT"
    | "SIZE_LIMIT"
    | "ENTRY_LIMIT"
    | "UNSUPPORTED_MEMBER"
    | "MALFORMED";
  message: string;
  entryPath?: string;
  recoverable: boolean;
};

export type ArchiveProcessResult = {
  status: ArchiveProcessStatus;
  format: ArchiveFormat | null;
  archiveFileName: string;
  members: ExtractedArchiveMember[];
  /** Documents + nested archives extracted successfully. */
  extractedCount: number;
  issues: ArchiveProcessIssue[];
  /** True when some entries recovered despite corruption elsewhere. */
  recoveredPartially: boolean;
  /** User-facing message — never includes a password. */
  userMessage: string | null;
};

/** Options for one archive open. Password must remain ephemeral — never log/store. */
export type ArchiveOpenOptions = {
  fileName: string;
  bytes: Buffer;
  /** Ephemeral only — never written to disk/DB/logs. */
  password?: string | null;
  nestingDepth?: number;
  provenanceChain?: string[];
  limits?: Partial<import("@/domain/tender-package/archive-limits").ArchiveProcessLimits>;
};
