/**
 * Canonical action deduplication — one primary action per canonical item.
 */

import type { TenderActionItem, TenderActionSourceType } from "./types";

export const GENERIC_VERIFICATION_ACTION =
  /^verification required — confirm against company records and tender wording\.?$/i;

export const GENERIC_VERIFY_GAP_ACTION =
  /^verify against company records and tender wording before treating as a gap\.?$/i;

/** Stable semantic action identity: canonicalItemId + actionType + purpose */
export function canonicalActionIdentity(item: Pick<
  TenderActionItem,
  "linkedRequirementId" | "sourceType" | "sourceId" | "title"
>): string {
  const canonicalId = item.linkedRequirementId ?? item.sourceId;
  const purpose =
    item.sourceType === "MISSING_EVIDENCE" ||
    item.sourceType === "UNVERIFIED_EVIDENCE" ||
    item.sourceType === "EXPIRED_EVIDENCE" ||
    item.sourceType === "FAILED_VERIFICATION"
      ? "evidence"
      : item.sourceType === "UNRESOLVED_RISK"
        ? "risk"
        : item.sourceType === "MISSING_MANDATORY_REQUIREMENT"
          ? "compliance-gap"
          : item.sourceType === "READINESS_BLOCKER"
            ? "readiness"
            : item.sourceType;
  return `${canonicalId}:${item.sourceType}:${purpose}`;
}

const PRIMARY_SOURCE_RANK: Record<TenderActionSourceType, number> = {
  DECISION_BLOCKER: 0,
  MISSING_MANDATORY_REQUIREMENT: 1,
  MISSING_EVIDENCE: 2,
  UNVERIFIED_EVIDENCE: 3,
  EXPIRED_EVIDENCE: 4,
  FAILED_VERIFICATION: 5,
  UNRESOLVED_RISK: 6,
  READINESS_BLOCKER: 7,
  COMPANY_FIT_GAP: 8,
  TEAM_VERIFICATION_TASK: 9,
  APPROACHING_DEADLINE: 10,
  DECISION_SIMULATOR: 11,
};

function primaryRank(item: TenderActionItem): number {
  return PRIMARY_SOURCE_RANK[item.sourceType] ?? 20;
}

function isConfirmedBlockingAction(item: TenderActionItem): boolean {
  return (
    item.blocking &&
    (item.sourceType === "DECISION_BLOCKER" ||
      item.sourceType === "MISSING_MANDATORY_REQUIREMENT" ||
      (item.sourceType === "MISSING_EVIDENCE" && item.priority === "CRITICAL"))
  );
}

/**
 * Collapse duplicate actions for the same canonical requirement.
 * Default: ONE unresolved canonical item → ONE primary action.
 */
export function collapsePrimaryActionsPerRequirement(
  items: TenderActionItem[],
): TenderActionItem[] {
  const global: TenderActionItem[] = [];
  const byRequirement = new Map<string, TenderActionItem[]>();

  for (const item of items) {
    if (item.simulationOnly || item.sourceType === "APPROACHING_DEADLINE") {
      global.push(item);
      continue;
    }
    if (!item.linkedRequirementId) {
      global.push(item);
      continue;
    }
    const list = byRequirement.get(item.linkedRequirementId) ?? [];
    list.push(item);
    byRequirement.set(item.linkedRequirementId, list);
  }

  const collapsed: TenderActionItem[] = [...global];

  for (const group of byRequirement.values()) {
    const sorted = [...group].sort((a, b) => primaryRank(a) - primaryRank(b));
    const primary = sorted[0]!;
    const blocking = sorted.some(isConfirmedBlockingAction);
    collapsed.push({
      ...primary,
      blocking,
    });
  }

  return collapsed;
}

export function isGenericVerificationText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return (
    GENERIC_VERIFICATION_ACTION.test(t) ||
    GENERIC_VERIFY_GAP_ACTION.test(t) ||
    /linked requirement/i.test(t) ||
    /^verify evidence\.?$/i.test(t) ||
    /^provide evidence\.?$/i.test(t) ||
    /^resolve linked requirement\.?$/i.test(t)
  );
}

export function dedupeByCanonicalActionIdentity(
  items: TenderActionItem[],
): TenderActionItem[] {
  const seen = new Set<string>();
  const out: TenderActionItem[] = [];
  for (const item of items) {
    const key = canonicalActionIdentity(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
