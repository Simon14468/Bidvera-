export * from "@/domain/evidence-verification/types";
export {
  selectBestEvidenceByRequirement,
  findDuplicateEvidenceAssignments,
  isRealEvidenceText,
} from "@/domain/evidence-verification/select-evidence";
export { runAutomatedEvidenceChecks } from "@/domain/evidence-verification/automated-checks";
export {
  deriveRequirementVerificationStatus,
  formatLocationLabel,
} from "@/domain/evidence-verification/status";
export {
  buildVerificationChains,
  buildVerificationIntelligence,
  type BuildVerificationChainsInput,
} from "@/domain/evidence-verification/build-chains";
export { buildVerificationSeedCandidates } from "@/domain/evidence-verification/seed-tasks";
