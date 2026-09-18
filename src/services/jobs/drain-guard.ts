import { AppError, ErrorCode } from "@/lib/errors";

/** Production must run `npm run worker` — never drain jobs from a web request. */
export function isDrainJobsAllowed(nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv !== "production";
}

export function assertDrainJobsAllowed(nodeEnv = process.env.NODE_ENV): void {
  if (!isDrainJobsAllowed(nodeEnv)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Job drain is disabled in production. Run npm run worker.",
      403,
    );
  }
}
