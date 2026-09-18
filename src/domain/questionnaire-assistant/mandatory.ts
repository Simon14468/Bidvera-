import type { QuestionnaireMandatoryStatus } from "./types";

/**
 * Mandatory only from explicit signals — never from weak words like "should"/"please".
 */
const EXPLICIT_MANDATORY =
  /(?:\*\s*$|\(\*\)|\[\s*required\s*\]|\brequired\s*[.:)]|\bmandatory\b|\bmust\s+(?:be\s+)?(?:provide|complete|answer|fill|attach|submit)\b|\bobligatoire\b|\bobligatory\b)/i;

const EXPLICIT_OPTIONAL =
  /(?:\[\s*optional\s*\]|\boptional\b|\bif\s+applicable\b|\bwhere\s+applicable\b|\bnot\s+mandatory\b|\bfacultatif\b)/i;

export function detectMandatoryStatus(
  text: string,
  structuralContext?: string | null,
): QuestionnaireMandatoryStatus {
  const blob = `${text}\n${structuralContext ?? ""}`;
  if (EXPLICIT_OPTIONAL.test(blob) && !EXPLICIT_MANDATORY.test(blob)) {
    return "OPTIONAL";
  }
  if (EXPLICIT_MANDATORY.test(blob)) {
    return "MANDATORY";
  }
  // Trailing asterisk alone on a prompt line
  if (/\S\s*\*(?:\s|$)/.test(text) || /^\s*\*/.test(text.trim())) {
    return "MANDATORY";
  }
  return "UNKNOWN";
}
