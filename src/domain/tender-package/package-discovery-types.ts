/**
 * Canonical tender-package discovery inventory.
 * Built at the upload/package-ingestion boundary before storage and analysis.
 */

export type PackageFileSource = "loose" | "zip" | "rar";

export type PackageFileDiscoveryStatus =
  | "DISCOVERED"
  | "STORED"
  | "EXTRACTING"
  | "EXTRACTED"
  | "FILE_EXTRACTION_FAILED"
  | "UNSUPPORTED_SKIPPED";

export type DiscoveredPackageFile = {
  /** Stable id within the package (survives storage rename collisions). */
  discoveryId: string;
  /** Basename as found in the upload / archive entry. */
  originalFileName: string;
  /** Storage/display name (may include archive-path provenance). */
  storageFileName: string;
  mimeType: string;
  sizeBytes: number;
  source: PackageFileSource;
  /** Parent archive file name when source is zip/rar. */
  archiveFileName: string | null;
  /** Original relative path inside the archive (posix). */
  archivePath: string | null;
  status: PackageFileDiscoveryStatus;
  error: string | null;
};

export type DiscoveredTenderPackage = {
  /** Eligible documents ready for storage + existing analysis pipeline. */
  files: Array<{
    discoveryId: string;
    fileName: string;
    originalFileName: string;
    mimeType: string;
    fileSize: number;
    bytes: Buffer;
    source: PackageFileSource;
    archiveFileName: string | null;
    archivePath: string | null;
    /** Intake recovery report when Universal File Recovery ran. */
    recovery?: import("@/domain/universal-intake/recovery/types").FileRecoveryReport | null;
  }>;
  inventory: DiscoveredPackageFile[];
  /** Exact count of eligible discovered files (must equal files.length). */
  discoveredFileCount: number;
  /** Uploads selected by the user before expansion (archives count as 1). */
  sourceUploadCount: number;
  status: "PACKAGE_READY";
};

export type PackageProvenanceMeta = {
  discoveryId: string;
  originalFileName: string;
  source: PackageFileSource;
  archiveFileName: string | null;
  archivePath: string | null;
  packageDiscoveredFileCount: number;
};

export function buildPackageProvenanceMeta(
  file: DiscoveredTenderPackage["files"][number],
  packageDiscoveredFileCount: number,
): PackageProvenanceMeta {
  return {
    discoveryId: file.discoveryId,
    originalFileName: file.originalFileName,
    source: file.source,
    archiveFileName: file.archiveFileName,
    archivePath: file.archivePath,
    packageDiscoveredFileCount,
  };
}
