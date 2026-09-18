/**
 * Multi-paragraph / page-spanning clause reunification.
 * Never classify an isolated sentence whose meaning depends on neighbours.
 */

import { isObligationBoundaryComplete } from "./boundary";

const ORPHAN_CONDITION_ONLY =
  /^(?:if|unless|when|where(?:\s+applicable)?|only\s+if|provided\s+that|subject\s+to)\b[\s\S]{8,220}$/i;

const ORPHAN_CONDITION_NO_ACTION =
  /^(?:if|unless|when|where(?:\s+applicable)?|only\s+if|provided\s+that|subject\s+to)\b(?![\s\S]{0,200}\b(?:shall|must|is\s+required|are\s+required)\b)[\s\S]{8,180}$/i;

const ACTION_LEAD =
  /^(?:(?:the\s+)?(?:bidder|tenderer|offeror|supplier|consultant)s?\s+)?(?:shall|must|will|is\s+required|are\s+required)\b/i;

const CONTINUATION_LEAD =
  /^(?:and|or|then|the\s+bidder|the\s+tenderer|including|together\s+with|as\s+well\s+as)\b/i;

const ENDS_MID_CLAUSE =
  /(?:shall|must|doit|devra|to|for|with|by|from|on|of|and|or|the|a|an|,|:|;)\s*$/i;

export type ClauseReunification = {
  /** Text used for semantic interpretation after context merge. */
  reunifiedText: string;
  reconstructedFromContext: boolean;
  /** True when an orphan condition could not be attached to an action. */
  orphanConditionUnresolved: boolean;
  /** Preceding/following snippets consumed. */
  consumedPreceding: boolean;
  consumedFollowing: boolean;
};

function clean(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Reunite multi-paragraph / split-page obligation text before interpretation.
 *
 * Patterns handled (universal):
 * - Condition paragraph + action paragraph (AfDB-style)
 * - Incomplete tail + continuation
 * - Action fragment that depends on preceding condition
 */
export function reunifyClauseFromContext(input: {
  text: string;
  precedingText?: string | null;
  followingText?: string | null;
}): ClauseReunification {
  const text = clean(input.text);
  const preceding = clean(input.precedingText);
  const following = clean(input.followingText);

  if (!text) {
    return {
      reunifiedText: "",
      reconstructedFromContext: false,
      orphanConditionUnresolved: false,
      consumedPreceding: false,
      consumedFollowing: false,
    };
  }

  let reunified = text;
  let consumedPreceding = false;
  let consumedFollowing = false;
  let reconstructedFromContext = false;
  let orphanConditionUnresolved = false;

  // 1. Current text is orphan condition → attach following action.
  if (
    (ORPHAN_CONDITION_ONLY.test(text) || ORPHAN_CONDITION_NO_ACTION.test(text)) &&
    following &&
    (ACTION_LEAD.test(following) ||
      /\b(?:bidder|tenderer|offeror)s?\s+(?:shall|must)\b/i.test(following))
  ) {
    reunified = `${text.replace(/[.:;,\s]+$/, "")}, ${following}`.replace(/\s+/g, " ").trim();
    consumedFollowing = true;
    reconstructedFromContext = true;
  }

  // 2. Current text is action / continuation → attach preceding condition.
  if (
    !reconstructedFromContext &&
    preceding &&
    (ORPHAN_CONDITION_ONLY.test(preceding) || ORPHAN_CONDITION_NO_ACTION.test(preceding)) &&
    (ACTION_LEAD.test(text) ||
      /\b(?:bidder|tenderer|offeror)s?\s+(?:shall|must)\b/i.test(text) ||
      CONTINUATION_LEAD.test(text))
  ) {
    reunified = `${preceding.replace(/[.:;,\s]+$/, "")}, ${text}`.replace(/\s+/g, " ").trim();
    consumedPreceding = true;
    reconstructedFromContext = true;
  }

  // 3. Incomplete boundary + following continuation.
  if (
    !isObligationBoundaryComplete(reunified) &&
    following &&
    (CONTINUATION_LEAD.test(following) ||
      ACTION_LEAD.test(following) ||
      /^[a-z]/.test(following))
  ) {
    reunified = `${reunified.replace(/\s+$/, "")} ${following}`.replace(/\s+/g, " ").trim();
    consumedFollowing = true;
    reconstructedFromContext = true;
  }

  // 4. Preceding ends mid-clause + current continues.
  if (
    preceding &&
    ENDS_MID_CLAUSE.test(preceding) &&
    !isObligationBoundaryComplete(preceding) &&
    text.length >= 8
  ) {
    const merged = `${preceding} ${text}`.replace(/\s+/g, " ").trim();
    if (isObligationBoundaryComplete(merged) || merged.length > reunified.length) {
      reunified = merged;
      consumedPreceding = true;
      reconstructedFromContext = true;
    }
  }

  // Orphan condition remains without attachable action → flag (do not invent).
  if (
    (ORPHAN_CONDITION_ONLY.test(text) || ORPHAN_CONDITION_NO_ACTION.test(text)) &&
    !reconstructedFromContext &&
    !/\b(?:shall|must|is\s+required|are\s+required)\b/i.test(text)
  ) {
    orphanConditionUnresolved = true;
  }

  return {
    reunifiedText: reunified,
    reconstructedFromContext,
    orphanConditionUnresolved,
    consumedPreceding,
    consumedFollowing,
  };
}
