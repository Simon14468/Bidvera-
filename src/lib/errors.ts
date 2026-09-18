import {
  DATABASE_CAPACITY_MESSAGE,
  DATABASE_POOL_MESSAGE,
  isDatabaseCapacityError,
  isDatabasePoolError,
} from "@/lib/db-capacity";

export enum ErrorCode {
  UNAUTHENTICATED = "UNAUTHENTICATED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  VALIDATION = "VALIDATION",
  TRIAL_EXHAUSTED = "TRIAL_EXHAUSTED",
  TRIAL_EXPIRED = "TRIAL_EXPIRED",
  TRIAL_RISK = "TRIAL_RISK",
  CONFLICT = "CONFLICT",
  RATE_LIMITED = "RATE_LIMITED",
  UPSTREAM = "UPSTREAM",
  INTERNAL = "INTERNAL",
}

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const DECISION_GUARDIAN_CLIENT_MESSAGE =
  "This report is not ready to view yet. Please try again shortly.";

export function toSafeClientError(error: unknown): {
  code: string;
  message: string;
  status: number;
  uploadStage?: string;
  userAction?: string;
  fileName?: string;
  retryable?: boolean;
} {
  if (isDatabaseCapacityError(error) && !(error instanceof AppError)) {
    return {
      code: ErrorCode.UPSTREAM,
      message: DATABASE_CAPACITY_MESSAGE,
      status: 503,
    };
  }
  if (isDatabasePoolError(error) && !(error instanceof AppError)) {
    return {
      code: ErrorCode.UPSTREAM,
      message: DATABASE_POOL_MESSAGE,
      status: 503,
      retryable: true,
    };
  }
  if (
    error instanceof Error &&
    error.name === "DecisionGuardianError"
  ) {
    const result =
      "result" in error && error.result && typeof error.result === "object"
        ? (error.result as { blockingFailures?: Array<{ validationCode?: string }> })
        : undefined;
    console.error(
      JSON.stringify({
        level: "error",
        event: "decision_guardian.blocked",
        codes: result?.blockingFailures?.map((f) => f.validationCode).filter(Boolean) ?? [],
        ts: new Date().toISOString(),
      }),
    );
    return {
      code: "DECISION_GUARDIAN_FAILED",
      message: DECISION_GUARDIAN_CLIENT_MESSAGE,
      status: 409,
    };
  }
  if (error instanceof AppError) {
    const details =
      error.details && typeof error.details === "object" && error.details !== null
        ? (error.details as Record<string, unknown>)
        : {};
    const stage =
      "uploadStage" in details ? String(details.uploadStage ?? "") : "";
    const stageCode =
      stage === "ARCHIVE_EXTRACTION_FAILED" ||
      stage === "ARCHIVE_PASSWORD_REQUIRED" ||
      stage === "ARCHIVE_WRONG_PASSWORD" ||
      stage === "UNSUPPORTED_FILE" ||
      stage === "FILE_EXTRACTION_FAILED" ||
      stage === "PACKAGE_LIMIT_EXCEEDED" ||
      stage === "UPLOAD_FAILED" ||
      stage === "PACKAGE_READY" ||
      stage === "ANALYSIS_FAILED"
        ? stage
        : null;
    return {
      code: stageCode ?? error.code,
      message: error.message,
      status: error.status,
      ...(stage ? { uploadStage: stage } : {}),
      ...(typeof details.userAction === "string"
        ? { userAction: details.userAction }
        : {}),
      ...(typeof details.fileName === "string" ? { fileName: details.fileName } : {}),
      ...(typeof details.retryable === "boolean" ? { retryable: details.retryable } : {}),
    };
  }
  return {
    code: ErrorCode.INTERNAL,
    message: "Something went wrong. Please try again.",
    status: 500,
  };
}

/** Re-throw Next.js redirects so try/catch in server actions does not swallow them. */
export function rethrowRedirect(error: unknown): void {
  const digest =
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string"
      ? (error as { digest: string }).digest
      : "";
  if (digest.startsWith("NEXT_REDIRECT")) throw error;
}
