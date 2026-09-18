export type * from "./types";
export type * from "./canonical";
export {
  buildTenderIntelligence,
  buildComplianceSummary,
  normalizeComplianceMatrix,
} from "./build";
export { buildHistoricalSignals } from "./canonical";
export type { IntelligenceInput } from "./build";
export {
  assertRequirementCountConsistency,
  snapshotFromComplianceSummary,
  snapshotFromReadiness,
} from "./requirement-count-consistency";
export {
  freezeCanonicalAnalysisSnapshot,
  assertCanonicalSnapshotInvariants,
  attachSnapshotToIntelligence,
  isCanonicalAnalysisSnapshot,
  metricsFromComplianceSummary,
} from "./canonical-snapshot";
export type {
  CanonicalAnalysisSnapshot,
  CanonicalRequirementMetrics,
  CanonicalPackageFileRecord,
} from "./canonical-snapshot";
