/**
 * Match quality states derived from MatchingBehaviorEvent (Feature 8E).
 *
 * Company-scoped only — never closes MatchingOpportunity globally.
 * INTEREST is self-reported intent only — never a verified deal outcome (WON/ACCEPTED).
 * Pipeline states CONTACTED / IN_PROGRESS / WON are outside Matching Engine
 * (CRM / tender outcomes); do not invent them here.
 *
 * Coexistence example for one shared opportunity:
 * Company A INTERESTED, B SEEN, C ENGAGED, D DISMISSED — all valid simultaneously.
 */

export type MatchQualityState =
  | "NONE"
  | "SEEN"
  | "ENGAGED"
  | "INTERESTED"
  | "DISMISSED";

export type MatchingBehaviorEventType =
  | "IMPRESSION"
  | "VIEW"
  | "CLICK"
  | "INTEREST"
  | "DISMISS";

const RANK: Record<MatchQualityState, number> = {
  NONE: 0,
  SEEN: 1,
  ENGAGED: 2,
  INTERESTED: 3,
  DISMISSED: 4,
};

/** Map a single event to its implied quality state. */
export function qualityStateFromEvent(
  eventType: MatchingBehaviorEventType,
): MatchQualityState {
  switch (eventType) {
    case "IMPRESSION":
      return "SEEN";
    case "VIEW":
    case "CLICK":
      return "ENGAGED";
    case "INTEREST":
      return "INTERESTED";
    case "DISMISS":
      return "DISMISSED";
    default:
      return "NONE";
  }
}

/**
 * Monotonic progression except DISMISS, which is terminal for that company.
 * Never invents completed deals or verified business outcomes.
 * Never implies opportunity-level single-winner closure.
 */
export function nextMatchQualityState(
  current: MatchQualityState | null | undefined,
  eventType: MatchingBehaviorEventType,
): MatchQualityState {
  const cur = current ?? "NONE";
  if (cur === "DISMISSED") return "DISMISSED";
  const next = qualityStateFromEvent(eventType);
  if (next === "DISMISSED") return "DISMISSED";
  return RANK[next] >= RANK[cur] ? next : cur;
}
