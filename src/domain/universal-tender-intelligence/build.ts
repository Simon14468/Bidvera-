/**
 * Build Universal Tender Package — authoritative package representation
 * before Requirement Intelligence / Decision / Risk.
 */

import type { CanonicalPackageMetadata } from "@/domain/tender-package/package-metadata";
import { aggregatePackageMetadata } from "@/domain/tender-package/package-metadata";
import { classifyUniversalDocumentRole, versionRank } from "./document-role";
import { buildDocumentVersionGraph, detectDocumentRelation } from "./version-graph";
import type {
  ExtractionLifecycleStatus,
  UniversalDocumentRecord,
  UniversalTenderIntelligenceSummary,
  UniversalTenderPackage,
  UtiQualityIssue,
} from "./types";

export type UtiBuildInputPart = {
  fileId: string;
  fileName: string;
  originalFileName?: string | null;
  mimeType?: string | null;
  documentKind?: string | null;
  text: string;
  pageCount?: number | null;
  extractionMethod?: string | null;
  extractionStatus?: ExtractionLifecycleStatus;
  ocrUsed?: boolean;
  archiveSource?: "loose" | "zip" | "rar" | "unknown";
  archiveFileName?: string | null;
  archivePath?: string | null;
  error?: string | null;
};

export function buildUniversalTenderPackage(input: {
  packageLabel: string;
  parts: UtiBuildInputPart[];
  /** Optional pre-aggregated metadata; otherwise derived from parts when extract hooks provided. */
  metadata?: CanonicalPackageMetadata | null;
  metadataSources?: Array<{
    fileName: string;
    text: string;
    extraction: {
      title: string | null;
      client: string | null;
      region: string | null;
      deadlineIso: string | null;
      deadlineTimezone: string | null;
      deadlineEvidence: string | null;
      deadlineLocalHour: number | null;
      deadlineLocalMinute: number | null;
      estimatedValue: number | null;
      reference: string | null;
    };
  }>;
}): UniversalTenderPackage {
  const documents: UniversalDocumentRecord[] = [];
  const qualityIssues: UtiQualityIssue[] = [];

  for (const part of input.parts) {
    const classified = classifyUniversalDocumentRole({
      text: part.text,
      fileName: part.originalFileName ?? part.fileName,
    });
    const textLen = part.text?.trim().length ?? 0;
    let status: ExtractionLifecycleStatus =
      part.extractionStatus ?? (textLen >= 40 ? "EXTRACTED" : "UNREADABLE");
    if (part.error && /unsupported/i.test(part.error)) status = "UNSUPPORTED_SKIPPED";
    else if (part.error) status = "FILE_EXTRACTION_FAILED";

    let readability: UniversalDocumentRecord["readability"] = "READABLE";
    if (textLen < 40) readability = "UNREADABLE";
    else if (textLen < 200) readability = "PARTIAL";

    let failureCode: UniversalDocumentRecord["failureCode"] = null;
    const failureMessage: string | null = part.error ?? null;
    if (status === "FILE_EXTRACTION_FAILED") {
      failureCode = "EXTRACTION_FAILED";
      qualityIssues.push({
        code: "EXTRACTION_FAILED",
        message: failureMessage ?? "Extraction failed",
        fileId: part.fileId,
        fileName: part.fileName,
      });
    } else if (status === "UNSUPPORTED_SKIPPED") {
      failureCode = "UNSUPPORTED_SKIPPED";
      qualityIssues.push({
        code: "UNSUPPORTED_SKIPPED",
        message: failureMessage ?? "Unsupported format",
        fileId: part.fileId,
        fileName: part.fileName,
      });
    } else if (readability === "UNREADABLE") {
      failureCode = "DOCUMENT_UNREADABLE";
      qualityIssues.push({
        code: "DOCUMENT_UNREADABLE",
        message: "Document text empty or too short after extraction",
        fileId: part.fileId,
        fileName: part.fileName,
      });
    }

    documents.push({
      fileId: part.fileId,
      originalFileName: part.originalFileName ?? part.fileName,
      mimeType: part.mimeType ?? null,
      archiveProvenance: {
        source: part.archiveSource ?? "unknown",
        archiveFileName: part.archiveFileName ?? null,
        archivePath: part.archivePath ?? null,
      },
      universalRole: classified.role,
      legacyRole: classified.legacyRole,
      roleConfidence: classified.confidence,
      roleSignals: classified.signals,
      language: detectLanguageHint(part.text),
      pageOrSheetCount: part.pageCount ?? null,
      extractionMethod: part.extractionMethod ?? null,
      extractionStatus: status,
      ocrStatus: part.ocrUsed ? "USED" : textLen > 0 ? "NOT_NEEDED" : "UNKNOWN",
      readability,
      revisionLabel: detectRevisionLabel(part.fileName, part.text),
      documentDate: null,
      textLength: textLen,
      failureCode,
      failureMessage,
    });
  }

  const versionEdges = buildDocumentVersionGraph(
    input.parts.map((p, i) => ({
      fileId: p.fileId,
      fileName: p.fileName,
      role: documents[i]!.universalRole,
      text: p.text,
    })),
  );

  for (const edge of versionEdges) {
    if (edge.conflict) {
      qualityIssues.push({
        code: "CONFLICTING_VERSION",
        message: edge.evidence,
        fileId: edge.fromFileId,
        fileName: documents.find((d) => d.fileId === edge.fromFileId)?.originalFileName ?? null,
      });
    }
    if (edge.relation === "DUPLICATE") {
      qualityIssues.push({
        code: "DUPLICATE_IDENTITY",
        message: edge.evidence,
        fileId: edge.fromFileId,
        fileName: null,
      });
    }
  }

  const metadata =
    input.metadata ??
    (input.metadataSources && input.metadataSources.length > 0
      ? aggregatePackageMetadata(input.metadataSources)
      : null);

  const metadataConflicts: string[] = [];
  if (metadata) {
    for (const [key, field] of Object.entries(metadata)) {
      if (field && typeof field === "object" && "status" in field && field.status === "CONFLICT") {
        metadataConflicts.push(key);
      }
    }
  }

  const orderedParts = [...input.parts]
    .map((p, i) => {
      const doc = documents[i]!;
      return {
        fileId: p.fileId,
        fileName: p.fileName,
        documentKind: p.documentKind ?? "TENDER",
        text: p.text,
        universalRole: doc.universalRole,
        legacyRole: doc.legacyRole,
        versionStatus: detectDocumentRelation({
          fileName: p.fileName,
          role: doc.universalRole,
          text: p.text,
        }),
        _rank: versionRank(doc.universalRole),
      };
    })
    .sort((a, b) => a._rank - b._rank)
    .map((row) => ({
      fileId: row.fileId,
      fileName: row.fileName,
      documentKind: row.documentKind,
      text: row.text,
      universalRole: row.universalRole,
      legacyRole: row.legacyRole,
      versionStatus: row.versionStatus,
    }));

  const extractedOkCount = documents.filter((d) => d.extractionStatus === "EXTRACTED").length;
  const failedCount = documents.filter(
    (d) =>
      d.extractionStatus === "FILE_EXTRACTION_FAILED" || d.extractionStatus === "UNREADABLE",
  ).length;
  const unsupportedCount = documents.filter(
    (d) => d.extractionStatus === "UNSUPPORTED_SKIPPED",
  ).length;

  return {
    version: "universal-tender-intelligence/v1",
    packageLabel: input.packageLabel,
    documents,
    inventoryCount: documents.length,
    extractedOkCount,
    failedCount,
    unsupportedCount,
    versionEdges,
    metadata,
    metadataConflicts,
    qualityIssues,
    orderedParts,
  };
}

export function toUtiSummary(pkg: UniversalTenderPackage): UniversalTenderIntelligenceSummary {
  return {
    version: pkg.version,
    inventoryCount: pkg.inventoryCount,
    extractedOkCount: pkg.extractedOkCount,
    failedCount: pkg.failedCount,
    unsupportedCount: pkg.unsupportedCount,
    roles: pkg.documents.map((d) => ({
      fileName: d.originalFileName,
      role: d.universalRole,
      legacyRole: d.legacyRole,
    })),
    versionEdges: pkg.versionEdges.length,
    metadataConflicts: pkg.metadataConflicts,
    qualityIssueCodes: [...new Set(pkg.qualityIssues.map((q) => q.code))],
  };
}

function detectLanguageHint(text: string): string | null {
  if (!text.trim()) return null;
  const sample = text.slice(0, 3_000);
  const fr = (sample.match(/\b(le|la|les|des|une|est|doit|soumissionnaire|march[eé])\b/gi) ?? [])
    .length;
  const en = (sample.match(/\b(the|and|shall|must|bidder|tender|contractor)\b/gi) ?? []).length;
  if (fr > en * 1.2 && fr > 8) return "fr";
  if (en > fr * 1.2 && en > 8) return "en";
  if (fr > 5 && en > 5) return "mixed";
  return null;
}

function detectRevisionLabel(fileName: string, text: string): string | null {
  const m =
    fileName.match(/\b(rev(?:ision)?[\s._-]?\d+|v\d+|corrigendum\s*\d*|addendum\s*\d*)\b/i) ??
    text.slice(0, 2_000).match(/\b(corrigendum\s*\d*|addendum\s*\d*|revision\s*\d+)\b/i);
  return m?.[1]?.replace(/\s+/g, " ").trim() ?? null;
}
