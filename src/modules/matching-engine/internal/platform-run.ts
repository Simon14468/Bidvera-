/**
 * Platform-wide Matching run state + exclusive lock (Super Admin Enable / Run Now).
 * Canonical Matching enable flag remains Feature.enabledGlobal (matching_engine).
 */

import { AppError, ErrorCode } from "@/lib/errors";
import { getSetting, setSetting } from "@/services/settings";
import { z } from "zod";

export const MATCHING_PLATFORM_RUN_SETTINGS_KEY = "matching.platform.run";

const PLATFORM_LOCK_TTL_MS = 15 * 60_000;

export const matchingPlatformRunStatusSchema = z.enum([
  "idle",
  "running",
  "completed",
  "failed",
]);

export type MatchingPlatformRunStatus = z.infer<
  typeof matchingPlatformRunStatusSchema
>;

export const matchingPlatformRunSummarySchema = z.object({
  ingestRan: z.boolean().optional(),
  ingestSkippedReason: z.string().max(400).nullable().optional(),
  opportunitiesUpserted: z.number().int().nonnegative().optional(),
  opportunitiesCreated: z.number().int().nonnegative().optional(),
  opportunitiesUpdated: z.number().int().nonnegative().optional(),
  companiesProcessed: z.number().int().nonnegative().default(0),
  companiesSucceeded: z.number().int().nonnegative().default(0),
  companiesFailed: z.number().int().nonnegative().default(0),
  recommendationsWritten: z.number().int().nonnegative().default(0),
});

export type MatchingPlatformRunSummary = z.infer<
  typeof matchingPlatformRunSummarySchema
>;

export const matchingPlatformRunStateSchema = z.object({
  status: matchingPlatformRunStatusSchema.default("idle"),
  lockToken: z.string().nullable().default(null),
  lockUntil: z.number().int().nullable().default(null),
  lastRunAt: z.string().datetime().nullable().default(null),
  lastSuccessAt: z.string().datetime().nullable().default(null),
  lastOpportunityRefreshAt: z.string().datetime().nullable().default(null),
  lastErrorSafe: z.string().max(400).nullable().default(null),
  lastSummary: matchingPlatformRunSummarySchema.nullable().default(null),
});

export type MatchingPlatformRunState = z.infer<
  typeof matchingPlatformRunStateSchema
>;

export const DEFAULT_MATCHING_PLATFORM_RUN_STATE: MatchingPlatformRunState = {
  status: "idle",
  lockToken: null,
  lockUntil: null,
  lastRunAt: null,
  lastSuccessAt: null,
  lastOpportunityRefreshAt: null,
  lastErrorSafe: null,
  lastSummary: null,
};

function sanitizeError(message: string): string {
  return message.replace(/\s+/g, " ").trim().slice(0, 400);
}

export async function getMatchingPlatformRunState(): Promise<MatchingPlatformRunState> {
  const raw = await getSetting<unknown>(
    MATCHING_PLATFORM_RUN_SETTINGS_KEY,
    DEFAULT_MATCHING_PLATFORM_RUN_STATE,
  );
  const parsed = matchingPlatformRunStateSchema.safeParse(raw);
  if (!parsed.success) return { ...DEFAULT_MATCHING_PLATFORM_RUN_STATE };

  const state = parsed.data;
  const now = Date.now();
  if (
    state.status === "running" &&
    typeof state.lockUntil === "number" &&
    state.lockUntil <= now
  ) {
    const recovered: MatchingPlatformRunState = {
      ...state,
      status: "failed",
      lockToken: null,
      lockUntil: null,
      lastErrorSafe: "Previous Matching run timed out or was interrupted.",
    };
    await setSetting(MATCHING_PLATFORM_RUN_SETTINGS_KEY, recovered);
    return recovered;
  }
  return state;
}

export async function saveMatchingPlatformRunState(
  state: MatchingPlatformRunState,
): Promise<MatchingPlatformRunState> {
  const parsed = matchingPlatformRunStateSchema.parse(state);
  await setSetting(MATCHING_PLATFORM_RUN_SETTINGS_KEY, parsed);
  return parsed;
}

/** Acquire exclusive platform Matching lock. Throws CONFLICT if another run is active. */
export async function acquireMatchingPlatformRunLock(): Promise<string> {
  const token = crypto.randomUUID();
  const now = Date.now();
  const existing = await getMatchingPlatformRunState();

  if (
    existing.status === "running" &&
    typeof existing.lockUntil === "number" &&
    existing.lockUntil > now &&
    existing.lockToken
  ) {
    throw new AppError(
      ErrorCode.CONFLICT,
      "A Matching platform run is already in progress.",
      409,
    );
  }

  await saveMatchingPlatformRunState({
    ...existing,
    status: "running",
    lockToken: token,
    lockUntil: now + PLATFORM_LOCK_TTL_MS,
    lastRunAt: new Date().toISOString(),
    lastErrorSafe: null,
  });
  return token;
}

export async function completeMatchingPlatformRun(input: {
  token: string;
  summary: MatchingPlatformRunSummary;
  opportunityRefreshed: boolean;
}): Promise<MatchingPlatformRunState> {
  const cur = await getMatchingPlatformRunState();
  if (cur.lockToken !== input.token) {
    throw new AppError(
      ErrorCode.CONFLICT,
      "Matching platform lock was lost or stolen.",
      409,
    );
  }
  const nowIso = new Date().toISOString();
  return saveMatchingPlatformRunState({
    ...cur,
    status: "completed",
    lockToken: null,
    lockUntil: null,
    lastSuccessAt: nowIso,
    lastOpportunityRefreshAt: input.opportunityRefreshed
      ? nowIso
      : cur.lastOpportunityRefreshAt,
    lastErrorSafe: null,
    lastSummary: input.summary,
  });
}

export async function failMatchingPlatformRun(input: {
  token: string;
  error: string;
  summary?: MatchingPlatformRunSummary | null;
}): Promise<MatchingPlatformRunState> {
  const cur = await getMatchingPlatformRunState();
  if (cur.lockToken && cur.lockToken !== input.token) {
    return cur;
  }
  return saveMatchingPlatformRunState({
    ...cur,
    status: "failed",
    lockToken: null,
    lockUntil: null,
    lastErrorSafe: sanitizeError(input.error),
    lastSummary: input.summary ?? cur.lastSummary,
  });
}
