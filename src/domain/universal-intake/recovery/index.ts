/**
 * Universal File Recovery & Readiness layer.
 */

export * from "./types";
export { recoverPdfBytes, sha256Hex } from "./recover-pdf";
export { recoverOoxmlBytes } from "./recover-ooxml";
export { recoverTextEncoding } from "./recover-text";
export { runOcrGate, type IntakeOcrRunner, type IntakeOcrResult } from "./ocr-gate";
export {
  recoverDiscoveredFile,
  recoveryReportForTerminal,
  type RecoverFileInput,
  type RecoverFileOutput,
} from "./recover-file";
