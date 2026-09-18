import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const LOAD_TEST_REPORT_DEFAULT = path.join(
  process.cwd(),
  ".data",
  "load-test",
  "latest-report.json",
);

export const loadTestReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  environment: z.string(),
  baseUrl: z.string(),
  concurrentUsersTarget: z.number().int().positive(),
  concurrentUsersReached: z.number().int().nonnegative(),
  holdSeconds: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  http: z.object({
    requests: z.number().nonnegative(),
    failed: z.number().nonnegative(),
    errorRate: z.number().nonnegative(),
    rpsPeak: z.number().nonnegative(),
    rpsAvg: z.number().nonnegative(),
    p50Ms: z.number().nonnegative(),
    p95Ms: z.number().nonnegative(),
    p99Ms: z.number().nonnegative(),
    status4xx: z.number().nonnegative(),
    status5xx: z.number().nonnegative(),
    timeouts: z.number().nonnegative(),
  }),
  thresholds: z.object({
    errorRateMax: z.number(),
    p95MsMax: z.number(),
    p99MsMax: z.number(),
  }),
  bottlenecks: z.array(z.string()),
  recommendedResources: z.array(z.string()),
  notes: z.array(z.string()).default([]),
  verdict: z.enum(["PASS", "WARNING", "FAIL", "NOT_RUN"]),
});

export type LoadTestReport = z.infer<typeof loadTestReportSchema>;

export function resolveLoadTestReportPath(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.LOAD_TEST_REPORT_PATH?.trim() || LOAD_TEST_REPORT_DEFAULT;
}

export function evaluateLoadTestVerdict(report: Omit<LoadTestReport, "verdict">): LoadTestReport["verdict"] {
  const { http, thresholds, concurrentUsersTarget, concurrentUsersReached } = report;
  if (concurrentUsersReached < concurrentUsersTarget) {
    return "FAIL";
  }
  if (http.errorRate > thresholds.errorRateMax) return "FAIL";
  if (http.status5xx > 0 && http.status5xx / Math.max(http.requests, 1) > 0.005) {
    return "FAIL";
  }
  if (http.p95Ms > thresholds.p95MsMax || http.p99Ms > thresholds.p99MsMax) {
    return "WARNING";
  }
  if (http.errorRate > thresholds.errorRateMax * 0.5) return "WARNING";
  return "PASS";
}

export async function readLoadTestReport(
  filePath = resolveLoadTestReportPath(),
): Promise<LoadTestReport | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = loadTestReportSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/** Public Super Admin DTO — never includes session tokens or DB URLs. */
export function toPublicLoadTestSnapshot(report: LoadTestReport | null) {
  if (!report) {
    return {
      available: false as const,
      verdict: "NOT_RUN" as const,
      message: "No load-test report found. Run the dedicated Docker + k6 suite first.",
    };
  }
  return {
    available: true as const,
    verdict: report.verdict,
    testDate: report.generatedAt,
    environment: report.environment,
    concurrentUsers: report.concurrentUsersReached,
    concurrentUsersTarget: report.concurrentUsersTarget,
    peakRps: report.http.rpsPeak,
    avgRps: report.http.rpsAvg,
    p50Ms: report.http.p50Ms,
    p95Ms: report.http.p95Ms,
    p99Ms: report.http.p99Ms,
    errorRate: report.http.errorRate,
    failedRequests: report.http.failed,
    status4xx: report.http.status4xx,
    status5xx: report.http.status5xx,
    timeouts: report.http.timeouts,
    bottlenecks: report.bottlenecks,
    recommendedResources: report.recommendedResources,
    notes: report.notes,
    thresholds: report.thresholds,
    holdSeconds: report.holdSeconds,
  };
}
