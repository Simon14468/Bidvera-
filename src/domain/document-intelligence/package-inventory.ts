/**
 * One logical TenderPackage inventory — no silent drops.
 */

import type {
  DocumentExtractionQualityState,
  DocumentFormatId,
  UniversalDocumentInventoryRecord,
  UniversalDocumentPackageModel,
} from "./types";
import { rollupPackageQuality } from "./quality";

export function buildUniversalDocumentPackage(input: {
  packageLabel: string;
  documents: Array<{
    fileId: string;
    originalName: string;
    mimeType?: string | null;
    format?: DocumentFormatId | null;
    source?: "loose" | "zip" | "rar" | "unknown";
    archivePath?: string | null;
    archiveFileName?: string | null;
    discoveryId?: string | null;
    documentRole?: string | null;
    language?: string | null;
    sizeBytes?: number | null;
    pageOrSheetCount?: number | null;
    extractionMethod?: string | null;
    extractionStatus: UniversalDocumentInventoryRecord["extractionStatus"];
    readability: DocumentExtractionQualityState;
    ocrStatus?: UniversalDocumentInventoryRecord["ocrStatus"];
    versionRevision?: string | null;
    failureMessage?: string | null;
  }>;
}): UniversalDocumentPackageModel {
  const inventory: UniversalDocumentInventoryRecord[] = input.documents.map((d) => ({
    fileId: d.fileId,
    originalName: d.originalName,
    mimeType: d.mimeType ?? null,
    format: d.format ?? "unknown",
    source: d.source ?? "unknown",
    archivePath: d.archivePath ?? null,
    documentRole: d.documentRole ?? null,
    language: d.language ?? null,
    sizeBytes: d.sizeBytes ?? null,
    pageOrSheetCount: d.pageOrSheetCount ?? null,
    extractionMethod: d.extractionMethod ?? null,
    extractionStatus: d.extractionStatus,
    readability: d.readability,
    ocrStatus: d.ocrStatus ?? "UNKNOWN",
    versionRevision: d.versionRevision ?? null,
    provenance: {
      archiveFileName: d.archiveFileName ?? null,
      discoveryId: d.discoveryId ?? null,
    },
    failureMessage: d.failureMessage ?? null,
  }));

  // Invariant: every input document must appear
  if (inventory.length !== input.documents.length) {
    throw new Error("UDI inventory length mismatch — silent drop detected");
  }

  const ids = new Set<string>();
  for (const row of inventory) {
    if (ids.has(row.fileId)) throw new Error(`Duplicate fileId in package inventory: ${row.fileId}`);
    ids.add(row.fileId);
    if (
      (row.extractionStatus === "FILE_EXTRACTION_FAILED" ||
        row.extractionStatus === "UNSUPPORTED_SKIPPED" ||
        row.extractionStatus === "UNREADABLE") &&
      !row.failureMessage &&
      row.readability === "VALID"
    ) {
      throw new Error(`Failed document must not be marked VALID: ${row.originalName}`);
    }
  }

  const extractedOkCount = inventory.filter((d) => d.extractionStatus === "EXTRACTED").length;
  const failedCount = inventory.filter(
    (d) =>
      d.extractionStatus === "FILE_EXTRACTION_FAILED" || d.extractionStatus === "UNREADABLE",
  ).length;
  const unsupportedCount = inventory.filter(
    (d) => d.extractionStatus === "UNSUPPORTED_SKIPPED",
  ).length;

  return {
    version: "universal-document-intelligence/v1",
    packageLabel: input.packageLabel,
    inventory,
    inventoryCount: inventory.length,
    extractedOkCount,
    failedCount,
    unsupportedCount,
    qualityState: rollupPackageQuality(inventory.map((d) => d.readability)),
  };
}

export function assertNoSilentDrops(
  discoveredCount: number,
  packageModel: UniversalDocumentPackageModel,
): void {
  if (packageModel.inventoryCount !== discoveredCount) {
    throw new Error(
      `Silent drop detected: discovered=${discoveredCount} inventory=${packageModel.inventoryCount}`,
    );
  }
}
