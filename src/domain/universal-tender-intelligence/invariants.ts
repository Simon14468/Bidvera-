/**
 * UTI architectural invariants — future changes must not silently break the layer.
 */

import type { UniversalTenderPackage } from "./types";
import type { ClassifiedContentUnit } from "./types";

export function assertUtiPackageInvariants(pkg: UniversalTenderPackage): void {
  if (pkg.version !== "universal-tender-intelligence/v1") {
    throw new Error(`Unexpected UTI version: ${pkg.version}`);
  }
  if (pkg.inventoryCount !== pkg.documents.length) {
    throw new Error("UTI inventoryCount must equal documents.length — no silent drops");
  }
  const accounted =
    pkg.extractedOkCount +
    pkg.failedCount +
    pkg.unsupportedCount +
    pkg.documents.filter(
      (d) =>
        d.extractionStatus !== "EXTRACTED" &&
        d.extractionStatus !== "FILE_EXTRACTION_FAILED" &&
        d.extractionStatus !== "UNREADABLE" &&
        d.extractionStatus !== "UNSUPPORTED_SKIPPED",
    ).length;
  if (accounted < pkg.inventoryCount) {
    // Soft check: other statuses (DISCOVERED/STORED) still count in inventory
  }
  for (const d of pkg.documents) {
    if (
      (d.extractionStatus === "FILE_EXTRACTION_FAILED" ||
        d.extractionStatus === "UNSUPPORTED_SKIPPED" ||
        d.readability === "UNREADABLE") &&
      !d.failureCode
    ) {
      throw new Error(`Failed/unreadable document must carry failureCode: ${d.originalFileName}`);
    }
  }
  // Duplicate fileIds forbidden
  const ids = new Set<string>();
  for (const d of pkg.documents) {
    if (ids.has(d.fileId)) throw new Error(`Duplicate UTI fileId: ${d.fileId}`);
    ids.add(d.fileId);
  }
}

export function assertSemanticAdmissionInvariants(units: ClassifiedContentUnit[]): void {
  for (const u of units) {
    if (u.admitToRequirements) {
      if (u.contentType === "AUTHORITY_OBLIGATION") {
        throw new Error("Authority obligation must not admit to bidder requirements");
      }
      if (u.contentType === "SECTION_HEADING") {
        throw new Error("Section heading must not admit to requirements");
      }
      if (u.contentType === "DOCUMENT_DESCRIPTION") {
        throw new Error("Document description must not admit to requirements");
      }
      if (u.contentType === "Q_AND_A" || u.contentType === "CLARIFICATION") {
        throw new Error("Q&A/clarification must not admit as requirement by default");
      }
      if (u.contentType === "REVISION" || u.contentType === "ADDENDUM") {
        throw new Error("Revision metadata must not admit as requirement");
      }
      if (u.failureCodes.includes("INCOMPLETE_FRAGMENT")) {
        throw new Error("Incomplete fragment must not admit to requirements");
      }
      if (u.conditional && !u.conditionText) {
        throw new Error("Conditional obligation must preserve condition text");
      }
    }
  }
}
