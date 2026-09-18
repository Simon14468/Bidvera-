/**
 * Structured conditionality — preserve IF/WHEN/UNLESS/PROVIDED THAT/WHERE APPLICABLE
 * → condition → actor → mandatory action → exception.
 * Never convert conditional / unknown applicability into unconditional.
 */

import type { ApplicabilityKind, StructuredConditionality } from "./types";

const CONDITION_LEAD =
  /\b((?:if|unless|when|where(?:\s+applicable)?|only\s+if|provided\s+that|subject\s+to|in\s+(?:the\s+)?case(?:\s+of)?|depending\s+on|alternatively|le\s+cas\s+[eé]ch[eé]ant|sous\s+reserve)[^.;]{0,240})/i;

const ACTION_AFTER_CONDITION =
  /(?:,|;|\.)\s*((?:the\s+)?(?:bidder|tenderer|offeror|supplier|contractor|consultant)s?\s+(?:shall|must|will|is\s+required|are\s+required)[^.]{8,280})/i;

const ACTION_STANDALONE =
  /\b((?:the\s+)?(?:bidder|tenderer|offeror|supplier|consultant)s?\s+(?:shall|must|will|is\s+required|are\s+required)[^.]{8,280})/i;

const THRESHOLD =
  /\b((?:at\s+least|minimum|not\s+less\s+than|no\s+fewer\s+than|equal\s+to|up\s+to|capped\s+at)\s+[^,.;]{2,80})/i;

const EXCEPTION =
  /\b((?:except(?:\s+that|\s+where|\s+for)?|excluding|other\s+than|unless\s+otherwise)[^,.;]{3,120})/i;

const TIMEFRAME =
  /\b((?:within\s+\d+\s+(?:calendar\s+|working\s+)?days?|not\s+later\s+than[^,.;]{3,60}|by\s+\d{1,2}\s+\w+\s+\d{4}|during\s+the\s+(?:bid|tender|contract)\s+period)[^,.;]{0,40})/i;

const SCOPE =
  /\b((?:for\s+(?:all\s+)?lots?|lot\s+\d+|throughout\s+the\s+(?:contract|project)|in\s+respect\s+of[^,.;]{3,60}))/i;

const UNRESOLVED_META =
  /\bif\s+(?:a|the)\s+.{0,40}\b(?:is|are)\s+mandatory\b|\bunless\s+(?:otherwise\s+)?(?:specified|stated|indicated)\b|\bif\s+required\s+by\s+the\s+(?:purchaser|authority|employer)\b|\bto\s+be\s+confirmed\s+in\s+the\s+(?:bds|tds|tender\s+particulars)\b/i;

const SOFT_CONDITIONAL =
  /\b(?:if\s+applicable|where\s+applicable|as\s+applicable|le\s+cas\s+[eé]ch[eé]ant)\b/i;

export function analyzeConditionality(text: string): StructuredConditionality {
  const t = text.replace(/\s+/g, " ").trim();
  const conditionMatch = t.match(CONDITION_LEAD);
  const conditionText = conditionMatch?.[1]?.trim() ?? null;

  let actionText: string | null = null;
  const afterCond = t.match(ACTION_AFTER_CONDITION);
  if (afterCond?.[1]) {
    actionText = afterCond[1].trim();
  } else {
    const stand = t.match(ACTION_STANDALONE);
    if (stand?.[1]) actionText = stand[1].trim();
  }

  const thresholdText = t.match(THRESHOLD)?.[1]?.trim() ?? null;
  const exceptionText = t.match(EXCEPTION)?.[1]?.trim() ?? null;
  const timeframeText = t.match(TIMEFRAME)?.[1]?.trim() ?? null;
  const scopeText = t.match(SCOPE)?.[1]?.trim() ?? null;

  const hasConditionalCue =
    Boolean(conditionText) || SOFT_CONDITIONAL.test(t) || UNRESOLVED_META.test(t);

  // Soft "if/where applicable" is CONDITIONAL with preserved condition — not unresolved.
  // Unresolved = applicability depends on unknown tender particulars.
  const unresolved =
    UNRESOLVED_META.test(t) &&
    !/\bif\s+the\s+(?:bidder|tenderer|offeror)\b/i.test(t) &&
    !/\bwhen\s+the\s+(?:bidder|tenderer|offeror)\b/i.test(t) &&
    !/\bwhere\s+the\s+(?:bidder|tenderer|offeror)\b/i.test(t) &&
    !SOFT_CONDITIONAL.test(t);

  // Condition present without attachable action → keep conditional/verification, never unconditional.
  const orphanCondition =
    Boolean(conditionText) &&
    !actionText &&
    !/\b(?:shall|must|is\s+required|are\s+required)\b/i.test(t);

  let applicability: ApplicabilityKind = "UNCONDITIONAL";
  if (unresolved || orphanCondition) {
    applicability = "NEEDS_VERIFICATION";
  } else if (SOFT_CONDITIONAL.test(t) || hasConditionalCue) {
    applicability = "CONDITIONAL";
  }

  if (/\b(?:optional|if\s+desired|at\s+the\s+bidder'?s\s+option)\b/i.test(t)) {
    applicability = "OPTIONAL";
  }

  // Hard invariant: never report UNCONDITIONAL when a condition cue exists.
  if (
    applicability === "UNCONDITIONAL" &&
    (conditionText || SOFT_CONDITIONAL.test(t) || UNRESOLVED_META.test(t))
  ) {
    applicability = unresolved ? "NEEDS_VERIFICATION" : "CONDITIONAL";
  }

  return {
    applicability,
    conditionText:
      conditionText ??
      (SOFT_CONDITIONAL.test(t)
        ? t.match(SOFT_CONDITIONAL)?.[0] ?? "if applicable"
        : unresolved || orphanCondition
          ? "unresolved conditional applicability"
          : null),
    actionText,
    thresholdText,
    exceptionText,
    timeframeText,
    scopeText,
    unresolved: unresolved || orphanCondition,
  };
}

/**
 * Full requirement text preserving condition + action (never strip IF clause).
 */
export function preserveConditionalRequirementText(
  original: string,
  conditionality: StructuredConditionality,
): string {
  const t = original.replace(/\s+/g, " ").trim();
  if (
    (conditionality.applicability === "CONDITIONAL" ||
      conditionality.applicability === "NEEDS_VERIFICATION") &&
    conditionality.conditionText &&
    conditionality.actionText &&
    !t.toLowerCase().includes(conditionality.conditionText.slice(0, 16).toLowerCase())
  ) {
    return `${conditionality.conditionText}, ${conditionality.actionText}`
      .replace(/\s+/g, " ")
      .trim();
  }
  return t;
}
