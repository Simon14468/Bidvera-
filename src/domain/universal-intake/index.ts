/**
 * Universal Intake, Recovery & Archive Engine
 * Pre-analysis layer before Document Intelligence / UTI.
 */

export * from "./types";
export * from "./codes";
export * from "./canonical-inventory";
export * from "./classify-upload";
export * from "./format-validate";
export * from "./readiness";
export {
  runUniversalIntake,
  acceptedUploadsFromIntake,
  assertIntakeMayProceed,
} from "./run-intake";
export * from "./archive";
export * from "./recovery";
export * from "./intake-report";
export { persistIntakeReport, loadIntakeReport } from "./persist-intake-report";
