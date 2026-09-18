/**
 * Declares what the Tender Analysis module owns.
 * Domain implementations stay in their historical paths so behavior and data
 * remain unchanged; this map is the architectural ownership boundary.
 */

import { TENDER_ANALYSIS_MODULE_ID } from "./constants";

/** Pipeline stages owned by this module (UDI → … → Certification). */
export const TENDER_ANALYSIS_PIPELINE = [
  "UDI",
  "UTI",
  "STI",
  "Admission",
  "Canonical",
  "Evidence",
  "Risk",
  "Decision",
  "Guardian",
  "Snapshot",
  "Certification",
] as const;

/**
 * Source packages owned by Tender Analysis.
 * New product modules must not import these internals — use `@/modules/tender-analysis`.
 */
export const TENDER_ANALYSIS_OWNED_PACKAGES = [
  "src/domain/document-intelligence",
  "src/domain/universal-intake",
  "src/domain/universal-tender-intelligence",
  "src/domain/semantic-tender-intelligence",
  "src/domain/tender-requirements",
  "src/domain/tender-intelligence",
  "src/domain/tender-package",
  "src/domain/package-identity",
  "src/domain/evidence-intelligence",
  "src/domain/evidence-verification",
  "src/domain/risk",
  "src/domain/decision",
  "src/domain/decision-validation",
  "src/domain/tender-certification",
  "src/domain/analysis-integrity",
  "src/domain/extraction-corpus",
  "src/domain/ai-trust",
  "src/domain/bid-score",
  "src/domain/provenance",
  "src/domain/tender-validity",
  "src/domain/tender-action-plan",
  "src/services/tender-processing",
  "src/services/tender-extraction",
  "src/application/tender-service",
  "src/application/canonical-tender-analysis",
  "src/application/tender-result-page",
  "src/application/tender-detail-from-canonical",
  "src/application/tender-live-status-poll",
  "src/components/tenders",
  "src/app/(app)/tenders",
  "src/app/api/tenders",
] as const;

export const TENDER_ANALYSIS_OWNERSHIP = {
  moduleId: TENDER_ANALYSIS_MODULE_ID,
  pipeline: TENDER_ANALYSIS_PIPELINE,
  ownedPackages: TENDER_ANALYSIS_OWNED_PACKAGES,
} as const;
