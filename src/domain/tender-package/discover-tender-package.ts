/**
 * Canonical package-discovery boundary.
 * Runs Universal Intake first, then adapts accepted files into the existing
 * DiscoveredTenderPackage shape for storage + analysis (no parallel pipeline).
 */

import { AppError, ErrorCode } from "@/lib/errors";
import {
  assertIntakeMayProceed,
  acceptedUploadsFromIntake,
  runUniversalIntake,
  type PackageIntake,
} from "@/domain/universal-intake";
import {
  type DiscoveredPackageFile,
  type DiscoveredTenderPackage,
} from "./package-discovery-types";

export type { DiscoveredPackageFile, DiscoveredTenderPackage, PackageProvenanceMeta } from "./package-discovery-types";
export { buildPackageProvenanceMeta } from "./package-discovery-types";

export type DiscoveredTenderPackageWithIntake = DiscoveredTenderPackage & {
  intake: PackageIntake;
  intakeReport: import("@/domain/universal-intake/intake-report").IntakeReport;
};

/**
 * Discover the tender package from user uploads (loose files and/or ZIP/RAR).
 * Guarantees discoveredFileCount === files.length for analyzable documents.
 * Skipped unsupported archive members appear in inventory with UNSUPPORTED_SKIPPED.
 */
export async function discoverTenderPackage(
  uploads: Array<{
    fileName: string;
    mimeType: string;
    fileSize: number;
    bytes: Buffer;
  }>,
  options?: {
    passwordsByFileName?: Record<string, string>;
  },
): Promise<DiscoveredTenderPackageWithIntake> {
  const intakeResult = await runUniversalIntake(uploads, options);
  assertIntakeMayProceed(intakeResult);

  const files = acceptedUploadsFromIntake(intakeResult);
  const intake = intakeResult.intake;
  const intakeReport = intakeResult.intakeReport;

  const inventory: DiscoveredPackageFile[] = [
    ...files.map((f) => ({
      discoveryId: f.discoveryId,
      originalFileName: f.originalFileName,
      storageFileName: f.fileName,
      mimeType: f.mimeType,
      sizeBytes: f.fileSize,
      source: f.source,
      archiveFileName: f.archiveFileName,
      archivePath: f.archivePath,
      status: "DISCOVERED" as const,
      error: null,
    })),
    ...intake.unsupportedFiles.map((s) => ({
      discoveryId: s.fileId,
      originalFileName: s.originalName,
      storageFileName: s.displayName,
      mimeType: "application/octet-stream",
      sizeBytes: s.sizeBytes,
      source: (s.source === "rar" || s.source === "zip" ? s.source : "zip") as "zip" | "rar",
      archiveFileName: s.archiveFileName,
      archivePath: s.archivePath,
      status: "UNSUPPORTED_SKIPPED" as const,
      error: s.message,
    })),
  ];

  const eligible = inventory.filter((i) => i.status === "DISCOVERED");
  if (eligible.length !== files.length) {
    throw new AppError(
      ErrorCode.INTERNAL,
      "Package discovery inventory mismatch — a discovered file was lost before storage.",
      500,
      { uploadStage: "UPLOAD_FAILED" },
    );
  }

  const ids = new Set(inventory.map((f) => f.discoveryId));
  if (ids.size !== inventory.length) {
    throw new AppError(
      ErrorCode.INTERNAL,
      "Package discovery produced duplicate file ids.",
      500,
      { uploadStage: "UPLOAD_FAILED" },
    );
  }

  return {
    files,
    inventory,
    discoveredFileCount: files.length,
    sourceUploadCount: uploads.length,
    status: "PACKAGE_READY",
    intake,
    intakeReport,
  };
}

/** Assert no inventory entry disappears between discovery and persisted document rows. */
export function assertPackageInventoryComplete(input: {
  discoveredFileCount: number;
  persistedFileCount: number;
}): void {
  if (input.discoveredFileCount !== input.persistedFileCount) {
    throw new AppError(
      ErrorCode.INTERNAL,
      `Package inventory incomplete: discovered ${input.discoveredFileCount} files but persisted ${input.persistedFileCount}.`,
      500,
      { uploadStage: "UPLOAD_FAILED" },
    );
  }
}
