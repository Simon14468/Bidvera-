/**
 * INTERNAL — module-owned pipeline surface.
 * Do not import from outside `@/modules/tender-analysis`.
 * Use the public package entry `@/modules/tender-analysis` instead.
 *
 * Implementations remain at their historical paths; this barrel documents
 * the ownership boundary without relocating production logic or data.
 */

export { processTenderAnalysis } from "@/services/tender-processing";
export {
  uploadAndQueueTenderPackage,
  getTenderAnalysisStatus,
} from "@/application/tender-service";
export {
  TENDER_ANALYSIS_OWNED_PACKAGES,
  TENDER_ANALYSIS_PIPELINE,
  TENDER_ANALYSIS_OWNERSHIP,
} from "../ownership";
