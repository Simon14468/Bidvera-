/**
 * Map expand/discover AppError uploadStage → intake blocking codes.
 */

import type { IntakeBlockingCode, IntakeFileTerminalState, IntakeWarningCode } from "./types";

export function mapUploadStageToBlockingCode(stage: string | undefined): IntakeBlockingCode {
  switch (stage) {
    case "ARCHIVE_PASSWORD_REQUIRED":
    case "ARCHIVE_WRONG_PASSWORD":
      return "ARCHIVE_PASSWORD_REQUIRED";
    case "ARCHIVE_EXTRACTION_FAILED":
      return "ARCHIVE_CORRUPTED";
    case "UNSUPPORTED_FILE":
      return "UNSUPPORTED_ONLY";
    case "PACKAGE_LIMIT_EXCEEDED":
      return "PACKAGE_LIMIT_EXCEEDED";
    case "UPLOAD_FAILED":
    default:
      return "UPLOAD_FAILED";
  }
}

export function classifyExpandFailureMessage(message: string): {
  state: IntakeFileTerminalState;
  blockingCode: IntakeBlockingCode;
} {
  const m = message.toLowerCase();
  if (/password|encrypted|decrypt/.test(m)) {
    return { state: "PASSWORD_PROTECTED", blockingCode: "ARCHIVE_PASSWORD_REQUIRED" };
  }
  if (/nesting depth|maximum nesting/.test(m)) {
    return { state: "NESTED_ARCHIVE_BLOCKED", blockingCode: "NESTED_ARCHIVE" };
  }
  if (/nested|inner archive|contains another archive/.test(m)) {
    return { state: "NESTED_ARCHIVE_BLOCKED", blockingCode: "NESTED_ARCHIVE" };
  }
  if (/traversal|symlink|bomb|compression ratio|executable|script|dangerous/.test(m)) {
    return { state: "SECURITY_FAILURE", blockingCode: "ARCHIVE_SECURITY_FAILURE" };
  }
  if (/corrupt|invalid|could not|failed to open|unexpected end/.test(m)) {
    return { state: "CORRUPTED", blockingCode: "ARCHIVE_CORRUPTED" };
  }
  if (/empty|does not contain supported|no supported/.test(m)) {
    return { state: "REJECTED_UNSUPPORTED", blockingCode: "NO_ACCEPTED_DOCUMENTS" };
  }
  if (/maximum|limit|exceed/.test(m)) {
    return { state: "REJECTED_TOO_LARGE", blockingCode: "PACKAGE_LIMIT_EXCEEDED" };
  }
  return { state: "CORRUPTED", blockingCode: "UPLOAD_FAILED" };
}

export function isTerminalAccepted(state: IntakeFileTerminalState): boolean {
  return state === "ACCEPTED" || state === "RECOVERABLE";
}

export const OCR_HINT_WARNING: IntakeWarningCode = "OCR_LIKELY_REQUIRED";
