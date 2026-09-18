/**
 * Stable source-based identity for Tender Action Plan items.
 */

import { createHash } from "node:crypto";
import type { TenderActionItem, TenderActionSourceType } from "./types";

export function buildActionStableId(input: {
  tenderId: string;
  sourceType: TenderActionSourceType;
  sourceId: string;
}): string {
  return createHash("sha256")
    .update(`${input.tenderId}:${input.sourceType}:${input.sourceId}`)
    .digest("hex")
    .slice(0, 16);
}

export function actionDedupeKey(item: Pick<TenderActionItem, "sourceType" | "sourceId">): string {
  return `${item.sourceType}:${item.sourceId}`;
}

/** Merge newly generated items with prior plan — preserve createdAt, resolve stale duplicates. */
export function mergeActionPlanItems(input: {
  tenderId: string;
  generated: TenderActionItem[];
  previous: TenderActionItem[];
  asOf: Date;
}): TenderActionItem[] {
  const prevByKey = new Map(
    input.previous.map((p) => [actionDedupeKey(p), p] as const),
  );
  const seen = new Set<string>();
  const out: TenderActionItem[] = [];

  for (const item of input.generated) {
    const key = actionDedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);

    const prior = prevByKey.get(key);
    if (prior) {
      out.push({
        ...item,
        id: prior.id,
        createdAt: prior.createdAt,
        updatedAt:
          prior.status !== item.status || prior.title !== item.title
            ? input.asOf.toISOString()
            : prior.updatedAt,
      });
      prevByKey.delete(key);
    } else {
      out.push(item);
    }
  }

  // Stale actions whose source no longer generates an item → CANCELLED
  for (const stale of prevByKey.values()) {
    if (stale.status === "COMPLETED" || stale.status === "CANCELLED") {
      out.push(stale);
      continue;
    }
    out.push({
      ...stale,
      status: "CANCELLED",
      description: `${stale.description} (Source resolved or no longer applicable on re-analysis.)`,
      updatedAt: input.asOf.toISOString(),
    });
  }

  return sortActions(out);
}

export function sortActions(items: TenderActionItem[]): TenderActionItem[] {
  const rank: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  const statusRank: Record<string, number> = {
    OPEN: 0,
    IN_PROGRESS: 1,
    EVIDENCE_SUBMITTED: 2,
    AWAITING_VERIFICATION: 3,
    BLOCKED: 4,
    COMPLETED: 5,
    CANCELLED: 6,
  };
  return [...items].sort((a, b) => {
    if (a.simulationOnly !== b.simulationOnly) return a.simulationOnly ? 1 : -1;
    const pr = (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
    if (pr !== 0) return pr;
    const sr = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    if (sr !== 0) return sr;
    return a.title.localeCompare(b.title);
  });
}

export function buildActionPlanContentHash(items: TenderActionItem[]): string {
  const payload = items
    .filter((i) => i.status !== "CANCELLED")
    .map((i) => `${i.sourceType}:${i.sourceId}:${i.status}:${i.priority}`)
    .sort()
    .join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
